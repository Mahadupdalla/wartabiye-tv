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
import { GridCard, isBreaking } from '../../components/cards';
import { AdSlot } from '../../components/ads';
import { BlockHead, CatTag, Notice, Photo, Row, Skeleton, T } from '../../components/ui';
import { Image } from 'expo-image';

const LOGO = require('../../../assets/logo.png');

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
      console.log(`[WTV] article ${id} ${r.article ? 'shown' : 'removed'}${r.fromCache ? ' (saved copy)' : ''}`);
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

  const share = async (how: 'any' | 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'linkedin') => {
    if (!article) return;
    const url = articleUrl(article.id);
    const title = (tx || article.tr.so)?.title || '';
    if (how === 'whatsapp') return Linking.openURL('https://wa.me/?text=' + encodeURIComponent(title + ' — Wartabiye TV ' + url));
    if (how === 'facebook') return Linking.openURL('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url));
    if (how === 'x') return Linking.openURL('https://x.com/intent/post?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url));
    if (how === 'telegram') return Linking.openURL('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title));
    if (how === 'linkedin') return Linking.openURL('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url));
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
  const textStyle = { fontSize: fontSize + 1, lineHeight: Math.round((fontSize + 1) * 1.7) };
  const outline = { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surface };
  const shareBtn = { backgroundColor: colors.blue, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 9 };
  const note = { backgroundColor: colors.surface, borderLeftWidth: rtl ? 0 : 4, borderRightWidth: rtl ? 4 : 0, borderColor: colors.red, borderRadius: 6, padding: 16 };

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
      <View style={{ padding: 16, paddingBottom: 4, gap: 12 }}>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <T style={{ fontSize: 13.5 }} onPress={() => router.navigate('/')}>{t('home')}</T>
          <T style={{ fontSize: 13.5 }} muted>›</T>
          <T style={{ fontSize: 13.5 }} onPress={() => router.push(`/section/${article.section}`)}>{secLabel}</T>
          <T style={{ fontSize: 13.5 }} muted>›</T>
        </Row>
        <CatTag label={article.sponsored ? t('sponsored') : isBreaking(article) ? t('breaking') : article.section === 'somalia' ? catName(lang, article.category) || secLabel : secLabel} red={article.sponsored || isBreaking(article)} dot={isBreaking(article)} />
        {article.sponsored ? <Notice tone="warn" text={t('sponsored') + (article.sponsor ? ' · ' + t('sponsoredBy') + ': ' + article.sponsor : '')} /> : null}
        {lang !== 'so' && (showSo || tx.status !== 'manual') ? (
          <View style={{ backgroundColor: colors.chip, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.line }}>
            <T style={{ fontSize: 13 }}>{showSo ? LANG_INFO.so.name : t('autoTr')}</T>
            <Pressable onPress={() => setShowSo(!showSo)} accessibilityRole="button">
              <T f="bodyBold" style={{ color: colors.link, fontSize: 13 }}>{showSo ? LANG_INFO[lang].name : t('readSo')}</T>
            </Pressable>
          </View>
        ) : null}
        <T f="display" style={[{ fontSize: 31, lineHeight: 35 }, textLangProps?.style]} selectable accessibilityRole="header">{tx.title}</T>
        {tx.body && tx.summary ? <T style={[{ fontSize: fontSize + 2, lineHeight: Math.round((fontSize + 2) * 1.55) }, textLangProps?.style]} selectable>{tx.summary}</T> : null}
        <View style={{ paddingTop: 6, gap: 8 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={LOGO} style={{ width: 36, height: 36, borderRadius: 18 }} />
          </View>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <T f="bodyBold" style={{ fontSize: 12.5 }}>Wartabiye TV</T>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.grey }} />
            <T f="bodyMed" style={{ fontSize: 12.5 }}>{article.timeVerified ? fullDate(lang, article.publishedAt) : t('timeUnverifiedLong')}</T>
          </Row>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            {article.timeVerified ? <T f="bodyMed" style={{ fontSize: 12.5 }}>{ago(lang, article.publishedAt)}</T> : null}
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.grey }} />
            <T f="bodyMed" style={{ fontSize: 12.5 }}>{t('readTime', { n: Math.max(1, Math.round((tx.title + ' ' + tx.summary + ' ' + tx.body).split(/\s+/).length / 200)) })}</T>
          </Row>
          <Row style={{ gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Pressable onPress={() => setFontSize(fontSize - 1)} style={outline} accessibilityRole="button" accessibilityLabel={t('smaller')}>
              <T f="bodyBold" style={{ fontSize: 13 }}>A−</T>
            </Pressable>
            <Pressable onPress={() => setFontSize(fontSize + 1)} style={outline} accessibilityRole="button" accessibilityLabel={t('larger')}>
              <T f="bodyBold" style={{ fontSize: 13 }}>A+</T>
            </Pressable>
            {card ? (
              <Pressable onPress={() => toggleSaved(card)} style={[outline, isSaved(id) && { backgroundColor: colors.blue, borderColor: colors.blue }]} accessibilityRole="button" accessibilityLabel={isSaved(id) ? t('unsave') : t('save')}>
                <Row style={{ gap: 6 }}>
                  <Ionicons name={isSaved(id) ? 'bookmark' : 'bookmark-outline'} size={14} color={isSaved(id) ? '#fff' : colors.fg} />
                  <T f="bodyBold" style={{ fontSize: 13, color: isSaved(id) ? '#fff' : colors.fg }}>{isSaved(id) ? t('savedBtn') : t('save')}</T>
                </Row>
              </Pressable>
            ) : null}
          </Row>
        </View>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {([['Facebook', 'logo-facebook', 'facebook'], ['WhatsApp', 'logo-whatsapp', 'whatsapp'], ['X', 'logo-x', 'x'], ['Telegram', 'paper-plane', 'telegram'], ['LinkedIn', 'logo-linkedin', 'linkedin']] as const).map(([name, icon, how]) => (
            <Pressable key={name} onPress={() => share(how)} style={shareBtn} accessibilityRole="button" accessibilityLabel={name}>
              <Row style={{ gap: 7 }}><Ionicons name={icon} size={15} color="#fff" /><T f="bodyBold" style={{ color: '#fff', fontSize: 13.5 }}>{name}</T></Row>
            </Pressable>
          ))}
          <Pressable onPress={() => share('any')} style={[shareBtn, { backgroundColor: colors.blueD }]} accessibilityRole="button" accessibilityLabel={t('shareMore')}>
            <Row style={{ gap: 7 }}><Ionicons name="share-social" size={15} color="#fff" /><T f="bodyBold" style={{ color: '#fff', fontSize: 13.5 }}>{t('shareMore')}</T></Row>
          </Pressable>
        </Row>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Photo uri={article.image || article.thumb} alt={tx.imageAlt || somali.imageAlt} style={{ width: '100%', aspectRatio: 16 / 10, borderWidth: 1, borderColor: colors.line }} rounded={10} priority="high" illus={article.imageKind === 'illustrative'} />
        <View style={{ paddingTop: 8 }}>
          {article.image ? (
            <T style={{ fontSize: 12.5, lineHeight: 18 }} muted>
              {article.imageKind === 'illustrative' ? <T f="bodyBold" style={{ color: colors.red, fontSize: 12.5 }}>{t('illus')}</T> : null}
              {article.imageKind === 'illustrative' ? t('illusNote') : ''}
              {credit ? t('photo') + ': ' : ''}
              {credit ? (
                article.imageSourceUrl ? <T style={{ color: colors.link, fontSize: 12.5, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(article.imageSourceUrl)}>{credit}</T> : credit
              ) : null}
              {article.imageLicense ? ' · ' + article.imageLicense : ''}
            </T>
          ) : (
            <T muted style={{ fontSize: 12 }}>{t('noImg')}{lang === 'so' && article.imageNote ? ': ' + article.imageNote : '.'}</T>
          )}
        </View>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        {paragraphs.map((para, i) => (i === 0 && !rtl && /^\p{L}/u.test(para) ? (
          <T key={i} style={[textStyle, textLangProps?.style]} selectable>
            <T f="brand" style={{ color: colors.blue, fontSize: Math.round(textStyle.fontSize * 2.4), lineHeight: Math.round(textStyle.fontSize * 2.4) }}>{para.charAt(0)}</T>
            {para.slice(1)}
          </T>
        ) : <T key={i} style={[textStyle, textLangProps?.style]} selectable>{para}</T>))}
        {article.source ? (
          <View style={[note, { gap: 6 }]}>
            <T style={{ fontSize: 14.5, lineHeight: 22 }}>{t('srcNote', { src: article.source })}</T>
            {article.sourceUrl ? (
              <Pressable onPress={() => Linking.openURL(article.sourceUrl)} accessibilityRole="link">
                <T f="bodyBold" style={{ color: colors.link, fontSize: 14 }}>{t('readOriginal')} ({article.source}) ↗</T>
              </Pressable>
            ) : null}
          </View>
        ) : article.basedOnOthers ? (
          <View style={note}><T style={{ fontSize: 14.5, lineHeight: 22 }}>{t('basedNote')}</T></View>
        ) : null}
        {fromCache && offline ? <T muted style={{ fontSize: 12 }}>{t('savedOffline')}</T> : null}
        <Pressable onPress={() => Linking.openURL(articleUrl(article.id))} accessibilityRole="link">
          <T style={{ color: colors.link, fontSize: 13 }}>{t('openWebsite')} ↗</T>
        </Pressable>
      </View>

      <AdSlot position="article" />
      {related.length ? (
        <View>
          <BlockHead title={t('related')} />
          {related.map(c => <GridCard key={c.id} c={c} />)}
        </View>
      ) : null}
      {rtl ? null : null}
    </ScrollView>
  );
}
