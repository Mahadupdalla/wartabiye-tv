import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { catName } from '../lib/i18n';
import { ArticleRow } from '../components/cards';
import { EmptyState, Row, T } from '../components/ui';

// Search in every published article of the chosen language (title, summary, category), newest first
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export default function Search() {
  const { colors, t, lang, rtl } = useSettings();
  const { items } = useContent();
  const [typed, setQ] = useState('');
  // the field shows every letter at once; the result list follows a moment later, so fast typing never loses letters
  const q = useDeferredValue(typed);
  const res = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(w => w.length > 1);
    if (!words.length) return [];
    return items.filter(c => {
      const hay = fold([c.title, c.summary, c.category, catName(lang, c.category)].join(' '));
      return words.every(w => hay.includes(w));
    }).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }, [q, items, lang]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.hair }}>
        <Row style={{ backgroundColor: colors.chip, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: colors.hair }}>
        <Ionicons name="search" size={18} color={colors.sub} />
        <TextInput
          value={typed} onChangeText={setQ} autoFocus placeholder={t('searchPh')} placeholderTextColor={colors.muted} returnKeyType="search" clearButtonMode="while-editing"
          accessibilityLabel={t('search')}
          style={{ flex: 1, color: colors.fg, paddingVertical: 11, fontSize: 16, textAlign: rtl ? 'right' : 'left', outlineStyle: 'none' } as any}
        />
        {typed ? <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('clear')}><Ionicons name="close-circle" size={18} color={colors.sub} /></Pressable> : null}
        </Row>
      </View>
      <FlatList
        data={res}
        keyExtractor={c => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ArticleRow c={item} />}
        ListHeaderComponent={q.trim().length > 1 && res.length ? <T f="bodyBold" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.sub }}>{t('searchResults')}: {res.length}</T> : undefined}
        ListEmptyComponent={q.trim().length > 1 ? <EmptyState icon="search-outline" title={t('noMatch')} /> : <EmptyState icon="newspaper-outline" title={t('search')} text={t('searchPh')} />}
      />
    </View>
  );
}
