import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Platform, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings, type NotifPrefs } from '../lib/settings';
import { useContent } from '../lib/content';
import { type AlertItem } from '../lib/api';
import { syncPush, type PushState } from '../lib/push';
import { articleIdOf, isFreeAppleBuild, kindOf, useAlerts, type AlertKind } from '../lib/alerts';
import { ago } from '../lib/i18n';
import { appPathFor } from '../lib/links';
import { EmptyState, Notice, Row, T } from '../components/ui';

// Notifications: the person's choice of categories (Breaking, Somalia, World, Sport), push notifications where Apple and
// Google allow them, and the notification center with the latest alerts: the same items as the website's bell
// (data/notifications.json, built by the publish workflow), newest first, each story once, new ones marked.
export default function NotificationsScreen() {
  const { colors, t, lang, notif, setNotif, rtl } = useSettings();
  const { meta } = useContent();
  const { alerts, failed, isRead, markRead, markAllRead, refresh, unread } = useAlerts();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [filter, setFilter] = useState<AlertKind | ''>('');
  const free = isFreeAppleBuild();

  const apply = useCallback(async (next: NotifPrefs, ask: boolean) => {
    setNotif(next);
    if (free) return; // no push for this copy of the app: only the in-app banner and the list use the choice
    setBusy(true);
    try { setState(await syncPush(meta, next, lang, next.enabled, ask)); } finally { setBusy(false); }
  }, [meta, lang, setNotif, free]);

  useEffect(() => { if (meta && !free) syncPush(meta, notif, lang, notif.enabled, false).then(setState).catch(() => setState('error')); }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPull = useCallback(async () => { setPulling(true); try { await refresh(); } finally { setPulling(false); } }, [refresh]);

  const cats: [AlertKind, string][] = [['breaking', t('notifBreaking')], ['eastAfrica', t('notifSomalia')], ['world', t('notifWorld')], ['sports', t('notifSports')]];
  const msg = state === 'off-by-site' || state === 'needs-setup' || (state === 'unsupported' && Platform.OS !== 'web') ? t('notifNeedsSetup')
    : state === 'denied' ? t('notifDenied') : state === 'error' ? t('loadFailed') : state === 'on' ? t('notifOnNote') : '';
  const catsOn = free ? notif.inApp : notif.enabled;
  const list = useMemo(() => (alerts || []).filter(a => !filter || kindOf(a) === filter), [alerts, filter]);
  const sw = { trackColor: { true: colors.blue, false: colors.hair }, thumbColor: '#fff' } as const;

  const header = (
    <View>
      <View style={{ backgroundColor: colors.surface, margin: 16, marginBottom: 10, borderRadius: 14, borderWidth: colors.dark ? 1 : 0, borderColor: colors.hair, overflow: 'hidden' }}>
        {free ? (
          <Row style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.hair }}>
            <View style={{ flex: 1 }}>
              <T f="bodyBold" style={{ fontSize: 16 }}>{t('notifInApp')}</T>
              <T muted style={{ fontSize: 13, marginTop: 2 }}>{t('notifIntro')}</T>
            </View>
            <Switch testID="notif-inapp" value={notif.inApp} onValueChange={v => apply({ ...notif, inApp: v }, false)} accessibilityLabel={t('notifInApp')} {...sw} />
          </Row>
        ) : (
          <Row style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.hair }}>
            <View style={{ flex: 1 }}>
              <T f="bodyBold" style={{ fontSize: 16 }}>{t('notifEnable')}</T>
              <T muted style={{ fontSize: 13, marginTop: 2 }}>{t('notifIntro')}</T>
            </View>
            {busy ? <ActivityIndicator color={colors.blue} /> : null}
            <Switch testID="notif-push" value={notif.enabled} onValueChange={v => apply({ ...notif, enabled: v }, true)} accessibilityLabel={t('notifEnable')} {...sw} />
          </Row>
        )}
        {cats.map(([k, label]) => (
          <Row key={k} style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 10, opacity: catsOn ? 1 : 0.5 }}>
            <T style={{ flex: 1, fontSize: 15 }}>{label}</T>
            <Switch value={!!notif[k]} disabled={!catsOn} onValueChange={v => apply({ ...notif, [k]: v }, false)} accessibilityLabel={label} {...sw} />
          </Row>
        ))}
      </View>
      {free ? <Notice tone="info" text={t('notifFree')} /> : null}
      {!free && notif.enabled && msg ? <Notice tone={state === 'on' ? 'info' : 'warn'} text={msg} action={state === 'denied' ? t('settings') : undefined} onAction={() => Linking.openSettings()} /> : null}
      {failed ? <Notice tone="warn" text={t('loadFailed')} action={t('retry')} onAction={onPull} /> : null}
      <Row style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, gap: 8 }}>
        <T f="bodyBold" style={{ flex: 1, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.sub, textAlign: rtl ? 'right' : 'left' }}>
          {t('notifCenter')}{unread ? ' · ' + t('unreadN', { n: unread }) : ''}
        </T>
        {unread ? (
          <Pressable testID="mark-all-read" onPress={markAllRead} accessibilityRole="button" hitSlop={8}>
            <T f="bodyBold" style={{ fontSize: 13, color: colors.link }}>{t('markAllRead')}</T>
          </Pressable>
        ) : null}
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
        {([['', t('all')], ...cats] as [AlertKind | '', string][]).map(([k, label]) => (
          <Pressable key={k || 'all'} onPress={() => setFilter(k)} accessibilityRole="button" accessibilityState={{ selected: filter === k }} style={{ backgroundColor: filter === k ? colors.blue : colors.surface, borderWidth: 1, borderColor: filter === k ? colors.blue : colors.hair, borderRadius: 16, height: 32, justifyContent: 'center', paddingHorizontal: 12 }}>
            <T f="bodyBold" style={{ fontSize: 12.5, color: filter === k ? '#fff' : colors.fg }}>{label}</T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const openAlert = (a: AlertItem) => {
    markRead(a.id);
    const id = (a.article && /^[A-Za-z0-9_.-]+$/.test(a.article) ? a.article : null) || articleIdOf(a.url);
    if (id) { router.push({ pathname: '/war/[id]', params: { id } }); return; }
    const to = a.url ? appPathFor('/' + String(a.url).replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '')) : null;
    if (to) router.push(to as any);
  };

  return (
    <FlatList
      testID="notif-list"
      style={{ backgroundColor: colors.bg }}
      data={list}
      keyExtractor={a => a.id}
      ListHeaderComponent={header}
      initialNumToRender={12}
      windowSize={9}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} colors={[colors.blue]} tintColor={colors.blue} />}
      ListEmptyComponent={alerts === null ? (
        <View style={{ padding: 24, alignItems: 'center', gap: 10 }}><ActivityIndicator color={colors.blue} /><T muted>{t('loading')}</T></View>
      ) : <EmptyState icon="notifications-outline" title={t('notifEmpty')} />}
      ListFooterComponent={<View style={{ height: 28 }} />}
      renderItem={({ item: a, index }) => {
        const tx = lang !== 'so' && a.t?.[lang]?.title ? a.t[lang] : { title: a.title, summary: a.summary };
        const k = kindOf(a);
        const isNew = !isRead(a.id);
        const first = index === 0, last = index === list.length - 1;
        return (
          <Pressable
            testID={'alert-' + index}
            onPress={() => openAlert(a)}
            accessibilityRole="link"
            accessibilityLabel={(isNew ? t('unreadN', { n: 1 }) + ': ' : '') + tx.title}
            style={({ pressed }) => ({ marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.hair, backgroundColor: pressed ? colors.tint : colors.surface, borderTopLeftRadius: first ? 14 : 0, borderTopRightRadius: first ? 14 : 0, borderBottomLeftRadius: last ? 14 : 0, borderBottomRightRadius: last ? 14 : 0 })}
          >
            <Row style={{ gap: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'breaking' ? (colors.dark ? '#3b0d0e' : '#fdecec') : colors.tint, marginTop: 2 }}>
                <Ionicons name={k === 'breaking' ? 'flash' : k === 'sports' ? 'football-outline' : k === 'world' ? 'earth-outline' : 'flag-outline'} size={15} color={k === 'breaking' ? colors.red : colors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <T f="bodyBold" style={{ fontSize: 12, color: k === 'breaking' ? colors.red : colors.blue }}>{k === 'breaking' ? t('breakingLabel') : k === 'sports' ? t('sports') : k === 'world' ? t('world') : t('somaliaNav')} · {ago(lang, a.time)}</T>
                <T f={isNew ? 'displayBold' : 'bodyBold'} style={{ fontSize: 15, lineHeight: 20, marginTop: 3, color: isNew ? colors.fg : colors.sub }}>{tx.title}</T>
                {tx.summary ? <T muted style={{ fontSize: 13, marginTop: 3 }} numberOfLines={2}>{tx.summary}</T> : null}
              </View>
              {isNew ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.red, marginTop: 6 }} /> : null}
            </Row>
          </Pressable>
        );
      }}
    />
  );
}
