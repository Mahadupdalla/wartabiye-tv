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
export function MetaLine({ c, light }: { c: Pick<Card, 'publishedAt' | 'timeVerified' | 'autoTranslated'>; light?: boolean }) {
  const { lang, t, colors } = useSettings();
  const fg = light ? '#fff' : colors.fg;
  const when = c.timeVerified === false ? t('timeUnverified') : ago(lang, c.publishedAt);
  return (
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>
      <T f="bodyBold" style={{ fontSize: 12.5, color: fg }}>Wartabiye TV</T>
      {when ? (
        <Row style={{ gap: 8 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.grey }} />
          <T f="bodyMed" style={{ fontSize: 12.5, color: light ? '#fff' : colors.muted }}>{when}</T>
        </Row>
      ) : null}
      {c.autoTranslated ? <T style={{ fontSize: 11.5, fontStyle: 'italic', color: light ? '#e6f0fb' : colors.soft }}>{t('autoBadge')}</T> : null}
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
      style={{ width: 32, height: 30, borderRadius: 6, borderWidth: 1, borderColor: on ? colors.blue : colors.line, backgroundColor: on ? colors.blue : 'transparent', alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={on ? 'bookmark' : 'bookmark-outline'} size={15} color={on ? '#fff' : colors.muted} />
    </Pressable>
  );
}

const shadow = { shadowColor: '#0b1c33', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

/** Homepage headline tile (.tile): the photo with the blue gradient, label and white headline on it */
export const Tile = memo(function Tile({ c, big }: { c: Card; big?: boolean }) {
  const { colors } = useSettings();
  const cat = useCat(c);
  const { width } = useWindowDimensions();
  const h = big ? (width >= 700 ? 380 : 340) : 220;
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, marginHorizontal: 16, marginBottom: 8, borderRadius: 10, overflow: 'hidden', height: h, backgroundColor: colors.blueD }, shadow]}>
      <Photo uri={big ? c.image || c.thumb : c.thumb || c.image} alt={c.imageAlt} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} rounded={0} priority={big ? 'high' : 'normal'} illus={c.imageKind === 'illustrative'} />
      <LinearGradient colors={['rgba(2,99,179,0)', 'rgba(2,99,179,0.92)']} locations={[0.35, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: big ? 18 : 16, gap: 8 }}>
        <CatTag {...cat} />
        <T f="display" style={{ color: '#fff', fontSize: big ? 25 : 17, lineHeight: big ? 29 : 21, textShadowColor: 'rgba(11,28,51,0.35)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } }} numberOfLines={big ? 5 : 3}>{c.title}</T>
        {big ? <MetaLine c={c} light /> : null}
      </View>
    </Pressable>
  );
});

/** List story (.row): bordered card, photo with the label, headline, meta, three lines of summary, "Read →" and bookmark */
export const StoryCard = memo(function StoryCard({ c }: { c: Card }) {
  const { colors, t, rtl } = useSettings();
  const cat = useCat(c);
  return (
    <View style={[{ marginHorizontal: 16, marginBottom: 20, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, gap: 10 }, shadow]}>
      <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, gap: 10 })}>
        <Photo uri={c.thumb || c.image} alt={c.imageAlt} style={{ width: '100%', aspectRatio: 16 / 10 }} illus={c.imageKind === 'illustrative'}>
          <View style={[{ position: 'absolute', bottom: 10 }, rtl ? { right: 10 } : { left: 10 }]}><CatTag {...cat} /></View>
        </Photo>
        <T f="display" style={{ fontSize: 21, lineHeight: 25 }}>{c.title}</T>
      </Pressable>
      <MetaLine c={c} />
      {c.summary ? <T style={{ fontSize: 14.5, lineHeight: 22 }} muted numberOfLines={3}>{c.summary}</T> : null}
      <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
        <Pressable onPress={() => open(c)} accessibilityRole="link" hitSlop={8}>
          <T f="display" style={{ color: colors.link, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t('readMore')}</T>
        </Pressable>
        <BookmarkBtn c={c} />
      </Row>
    </View>
  );
});

/** Section-block card (.card): photo on top with the label, headline, two lines of summary, meta */
export const GridCard = memo(function GridCard({ c, lead }: { c: Card; lead?: boolean }) {
  const { colors, rtl } = useSettings();
  const cat = useCat(c);
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, marginHorizontal: 16, marginBottom: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' }, shadow]}>
      <Photo uri={c.thumb || c.image} alt={c.imageAlt} style={{ width: '100%', aspectRatio: 16 / 10 }} rounded={0} illus={c.imageKind === 'illustrative'}>
        <View style={[{ position: 'absolute', bottom: 10 }, rtl ? { right: 10 } : { left: 10 }]}><CatTag {...cat} /></View>
      </Photo>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 8 }}>
        <T f="display" style={{ fontSize: lead ? 22 : 17.5, lineHeight: lead ? 26.5 : 21.5 }}>{c.title}</T>
        {c.summary ? <T style={{ fontSize: lead ? 15 : 14, lineHeight: lead ? 23 : 21 }} muted numberOfLines={lead ? 4 : 2}>{c.summary}</T> : null}
        <MetaLine c={c} />
      </View>
    </Pressable>
  );
});

/** Small row with a thumbnail (the website's sidebar "Ugu dambeeyay" list) */
export const MiniRow = memo(function MiniRow({ c, first }: { c: Card; first?: boolean }) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line })}>
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>
        <Photo uri={c.thumb || c.image} alt={c.imageAlt} style={{ width: 104, height: 68 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <T f="display" style={{ fontSize: 14.5, lineHeight: 18.5 }} numberOfLines={3}>{c.title}</T>
          <MetaLine c={c} />
        </View>
      </Row>
    </Pressable>
  );
});

// names used by the other screens (search, saved, breaking, sections): the website's list story everywhere
export const ArticleRow = StoryCard;
export const HeroCard = memo(function HeroCard({ c }: { c: Card }) {
  return <View style={{ marginTop: 16 }}><Tile c={c} big /></View>;
});
