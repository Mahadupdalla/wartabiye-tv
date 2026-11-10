import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { articleUrl } from '../../lib/config';
import { catName, fullDate, ago } from '../../lib/i18n';
import { cardOf } from '../../lib/api';
import type { Article, Lang } from '../../lib/types';
import { LANG_INFO, LANGS } from '../../lib/types';
import { ArticleRow, isBreaking } from '../../components/cards';
import { AdSlot } from '../../components/ads';
import { Notice, Photo, Pill, Row, Skeleton, T } from '../../components/ui';

export default function ArticleScreen() {
  const p = useLocalSearchParams<{ id: string; rev?: string }>();
  const id = String(p.id || '').replace(/\.html$/, '');
  const { colors, t, lang, rtl, fontSize, setFontSize, setLang } = useSettings();
  const { getArticle, items, isSaved, toggleSaved, offline } = useContent();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [showSo, setShowSo] = useState(false);
  // the newest rev the website published for this article: an edit in /admin/ reloads the open article
  const { published } = useContent();
  const rev = items.find(c => c.id === id)?.rev || published?.get(id) || (p.rev as string | undefined);

  const loadIt = useCallback(async () => {
    setFailed(false);
    try {
      const r = await getArticle(id, { rev });
      setArticle(r.article);
      setFromCache(r.fromCache);
    } catch (e) {
      setFailed(true);
    }
  }, [getArticle, id, rev]);
  useEffect(() => { loadIt(); }, [loadIt]);
  useEffect(() => { setShowSo(false); }, [id, lang]);

  const viewLang: Lang = showSo ? 'so' : lang;
  const tx = article?.tr[viewLang];
  const card = useMemo(() => (article ? cardOf(article, article.tr[lang] ? lang : 'so') : null), [article, lang]);
  const related = useMemo(() => {
    if (!article) return [];
    return items.filter(c => c.id !== article.id && !c.sponsored && c.section === article.section && (c.category === article.category || c.section !== 'somalia')).slice(0, 4);
  }, [items, article]);

  const share = async (how: 'any' | 'whatsapp' | 'facebook') => {
    if (!article) return;
    const url = articleUrl(article.id);
    const title = (tx || article.tr.so)?.title || '';
    if (how === 'whatsapp') return Linking.openURL('https://wa.me/?text=' + encodeURIComponent(title + ' — Wartabiye TV ' + url));
    if (how === 'facebook') return Linking.openURL('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url));
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !(navigator as any).share) { await (navigator as any).clipboard?.writeText(url); return; }
      await Share.share(Platform.OS === 'ios' ? { message: title, url } : { message: title + '\n' + url, title });
    } catch (e) { /* cancelled */ }
  };

  // opened from a link or a notification with nothing behind it: offer the way home
  const navigation = useNavigation();
  const headerLeft = navigation.canGoBack() ? undefined : () => (
    <Pressable onPress={() => router.replace('/')} hitSlop={8} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel={t('home')}>
      <Ionicons name="home-outline" size={22} color="#fff" />
    </Pressable>
  );
  const headerRight = () => (
    <Row style={{ gap: 2 }}>
      {card ? (
        <Pressable onPress={() => toggleSaved(card)} hitSlop={8} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel={isSaved(id) ? t('unsave') : t('save')}>
          <Ionicons name={isSaved(id) ? 'bookmark' : 'bookmark-outline'} size={22} color="#fff" />
        </Pressable>
      ) : null}
      <Pressable onPress={() => share('any')} hitSlop={8} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel={t('share')}>
        <Ionicons name="share-social-outline" size={22} color="#fff" />
      </Pressable>
    </Row>
  );

  if (article === undefined && !failed) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 14, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <Skeleton style={{ height: 28, width: '90%' }} />
        <Skeleton style={{ height: 28, width: '70%' }} />
        <Skeleton style={{ height: 220, borderRadius: 12 }} />
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} style={{ height: 15, width: i % 2 ? '92%' : '100%' }} />)}
        <ActivityIndicator color={colors.blue} accessibilityLabel={t('loadingStory')} />
      </View>
    );
  }
  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <Notice tone="error" text={offline ? t('offline') : t('loadFailed')} action={t('retry')} onAction={loadIt} />
      </View>
    );
  }
  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <Notice tone="warn" text={t('removedArticle')} action={t('home')} onAction={() => router.navigate('/')} />
      </View>
    );
  }

  const somali = article.tr.so!;
  const available = LANGS.filter(l => article.tr[l]);
  const secLabel = article.section === 'sports' ? t('sports') : article.section === 'world' ? t('world') : article.country === 'so' ? t('somaliaNav') : t('eastAfrica');
  const textStyle = { fontSize, lineHeight: Math.round(fontSize * 1.6) };

  // no translation in the chosen language: say so plainly, offer the languages this article exists in (as the website)
  if (!tx) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Stack.Screen options={{ title: '', headerRight, headerLeft }} />
        <T f="display" style={{ fontSize: 22 }}>{t('trNoneTitle')}</T>
        <T muted style={{ fontSize: 15, lineHeight: 22 }}>{t('trNoneText')}</T>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {available.map(l => (
            <Pressable key={l} onPress={() => (l === 'so' ? setShowSo(true) : setLang(l))} style={{ backgroundColor: l === 'so' ? colors.blue : colors.chip, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }} accessibilityRole="button">
              <T f="bodyBold" style={{ color: l === 'so' ? '#fff' : colors.fg }}>{LANG_INFO[l].name}</T>
            </Pressable>
          ))}
        </Row>
        <Photo uri={article.image || article.thumb} alt={somali.imageAlt} style={{ width: '100%', aspectRatio: 16 / 9 }} />
      </ScrollView>
    );
  }

  const body = tx.body || tx.summary || tx.title;
  const paragraphs = body.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const credit = article.imageCredit;
  const textLangProps = viewLang === 'so' && lang !== 'so' ? { style: { textAlign: 'left' as const, writingDirection: 'ltr' as const } } : null;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: '', headerRight, headerLeft }} />
      <View style={{ padding: 16, paddingBottom: 6 }}>
        <Row style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {isBreaking(article) ? <Pill label={t('breakingLabel')} color={colors.red} /> : null}
          <T f="bodyBold" style={{ color: colors.blue, fontSize: 13 }}>{secLabel}</T>
          {article.category && catName(lang, article.category) !== secLabel ? <T muted style={{ fontSize: 13 }}>· {catName(lang, article.category)}</T> : null}
        </Row>
        {article.sponsored ? <Notice tone="warn" text={t('sponsored') + (article.sponsor ? ' · ' + t('sponsoredBy') + ': ' + article.sponsor : '')} /> : null}
        {lang !== 'so' && (showSo || tx.status !== 'manual') ? (
          <View style={{ backgroundColor: colors.chip, borderRadius: 8, padding: 10, marginBottom: 12, gap: 6 }}>
            <T style={{ fontSize: 13 }}>{showSo ? LANG_INFO.so.name : t('autoTr')}</T>
            <Pressable onPress={() => setShowSo(!showSo)} accessibilityRole="button">
              <T f="bodyBold" style={{ color: colors.link, fontSize: 13 }}>{showSo ? LANG_INFO[lang].name : t('readSo')}</T>
            </Pressable>
          </View>
        ) : null}
        <T f="display" style={[{ fontSize: 26, lineHeight: 33 }, textLangProps?.style]} selectable>{tx.title}</T>
        {tx.body && tx.summary ? <T f="bodyMed" muted style={[{ fontSize: fontSize, lineHeight: Math.round(fontSize * 1.5), marginTop: 10 }, textLangProps?.style]} selectable>{tx.summary}</T> : null}
        <Row style={{ gap: 10, marginTop: 14, justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T f="bodyBold" style={{ fontSize: 14 }}>Wartabiye TV</T>
            <T muted style={{ fontSize: 12 }}>
              {article.timeVerified ? fullDate(lang, article.publishedAt) + ' · ' + ago(lang, article.publishedAt) : t('timeUnverifiedLong')}
              {' · '}{t('readTime', { n: Math.max(1, Math.round((tx.title + ' ' + tx.summary + ' ' + tx.body).split(/\s+/).length / 200)) })}
            </T>
          </View>
          <Row style={{ gap: 6 }}>
            <Pressable onPress={() => setFontSize(fontSize - 1)} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} accessibilityRole="button" accessibilityLabel={t('smaller')}>
              <T f="bodyBold">A−</T>
            </Pressable>
            <Pressable onPress={() => setFontSize(fontSize + 1)} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} accessibilityRole="button" accessibilityLabel={t('larger')}>
              <T f="bodyBold" style={{ fontSize: 17 }}>A+</T>
            </Pressable>
          </Row>
        </Row>
      </View>

      <View>
        <Photo uri={article.image || article.thumb} alt={tx.imageAlt || somali.imageAlt} label={catName(lang, article.category)} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0} priority="high" />
        <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
          {article.image ? (
            <T muted style={{ fontSize: 12, lineHeight: 17 }}>
              {article.imageKind === 'illustrative' ? t('illus') + t('illusNote') : ''}
              {credit ? t('photo') + ': ' : ''}
              {credit ? (
                article.imageSourceUrl ? <T style={{ color: colors.link, fontSize: 12 }} onPress={() => Linking.openURL(article.imageSourceUrl)}>{credit}</T> : credit
              ) : null}
              {article.imageLicense ? ' · ' + article.imageLicense : ''}
            </T>
          ) : (
            <T muted style={{ fontSize: 12 }}>{t('noImg')}{lang === 'so' && article.imageNote ? ': ' + article.imageNote : '.'}</T>
          )}
        </View>
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        {paragraphs.map((para, i) => <T key={i} style={[textStyle, textLangProps?.style]} selectable>{para}</T>)}
        {article.source ? (
          <View style={{ backgroundColor: colors.chip, borderRadius: 8, padding: 12, gap: 6 }}>
            <T style={{ fontSize: 14 }}>{t('srcNote', { src: article.source })}</T>
            {article.sourceUrl ? (
              <Pressable onPress={() => Linking.openURL(article.sourceUrl)} accessibilityRole="link">
                <T f="bodyBold" style={{ color: colors.link, fontSize: 14 }}>{t('readOriginal')} ({article.source}) ↗</T>
              </Pressable>
            ) : null}
          </View>
        ) : article.basedOnOthers ? (
          <View style={{ backgroundColor: colors.chip, borderRadius: 8, padding: 12 }}>
            <T style={{ fontSize: 14 }}>{t('basedNote')}</T>
          </View>
        ) : null}
        {fromCache && offline ? <T muted style={{ fontSize: 12 }}>{t('savedOffline')}</T> : null}

        <T f="bodyBold" style={{ fontSize: 14, marginTop: 6 }}>{t('share')}</T>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Pressable onPress={() => share('whatsapp')} style={{ backgroundColor: '#25D366', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }} accessibilityRole="button" accessibilityLabel="WhatsApp">
            <Row style={{ gap: 6 }}><Ionicons name="logo-whatsapp" size={17} color="#fff" /><T f="bodyBold" style={{ color: '#fff', fontSize: 14 }}>WhatsApp</T></Row>
          </Pressable>
          <Pressable onPress={() => share('facebook')} style={{ backgroundColor: '#1877F2', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }} accessibilityRole="button" accessibilityLabel="Facebook">
            <Row style={{ gap: 6 }}><Ionicons name="logo-facebook" size={17} color="#fff" /><T f="bodyBold" style={{ color: '#fff', fontSize: 14 }}>Facebook</T></Row>
          </Pressable>
          <Pressable onPress={() => share('any')} style={{ backgroundColor: colors.chip, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }} accessibilityRole="button">
            <Row style={{ gap: 6 }}><Ionicons name="share-outline" size={17} color={colors.fg} /><T f="bodyBold" style={{ fontSize: 14 }}>{t('shareMore')}</T></Row>
          </Pressable>
        </Row>
        <Pressable onPress={() => Linking.openURL(articleUrl(article.id))} accessibilityRole="link">
          <T style={{ color: colors.link, fontSize: 13 }}>{t('openWebsite')} ↗</T>
        </Pressable>
      </View>

      <AdSlot position="article" />
      {related.length ? (
        <View style={{ marginTop: 18 }}>
          <T f="display" style={{ fontSize: 18, paddingHorizontal: 16, paddingBottom: 6 }}>{t('related')}</T>
          {related.map(c => <ArticleRow key={c.id} c={c} />)}
        </View>
      ) : null}
      {rtl ? null : null}
    </ScrollView>
  );
}
