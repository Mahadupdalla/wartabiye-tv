import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { fetchLiveUpdates } from '../../lib/api';
import { LIVE_POLL_MS, LIVE_WINDOW_MS } from '../../lib/config';
import { ago, clock } from '../../lib/i18n';
import type { Card, LiveUpdate } from '../../lib/types';
import { AppHeader, StatusLine } from '../../components/chrome';
import { isBreaking, open } from '../../components/cards';
import { LiveDot, Pill, Row, T } from '../../components/ui';

// LIVE News: ONE written timeline, like the website's #wararka-tooska. It holds (1) the short LIVE updates Wartabiye TV
// writes from official newsroom feeds (tools/live_updates.py, branch live-data) and (2) every story Wartabiye TV published
// in the last 24 hours. Times are the publisher's own. Red "LIVE" only while coverage is genuinely active: the newest
// update or breaking story is under 60 minutes old AND the app's last check succeeded in the last 3 minutes.
// No video players, no links to other websites.

type Entry = { t: number; id: string; region: string; u?: LiveUpdate; a?: Card };
const REG: [string, string][] = [['', 'wireAll'], ['somalia', 'wireSomalia'], ['eastafrica', 'wireEastAfrica'], ['africa', 'wireAfrica'], ['world', 'wireWorld']];

function luOk(u: LiveUpdate, now: number) {
  const t = Date.parse(u?.publishedAt);
  return !!(u && u.id && u.so && u.so.title && u.so.text) && !isNaN(t) && t <= now + 5 * 60e3 && now - t < LIVE_WINDOW_MS;
}

export default function LiveScreen() {
  const { colors, t, lang } = useSettings();
  const { items, meta, refresh } = useContent();
  const [updates, setUpdates] = useState<LiveUpdate[] | null>(null);
  const [lastOk, setLastOk] = useState(0);
  const [reg, setReg] = useState('');
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const [d] = await Promise.all([fetchLiveUpdates(meta), refresh().catch(() => undefined)]);
    setUpdates(Array.isArray(d.items) ? d.items : []);
    setLastOk(Date.now());
  }, [meta, refresh]);

  // every 30 seconds while this screen is open (and the app is in front): new entries appear at the top
  useEffect(() => {
    load();
    let timer: ReturnType<typeof setInterval> | null = setInterval(load, LIVE_POLL_MS);
    const clockTimer = setInterval(() => tick(x => x + 1), 30_000);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') { load(); if (!timer) timer = setInterval(load, LIVE_POLL_MS); }
      else if (timer) { clearInterval(timer); timer = null; }
    });
    return () => { if (timer) clearInterval(timer); clearInterval(clockTimer); sub.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now();
  const all: Entry[] = useMemo(() => {
    const ups = (updates || []).filter(u => luOk(u, now)).map(u => ({ t: Date.parse(u.publishedAt), id: u.id, region: u.region || 'world', u }));
    const own = items.filter(c => !c.sponsored && now - Date.parse(c.publishedAt) < LIVE_WINDOW_MS && Date.parse(c.publishedAt) <= now + 5 * 60e3)
      .map(c => ({ t: Date.parse(c.publishedAt), id: c.id, region: c.section === 'world' ? 'world' : c.section === 'somalia' ? (c.region === 'somalia' || !c.region ? 'somalia' : 'eastafrica') : 'sports', a: c }));
    return [...ups, ...own].sort((x, y) => y.t - x.t);
  }, [updates, items, now]);

  useEffect(() => {
    if (updates === null) return;
    if (!known.current) { known.current = new Set(all.map(e => e.id)); return; }
    const add = all.filter(e => !known.current!.has(e.id)).map(e => e.id);
    if (add.length) { add.forEach(id => known.current!.add(id)); setFresh(prev => new Set([...prev, ...add])); }
  }, [all, updates]);

  const fits = (r: string) => !reg || r === reg || (reg === 'africa' && (r === 'eastafrica' || r === 'somalia')) || (reg === 'eastafrica' && r === 'somalia');
  const list = all.filter(e => fits(e.region));
  const newest = all.length ? all[0].t : 0;
  const active = all.filter(e => e.u || (e.a && isBreaking(e.a))).reduce((m, e) => Math.max(m, e.t), 0);
  const on = !!active && now - active < 60 * 60e3 && now - lastOk < 3 * 60e3;
  const lu = (u: LiveUpdate, f: 'title' | 'text') => {
    const x = lang !== 'so' ? (u[lang] as { title?: string; text?: string } | undefined) : undefined;
    const v = x && typeof x[f] === 'string' && x[f]!.trim();
    return v ? { s: v as string, so: false } : { s: u.so[f], so: lang !== 'so' };
  };

  const header = (
    <View>
      <LinearGradient colors={[colors.blue, colors.blueD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 22 }}>
        <Row style={{ gap: 10 }}>
          <T f="brand" style={{ color: '#fff', fontSize: 26, lineHeight: 30, flexShrink: 1 }} accessibilityRole="header">{t('lnTitle')}</T>
          {on ? (
            <Row style={{ gap: 6, backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
              <LiveDot size={8} />
              <T f="display" style={{ color: '#fff', fontSize: 12 }}>{t('lnLiveOn')}</T>
            </Row>
          ) : null}
        </Row>
        <T style={{ color: '#d6e6f7', fontSize: 13, marginTop: 4, lineHeight: 18 }}>{t('lnSub')}</T>
        <T style={{ color: '#d6e6f7', fontSize: 12, marginTop: 6 }}>
          {!on && newest ? t('liveNotActive', { t: clock(new Date(newest).toISOString()) }) + ' · ' : ''}
          {lastOk ? t('lnChecked', { t: clock(new Date(lastOk).toISOString()) }) : t('loading')}
        </T>
      </LinearGradient>
      <StatusLine />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {REG.map(([k, label]) => (
          <Pressable key={k} onPress={() => setReg(k)} accessibilityRole="button" accessibilityState={{ selected: reg === k }} style={{ backgroundColor: reg === k ? colors.red : colors.surface, borderColor: reg === k ? colors.red : colors.line, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 }}>
            <T f="bodyBold" style={{ fontSize: 13, color: reg === k ? '#fff' : colors.fg }}>{t(label)}</T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <FlatList
        data={list.slice(0, 120)}
        keyExtractor={e => e.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.red]} tintColor={colors.red} />}
        ListEmptyComponent={<T muted style={{ padding: 16 }}>{updates === null ? t('loading') : t('lnEmpty')}</T>}
        ListFooterComponent={<T muted style={{ padding: 16, fontSize: 12, lineHeight: 17 }}>{t('lnRule')}</T>}
        renderItem={({ item: e }) => {
          const brk = e.u ? !!e.u.breaking : isBreaking(e.a!);
          const isNew = fresh.has(e.id);
          const title = e.u ? lu(e.u, 'title') : { s: e.a!.title, so: false };
          const text = e.u ? lu(e.u, 'text') : { s: e.a!.summary, so: false };
          const body = (
            <Row style={{ alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isNew ? (colors.dark ? '#13263f' : '#eef6ff') : 'transparent' }}>
              <View style={{ width: 52, alignItems: 'center' }}>
                <T f="display" style={{ fontSize: 15, color: brk ? colors.red : colors.blue }}>{e.a?.timeVerified === false ? '--:--' : clock(new Date(e.t).toISOString())}</T>
                <T muted style={{ fontSize: 10, textAlign: 'center' }}>{ago(lang, new Date(e.t).toISOString(), now)}</T>
              </View>
              <View style={{ width: 2, alignSelf: 'stretch', backgroundColor: brk ? colors.red : colors.line, borderRadius: 1 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {isNew ? <Pill label={t('lnNew')} color={colors.blue} /> : null}
                  {brk ? <Pill label={t('breakingLabel')} color={colors.red} /> : null}
                  <T f="bodyBold" style={{ fontSize: 11, color: colors.muted }}>{e.region === 'sports' ? t('sports') : t(REG.find(r => r[0] === e.region)?.[1] || 'wireWorld')}</T>
                </Row>
                <T f="displayBold" style={{ fontSize: 16, lineHeight: 21 }}>{title.s}</T>
                {text.s ? <T muted style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={e.u ? undefined : 3}>{text.s}</T> : null}
                <T f="bodyBold" style={{ fontSize: 11, color: colors.muted }}>Wartabiye TV{e.u && (e.u.corroborated || 0) > 1 ? ' · ' + t('luCorrob', { n: e.u.corroborated! }) : ''}</T>
              </View>
            </Row>
          );
          return e.a ? <Pressable onPress={() => open(e.a!)} accessibilityRole="link">{body}</Pressable> : body;
        }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 82 }} />}
      />
    </View>
  );
}
