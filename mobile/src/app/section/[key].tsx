import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { catName } from '../../lib/i18n';
import type { Card } from '../../lib/types';
import { ArticleRow, HeroCard } from '../../components/cards';
import { StatusLine } from '../../components/chrome';
import { FeedSkeleton, T } from '../../components/ui';

// Soomaaliya, Caalamka and Ciyaaraha: the same three sections as the website, newest first by the publisher's time
const SPORT_NAMES: Record<string, string> = { football: '⚽', basketball: '🏀', athletics: '🏃', formula1: '🏎', tennis: '🎾', boxing: '🥊', cricket: '🏏' };

export default function SectionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const sec = key === 'world' || key === 'sports' ? key : 'somalia';
  const { colors, t, lang } = useSettings();
  const { items, status, refreshing, refresh } = useContent();
  const [chip, setChip] = useState('');
  const base = useMemo(() => items.filter(c => c.section === sec && !c.sponsored).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)), [items, sec]);
  const chips = useMemo(() => {
    if (sec === 'somalia') {
      const cats = [...new Set(base.map(c => c.category).filter(Boolean))];
      return [{ k: '', label: t('all') }, { k: 'country:so', label: t('somaliaNav') }, ...cats.map(c => ({ k: 'cat:' + c, label: catName(lang, c) }))];
    }
    if (sec === 'sports') {
      const sports = [...new Set(base.map(c => c.sport).filter(Boolean))] as string[];
      return sports.length > 1 ? [{ k: '', label: t('all') }, ...sports.map(s => ({ k: 'sport:' + s, label: (SPORT_NAMES[s] ? SPORT_NAMES[s] + ' ' : '') + s.charAt(0).toUpperCase() + s.slice(1) }))] : [];
    }
    return [];
  }, [base, sec, t, lang]);
  const list: Card[] = useMemo(() => {
    if (!chip) return base;
    const [k, v] = chip.split(':');
    return base.filter(c => (k === 'country' ? c.country === v : k === 'cat' ? c.category === v : c.sport === v));
  }, [base, chip]);
  const title = sec === 'somalia' ? t('eaTitle') : sec === 'world' ? t('worldTitle') : t('sportsTitle');
  const sub = sec === 'somalia' ? t('eaSub') : sec === 'world' ? t('worldSub') : t('sportsSub');
  const empty = sec === 'somalia' ? t('noSo') : sec === 'world' ? t('noWorld') : t('noSports');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: sec === 'somalia' ? t('somaliaNav') : sec === 'world' ? t('world') : t('sports') }} />
      {status === 'loading' && !items.length ? <FeedSkeleton /> : (
        <FlatList
          data={list.slice(1)}
          keyExtractor={c => c.id}
          renderItem={({ item }) => <ArticleRow c={item} />}
          initialNumToRender={8}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.blue]} tintColor={colors.blue} />}
          ListHeaderComponent={
            <View>
              <View style={{ backgroundColor: sec === 'sports' ? '#0a8f4e' : colors.blueD, padding: 16 }}>
                <T f="display" style={{ color: '#fff', fontSize: 22 }}>{title}</T>
                <T style={{ color: '#e6f0fb', fontSize: 13, marginTop: 4, lineHeight: 18 }}>{sub}</T>
              </View>
              <StatusLine />
              {chips.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
                  {chips.map(c => (
                    <Pressable key={c.k} onPress={() => setChip(c.k)} accessibilityRole="button" accessibilityState={{ selected: chip === c.k }} style={{ backgroundColor: chip === c.k ? colors.blue : colors.surface, borderWidth: 1, borderColor: chip === c.k ? colors.blue : colors.line, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <T f="bodyBold" style={{ fontSize: 13, color: chip === c.k ? '#fff' : colors.fg }}>{c.label}</T>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {list[0] ? <HeroCard c={list[0]} /> : <T muted style={{ padding: 16 }}>{empty}</T>}
              <View style={{ height: 10 }} />
            </View>
          }
        />
      )}
    </View>
  );
}
