// Home: the website's homepage (assets/app.js renderHome + renderSidebars) in the same order, adapted to one column:
// date bar and logo band, the blue menu bar with the DEGDEG ticker (stays on top), CINWAANNADA UGU MUHIIMSAN (five
// headline tiles: the editor's picks, then the mixed feed of the last 72 hours), SOOMAALIYA & BARIGA AFRIKA (six newest),
// MUUQAAL WARARKA, WARARKA CAALAMKA, CIYAARAHA, WARARKA TOOSKA, then the sidebar blocks (Nala soco, Muhiim hadda,
// Ugu dambeeyay, Qaybaha) and the blue footer. Stories already in the headlines are not repeated below, as on the website.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { openLink } from '../../lib/links';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { LIVE_WINDOW_MS } from '../../lib/config';
import { ago, catName, clock } from '../../lib/i18n';
import { fetchVideos } from '../../lib/api';
import type { Card, Video } from '../../lib/types';
import { LANG_INFO } from '../../lib/types';
import { BreakingBanner, DateLine, MenuBar, NewStories, SectionChips, SiteFooter, StatusLine, Ticker } from '../../components/chrome';
import { MetaLine, NewsRow, StoryCard, Tile, isBreaking, open } from '../../components/cards';
import { BlockHead, EmptyState, FeedSkeleton, Group, Notice, Photo, ROW_RTL, Row, T } from '../../components/ui';
import { AdSlot } from '../../components/ads';

const CATS = ['Siyaasadda', 'Amniga', 'Bulshada', 'Dhaqaalaha', 'Adduunka', 'Ciyaaraha'];
const H = 3600_000;

/** The website's rankScore() + mixFeed(): freshness first, a bonus for breaking / important, no more than two in a row from one section */
function mixFeed(list: Card[], now: number): Card[] {
  const score = (c: Card) => {
    const t = Date.parse(c.publishedAt);
    let h = isNaN(t) ? 1e4 : Math.max(0, (now - t) / H);
    if (isBreaking(c, now)) h -= 6;
    if (c.important) h -= 3;
    if (c.timeVerified === false) h += 2;
    return h;
  };
  const q = list.map((c, i) => ({ c, s: score(c), i })).sort((a, b) => a.s - b.s || a.i - b.i).map(o => o.c);
  const out: Card[] = [];
  while (q.length) {
    let k = 0;
    const n = out.length;
    if (n >= 2 && out[n - 1].section === out[n - 2].section) {
      const s0 = out[n - 1].section;
      for (let i = 1; i < q.length && i < 4; i++) if (q[i].section !== s0) { k = q[0].section === s0 ? i : 0; break; }
    }
    out.push(q.splice(k, 1)[0]);
  }
  return out;
}

export default function Home() {
  const { colors, t, lang, setLang, rtl } = useSettings();
  const { items, status, refreshing, refresh, meta, markSeen } = useContent();
  const scrollRef = useRef<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [more, setMore] = useState(10);
  useEffect(() => { fetchVideos(meta).then(v => setVideos(v.slice(0, 3))).catch(() => undefined); }, [meta?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const home = useMemo(() => {
    const now = Date.now();
    const sorted = [...items].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    const byId = new Map(sorted.map(c => [c.id, c]));
    const fe = (meta?.featured || []).map(id => byId.get(id)).filter(Boolean) as Card[];
    const ranked = mixFeed(sorted.filter(c => !c.sponsored), now);
    const fresh = ranked.filter(c => now - Date.parse(c.publishedAt) < 72 * H);
    const pool = fresh.length >= 5 ? fresh : fresh.concat(ranked.filter(c => !fresh.includes(c)));
    const lead = fe[0] || pool.find(c => c.image) || pool[0];
    const others = fe.slice(1).concat(pool.filter(c => !fe.includes(c) && c !== lead));
    const top = others.slice(0, 4);
    const shown = new Set<string>([lead?.id, ...top.map(c => c.id)].filter(Boolean) as string[]);
    const take = (list: Card[], n: number) => { const out = list.filter(c => !shown.has(c.id)).slice(0, n); out.forEach(c => shown.add(c.id)); return out; };
    const latest = take(sorted.filter(c => !c.sponsored), 5);
    const somalia = take(sorted.filter(c => c.section === 'somalia' && !c.sponsored), 5);
    const world = take(sorted.filter(c => c.section === 'world' && !c.sponsored), 4);
    const sports = take(sorted.filter(c => c.section === 'sports' && !c.sponsored), 4);
    const live = sorted.filter(c => !c.sponsored && now - Date.parse(c.publishedAt) < LIVE_WINDOW_MS).slice(0, 5);
    // Muhiim hadda: the editor's list, else breaking, important (72 h), the newest of each section, then the newest
    const seen = new Set<string>(); const trend: Card[] = [];
    const add = (c?: Card) => { if (c && !c.sponsored && !seen.has(c.id)) { seen.add(c.id); trend.push(c); } };
    (meta?.trending || []).forEach(id => add(byId.get(id)));
    sorted.filter(c => isBreaking(c, now)).forEach(add);
    sorted.filter(c => c.important && now - Date.parse(c.publishedAt) < 72 * H).forEach(add);
    (['somalia', 'world', 'sports'] as const).forEach(s => add(sorted.find(c => c.section === s)));
    sorted.slice(0, 6).forEach(add);
    // every other published story, newest first, so Home really holds all the website's news
    const rest = sorted.filter(c => !shown.has(c.id));
    const cats = CATS.map(k => ({ k, n: sorted.filter(c => c.category === k).length })).filter(x => x.n > 0);
    return { lead, top, latest, somalia, world, sports, live, trend: trend.slice(0, 5), rest, cats, editorTrend: (meta?.trending || []).length > 0, total: sorted.length };
  }, [items, meta]);

  const hidden = lang !== 'so' && meta?.counts?.so != null && meta.counts[lang] != null ? Math.max(0, (meta.counts.so || 0) - (meta.counts[lang] || 0)) : 0;
  const social = meta?.social || {};
  const soc: [string, string, keyof typeof Ionicons.glyphMap, string][] = [
    ['Facebook', social.facebook || 'https://www.facebook.com/share/18bkUUeoJx/?mibextid=wwXIfr', 'logo-facebook', '#0866FF'],
    ['YouTube', social.youtube || 'https://www.youtube.com/@WarTabiye-channel', 'logo-youtube', '#FF0000'],
    ['TikTok', social.tiktok || 'https://www.tiktok.com/@wartabiyetv', 'logo-tiktok', colors.dark ? '#fff' : '#000'],
  ];
  const catGo = (k: string) => router.push(k === 'Adduunka' ? '/section/world' : k === 'Ciyaaraha' ? '/section/sports' : { pathname: '/section/[key]', params: { key: 'somalia', cat: k } });
  const rows = (list: Card[]) => <Group>{list.map((c, i) => <NewsRow key={c.id} c={c} first={i === 0} />)}</Group>;
  const block = (title: string, list: Card[], go: () => void, red?: boolean) => list.length ? (
    <View>
      <BlockHead title={title} red={red} onMore={go} moreLabel={t('seeAll')} />
      <StoryCard c={list[0]} />
      {list.length > 1 ? rows(list.slice(1)) : null}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MenuBar />
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { markSeen(); refresh(); }} colors={[colors.blue]} tintColor={colors.blue} />}
      >
        <Ticker />
        <View>
          <DateLine />
          <StatusLine />
          {hidden > 0 ? <Notice text={t('noTranslationList', { lang: LANG_INFO[lang].name })} action={t('switchSomali')} onAction={() => setLang('so')} /> : null}
          {status === 'loading' && !items.length ? <FeedSkeleton /> : !items.length ? (
            <EmptyState icon="newspaper-outline" title={t('loadFailed')} action={t('retry')} onAction={refresh} />
          ) : (
            <View>
              <SectionChips />
              <BreakingBanner />
              <AdSlot position="home" />
              {home.lead ? (
                <View>
                  <BlockHead title={t('latestHeadlines')} />
                  <Tile c={home.lead} big />
                  {home.top.length ? rows(home.top) : null}
                </View>
              ) : null}

              {home.latest.length ? (
                <View>
                  <BlockHead title={t('latest')} />
                  {rows(home.latest)}
                </View>
              ) : null}

              {block(t('eaBlock'), home.somalia, () => router.push('/section/somalia'))}
              <AdSlot position="mobile" />
              {block(t('worldBlock'), home.world, () => router.push('/section/world'))}
              {block(t('sportsBlock'), home.sports, () => router.push('/section/sports'))}

              {home.live.length ? (
                <View>
                  <BlockHead title={t('liveNewsNav')} red onMore={() => router.navigate('/live')} moreLabel={t('seeAll')} />
                  <Group>
                    {home.live.map((c, i) => (
                      <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={clock(c.publishedAt) + ' ' + c.title} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hair, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                          <View style={{ alignItems: 'center', width: 46, gap: 4, paddingTop: 1 }}>
                            <T f="display" style={{ color: isBreaking(c) ? colors.red : colors.blue, fontSize: 14, textAlign: 'center' }}>{c.timeVerified === false ? '--:--' : clock(c.publishedAt)}</T>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isBreaking(c) ? colors.red : colors.grey }} />
                          </View>
                          <T f="displayBold" style={{ flex: 1, fontSize: 15, lineHeight: 20 }} numberOfLines={3}>{c.title}</T>
                        </Row>
                      </Pressable>
                    ))}
                  </Group>
                </View>
              ) : null}
              <AdSlot position="spotlight" />

              {videos.length ? (
                <View>
                  <BlockHead title={t('videoNewsTitle')} onMore={() => router.navigate('/videos')} moreLabel={t('seeAll')} />
                  {videos.slice(0, 1).map(v => (
                    <Pressable key={v.id} onPress={() => router.navigate('/videos')} accessibilityRole="link" accessibilityLabel={v.title} style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: colors.dark ? 1 : 0, borderColor: colors.hair }}>
                      <Photo uri={v.thumbnail} alt={v.title} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0}>
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(242,6,10,0.92)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} /></View>
                        </View>
                      </Photo>
                      <View style={{ padding: 14, gap: 6 }}>
                        <T f="display" style={{ fontSize: 17, lineHeight: 21.5 }} numberOfLines={3}>{v.title}</T>
                        <Row style={{ gap: 8 }}>
                          {v.source ? <T f="bodyBold" style={{ fontSize: 12 }}>{v.source}</T> : null}
                          {v.publishedAt ? <T f="bodyMed" style={{ fontSize: 12, color: colors.sub }}>{ago(lang, v.publishedAt)}</T> : null}
                        </Row>
                      </View>
                    </Pressable>
                  ))}
                  {videos.length > 1 ? (
                    <Group>
                      {videos.slice(1).map((v, i) => (
                        <Pressable key={v.id} onPress={() => router.navigate('/videos')} accessibilityRole="link" accessibilityLabel={v.title} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hair, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                          <Row style={{ gap: 12 }}>
                            <Photo uri={v.thumbnail} alt={v.title} style={{ width: 96, height: 56 }} rounded={8}>
                              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play-circle" size={24} color="#fff" /></View>
                            </Photo>
                            <T f="displayBold" style={{ flex: 1, fontSize: 14.5, lineHeight: 19 }} numberOfLines={3}>{v.title}</T>
                          </Row>
                        </Pressable>
                      ))}
                    </Group>
                  ) : null}
                </View>
              ) : null}

              {home.trend.length ? (
                <View>
                  <BlockHead title={t('trending')} red />
                  <Group>
                    {home.trend.map((c, i) => (
                      <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hair, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
                          <T f="brand" style={{ color: colors.red, fontSize: 26, lineHeight: 28, width: 22, textAlign: 'center' }}>{i + 1}</T>
                          <View style={{ flex: 1, gap: 5 }}>
                            <T f="display" style={{ fontSize: 15.5, lineHeight: 20 }} numberOfLines={3}>{c.title}</T>
                            <MetaLine c={c} />
                          </View>
                        </Row>
                      </Pressable>
                    ))}
                  </Group>
                  <T style={{ fontSize: 12, marginTop: 8, marginHorizontal: 18, color: colors.sub }}>{home.editorTrend ? t('trendingNote') : t('trendingAuto')}</T>
                </View>
              ) : null}
              <AdSlot position="sidebar" />

              {home.rest.length ? (
                <View>
                  <BlockHead title={t('allNews')} />
                  {rows(home.rest.slice(0, more))}
                  {home.rest.length > more ? (
                    <Pressable testID="load-more" onPress={() => setMore(m => m + 15)} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'center', marginTop: 14, flexDirection: rtl ? ROW_RTL : 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.hair, backgroundColor: pressed ? colors.tint : colors.surface, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 })}>
                      <T f="bodyBold" style={{ fontSize: 14, color: colors.link }}>{t('loadMore')}</T>
                      <T style={{ fontSize: 13, color: colors.sub }}>({home.rest.length - more})</T>
                      <Ionicons name="chevron-down" size={15} color={colors.link} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {home.cats.length ? (
                <View>
                  <BlockHead title={t('categories')} />
                  <View style={{ flexDirection: rtl ? ROW_RTL : 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16 }}>
                    {home.cats.map(x => (
                      <Pressable key={x.k} onPress={() => catGo(x.k)} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: rtl ? ROW_RTL : 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.hair, backgroundColor: pressed ? colors.tint : colors.surface })}>
                        <T f="bodyBold" style={{ fontSize: 13.5 }}>{catName(lang, x.k)}</T>
                        <T f="bodyBold" style={{ fontSize: 12, color: colors.sub }}>{x.n}</T>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <BlockHead title={t('follow')} />
              <Row style={{ marginHorizontal: 16, gap: 10 }}>
                {soc.map(([name, url, icon, c]) => (
                  <Pressable key={name} onPress={() => openLink(url)} accessibilityRole="link" accessibilityLabel={'Wartabiye TV · ' + name} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.hair, backgroundColor: pressed ? colors.tint : colors.surface, alignItems: 'center', justifyContent: 'center' })}>
                    <Row style={{ gap: 8 }}>
                      <Ionicons name={icon} size={19} color={c} />
                      <T f="bodyBold" style={{ fontSize: 13.5 }}>{name}</T>
                    </Row>
                  </Pressable>
                ))}
              </Row>
              <SiteFooter />
            </View>
          )}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', top: 100, left: 0, right: 0 }} pointerEvents="box-none">
        <NewStories onPress={() => { markSeen(); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} />
      </View>
    </View>
  );
}
