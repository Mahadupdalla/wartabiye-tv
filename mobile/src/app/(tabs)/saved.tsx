import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { AppHeader } from '../../components/chrome';
import { ArticleRow } from '../../components/cards';
import { EmptyState, Row, T, PageHero } from '../../components/ui';

// Saved articles stay on this phone only, with an offline copy. An article that the website no longer publishes is
// marked and its offline copy deleted (it is not shown any more).
export default function Saved() {
  const { colors, t } = useSettings();
  const { saved, toggleSaved } = useContent();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <FlatList
        data={saved}
        keyExtractor={s => s.card.id}
        ListHeaderComponent={<View style={{ marginBottom: 8 }}><PageHero title={t('saved')} sub={t('savedOffline')} /></View>}
        ListEmptyComponent={<EmptyState icon="bookmark-outline" title={t('saved')} text={t('savedEmpty')} />}
        renderItem={({ item }) => item.removed ? (
          <Row style={{ padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <T muted style={{ flex: 1, fontSize: 14 }}>{t('removedArticle')}</T>
            <Pressable onPress={() => toggleSaved(item.card)} accessibilityRole="button" accessibilityLabel={t('unsave')}><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>
          </Row>
        ) : (
          <View style={{ backgroundColor: colors.surface }}>
            <ArticleRow c={item.card} action={(
              <Pressable onPress={() => toggleSaved(item.card)} accessibilityRole="button" hitSlop={8} style={{ padding: 4 }} accessibilityLabel={t('unsave')}>
                <Ionicons name="bookmark" size={18} color={colors.blue} />
              </Pressable>
            )} />
          </View>
        )}
      />
    </View>
  );
}
