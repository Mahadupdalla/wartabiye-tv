// Home, the app's own editorial layout of the website's homepage (assets/app.js renderHome + renderSidebars), one column:
// date bar and logo band, the blue menu bar with the DEGDEG ticker (stays on top), CINWAANNADA UGU MUHIIMSAN (five
// headline tiles: the editor's picks, then the mixed feed of the last 72 hours), SOOMAALIYA & BARIGA AFRIKA (six newest),
// MUUQAAL WARARKA, WARARKA CAALAMKA, CIYAARAHA, WARARKA TOOSKA, then the sidebar blocks (Nala soco, Muhiim hadda,
// Ugu dambeeyay, Qaybaha) and the blue footer. Stories already in the headlines are not repeated below, as on the website.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { openLink } from '../../lib/links';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { LIVE_WINDOW_MS } from '../../lib/config';
import { ago, catName, clock, todayLine } from '../../lib/i18n';
import { fetchVideos } from '../../lib/api';
import type { Card, Video } from '../../lib/types';
import { LANG_INFO } from '../../lib/types';
import { BreakingBanner, MenuBar, NewStories, SectionTabs, SiteFooter, StatusLine, Ticker } from '../../components/chrome';
import { LeadStory, MetaLine, NewsRow, PairCard, StoryCard, isBreaking, open } from '../../components/cards';
import { BlockHead, EmptyState, FadeIn, FeedSkeleton, Notice, Photo, ROW_RTL, Row, Sheet, T } from '../../components/ui';
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
  useEffect(() => { fetchVideos(meta).then(v => setVideos(v.slice(0, 6))).catch(() => undefined); }, [meta?.version]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const rows = (list: Card[]) => <Sheet>{list.map((c, i) => <NewsRow key={c.id} c={c} first={i === 0} />)}</Sheet>;
  // a section: the editorial rule, the newest story large, the next ones as rows, all on one white sheet
  const block = (title: string, list: Card[], go: () => void, red?: boolean) => list.length ? (
    <View>
      <BlockHead title={title} red={red} onMore={go} moreLabel={t('seeAll')} />
      <Sheet>
        <StoryCard c={list[0]} />
        {list.slice(1).map(c => <NewsRow key={c.id} c={c} />)}
      </Sheet>
    </View>
  ) : null;
  const pairs = (list: Card[]) => {
    const out: Card[][] = [];
    for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
    return out;
  };
  const flip = rtl && Platform.OS !== 'web';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MenuBar />
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { markSeen(); refresh(); }} colors={[colors.blue]} tintColor={colors.blue} />}
      >
        <View>
          <Ticker />
          <SectionTabs />
        </View>
        <View>
          <StatusLine />
          {hidden > 0 ? <Notice text={t('noTranslationList', { lang: LANG_INFO[lang].name })} action={t('switchSomali')} onAction={() => setLang('so')} /> : null}
          {status === 'loading' && !items.length ? <FeedSkeleton /> : !items.length ? (
            <EmptyState icon="newspaper-outline" title={t('loadFailed')} action={t('retry')} onAction={refresh} />
          ) : (
            <View>
              <BreakingBanner />
              <AdSlot position="home" />
              {home.lead ? (
                <FadeIn index={0}>
                  <BlockHead title={t('latestHeadlines')} sub={todayLine(lang)} style={{ marginTop: 20 }} />
                  <Sheet style={{ borderBottomWidth: 0 }}>
                    <LeadStory c={home.lead} />
                  </Sheet>
                  {home.top.length ? (
                    <Sheet style={{ borderTopWidth: 0, paddingHorizontal: 16, paddingBottom: 6 }}>
                      {pairs(home.top).map((two, i) => (
                        <View key={i} style={{ flexDirection: rtl ? ROW_RTL : 'row', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.hair }}>
                          {two.map(c => <PairCard key={c.id} c={c} />)}
                          {two.length === 1 ? <View style={{ flex: 1 }} /> : null}
                        </View>
                      ))}
                    </Sheet>
                  ) : null}
                </FadeIn>
              ) : null}

              {home.latest.length ? (
                <FadeIn index={1}>
                  <BlockHead title={t('latest')} onMore={() => router.push('/latest')} moreLabel={t('seeAll')} />
                  {rows(home.latest)}
                </FadeIn>
              ) : null}

              <FadeIn index={2}>{block(t('eaBlock'), home.somalia, () => router.push('/section/somalia'))}</FadeIn>
              <AdSlot position="mobile" />

              {videos.length ? (
                <View style={{ backgroundColor: colors.band, marginTop: 30, paddingBottom: 22 }}>
                  <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, gap: 12 }}>
                    <Row style={{ gap: 10, flexShrink: 1 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={15} color="#fff" style={{ marginLeft: 2 }} /></View>
                      <T f="display" numberOfLines={2} style={{ color: '#fff', fontSize: 19, lineHeight: 23, letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 1 }} accessibilityRole="header">{t('videoNewsTitle')}</T>
                    </Row>
                    <Pressable onPress={() => router.navigate('/videos')} accessibilityRole="link" hitSlop={10} style={({ pressed }) => ({ flexDirection: flip ? 'row-reverse' : 'row', alignItems: 'center', gap: 2, opacity: pressed ? 0.6 : 1 })}>
                      <T f="bodyBold" style={{ color: '#9fd0ff', fontSize: 13 }}>{t('seeAll').replace(/\s*[→←›]\s*$/, '')}</T>
                      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color="#9fd0ff" />
                    </Pressable>
                  </Row>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={268} style={{ transform: flip ? [{ scaleX: -1 }] : undefined }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {videos.map(v => (
                      <Pressable key={v.id} onPress={() => router.navigate('/videos')} accessibilityRole="link" accessibilityLabel={v.title} style={({ pressed }) => ({ width: 256, opacity: pressed ? 0.8 : 1, transform: flip ? [{ scaleX: -1 }] : undefined })}>
                        <Photo uri={v.thumbnail} alt={v.title} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={10}>
                          <View style={{ position: 'absolute', left: 10, bottom: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(242,6,10,0.95)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={17} color="#fff" style={{ marginLeft: 2 }} /></View>
                        </Photo>
                        <T f="displayBold" style={{ color: '#fff', fontSize: 15.5, lineHeight: 20, marginTop: 10 }} numberOfLines={3}>{v.title}</T>
                        {v.publishedAt ? <T f="bodyMed" style={{ fontSize: 11.5, color: 'rgba(233,241,251,0.7)', marginTop: 5 }}>{v.source ? v.source + ' · ' : ''}{ago(lang, v.publishedAt)}</T> : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {block(t('worldBlock'), home.world, () => router.push('/section/world'))}
              {block(t('sportsBlock'), home.sports, () => router.push('/section/sports'))}

              {home.live.length ? (
                <View>
                  <BlockHead title={t('liveNewsNav')} red onMore={() => router.navigate('/live')} moreLabel={t('seeAll')} />
                  <Sheet style={{ paddingVertical: 6 }}>
                    {home.live.map((c, i) => (
                      <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" accessibilityLabel={clock(c.publishedAt) + ' ' + c.title} style={({ pressed }) => ({ paddingHorizontal: 16, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                        <Row style={{ gap: 12, alignItems: 'stretch' }}>
                          <T f="display" style={{ width: 44, paddingTop: 11, color: isBreaking(c) ? colors.red : colors.blue, fontSize: 14, textAlign: rtl ? 'left' : 'right' }}>{c.timeVerified === false ? '--:--' : clock(c.publishedAt)}</T>
                          <View style={{ width: 11, alignItems: 'center' }}>
                            <View style={{ position: 'absolute', top: i === 0 ? 15 : 0, bottom: i === home.live.length - 1 ? undefined : 0, height: i === home.live.length - 1 ? 15 : undefined, width: 2, backgroundColor: colors.hair }} />
                            <View style={{ marginTop: 14, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.surface, backgroundColor: isBreaking(c) ? colors.red : colors.blue }} />
                          </View>
                          <T f="displayBold" style={{ flex: 1, fontSize: 15.5, lineHeight: 20.5, paddingVertical: 10 }} numberOfLines={3}>{c.title}</T>
                        </Row>
                      </Pressable>
                    ))}
                  </Sheet>
                </View>
              ) : null}
              <AdSlot position="spotlight" />

              {home.trend.length ? (
                <View>
                  <BlockHead title={t('trending')} red />
                  <Sheet>
                    {home.trend.map((c, i) => (
                      <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" style={({ pressed }) => ({ paddingHorizontal: 16, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                        <Row style={{ gap: 14, alignItems: 'flex-start', paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hair }}>
                          <T f="brand" style={{ color: colors.red, fontSize: 34, lineHeight: 36, width: 28, textAlign: 'center' }}>{i + 1}</T>
                          <View style={{ flex: 1, gap: 6 }}>
                            <T f="display" style={{ fontSize: 16, lineHeight: 20.5 }} numberOfLines={3}>{c.title}</T>
                            <MetaLine c={c} compact />
                          </View>
                        </Row>
                      </Pressable>
                    ))}
                  </Sheet>
                  <T style={{ fontSize: 12, marginTop: 8, marginHorizontal: 16, color: colors.sub }}>{home.editorTrend ? t('trendingNote') : t('trendingAuto')}</T>
                </View>
              ) : null}
              <AdSlot position="sidebar" />

              {home.rest.length ? (
                <View>
                  <BlockHead title={t('allNews')} />
                  {rows(home.rest.slice(0, more))}
                  {home.rest.length > more ? (
                    <Pressable testID="load-more" onPress={() => setMore(m => m + 15)} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'center', marginTop: 16, flexDirection: rtl ? ROW_RTL : 'row', alignItems: 'center', gap: 6, backgroundColor: pressed ? colors.blueD : colors.blue, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 })}>
                      <T f="bodyBold" style={{ fontSize: 14, color: '#fff' }}>{t('loadMore')}</T>
                      <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>({home.rest.length - more})</T>
                      <Ionicons name="chevron-down" size={15} color="#fff" />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {home.cats.length ? (
                <View>
                  <BlockHead title={t('categories')} />
                  <View style={{ flexDirection: rtl ? ROW_RTL : 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16 }}>
                    {home.cats.map(x => (
                      <Pressable key={x.k} onPress={() => catGo(x.k)} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: rtl ? ROW_RTL : 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.hair, backgroundColor: pressed ? colors.tint : colors.surface })}>
                        <T f="bodyBold" style={{ fontSize: 13.5 }}>{catName(lang, x.k)}</T>
                        <View style={{ backgroundColor: colors.tint, borderRadius: 9, paddingHorizontal: 6, minWidth: 22, alignItems: 'center' }}><T f="bodyBold" style={{ fontSize: 11.5, color: colors.link }}>{x.n}</T></View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <BlockHead title={t('follow')} />
              <Row style={{ marginHorizontal: 16, gap: 10 }}>
                {soc.map(([name, url, icon, c]) => (
                  <Pressable key={name} onPress={() => openLink(url)} accessibilityRole="link" accessibilityLabel={'Wartabiye TV · ' + name} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.hair, backgroundColor: pressed ? colors.tint : colors.surface, alignItems: 'center', justifyContent: 'center' })}>
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
      <View style={{ position: 'absolute', top: 140, left: 0, right: 0 }} pointerEvents="box-none">
        <NewStories onPress={() => { markSeen(); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} />
      </View>
    </View>
  );
}
