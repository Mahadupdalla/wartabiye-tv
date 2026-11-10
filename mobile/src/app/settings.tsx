import React from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSettings, type ThemePref } from '../lib/settings';
import { LANG_INFO, LANGS } from '../lib/types';
import { APP_VERSION } from '../lib/config';
import { Row, T } from '../components/ui';

export default function SettingsScreen() {
  const { colors, t, lang, setLang, themePref, setThemePref, fontSize, setFontSize, analytics, setAnalytics } = useSettings();
  const box = { backgroundColor: colors.surface, marginHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' as const };
  const head = (s: string) => <T f="bodyBold" muted style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 8, fontSize: 12, letterSpacing: 1 }}>{s.toUpperCase()}</T>;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 30 }}>
      {head(t('language'))}
      <View style={box}>
        {LANGS.map((l, i) => (
          <Pressable key={l} onPress={() => setLang(l)} accessibilityRole="radio" accessibilityState={{ checked: l === lang }} style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Row style={{ gap: 12 }}>
              <T style={{ fontSize: 18 }}>{LANG_INFO[l].flag}</T>
              <T f={l === lang ? 'bodyBold' : 'body'} style={{ flex: 1, fontSize: 16, writingDirection: LANG_INFO[l].rtl ? 'rtl' : 'ltr' }}>{LANG_INFO[l].name}</T>
              {l === lang ? <T style={{ color: colors.blue, fontSize: 18 }}>✓</T> : null}
            </Row>
          </Pressable>
        ))}
      </View>
      {head(t('appearance'))}
      <Row style={{ ...box, padding: 6, gap: 6 }}>
        {(['light', 'dark', 'system'] as ThemePref[]).map(p => (
          <Pressable key={p} onPress={() => setThemePref(p)} accessibilityRole="radio" accessibilityState={{ checked: themePref === p }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: themePref === p ? colors.blue : 'transparent' }}>
            <T f="bodyBold" style={{ color: themePref === p ? '#fff' : colors.fg, fontSize: 14 }}>{t(p)}</T>
          </Pressable>
        ))}
      </Row>
      {head(t('fontSize'))}
      <View style={[box, { padding: 14, gap: 12 }]}>
        <Row style={{ gap: 10 }}>
          <Pressable onPress={() => setFontSize(fontSize - 1)} accessibilityRole="button" accessibilityLabel={t('smaller')} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 }}><T f="bodyBold">A−</T></Pressable>
          <T style={{ flex: 1, textAlign: 'center' }}>{fontSize}px</T>
          <Pressable onPress={() => setFontSize(fontSize + 1)} accessibilityRole="button" accessibilityLabel={t('larger')} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 }}><T f="bodyBold" style={{ fontSize: 18 }}>A+</T></Pressable>
        </Row>
        <T style={{ fontSize, lineHeight: Math.round(fontSize * 1.6) }}>{t('about')}</T>
      </View>
      {head(t('notifications'))}
      <Pressable onPress={() => router.push('/notifications')} style={[box, { padding: 14 }]} accessibilityRole="link">
        <T f="bodyMed" style={{ fontSize: 16 }}>{t('notifIntro')} ›</T>
      </Pressable>
      {head(t('analytics'))}
      <View style={[box, { padding: 14 }]}>
        <Row style={{ gap: 10 }}>
          <T style={{ flex: 1, fontSize: 13, lineHeight: 18 }} muted>{t('analyticsNote')}</T>
          <Switch value={analytics} onValueChange={setAnalytics} accessibilityLabel={t('analytics')} trackColor={{ true: colors.blue }} />
        </Row>
      </View>
      <T muted style={{ padding: 16, fontSize: 12 }}>Wartabiye TV · {t('version')} {APP_VERSION}</T>
    </ScrollView>
  );
}
