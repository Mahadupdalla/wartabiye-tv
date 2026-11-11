import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { openLink } from '../lib/links';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import type { Ad } from '../lib/types';
import { Photo, T } from './ui';

// Sponsored placements from /admin/ -> Xayeysiisyada (data/ads.json), shown with the same rules as the website: only
// active adverts inside their dates, in the positions the owner chose, and always labelled "ADVERTISEMENT".
// No third-party ad network is used or switched on.
export function adText(a: Ad, f: 'title' | 'text' | 'imageAlt', lang: string): string {
  const x = lang !== 'so' ? (a as any)[lang] : null;
  const v = x && typeof x[f] === 'string' && x[f].trim() ? x[f] : (a as any)[f];
  return typeof v === 'string' ? v : '';
}

export function AdSlot({ position }: { position: string }) {
  const { colors, t, lang } = useSettings();
  const { meta } = useContent();
  const ad = useMemo(() => {
    const list = (meta?.ads || []).filter(a => Array.isArray(a.positions) && a.positions.includes(position));
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }, [meta, position]);
  if (!ad) return null;
  const link = typeof ad.link === 'string' && /^https?:\/\//.test(ad.link) ? ad.link : null;
  const title = adText(ad, 'title', lang), text = adText(ad, 'text', lang);
  return (
    <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' }} accessibilityLabel={t('adLabel')}>
      <T f="bodyBold" style={{ fontSize: 10, letterSpacing: 1, color: colors.muted, paddingHorizontal: 10, paddingTop: 6 }}>{t('adLabel').toUpperCase()}</T>
      <Pressable disabled={!link} onPress={() => link && openLink(link)} accessibilityRole={link ? 'link' : undefined}>
        {ad.image ? <Photo uri={ad.image} alt={adText(ad, 'imageAlt', lang) || title} style={{ width: '100%', aspectRatio: 3 }} rounded={0} /> : null}
        {title || text || ad.advertiser ? (
          <View style={{ padding: 10, gap: 2 }}>
            {title ? <T f="bodyBold" style={{ fontSize: 15 }}>{title}</T> : null}
            {text ? <T muted style={{ fontSize: 13 }}>{text}</T> : null}
            {ad.advertiser ? <T muted style={{ fontSize: 12 }}>{t('sponsoredBy')}: {ad.advertiser}</T> : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
