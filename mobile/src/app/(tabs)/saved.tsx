import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { AppHeader } from '../../components/chrome';
import { ArticleRow } from '../../components/cards';
import { Row, T } from '../../components/ui';

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
        ListHeaderComponent={<View style={{ padding: 16 }}><T f="display" style={{ fontSize: 22 }}>{t('saved')}</T><T muted style={{ fontSize: 13, marginTop: 4 }}>{t('savedOffline')}</T></View>}
        ListEmptyComponent={<T muted style={{ paddingHorizontal: 16, fontSize: 15, lineHeight: 22 }}>{t('savedEmpty')}</T>}
        renderItem={({ item }) => item.removed ? (
          <Row style={{ padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <T muted style={{ flex: 1, fontSize: 14 }}>{t('removedArticle')}</T>
            <Pressable onPress={() => toggleSaved(item.card)} accessibilityRole="button" accessibilityLabel={t('unsave')}><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>
          </Row>
        ) : (
          <View>
            <ArticleRow c={item.card} />
            <Pressable onPress={() => toggleSaved(item.card)} accessibilityRole="button" style={{ position: 'absolute', right: 10, bottom: 8, padding: 6 }} accessibilityLabel={t('unsave')}>
              <Ionicons name="bookmark" size={18} color={colors.blue} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
