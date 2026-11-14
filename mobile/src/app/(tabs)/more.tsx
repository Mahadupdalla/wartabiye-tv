import React from 'react';
import { ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { APP_VERSION } from '../../lib/config';
import { fullDate } from '../../lib/i18n';
import { LANG_INFO } from '../../lib/types';
import { AppHeader } from '../../components/chrome';
import { Group, GroupRow, T } from '../../components/ui';

// Menu tab: every section and page of the app, grouped, in the same order as the website's menu
export default function More() {
  const { colors, t, lang } = useSettings();
  const { meta, lastOk } = useContent();
  const nav = (h: Href) => () => router.push(h);
  const head = (s: string) => <T f="bodyBold" style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8, fontSize: 12, letterSpacing: 1, color: colors.sub, textTransform: 'uppercase' }}>{s}</T>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {head(t('sections'))}
        <Group>
          <GroupRow first icon="home-outline" label={t('allNews')} onPress={() => router.navigate('/')} />
          <GroupRow icon="time-outline" label={t('latest')} onPress={nav('/latest')} />
          <GroupRow icon="flag-outline" label={t('somaliaNav')} onPress={nav('/section/somalia')} />
          <GroupRow icon="earth-outline" label={t('world')} onPress={nav('/section/world')} />
          <GroupRow icon="football-outline" label={t('sports')} onPress={nav('/section/sports')} />
          <GroupRow icon="radio-outline" label={t('liveNewsNav')} onPress={() => router.navigate('/live')} color={colors.red} />
          <GroupRow icon="flash-outline" label={t('breakingTitle')} onPress={nav('/breaking')} color={colors.red} />
          <GroupRow icon="play-circle-outline" label={t('videosNav')} onPress={() => router.navigate('/videos')} />
        </Group>
        {head(t('menu'))}
        <Group>
          <GroupRow first icon="search-outline" label={t('search')} onPress={nav('/search')} />
          <GroupRow icon="bookmark-outline" label={t('saved')} onPress={() => router.navigate('/saved')} />
          <GroupRow icon="notifications-outline" label={t('notifications')} onPress={nav('/notifications')} />
          <GroupRow icon="settings-outline" label={t('settings')} value={LANG_INFO[lang].name} onPress={nav('/settings')} />
        </Group>
        {head('Wartabiye TV')}
        <Group>
          <GroupRow first icon="information-circle-outline" label={t('aboutUs')} onPress={nav('/page/nagu-saabsan')} />
          <GroupRow icon="mail-outline" label={t('contact')} onPress={nav('/page/xiriir')} />
          <GroupRow icon="ribbon-outline" label={t('editorial')} onPress={nav('/page/anshaxa')} />
          <GroupRow icon="create-outline" label={t('corrections')} onPress={nav('/page/saxitaannada')} />
          <GroupRow icon="shield-checkmark-outline" label={t('privacy')} onPress={nav('/page/asturnaanta')} />
          <GroupRow icon="megaphone-outline" label={t('advertise')} onPress={nav('/ads')} />
        </Group>
        <View style={{ padding: 20, gap: 4, alignItems: 'center' }}>
          <T style={{ fontSize: 12, color: colors.sub, textAlign: 'center' }}>{t('sameNews')}</T>
          {meta?.contentUpdatedAt ? <T style={{ fontSize: 12, color: colors.sub, textAlign: 'center' }}>{t('updatedAt', { t: fullDate(lang, meta.contentUpdatedAt) })}</T> : null}
          {lastOk ? <T style={{ fontSize: 12, color: colors.sub, textAlign: 'center' }}>{t('lastChecked', { t: fullDate(lang, new Date(lastOk).toISOString()) })}</T> : null}
          <T style={{ fontSize: 12, color: colors.sub, textAlign: 'center' }}>{t('version')} {APP_VERSION}</T>
        </View>
      </ScrollView>
    </View>
  );
}
