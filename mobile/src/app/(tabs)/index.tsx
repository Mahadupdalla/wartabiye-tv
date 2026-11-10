// Home: the website's homepage (assets/app.js renderHome + renderSidebars) in the same order, adapted to one column:
// date bar and logo band, the blue menu bar with the DEGDEG ticker (stays on top), CINWAANNADA UGU MUHIIMSAN (five
// headline tiles: the editor's picks, then the mixed feed of the last 72 hours), SOOMAALIYA & BARIGA AFRIKA (six newest),
// MUUQAAL WARARKA, WARARKA CAALAMKA, CIYAARAHA, WARARKA TOOSKA, then the sidebar blocks (Nala soco, Muhiim hadda,
// Ugu dambeeyay, Qaybaha) and the blue footer. Stories already in the headlines are not repeated below, as on the website.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { LIVE_WINDOW_MS } from '../../lib/config';
import { ago, catName, clock } from '../../lib/i18n';
import { fetchVideos } from '../../lib/api';
import type { Card, Video } from '../../lib/types';
import { LANG_INFO } from '../../lib/types';
import { MenuBar, NewStories, SiteFooter, SiteTop, StatusLine, Ticker } from '../../components/chrome';
import { GridCard, MetaLine, MiniRow, StoryCard, Tile, isBreaking, open } from '../../components/cards';
import { BlockHead, FeedSkeleton, Notice, Photo, Row, T } from '../../components/ui';
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
  const { colors, t, lang, setLang } = useSettings();
  const { items, status, refreshing, refresh, meta, markSeen, lastOk } = useContent();
  const scrollRef = useRef<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
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
    const mosaic = lead ? [lead, ...others.slice(0, 4)] : [];
    const somalia = sorted.filter(c => !mosaic.includes(c) && c.section === 'somalia').slice(0, 6);
    const block = (s: 'world' | 'sports') => sorted.filter(c => c.section === s && !c.sponsored && !somalia.includes(c) && !mosaic.includes(c)).slice(0, 6);
    const live = sorted.filter(c => !c.sponsored && now - Date.parse(c.publishedAt) < LIVE_WINDOW_MS).slice(0, 5);
    // Muhiim hadda: the editor's list, else breaking, important (72 h), the newest of each section, then the newest
    const seen = new Set<string>(); const trend: Card[] = [];
    const add = (c?: Card) => { if (c && !c.sponsored && !seen.has(c.id)) { seen.add(c.id); trend.push(c); } };
    (meta?.trending || []).forEach(id => add(byId.get(id)));
    sorted.filter(c => isBreaking(c, now)).forEach(add);
    sorted.filter(c => c.important && now - Date.parse(c.publishedAt) < 72 * H).forEach(add);
    (['somalia', 'world', 'sports'] as const).forEach(s => add(sorted.find(c => c.section === s)));
    sorted.slice(0, 6).forEach(add);
    const cats = CATS.map(k => ({ k, n: sorted.filter(c => c.category === k).length }));
    return { mosaic, somalia, world: block('world'), sports: block('sports'), live, trend: trend.slice(0, 5), latest: sorted.slice(0, 5), cats, editorTrend: (meta?.trending || []).length > 0 };
  }, [items, meta]);

  const hidden = lang !== 'so' && meta?.counts?.so != null && meta.counts[lang] != null ? Math.max(0, (meta.counts.so || 0) - (meta.counts[lang] || 0)) : 0;
  const updated = lastOk ? t('updated') + ago(lang, new Date(lastOk).toISOString()) + ' · ' + t('updatedDaily') : t('updatedDaily');
  const social = meta?.social || {};
  const soc: [string, string, keyof typeof Ionicons.glyphMap, string][] = [
    ['Facebook', social.facebook || 'https://www.facebook.com/share/18bkUUeoJx/?mibextid=wwXIfr', 'logo-facebook', '#0866FF'],
    ['YouTube', social.youtube || 'https://www.youtube.com/@WarTabiye-channel', 'logo-youtube', '#FF0000'],
    ['TikTok', social.tiktok || 'https://www.tiktok.com/@wartabiyetv', 'logo-tiktok', colors.dark ? '#fff' : '#000'],
  ];
  const catGo = (k: string) => router.push(k === 'Adduunka' ? '/section/world' : k === 'Ciyaaraha' ? '/section/sports' : { pathname: '/section/[key]', params: { key: 'somalia', cat: k } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { markSeen(); refresh(); }} colors={[colors.blue]} tintColor={colors.blue} />}
      >
        <SiteTop />
        <View>
          <MenuBar />
          <Ticker />
        </View>
        <View>
          <StatusLine />
          {hidden > 0 ? <Notice text={t('noTranslationList', { lang: LANG_INFO[lang].name })} action={t('switchSomali')} onAction={() => setLang('so')} /> : null}
          {status === 'loading' && !items.length ? <FeedSkeleton /> : (
            <View>
              <AdSlot position="home" />
              {home.mosaic.length ? (
                <View>
                  <BlockHead title={t('latestHeadlines')} />
                  {home.mosaic.map((c, i) => <Tile key={c.id} c={c} big={i === 0} />)}
                </View>
              ) : null}

              {home.somalia.length ? (
                <View>
                  <BlockHead title={t('eaBlock')} onMore={() => router.push('/section/somalia')} moreLabel={t('seeAll') + ' →'} style={{ marginBottom: 8 }} />
                  <T f="bodyMed" style={{ fontSize: 12.5, marginHorizontal: 16, marginBottom: 16 }} muted>{updated}</T>
                  {home.somalia.map((c, i) => (
                    <React.Fragment key={c.id}>
                      <StoryCard c={c} />
                      {i === 3 ? <AdSlot position="card" /> : null}
                    </React.Fragment>
                  ))}
                </View>
              ) : null}
              <AdSlot position="mobile" />
              <AdSlot position="spotlight" />

              {videos.length ? (
                <View>
                  <BlockHead title={t('videoNewsTitle')} onMore={() => router.navigate('/videos')} moreLabel={t('seeAll') + ' →'} />
                  {videos.map(v => (
                    <Pressable key={v.id} onPress={() => router.navigate('/videos')} accessibilityRole="link" accessibilityLabel={v.title} style={{ marginHorizontal: 16, marginBottom: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' }}>
                      <Photo uri={v.thumbnail} alt={v.title} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0}>
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={26} color="#fff" /></View>
                        </View>
                      </Photo>
                      <View style={{ padding: 14, gap: 8 }}>
                        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 6 }}>
                          <T f="display" style={{ color: '#fff', fontSize: 10.5, lineHeight: 11, letterSpacing: 0.95, textTransform: 'uppercase' }}>{v.kind === 'sports' ? t('sports') : v.kind === 'somalia' ? t('somalia') : t('world')}</T>
                        </View>
                        <T f="display" style={{ fontSize: 17, lineHeight: 21 }} numberOfLines={3}>{v.title}</T>
                        <Row style={{ gap: 8 }}>
                          {v.source ? <T f="bodyBold" style={{ fontSize: 12.5 }}>{v.source}</T> : null}
                          {v.publishedAt ? <T f="bodyMed" style={{ fontSize: 12.5 }} muted>{ago(lang, v.publishedAt)}</T> : null}
                        </Row>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {home.world.length ? (
                <View>
                  <BlockHead title={t('worldBlock')} onMore={() => router.push('/section/world')} moreLabel={t('seeAll') + ' →'} />
                  {home.world.map(c => <GridCard key={c.id} c={c} />)}
                </View>
              ) : null}
              {home.sports.length ? (
                <View>
                  <BlockHead title={t('sportsBlock')} onMore={() => router.push('/section/sports')} moreLabel={t('seeAll') + ' →'} />
                  {home.sports.map(c => <GridCard key={c.id} c={c} />)}
                </View>
              ) : null}

              {home.live.length ? (
                <View>
                  <BlockHead title={t('liveNewsNav')} red onMore={() => router.navigate('/live')} moreLabel={t('seeAll') + ' →'} />
                  <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 }}>
                    {home.live.map((c, i) => (
                      <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                          <View style={{ alignItems: 'center', width: 46 }}>
                            <T f="display" style={{ color: isBreaking(c) ? colors.red : colors.blue, fontSize: 14 }}>{c.timeVerified === false ? '--:--' : clock(c.publishedAt)}</T>
                          </View>
                          <T f="displayBold" style={{ flex: 1, fontSize: 15, lineHeight: 20 }} numberOfLines={3}>{c.title}</T>
                        </Row>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <BlockHead title={t('follow')} />
              <Row style={{ marginHorizontal: 16, gap: 10, flexWrap: 'wrap' }}>
                {soc.map(([name, url, icon, c]) => (
                  <Pressable key={name} onPress={() => Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={'Wartabiye TV · ' + name} style={{ flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 }}>
                    <Row style={{ gap: 8, justifyContent: 'center' }}>
                      <Ionicons name={icon} size={20} color={c} />
                      <T f="bodyBold" style={{ fontSize: 14 }}>{name}</T>
                    </Row>
                  </Pressable>
                ))}
              </Row>

              {home.trend.length ? (
                <View>
                  <BlockHead title={t('trending')} red />
                  <View style={{ marginHorizontal: 16 }}>
                    {home.trend.map((c, i) => (
                      <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
                          <T f="brand" style={{ color: colors.red, fontSize: 28, lineHeight: 30, width: 26 }}>{i + 1}</T>
                          <View style={{ flex: 1, gap: 6 }}>
                            <T f="display" style={{ fontSize: 15.5, lineHeight: 20 }}>{c.title}</T>
                            <MetaLine c={c} />
                          </View>
                        </Row>
                      </Pressable>
                    ))}
                    <T style={{ fontSize: 12, marginTop: 6 }} muted>{home.editorTrend ? t('trendingNote') : t('trendingAuto')}</T>
                  </View>
                </View>
              ) : null}
              <AdSlot position="sidebar" />

              {home.latest.length ? (
                <View>
                  <BlockHead title={t('latestShort')} />
                  <View style={{ marginHorizontal: 16 }}>{home.latest.map((c, i) => <MiniRow key={c.id} c={c} first={i === 0} />)}</View>
                </View>
              ) : null}

              <BlockHead title={t('categories')} />
              <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 }}>
                {home.cats.map((x, i) => (
                  <Pressable key={x.k} onPress={() => catGo(x.k)} accessibilityRole="link" style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T f="bodyBold" style={{ fontSize: 15 }}>{catName(lang, x.k)}</T>
                      <View style={{ backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}><T f="bodyBold" style={{ fontSize: 12 }} muted>{x.n}</T></View>
                    </Row>
                  </Pressable>
                ))}
              </View>
              <SiteFooter />
            </View>
          )}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', top: 120, left: 0, right: 0 }} pointerEvents="box-none">
        <NewStories onPress={() => { markSeen(); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} />
      </View>
    </View>
  );
}
