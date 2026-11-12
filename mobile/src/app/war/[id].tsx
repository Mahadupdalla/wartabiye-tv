import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { articleUrl } from '../../lib/config';
import { openLink } from '../../lib/links';
import { catName, fullDate, ago } from '../../lib/i18n';
import { cardOf } from '../../lib/api';
import type { Article, Lang } from '../../lib/types';
import { LANG_INFO, LANGS } from '../../lib/types';
import { NewsRow, isBreaking } from '../../components/cards';
import { AdSlot } from '../../components/ads';
import { BlockHead, CatTag, EmptyState, Group, Notice, Photo, Row, Skeleton, T } from '../../components/ui';
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
  // the next story: the one published just before this one in the same section (then the newest of the rest)
  const next = useMemo(() => {
    if (!article) return null;
    const pool = items.filter(c => c.id !== article.id && !c.sponsored).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    const same = pool.filter(c => c.section === article.section);
    return same.find(c => c.publishedAt < article.publishedAt) || same[0] || pool[0] || null;
  }, [items, article]);
  const scrollY = useRef(new Animated.Value(0)).current;
  const contentH = useRef(0);
  const viewH = useRef(0);
  const [scrollMax, setScrollMax] = useState(0);
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!article) return;
    fadeIn.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [article?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const related = useMemo(() => {
    if (!article) return [];
    return items.filter(c => c.id !== article.id && c.id !== next?.id && !c.sponsored && c.section === article.section && (c.category === article.category || c.section !== 'somalia')).slice(0, 4);
  }, [items, article, next]);

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
        <EmptyState icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} title={offline ? t('offline') : t('loadFailed')} action={t('retry')} onAction={loadIt} />
      </View>
    );
  }
  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="document-text-outline" title={t('removedArticle')} action={t('home')} onAction={() => router.navigate('/')} />
      </View>
    );
  }

  const somali = article.tr.so!;
  const available = LANGS.filter(l => article.tr[l]);
  const secLabel = article.section === 'sports' ? t('sports') : article.section === 'world' ? t('world') : article.country === 'so' ? t('somaliaNav') : t('eastAfrica');
  const textStyle = { fontSize: fontSize + 1, lineHeight: Math.round((fontSize + 1) * 1.7) };
  const seg = { width: 40, height: 32, borderRadius: 999, alignItems: 'center' as const, justifyContent: 'center' as const };
  const round = { width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const };
  const note = { backgroundColor: colors.surface, borderLeftWidth: rtl ? 0 : 3, borderRightWidth: rtl ? 3 : 0, borderColor: colors.red, borderRadius: 10, padding: 14 };

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

  const readMin = Math.max(1, Math.round((tx.title + ' ' + tx.summary + ' ' + tx.body).split(/\s+/).length / 200));
  const sharePill = (name: string, icon: keyof typeof Ionicons.glyphMap, how: 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'linkedin' | 'any', fg = colors.blue) => (
    <Pressable key={name} onPress={() => share(how)} style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hair, transform: [{ scale: pressed ? 0.94 : 1 }] })} accessibilityRole="button" accessibilityLabel={name}>
      <Ionicons name={icon} size={20} color={fg} />
    </Pressable>
  );
  const progress = scrollMax > 0 ? scrollY.interpolate({ inputRange: [0, scrollMax], outputRange: [0, 1], extrapolate: 'clamp' }) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Stack.Screen options={{ title: '', headerRight, headerLeft }} />
    {/* reading progress under the blue bar */}
    <View style={{ height: 3, backgroundColor: colors.dark ? '#1a2b46' : '#dfe7f1', zIndex: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ height: 3, width: '100%', backgroundColor: colors.red, transformOrigin: rtl ? 'right' : 'left', transform: [{ scaleX: progress as any }] }} />
    </View>
    <Animated.ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
      onLayout={e => { viewH.current = e.nativeEvent.layout.height; setScrollMax(Math.max(0, contentH.current - viewH.current)); }}
      onContentSizeChange={(_, h) => { contentH.current = h; setScrollMax(Math.max(0, contentH.current - viewH.current)); }}
    >
      <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <View style={{ padding: 16, paddingBottom: 4, gap: 12 }}>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <CatTag label={article.sponsored ? t('sponsored') : isBreaking(article) ? t('breaking') : article.section === 'somalia' ? catName(lang, article.category) || secLabel : secLabel} red={article.sponsored || isBreaking(article)} dot={isBreaking(article)} />
          <Pressable onPress={() => router.push(`/section/${article.section}`)} accessibilityRole="link" hitSlop={8}>
            <T f="bodyBold" style={{ fontSize: 13, color: colors.link }}>{secLabel} {rtl ? '‹' : '›'}</T>
          </Pressable>
        </Row>
        {article.sponsored ? <Notice tone="warn" text={t('sponsored') + (article.sponsor ? ' · ' + t('sponsoredBy') + ': ' + article.sponsor : '')} /> : null}
        {lang !== 'so' && (showSo || tx.status !== 'manual') ? (
          <View style={{ backgroundColor: colors.chip, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.line }}>
            <T style={{ fontSize: 13 }}>{showSo ? LANG_INFO.so.name : t('autoTr')}</T>
            <Pressable onPress={() => setShowSo(!showSo)} accessibilityRole="button">
              <T f="bodyBold" style={{ color: colors.link, fontSize: 13 }}>{showSo ? LANG_INFO[lang].name : t('readSo')}</T>
            </Pressable>
          </View>
        ) : null}
        <T f="display" style={[{ fontSize: 28, lineHeight: 33.5 }, textLangProps?.style]} selectable accessibilityRole="header">{tx.title}</T>
        {tx.body && tx.summary ? <T f="bodyMed" style={[{ fontSize: fontSize - 1, lineHeight: Math.round((fontSize - 1) * 1.55), color: colors.sub }, textLangProps?.style]} selectable>{tx.summary}</T> : null}
        <Row style={{ gap: 10, paddingTop: 4 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.hair, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={LOGO} style={{ width: 36, height: 36, borderRadius: 18 }} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T f="bodyBold" style={{ fontSize: 13.5 }}>Wartabiye TV</T>
            <T f="bodyMed" style={{ fontSize: 12.5, color: colors.sub }}>
              {article.timeVerified ? fullDate(lang, article.publishedAt) : t('timeUnverifiedLong')}
            </T>
            <Row style={{ gap: 10 }}>
              {article.timeVerified ? <Row style={{ gap: 4 }}><Ionicons name="time-outline" size={12} color={colors.sub} /><T style={{ fontSize: 12, color: colors.sub }}>{ago(lang, article.publishedAt)}</T></Row> : null}
              <Row style={{ gap: 4 }}><Ionicons name="book-outline" size={12} color={colors.sub} /><T style={{ fontSize: 12, color: colors.sub }}>{t('readTime', { n: readMin })}</T></Row>
            </Row>
          </View>
        </Row>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Photo uri={article.image || article.thumb} alt={tx.imageAlt || somali.imageAlt} style={{ width: '100%', aspectRatio: 16 / 10 }} rounded={12} priority="high" illus={article.imageKind === 'illustrative'} />
        <View style={{ paddingTop: 8 }}>
          {article.image ? (
            <T style={{ fontSize: 12.5, lineHeight: 18 }} muted>
              {article.imageKind === 'illustrative' ? <T f="bodyBold" style={{ color: colors.red, fontSize: 12.5 }}>{t('illus')}</T> : null}
              {article.imageKind === 'illustrative' ? t('illusNote') : ''}
              {credit ? t('photo') + ': ' : ''}
              {credit ? (
                article.imageSourceUrl ? <T style={{ color: colors.link, fontSize: 12.5, textDecorationLine: 'underline' }} onPress={() => openLink(article.imageSourceUrl)}>{credit}</T> : credit
              ) : null}
              {article.imageLicense ? ' · ' + article.imageLicense : ''}
            </T>
          ) : (
            <T muted style={{ fontSize: 12 }}>{t('noImg')}{lang === 'so' && article.imageNote ? ': ' + article.imageNote : '.'}</T>
          )}
        </View>
      </View>

      {/* reading tools: text size, save, share */}
      <Row style={{ gap: 8, marginHorizontal: 16, marginTop: 14, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hair }}>
        <Row style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hair, borderRadius: 999, padding: 2, gap: 2 }}>
          <Pressable testID="text-smaller" onPress={() => setFontSize(fontSize - 1)} disabled={fontSize <= 15} style={({ pressed }) => [seg, { opacity: fontSize <= 15 ? 0.35 : 1, backgroundColor: pressed ? colors.tint : 'transparent' }]} accessibilityRole="button" accessibilityLabel={t('smaller')}>
            <T f="bodyBold" style={{ fontSize: 13, textAlign: 'center' }}>A</T>
          </Pressable>
          <View style={{ width: 1, height: 16, backgroundColor: colors.hair }} />
          <Pressable testID="text-larger" onPress={() => setFontSize(fontSize + 1)} disabled={fontSize >= 24} style={({ pressed }) => [seg, { opacity: fontSize >= 24 ? 0.35 : 1, backgroundColor: pressed ? colors.tint : 'transparent' }]} accessibilityRole="button" accessibilityLabel={t('larger')}>
            <T f="bodyBold" style={{ fontSize: 18, textAlign: 'center' }}>A</T>
          </Pressable>
        </Row>
        <T style={{ fontSize: 12, color: colors.sub }}>{t('textSize')}</T>
        <View style={{ flex: 1 }} />
        {card ? (
          <Pressable onPress={() => toggleSaved(card)} style={({ pressed }) => [round, { borderWidth: 1, borderColor: isSaved(id) ? colors.blue : colors.hair, backgroundColor: isSaved(id) ? colors.blue : pressed ? colors.tint : colors.surface }]} accessibilityRole="button" accessibilityLabel={isSaved(id) ? t('unsave') : t('save')} accessibilityState={{ selected: isSaved(id) }}>
            <Ionicons name={isSaved(id) ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved(id) ? '#fff' : colors.fg} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => share('any')} style={({ pressed }) => [round, { backgroundColor: pressed ? colors.blueD : colors.blue }]} accessibilityRole="button" accessibilityLabel={t('share')}>
          <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={18} color="#fff" />
        </Pressable>
      </Row>

      <View style={{ padding: 16, gap: 16 }}>
        {paragraphs.map((para, i) => (/^##\s+/.test(para) ? (
          <T key={i} f="display" style={[{ fontSize: textStyle.fontSize + 3, lineHeight: Math.round((textStyle.fontSize + 3) * 1.3), marginTop: 6 }, textLangProps?.style]} selectable accessibilityRole="header">{para.replace(/^##\s+/, '')}</T>
        ) : i === paragraphs.findIndex(x => !/^##\s+/.test(x)) && !rtl && /^\p{L}/u.test(para) ? (
          <T key={i} style={[textStyle, textLangProps?.style]} selectable>
            <T f="brand" style={{ color: colors.blue, fontSize: Math.round(textStyle.fontSize * 2.4), lineHeight: Math.round(textStyle.fontSize * 2.4) }}>{para.charAt(0)}</T>
            {para.slice(1)}
          </T>
        ) : <T key={i} style={[textStyle, textLangProps?.style]} selectable>{para}</T>))}
        {article.source ? (
          <View style={[note, { gap: 6 }]}>
            <T style={{ fontSize: 14.5, lineHeight: 22 }}>{t('srcNote', { src: article.source })}</T>
            {article.sourceUrl ? (
              <Pressable onPress={() => openLink(article.sourceUrl)} accessibilityRole="link">
                <T f="bodyBold" style={{ color: colors.link, fontSize: 14 }}>{t('readOriginal')} ({article.source}) ›</T>
              </Pressable>
            ) : null}
          </View>
        ) : article.basedOnOthers ? (
          <View style={note}><T style={{ fontSize: 14.5, lineHeight: 22 }}>{t('basedNote')}</T></View>
        ) : null}
        {fromCache && offline ? <T muted style={{ fontSize: 12 }}>{t('savedOffline')}</T> : null}

        <View style={{ marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.hair, gap: 12 }}>
          <T f="display" style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: colors.sub }}>{t('shareStory')}</T>
          <Row style={{ gap: 10, flexWrap: 'wrap' }}>
            {sharePill('WhatsApp', 'logo-whatsapp', 'whatsapp', '#25A85A')}
            {sharePill('Facebook', 'logo-facebook', 'facebook', '#0866FF')}
            {sharePill('X', 'logo-x', 'x', colors.dark ? '#fff' : '#0b1c33')}
            {sharePill('Telegram', 'paper-plane', 'telegram', '#229ED9')}
            {sharePill('LinkedIn', 'logo-linkedin', 'linkedin', '#0a66c2')}
            {sharePill(t('shareMore'), 'ellipsis-horizontal', 'any', colors.sub)}
          </Row>
        </View>
      </View>

      {next ? (
        <Pressable onPress={() => router.replace({ pathname: '/war/[id]', params: { id: next.id, rev: next.rev } })} accessibilityRole="link" accessibilityLabel={t('nextStory') + ': ' + next.title} style={({ pressed }) => ({ marginHorizontal: 16, marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.hair, backgroundColor: colors.surface, overflow: 'hidden', transform: [{ scale: pressed ? 0.985 : 1 }] })}>
          <Row style={{ gap: 12, padding: 12 }}>
            <Photo uri={next.thumb || next.image} alt={next.imageAlt} style={{ width: 96, height: 64 }} rounded={8} />
            <View style={{ flex: 1, gap: 4 }}>
              <T f="display" style={{ color: colors.red, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t('nextStory')}</T>
              <T f="display" style={{ fontSize: 15, lineHeight: 19 }} numberOfLines={3}>{next.title}</T>
            </View>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.muted} />
          </Row>
        </Pressable>
      ) : null}

      <AdSlot position="article" />
      {related.length ? (
        <View>
          <BlockHead title={t('related')} />
          <Group>{related.map((c, i) => <NewsRow key={c.id} c={c} first={i === 0} />)}</Group>
        </View>
      ) : null}
      </Animated.View>
    </Animated.ScrollView>
    </View>
  );
}
