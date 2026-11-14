import React, { useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { NewsRow } from '../components/cards';
import { StatusLine } from '../components/chrome';
import { EmptyState, FeedSkeleton, PageHero } from '../components/ui';

// Latest news: every published story of the chosen language, newest first by the publisher's time (as the website's
// "Wararkii ugu dambeeyay"), each story once. Pull down to check the website at once.
export default function Latest() {
  const { colors, t } = useSettings();
  const { items, status, refreshing, refresh } = useContent();
  const list = useMemo(() => {
    const seen = new Set<string>();
    return items.filter(c => !c.sponsored && !seen.has(c.id) && seen.add(c.id)).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }, [items]);
  if (status === 'loading' && !items.length) return <View style={{ flex: 1, backgroundColor: colors.bg }}><FeedSkeleton /></View>;
  return (
    <FlatList
      testID="latest-list"
      style={{ backgroundColor: colors.bg }}
      data={list}
      keyExtractor={c => c.id}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={11}
      removeClippedSubviews
      renderItem={({ item, index }) => {
        const last = index === list.length - 1;
        return (
          <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, overflow: 'hidden', borderTopLeftRadius: index === 0 ? 14 : 0, borderTopRightRadius: index === 0 ? 14 : 0, borderBottomLeftRadius: last ? 14 : 0, borderBottomRightRadius: last ? 14 : 0 }}>
            <NewsRow c={item} first={index === 0} />
          </View>
        );
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.blue]} tintColor={colors.blue} />}
      ListHeaderComponent={<View style={{ marginBottom: 12 }}><PageHero title={t('latest')} sub={t('latestSub')} /><StatusLine /></View>}
      ListEmptyComponent={status === 'error' ? <EmptyState icon="cloud-offline-outline" title={t('loadFailed')} action={t('retry')} onAction={refresh} /> : <EmptyState icon="newspaper-outline" title={t('noSo')} />}
      ListFooterComponent={<View style={{ height: 28 }} />}
    />
  );
}
