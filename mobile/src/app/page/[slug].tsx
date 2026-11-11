import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSettings } from '../../lib/settings';
import { SITE } from '../../lib/config';
import { PAGES, type PageSlug } from '../../lib/links';
import { SiteWebView } from '../../components/SiteWebView';
import { Notice } from '../../components/ui';

// About us, Contact us, Privacy, Editorial ethics, Corrections and the advertising pages: the website's own page,
// opened INSIDE the app (never in Chrome or Safari), in the reader's language and theme
const TITLE: Record<PageSlug, string> = {
  'nagu-saabsan': 'aboutUs', 'xiriir': 'contact', 'asturnaanta': 'privacy', 'anshaxa': 'editorial',
  'saxitaannada': 'corrections', 'siyaasadda-xayeysiiska': 'adPolicy', 'xayeysiimaha': 'advertise',
};

export default function SitePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, lang, colors } = useSettings();
  const ok = (PAGES as readonly string[]).includes(String(slug));
  const s = (ok ? slug : 'nagu-saabsan') as PageSlug;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t(TITLE[s]) }} />
      {ok ? (
        <SiteWebView key={lang + (colors.dark ? 'd' : 'l')} url={`${SITE}${s}/?lang=${lang}`} onLoaded={() => console.log('[WTV] page ' + s + ' shown')} />
      ) : <Notice tone="warn" text={t('loadFailed')} />}
    </View>
  );
}
