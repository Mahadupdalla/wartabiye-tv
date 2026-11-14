import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Brand, FreshBreaking } from '../components/chrome';
import { Intro } from '../components/intro';
// only the five weights the app uses (importing the package index would ship every weight)
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_500Medium } from '@expo-google-fonts/public-sans/500Medium';
import { PublicSans_700Bold } from '@expo-google-fonts/public-sans/700Bold';
import { SettingsProvider, useSettings } from '../lib/settings';
import { ContentProvider, useContent } from '../lib/content';
import { AlertsProvider } from '../lib/alerts';
import { trackView } from '../lib/analytics';
import { registerPwa } from '../lib/pwa';
import { syncPush } from '../lib/push';
import { appPathFor } from '../lib/links';
import { useOtaUpdates } from '../lib/ota';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** A tapped notification opens the exact article inside the app (also when the app was closed) */
function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const go = (resp: Notifications.NotificationResponse | null) => {
      const d = resp?.notification.request.content.data as { path?: string; id?: string } | undefined;
      if (!d) return;
      const m = typeof d.path === 'string' && d.path.match(/^\/war\/([A-Za-z0-9_.-]+)$/);
      if (m) router.push({ pathname: '/war/[id]', params: { id: m[1] } });
      else if (typeof d.path === 'string') { const to = appPathFor(d.path); if (to) router.push(to as any); }
    };
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, []);
}

/** Web app: a link like /app/war/<id> reaches the app through the website's 404 page as /app/?r=/war/<id> */
function useWebRedirect() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const r = new URLSearchParams(window.location.search).get('r');
    if (r && /^\/[A-Za-z0-9_\/.-]*$/.test(r.split('?')[0])) setTimeout(() => router.replace(r.split('?')[0].replace(/\.html$/, '') as any), 0);
  }, []);
}

function Analytics() {
  const path = usePathname();
  const { analytics, lang, ready } = useSettings();
  useEffect(() => {
    if (!ready) return;
    // same paths as the website's statistics: /war/<id> for an article, otherwise the section page
    const p = path.startsWith('/war/') ? path.replace(/\.html$/, '') : ({ '/': '/', '/live': '/wararka-tooska', '/videos': '/muuqaal', '/saved': '/kaydsan', '/search': '/raadi', '/ads': '/xayeysiimaha', '/section/somalia': '/soomaaliya', '/section/world': '/caalamka', '/section/sports': '/ciyaaraha', '/page/nagu-saabsan': '/nagu-saabsan', '/page/xiriir': '/xiriir', '/page/asturnaanta': '/asturnaanta' } as Record<string, string>)[path];
    if (p) trackView(analytics, p, lang);
  }, [path, analytics, lang, ready]);
  return null;
}

function Shell() {
  const { colors, ready, t, lang, notif, rtl } = useSettings();
  const { status, meta } = useContent();
  useNotificationTaps();
  useWebRedirect();
  useOtaUpdates();
  // keep the push registration current (new token, language or category choice); never asks for permission by itself
  const pushOn = notif.enabled && !!meta?.push?.enabled;
  useEffect(() => {
    if (ready && pushOn) syncPush(meta, notif, lang, true, false).catch(() => undefined);
  }, [ready, pushOn, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // the opening screen (components/intro.tsx, same blue and logo) takes over from the native splash at once
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
    const tm = setTimeout(() => SplashScreen.hideAsync().catch(() => undefined), 2500); // never keep the splash longer
    return () => clearTimeout(tm);
  }, [ready, status]);
  // tablets and the desktop web app: a comfortable reading column instead of full-width pictures
  return (
    <View style={{ flex: 1, backgroundColor: colors.dark ? '#050c17' : '#e3e9f1' }}>
     <View style={{ flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center', backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Analytics />
      <Stack
        screenOptions={{
          // the website's blue menu bar with the red rule underneath
          headerStyle: { backgroundColor: colors.blue },
          headerBackground: () => <View style={{ flex: 1, backgroundColor: colors.blue, borderBottomWidth: 3, borderBottomColor: colors.red }} />,
          headerShadowVisible: false,
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'ArchivoCond-800', fontWeight: '800' },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
          // native-feeling page changes: slide in from the side (mirrored for Arabic), swipe back on iPhone
          animation: Platform.OS === 'android' ? (rtl ? 'slide_from_left' : 'slide_from_right') : 'default',
          animationDuration: 260,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="war/[id]" options={{ title: '', headerTitle: () => <Brand size="bar" /> }} />
        <Stack.Screen name="section/[key]" options={{ title: '', headerTitle: () => <Brand size="bar" /> }} />
        <Stack.Screen name="search" options={{ title: t('search') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications') }} />
        <Stack.Screen name="settings" options={{ title: t('settings') }} />
        <Stack.Screen name="ads" options={{ title: t('advertise') }} />
        <Stack.Screen name="breaking" options={{ title: t('breakingTitle') }} />
        <Stack.Screen name="latest" options={{ title: t('latestShort') }} />
        <Stack.Screen name="page/[slug]" options={{ title: '' }} />
        <Stack.Screen name="browser" options={{ title: '', animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default', presentation: 'card' }} />
      </Stack>
      <FreshBreaking />
      <Intro />
     </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ 'ArchivoCond-700': require('../../assets/fonts/ArchivoCond-700.ttf'), 'ArchivoCond-800': require('../../assets/fonts/ArchivoCond-800.ttf'), 'ArchivoCond-900': require('../../assets/fonts/ArchivoCond-900.ttf'), PublicSans_400Regular, PublicSans_500Medium, PublicSans_700Bold });
  useEffect(() => { registerPwa(); }, []);
  if (!fontsLoaded && Platform.OS !== 'web') return null;
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ContentProvider>
          <AlertsProvider>
            <Shell />
          </AlertsProvider>
        </ContentProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
