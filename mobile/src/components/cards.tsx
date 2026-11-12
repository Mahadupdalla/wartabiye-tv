// Article cards drawn exactly like the website's (assets/site.css .tile, .row, .card, .mini; assets/app.js catTag/meta):
// the same blue category label on the photo, the same headline type, "Wartabiye TV · 5 saac kahor", "AKHRI WARKA →" and
// the bookmark button.
import React, { memo } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { ago, catName } from '../lib/i18n';
import { BREAKING_MS } from '../lib/config';
import type { Card } from '../lib/types';
import { CatTag, Photo, Row, T } from './ui';

export function isBreaking(c: Pick<Card, 'breaking' | 'publishedAt'>, now = Date.now()): boolean {
  if (!c.breaking) return false;
  const d = Date.parse(c.publishedAt);
  return !isNaN(d) && now - d < BREAKING_MS;
}

export function open(c: Card) {
  router.push({ pathname: '/war/[id]', params: { id: c.id, rev: c.rev } });
}

/** The website's catTag(): sponsored, breaking, the World / Sports section, otherwise the category */
export function useCat(c: Card): { label: string; red: boolean; dot: boolean } {
  const { lang, t } = useSettings();
  if (c.sponsored) return { label: t('sponsored'), red: true, dot: false };
  if (isBreaking(c)) return { label: t('breaking'), red: true, dot: true };
  if (c.section === 'sports' || c.section === 'world') return { label: t(c.section), red: false, dot: false };
  return { label: catName(lang, c.category) || t('somalia'), red: false, dot: false };
}

/** "Wartabiye TV • 5 saac kahor" (the website's .meta) */
export function MetaLine({ c, light, compact }: { c: Pick<Card, 'publishedAt' | 'timeVerified' | 'autoTranslated'>; light?: boolean; compact?: boolean }) {
  const { lang, t, colors } = useSettings();
  const fg = light ? '#fff' : colors.fg;
  const when = c.timeVerified === false ? t('timeUnverified') : ago(lang, c.publishedAt);
  return (
    <Row style={{ gap: 7, flexWrap: 'wrap' }}>
      <T f="bodyBold" style={{ fontSize: 12, color: fg }}>Wartabiye TV</T>
      {when ? (
        <Row style={{ gap: 7 }}>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: light ? 'rgba(255,255,255,0.8)' : colors.grey }} />
          <T f="bodyMed" style={{ fontSize: 12, color: light ? 'rgba(255,255,255,0.92)' : colors.sub }}>{when}</T>
        </Row>
      ) : null}
      {c.autoTranslated && !compact ? <T style={{ fontSize: 11.5, fontStyle: 'italic', color: light ? '#e6f0fb' : colors.soft }}>{t('autoBadge')}</T> : null}
    </Row>
  );
}

export function BookmarkBtn({ c }: { c: Card }) {
  const { colors, t } = useSettings();
  const { saved, toggleSaved } = useContent();
  const on = saved.some(s => s.card.id === c.id);
  return (
    <Pressable
      onPress={() => toggleSaved(c)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('savedBtn')}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: pressed || on ? colors.tint : 'transparent', alignItems: 'center', justifyContent: 'center' })}
    >
      <Ionicons name={on ? 'bookmark' : 'bookmark-outline'} size={18} color={on ? colors.blue : colors.sub} />
    </Pressable>
  );
}

const shadow = { shadowColor: '#0b1c33', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 };

/** Small coloured label above a headline (category, or BREAKING in red) */
export function Kicker({ c }: { c: Card }) {
  const { colors } = useSettings();
  const cat = useCat(c);
  return (
    <Row style={{ gap: 6 }}>
      {cat.dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red }} /> : null}
      <T f="display" numberOfLines={1} style={{ fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: cat.red ? colors.red : colors.dark ? colors.link : colors.blue }}>{cat.label}</T>
    </Row>
  );
}

/** Featured story (.tile): the photo with the blue gradient, label and white headline on it */
export const Tile = memo(function Tile({ c, big }: { c: Card; big?: boolean }) {
  const { colors } = useSettings();
  const cat = useCat(c);
  const { width } = useWindowDimensions();
  const h = big ? Math.min(420, Math.max(300, Math.round(Math.min(width, 820) * 0.95))) : 220;
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.988 : 1 }], marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden', height: h, backgroundColor: colors.blueD }, shadow]}>
      <Photo uri={big ? c.image || c.thumb : c.thumb || c.image} alt={c.imageAlt} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} rounded={0} priority={big ? 'high' : 'normal'} illus={c.imageKind === 'illustrative'} />
      <LinearGradient colors={['rgba(4,33,63,0)', 'rgba(2,70,130,0.78)', 'rgba(2,48,92,0.96)']} locations={[0.28, 0.66, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: big ? 18 : 14, gap: 10 }}>
        <CatTag {...cat} />
        <T f="display" style={{ color: '#fff', fontSize: big ? 26 : 17, lineHeight: big ? 30 : 21, textShadowColor: 'rgba(11,28,51,0.35)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } }} numberOfLines={big ? 4 : 3}>{c.title}</T>
        {big ? <MetaLine c={c} light /> : null}
      </View>
    </Pressable>
  );
});

/** Story card: full-width photo, label, headline, two lines of summary, meta and the bookmark */
export const StoryCard = memo(function StoryCard({ c, lead }: { c: Card; lead?: boolean }) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }], marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: colors.dark ? 1 : 0, borderColor: colors.hair }, shadow]}>
      <Photo uri={c.thumb || c.image} alt={c.imageAlt} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0} illus={c.imageKind === 'illustrative'} priority={lead ? 'high' : 'normal'} />
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 8 }}>
        <Kicker c={c} />
        <T f="display" style={{ fontSize: lead ? 22 : 19, lineHeight: lead ? 27 : 23.5 }} numberOfLines={4}>{c.title}</T>
        {c.summary ? <T style={{ fontSize: 14.5, lineHeight: 21, color: colors.sub }} numberOfLines={lead ? 3 : 2}>{c.summary}</T> : null}
        <Row style={{ justifyContent: 'space-between', marginTop: 2, gap: 10 }}>
          <View style={{ flex: 1 }}><MetaLine c={c} /></View>
          <BookmarkBtn c={c} />
        </Row>
      </View>
    </Pressable>
  );
});

/** Section-block card: the same card, without the bookmark (sections, related stories) */
export const GridCard = memo(function GridCard({ c, lead }: { c: Card; lead?: boolean }) {
  return <StoryCard c={c} lead={lead} />;
});

/** Compact row: thumbnail, label, headline and time (Latest news, section lists, search, saved) */
export const NewsRow = memo(function NewsRow({ c, first, inset = true, action }: { c: Card; first?: boolean; inset?: boolean; action?: React.ReactNode }) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => ({ backgroundColor: pressed ? colors.tint : 'transparent', paddingHorizontal: inset ? 16 : 0, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.hair })}>
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Kicker c={c} />
          <T f="display" style={{ fontSize: 16, lineHeight: 20.5 }} numberOfLines={3}>{c.title}</T>
          <Row style={{ gap: 8, justifyContent: 'space-between' }}><View style={{ flex: 1 }}><MetaLine c={c} compact /></View>{action}</Row>
        </View>
        <Photo uri={c.thumb || c.image} alt={c.imageAlt} style={{ width: 108, height: 76 }} rounded={10} illus={false} />
      </Row>
    </Pressable>
  );
});

/** Small row with a thumbnail (the website's sidebar "Ugu dambeeyay" list) */
export const MiniRow = memo(function MiniRow({ c, first }: { c: Card; first?: boolean }) {
  return <NewsRow c={c} first={first} inset={false} />;
});

// names used by the other screens (search, saved, breaking, sections)
export const ArticleRow = NewsRow;
export const HeroCard = memo(function HeroCard({ c }: { c: Card }) {
  return <View style={{ marginTop: 16 }}><Tile c={c} big /></View>;
});
