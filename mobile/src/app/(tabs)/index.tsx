import React, { useMemo, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { LIVE_WINDOW_MS } from '../../lib/config';
import { clock } from '../../lib/i18n';
import type { Card } from '../../lib/types';
import { LANG_INFO } from '../../lib/types';
import { AppHeader, NewStories, StatusLine, Ticker } from '../../components/chrome';
import { ArticleRow, HeroCard, MiniCard, isBreaking, open } from '../../components/cards';
import { FeedSkeleton, Notice, Row, SectionHead, T } from '../../components/ui';
import { AdSlot } from '../../components/ads';

/** Lead story: an active breaking story, else the newest important one of the last day, else the newest */
function leadOf(list: Card[]): Card | undefined {
  const now = Date.now();
  return list.find(c => !c.sponsored && isBreaking(c, now))
    || list.find(c => !c.sponsored && c.important && now - Date.parse(c.publishedAt) < 24 * 3600_000)
    || list.find(c => !c.sponsored);
}

export default function Home() {
  const { colors, t, lang, setLang } = useSettings();
  const { items, status, refreshing, refresh, meta, markSeen } = useContent();
  const listRef = useRef<FlatList<Card>>(null);
  const sorted = useMemo(() => [...items].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)), [items]);
  const lead = leadOf(sorted);
  const bySec = (s: string) => sorted.filter(c => c.section === s && c !== lead && !c.sponsored).slice(0, 8);
  const live = sorted.filter(c => !c.sponsored && Date.now() - Date.parse(c.publishedAt) < LIVE_WINDOW_MS).slice(0, 4);
  const hidden = lang !== 'so' && meta?.counts?.so != null && meta.counts[lang] != null ? Math.max(0, (meta.counts.so || 0) - (meta.counts[lang] || 0)) : 0;

  const chips: { label: string; go: () => void; icon: keyof typeof Ionicons.glyphMap; color?: string }[] = [
    { label: t('somaliaNav'), go: () => router.push('/section/somalia'), icon: 'flag-outline' },
    { label: t('world'), go: () => router.push('/section/world'), icon: 'globe-outline' },
    { label: t('sports'), go: () => router.push('/section/sports'), icon: 'football-outline' },
    { label: t('liveNewsNav'), go: () => router.navigate('/live'), icon: 'radio-outline', color: colors.red },
    { label: t('breaking'), go: () => router.push('/breaking'), icon: 'flash-outline', color: colors.red },
    { label: t('videosNav'), go: () => router.navigate('/videos'), icon: 'play-circle-outline' },
  ];

  const header = (
    <View>
      <StatusLine />
      {hidden > 0 ? <Notice text={t('noTranslationList', { lang: LANG_INFO[lang].name })} action={t('switchSomali')} onAction={() => setLang('so')} /> : null}
      {lead ? <HeroCard c={lead} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, gap: 8 }}>
        {chips.map(ch => (
          <Pressable key={ch.label} onPress={ch.go} accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 })}>
            <Row style={{ gap: 6 }}>
              <Ionicons name={ch.icon} size={15} color={ch.color || colors.blue} />
              <T f="bodyBold" style={{ fontSize: 13 }}>{ch.label}</T>
            </Row>
          </Pressable>
        ))}
      </ScrollView>
      <AdSlot position="home" />
      {live.length ? (
        <View>
          <SectionHead title={t('liveNewsNav')} color={colors.red} onMore={() => router.navigate('/live')} moreLabel={t('readMore')} />
          <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line }}>
            {live.map((c, i) => (
              <Pressable key={c.id} onPress={() => open(c)} accessibilityRole="link" style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <Row style={{ gap: 10, alignItems: 'flex-start' }}>
                  <T f="bodyBold" style={{ color: isBreaking(c) ? colors.red : colors.blue, fontSize: 13, width: 44 }}>{c.timeVerified === false ? '--:--' : clock(c.publishedAt)}</T>
                  <T f="bodyMed" style={{ flex: 1, fontSize: 14, lineHeight: 19 }} numberOfLines={2}>{c.title}</T>
                </Row>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {(['somalia', 'world', 'sports'] as const).map(sec => {
        const l = bySec(sec);
        if (!l.length) return null;
        const title = sec === 'somalia' ? t('somaliaBlock') : sec === 'world' ? t('worldBlock') : t('sportsBlock');
        return (
          <View key={sec}>
            <SectionHead title={title} color={sec === 'sports' ? '#0a8f4e' : sec === 'world' ? colors.blueD : colors.blue} onMore={() => router.push(`/section/${sec}`)} moreLabel={t('readMore')} />
            <FlatList horizontal data={l} keyExtractor={c => c.id} renderItem={({ item }) => <MiniCard c={item} />} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} />
          </View>
        );
      })}
      <SectionHead title={t('latest')} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <Ticker />
      <View style={{ flex: 1 }}>
        <NewStories onPress={() => { markSeen(); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} />
        {status === 'loading' && !items.length ? (
          <FeedSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={sorted}
            keyExtractor={c => c.id}
            renderItem={({ item }) => <ArticleRow c={item} />}
            ListHeaderComponent={header}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={9}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { markSeen(); refresh(); }} colors={[colors.blue]} tintColor={colors.blue} />}
            ListFooterComponent={<View style={{ padding: 24, alignItems: 'center' }}><T muted style={{ fontSize: 12, textAlign: 'center' }}>{t('sameNews')}</T></View>}
          />
        )}
      </View>
    </View>
  );
}
