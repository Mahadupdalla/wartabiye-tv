import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSettings, type NotifPrefs } from '../lib/settings';
import { useContent } from '../lib/content';
import { fetchAlerts, type AlertItem } from '../lib/api';
import { syncPush, type PushState } from '../lib/push';
import { ago } from '../lib/i18n';
import { Notice, Row, T } from '../components/ui';

// Notifications: the person's own choice of categories (Breaking, Somalia, World, Sport) and the latest alerts, which
// are the same items as the website's bell (data/notifications.json, built by the publish workflow).
export default function NotificationsScreen() {
  const { colors, t, lang, notif, setNotif } = useSettings();
  const { meta } = useContent();
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchAlerts().then(setAlerts).catch(() => setAlerts([])); }, []);

  const apply = useCallback(async (next: NotifPrefs, ask: boolean) => {
    setNotif(next);
    setBusy(true);
    try { setState(await syncPush(meta, next, lang, next.enabled, ask)); } finally { setBusy(false); }
  }, [meta, lang, setNotif]);

  useEffect(() => { if (meta) syncPush(meta, notif, lang, notif.enabled, false).then(setState).catch(() => setState('error')); }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats: [keyof NotifPrefs, string][] = [['breaking', t('notifBreaking')], ['eastAfrica', t('notifSomalia')], ['world', t('notifWorld')], ['sports', t('notifSports')]];
  const msg = state === 'off-by-site' ? t('notifNeedsSetup') : state === 'needs-setup' ? t('notifNeedsSetup') : state === 'denied' ? t('notifDenied') : state === 'unsupported' && Platform.OS !== 'web' ? t('notifNeedsSetup') : state === 'error' ? t('loadFailed') : state === 'on' ? t('notifOnNote') : '';

  const header = (
    <View>
      <View style={{ backgroundColor: colors.surface, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line }}>
        <Row style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={{ flex: 1 }}>
            <T f="bodyBold" style={{ fontSize: 16 }}>{t('notifEnable')}</T>
            <T muted style={{ fontSize: 13, marginTop: 2 }}>{t('notifIntro')}</T>
          </View>
          {busy ? <ActivityIndicator color={colors.blue} /> : null}
          <Switch value={notif.enabled} onValueChange={v => apply({ ...notif, enabled: v }, true)} accessibilityLabel={t('notifEnable')} trackColor={{ true: colors.blue }} />
        </Row>
        {cats.map(([k, label]) => (
          <Row key={k} style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 10, opacity: notif.enabled ? 1 : 0.5 }}>
            <T style={{ flex: 1, fontSize: 15 }}>{label}</T>
            <Switch value={!!notif[k]} disabled={!notif.enabled} onValueChange={v => apply({ ...notif, [k]: v }, false)} accessibilityLabel={label} trackColor={{ true: colors.blue }} />
          </Row>
        ))}
      </View>
      {notif.enabled && msg ? <Notice tone={state === 'on' ? 'info' : 'warn'} text={msg} action={state === 'denied' ? t('settings') : undefined} onAction={() => Linking.openSettings()} /> : null}
      <T f="display" style={{ fontSize: 18, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>{t('notifCenter')}</T>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={alerts || []}
      keyExtractor={a => a.id}
      ListHeaderComponent={header}
      ListEmptyComponent={<T muted style={{ padding: 16 }}>{alerts === null ? t('loading') : t('notifEmpty')}</T>}
      renderItem={({ item: a }) => {
        const tx = lang !== 'so' && a.t?.[lang]?.title ? a.t[lang] : { title: a.title, summary: a.summary };
        const m = String(a.url || '').match(/^war\/([A-Za-z0-9_.-]+?)\.html$/);
        return (
          <Pressable disabled={!m} onPress={() => m && router.push({ pathname: '/war/[id]', params: { id: m[1] } })} accessibilityRole="link" style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface }}>
            <T f="bodyBold" style={{ fontSize: 12, color: a.kind === 'breaking' ? colors.red : colors.blue }}>{a.kind === 'breaking' ? t('breakingLabel') : a.kind === 'sports' ? t('sports') : a.kind === 'world' ? t('world') : t('somaliaNav')} · {ago(lang, a.time)}</T>
            <T f="displayBold" style={{ fontSize: 15, lineHeight: 20, marginTop: 3 }}>{tx.title}</T>
            {tx.summary ? <T muted style={{ fontSize: 13, marginTop: 3 }} numberOfLines={2}>{tx.summary}</T> : null}
          </Pressable>
        );
      }}
    />
  );
}
