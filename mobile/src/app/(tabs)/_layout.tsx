import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '../../lib/settings';
import { LiveDot, ROW_RTL } from '../../components/ui';
import { useContent } from '../../lib/content';
import { LIVE_WINDOW_MS } from '../../lib/config';

export default function TabsLayout() {
  const { colors, t, rtl } = useSettings();
  const { items } = useContent();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // red dot on LIVE only while there is genuinely fresh coverage (a breaking story in the last hour)
  const liveNow = items.some(c => c.breaking && Date.now() - Date.parse(c.publishedAt) < 3600_000 && Date.now() - Date.parse(c.publishedAt) < LIVE_WINDOW_MS);
  // the chosen tab: filled icon on a soft blue pill, the label in blue
  const Pill = ({ on, children }: { on: boolean; children: React.ReactNode }) => (
    <View style={{ width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.tint : 'transparent' }}>{children}</View>
  );
  const icon = (name: keyof typeof Ionicons.glyphMap, filled: keyof typeof Ionicons.glyphMap) => ({ color, focused }: { color: any; size: number; focused: boolean }) => (
    <Pill on={focused}><Ionicons name={focused ? filled : name} size={21} color={color as string} /></Pill>
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.sub,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hair, flexDirection: rtl ? ROW_RTL : 'row', height: 60 + Math.max(insets.bottom, 6), paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6), borderTopWidth: 1, elevation: 8, shadowColor: '#0b1c33', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
        tabBarLabelStyle: { fontSize: width < 360 ? 9 : 10.5, fontFamily: rtl ? undefined : 'PublicSans_700Bold', fontWeight: rtl ? '700' : undefined, lineHeight: 14, marginTop: 2 },
        tabBarItemStyle: { paddingTop: 0 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="live"
        options={{
          title: t('live'),
          tabBarIcon: ({ color, focused }) => (
            <Pill on={focused}>
              <Ionicons name={focused ? 'radio' : 'radio-outline'} size={21} color={color as string} />
              {liveNow ? <View style={{ position: 'absolute', top: 2, right: 10 }}><LiveDot size={8} /></View> : null}
            </Pill>
          ),
        }}
      />
      <Tabs.Screen name="videos" options={{ title: t('videosNav'), tabBarIcon: icon('play-circle-outline', 'play-circle') }} />
      <Tabs.Screen name="saved" options={{ title: t('savedBtn'), tabBarIcon: icon('bookmark-outline', 'bookmark') }} />
      <Tabs.Screen name="more" options={{ title: t('menu'), tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  );
}
