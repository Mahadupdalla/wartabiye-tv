import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { catName } from '../lib/i18n';
import { ArticleRow } from '../components/cards';
import { T } from '../components/ui';

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
      <View style={{ padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <TextInput
          value={typed} onChangeText={setQ} autoFocus placeholder={t('searchPh')} placeholderTextColor={colors.muted} returnKeyType="search" clearButtonMode="while-editing"
          accessibilityLabel={t('search')}
          style={{ backgroundColor: colors.bg, color: colors.fg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: colors.line, textAlign: rtl ? 'right' : 'left' }}
        />
      </View>
      <FlatList
        data={res}
        keyExtractor={c => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ArticleRow c={item} />}
        ListHeaderComponent={q.trim().length > 1 ? <T muted style={{ padding: 12, fontSize: 13 }}>{t('searchResults')}: {res.length}</T> : undefined}
        ListEmptyComponent={q.trim().length > 1 ? <T muted style={{ padding: 16 }}>{t('noMatch')}</T> : undefined}
      />
    </View>
  );
}
