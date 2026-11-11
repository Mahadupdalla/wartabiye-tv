import React from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSettings, type ThemePref } from '../lib/settings';
import { APP_VERSION } from '../lib/config';
import { Group, GroupRow, Row, T } from '../components/ui';
import { LangRow } from '../components/lang';

export default function SettingsScreen() {
  const { colors, t, themePref, setThemePref, fontSize, setFontSize, analytics, setAnalytics } = useSettings();
  const head = (s: string) => <T f="bodyBold" style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, fontSize: 12, letterSpacing: 1, color: colors.sub, textTransform: 'uppercase' }}>{s}</T>;
  const seg = (on: boolean) => ({ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, height: 36, borderRadius: 9, backgroundColor: on ? colors.blue : 'transparent' });
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 36 }}>
      {head(t('language'))}
      <Group><LangRow /></Group>

      {head(t('appearance'))}
      <Group style={{ padding: 5 }}>
        <Row style={{ gap: 4 }}>
          {(['light', 'dark', 'system'] as ThemePref[]).map(p => (
            <Pressable key={p} onPress={() => setThemePref(p)} accessibilityRole="radio" accessibilityState={{ checked: themePref === p }} style={seg(themePref === p)}>
              <T f="bodyBold" numberOfLines={1} style={{ color: themePref === p ? '#fff' : colors.fg, fontSize: 13.5, textAlign: 'center' }}>{t(p)}</T>
            </Pressable>
          ))}
        </Row>
      </Group>

      {head(t('fontSize'))}
      <Group style={{ padding: 14, gap: 12 }}>
        <Row style={{ gap: 10 }}>
          <Pressable onPress={() => setFontSize(fontSize - 1)} disabled={fontSize <= 15} accessibilityRole="button" accessibilityLabel={t('smaller')} style={({ pressed }) => ({ width: 44, height: 36, borderRadius: 10, backgroundColor: pressed ? colors.tint : colors.chip, alignItems: 'center', justifyContent: 'center', opacity: fontSize <= 15 ? 0.4 : 1 })}><T f="bodyBold" style={{ fontSize: 13 }}>A</T></Pressable>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.hair }}>
            <View style={{ width: `${((fontSize - 15) / 9) * 100}%`, height: 4, borderRadius: 2, backgroundColor: colors.blue }} />
          </View>
          <Pressable onPress={() => setFontSize(fontSize + 1)} disabled={fontSize >= 24} accessibilityRole="button" accessibilityLabel={t('larger')} style={({ pressed }) => ({ width: 44, height: 36, borderRadius: 10, backgroundColor: pressed ? colors.tint : colors.chip, alignItems: 'center', justifyContent: 'center', opacity: fontSize >= 24 ? 0.4 : 1 })}><T f="bodyBold" style={{ fontSize: 19 }}>A</T></Pressable>
        </Row>
        <T style={{ fontSize, lineHeight: Math.round(fontSize * 1.6) }}>{t('about')}</T>
      </Group>

      {head(t('notifications'))}
      <Group>
        <GroupRow first icon="notifications-outline" label={t('notifications')} onPress={() => router.push('/notifications')} />
      </Group>

      {head(t('analytics'))}
      <Group style={{ padding: 14 }}>
        <Row style={{ gap: 12 }}>
          <T style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.sub }}>{t('analyticsNote')}</T>
          <Switch value={analytics} onValueChange={setAnalytics} accessibilityLabel={t('analytics')} trackColor={{ true: colors.blue, false: colors.hair }} thumbColor="#fff" />
        </Row>
      </Group>
      <T style={{ padding: 20, fontSize: 12, color: colors.sub, textAlign: 'center' }}>Wartabiye TV · {t('version')} {APP_VERSION}</T>
    </ScrollView>
  );
}
