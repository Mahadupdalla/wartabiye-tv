import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSettings } from '../lib/settings';
import { ago, catName } from '../lib/i18n';
import { BREAKING_MS } from '../lib/config';
import type { Card } from '../lib/types';
import { Photo, Pill, Row, T } from './ui';

export function isBreaking(c: Pick<Card, 'breaking' | 'publishedAt'>, now = Date.now()): boolean {
  if (!c.breaking) return false;
  const d = Date.parse(c.publishedAt);
  return !isNaN(d) && now - d < BREAKING_MS;
}

export function open(c: Card) {
  router.push({ pathname: '/war/[id]', params: { id: c.id, rev: c.rev } });
}

function useLabels(c: Card) {
  const { lang, t, colors } = useSettings();
  const sec = c.section === 'sports' ? t('sports') : c.section === 'world' ? t('world') : c.country === 'so' ? t('somaliaNav') : t('eastAfrica');
  const secColor = c.section === 'sports' ? '#0a8f4e' : c.section === 'world' ? colors.blueD : colors.blue;
  const cat = catName(lang, c.category);
  const when = c.timeVerified === false ? t('timeUnverified') : ago(lang, c.publishedAt);
  return { sec, secColor, cat, when, t, colors, lang };
}

function Meta({ c }: { c: Card }) {
  const { sec, secColor, when, t, colors } = useLabels(c);
  return (
    <Row style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
      {isBreaking(c) ? <Pill label={t('breakingLabel')} color={colors.red} /> : null}
      {c.sponsored ? <Pill label={t('sponsored')} color={colors.amberBg} fg={colors.amber} /> : null}
      <T f="bodyBold" style={{ fontSize: 12, color: secColor }}>{sec}</T>
      <T muted style={{ fontSize: 12 }}>{when}</T>
      {c.autoTranslated ? <T muted style={{ fontSize: 11, fontStyle: 'italic' }}>· {t('autoBadge')}</T> : null}
    </Row>
  );
}

/** Large lead story */
export const HeroCard = memo(function HeroCard({ c }: { c: Card }) {
  const { colors, cat } = useLabels(c);
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginHorizontal: 16, marginTop: 14, backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.line })}>
      <Photo uri={c.image || c.thumb} alt={c.imageAlt} label={cat} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0} priority="high" />
      <View style={{ padding: 14 }}>
        <T f="display" style={{ fontSize: 22, lineHeight: 28 }}>{c.title}</T>
        {c.summary ? <T muted style={{ fontSize: 15, lineHeight: 22, marginTop: 8 }} numberOfLines={3}>{c.summary}</T> : null}
        <Meta c={c} />
      </View>
    </Pressable>
  );
});

/** Standard list row: photo at the side */
export const ArticleRow = memo(function ArticleRow({ c }: { c: Card }) {
  const { colors, cat } = useLabels(c);
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line })}>
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>
        <Photo uri={c.thumb || c.image} alt={c.imageAlt} label={cat} style={{ width: 116, height: 80 }} />
        <View style={{ flex: 1 }}>
          <T f="displayBold" style={{ fontSize: 16, lineHeight: 21 }} numberOfLines={3}>{c.title}</T>
          <Meta c={c} />
        </View>
      </Row>
    </Pressable>
  );
});

/** Narrow card for horizontal section strips */
export const MiniCard = memo(function MiniCard({ c }: { c: Card }) {
  const { colors, cat } = useLabels(c);
  return (
    <Pressable onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={c.title} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, width: 230, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line })}>
      <Photo uri={c.thumb || c.image} alt={c.imageAlt} label={cat} style={{ width: '100%', height: 128 }} rounded={0} />
      <View style={{ padding: 10 }}>
        <T f="displayBold" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={3}>{c.title}</T>
        <Meta c={c} />
      </View>
    </Pressable>
  );
});
