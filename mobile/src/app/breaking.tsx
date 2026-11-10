import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { ArticleRow, HeroCard, isBreaking } from '../components/cards';
import { T, PageHero } from '../components/ui';

// Breaking News: every story the newsroom marked "breaking", newest first; the ones of the last 12 hours on top
export default function Breaking() {
  const { colors, t } = useSettings();
  const { items } = useContent();
  const list = useMemo(() => items.filter(c => c.breaking && !c.sponsored).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)), [items]);
  const active = list.filter(c => isBreaking(c));
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={list.filter(c => !active.includes(c))}
      keyExtractor={c => c.id}
      renderItem={({ item }) => <ArticleRow c={item} />}
      ListHeaderComponent={
        <View>
          <PageHero red title={t('breakingTitle')} sub={t('breakingSub')} />
          {active.length ? active.map(c => <HeroCard key={c.id} c={c} />) : <T muted style={{ padding: 16, fontSize: 15 }}>{t('breakingNone')}</T>}
          <View style={{ height: 12 }} />
        </View>
      }
    />
  );
}
