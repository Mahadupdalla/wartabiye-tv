import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { SITE } from '../lib/config';
import { AdSlot, adText } from '../components/ads';
import { Notice, T, PageHero } from '../components/ui';

// Xayeysiimaha: the website's advertising information and the adverts running now (from /admin/). Requests go to the
// website's own advertising form; the app does not take payments and no paid ad service is switched on.
export default function Ads() {
  const { colors, t, lang } = useSettings();
  const { meta } = useContent();
  const ads = meta?.ads || [];
  const why = [['adWhy1', 'adWhy1t'], ['adWhy2', 'adWhy2t'], ['adWhy3', 'adWhy3t'], ['adWhy4', 'adWhy4t']];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 30 }}>
      <PageHero title={t('adHero')} sub={t('adHeroSub')}>
        <Pressable onPress={() => Linking.openURL(SITE + 'xayeysiimaha/')} accessibilityRole="link" style={{ backgroundColor: '#fff', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 }}>
          <T f="bodyBold" style={{ color: colors.blueD }}>{t('adOrder')}</T>
        </Pressable>
      </PageHero>
      <Notice text={t('adsIntro')} />
      <T f="display" style={{ fontSize: 18, paddingHorizontal: 16, paddingTop: 18 }}>{t('adWhy')}</T>
      {why.map(([h, b]) => (
        <View key={h} style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <T f="bodyBold" style={{ fontSize: 15 }}>{t(h)}</T>
          <T muted style={{ fontSize: 14, lineHeight: 20 }}>{t(b)}</T>
        </View>
      ))}
      <T f="display" style={{ fontSize: 18, paddingHorizontal: 16, paddingTop: 22 }}>{t('adsActive')}</T>
      {ads.length ? ads.map(a => <T key={a.id} style={{ paddingHorizontal: 16, paddingTop: 6 }}>• {adText(a, 'title', lang) || a.advertiser || a.id}</T>) : <T muted style={{ paddingHorizontal: 16, paddingTop: 6 }}>{t('adsNone')}</T>}
      <AdSlot position="home" />
      <Pressable onPress={() => Linking.openURL(SITE + 'siyaasadda-xayeysiiska/')} accessibilityRole="link" style={{ padding: 16 }}>
        <T style={{ color: colors.link }}>{t('adPolicy')} ↗</T>
      </Pressable>
    </ScrollView>
  );
}
