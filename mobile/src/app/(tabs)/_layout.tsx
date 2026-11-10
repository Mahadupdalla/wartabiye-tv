import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { LiveDot } from '../../components/ui';
import { useContent } from '../../lib/content';
import { LIVE_WINDOW_MS } from '../../lib/config';

export default function TabsLayout() {
  const { colors, t, rtl } = useSettings();
  const { items } = useContent();
  const insets = useSafeAreaInsets();
  // red dot on LIVE only while there is genuinely fresh coverage (a breaking story in the last hour)
  const liveNow = items.some(c => c.breaking && Date.now() - Date.parse(c.publishedAt) < 3600_000 && Date.now() - Date.parse(c.publishedAt) < LIVE_WINDOW_MS);
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: any; size: number }) => <Ionicons name={name} size={size} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, flexDirection: rtl ? 'row-reverse' : 'row', height: 62 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen
        name="live"
        options={{
          title: t('live'),
          tabBarIcon: ({ color, size }) => (liveNow ? <LiveDot size={12} /> : <Ionicons name="radio-outline" size={size} color={color as string} />),
        }}
      />
      <Tabs.Screen name="videos" options={{ title: t('videosNav'), tabBarIcon: icon('play-circle-outline') }} />
      <Tabs.Screen name="saved" options={{ title: t('savedBtn'), tabBarIcon: icon('bookmark-outline') }} />
      <Tabs.Screen name="more" options={{ title: t('menu'), tabBarIcon: icon('menu') }} />
    </Tabs>
  );
}
