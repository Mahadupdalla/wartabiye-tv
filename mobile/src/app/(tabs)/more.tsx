import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { APP_VERSION } from '../../lib/config';
import { fullDate } from '../../lib/i18n';
import { AppHeader } from '../../components/chrome';
import { Row, T } from '../../components/ui';

export default function More() {
  const { colors, t, lang } = useSettings();
  const { meta, lastOk } = useContent();
  const item = (icon: keyof typeof Ionicons.glyphMap, label: string, go: () => void, color?: string) => (
    <Pressable key={label} onPress={go} accessibilityRole="link" style={({ pressed }) => ({ backgroundColor: pressed ? colors.chip : colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line })}>
      <Row style={{ gap: 14 }}>
        <Ionicons name={icon} size={21} color={color || colors.blue} />
        <T f="bodyMed" style={{ flex: 1, fontSize: 16 }}>{label}</T>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Row>
    </Pressable>
  );
  const nav = (h: Href) => () => router.push(h);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView>
        <T f="bodyBold" muted style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, fontSize: 12, letterSpacing: 1 }}>{t('sections').toUpperCase()}</T>
        {item('newspaper-outline', t('allNews'), () => router.navigate('/'))}
        {item('flag-outline', t('somaliaNav'), nav('/section/somalia'))}
        {item('globe-outline', t('world'), nav('/section/world'))}
        {item('football-outline', t('sports'), nav('/section/sports'), '#0a8f4e')}
        {item('radio-outline', t('liveNewsNav'), () => router.navigate('/live'), colors.red)}
        {item('flash-outline', t('breakingTitle'), nav('/breaking'), colors.red)}
        {item('play-circle-outline', t('videosNav'), () => router.navigate('/videos'))}
        {item('megaphone-outline', t('advertise'), nav('/ads'))}
        <T f="bodyBold" muted style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 8, fontSize: 12, letterSpacing: 1 }}>{t('menu').toUpperCase()}</T>
        {item('search-outline', t('search'), nav('/search'))}
        {item('bookmark-outline', t('saved'), () => router.navigate('/saved'))}
        {item('notifications-outline', t('notifications'), nav('/notifications'))}
        {item('settings-outline', t('settings'), nav('/settings'))}
        <T f="bodyBold" muted style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 8, fontSize: 12, letterSpacing: 1 }}>WARTABIYE TV</T>
        {item('information-circle-outline', t('aboutUs'), nav('/page/nagu-saabsan'))}
        {item('mail-outline', t('contact'), nav('/page/xiriir'))}
        {item('ribbon-outline', t('editorial'), nav('/page/anshaxa'))}
        {item('create-outline', t('corrections'), nav('/page/saxitaannada'))}
        {item('shield-checkmark-outline', t('privacy'), nav('/page/asturnaanta'))}
        <View style={{ padding: 16, gap: 4 }}>
          <T muted style={{ fontSize: 12 }}>{t('sameNews')}</T>
          {meta?.contentUpdatedAt ? <T muted style={{ fontSize: 12 }}>{t('updatedAt', { t: fullDate(lang, meta.contentUpdatedAt) })}</T> : null}
          {lastOk ? <T muted style={{ fontSize: 12 }}>{t('lastChecked', { t: fullDate(lang, new Date(lastOk).toISOString()) })}</T> : null}
          <T muted style={{ fontSize: 12 }}>{t('version')} {APP_VERSION}</T>
        </View>
      </ScrollView>
    </View>
  );
}
