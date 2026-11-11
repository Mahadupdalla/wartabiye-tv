import React, { useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { SiteWebView } from '../components/SiteWebView';
import { Notice, Row, T } from '../components/ui';

// The in-app browser, only for OTHER websites the reader chose to open (a news source, a photo credit, an advertiser).
// It stays inside Wartabiye TV with a Back button. Wartabiye TV's own links never come here: they open app screens.
export default function Browser() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { colors, t } = useSettings();
  const u = /^https?:\/\//i.test(String(url || '')) ? String(url) : '';
  const [title, setTitle] = useState('');
  let host = '';
  try { host = u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
  const headerRight = () => (
    <Row style={{ gap: 2 }}>
      <Pressable onPress={() => Share.share({ message: u, url: u }).catch(() => undefined)} hitSlop={8} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel={t('share')}>
        <Ionicons name="share-outline" size={22} color="#fff" />
      </Pressable>
      <Pressable onPress={() => Linking.openURL(u).catch(() => undefined)} hitSlop={8} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel={t('openBrowser')}>
        <Ionicons name="open-outline" size={22} color="#fff" />
      </Pressable>
    </Row>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: host, headerRight: u ? headerRight : undefined }} />
      {u ? (
        <>
          <Row style={{ gap: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.chip, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Ionicons name="lock-closed" size={12} color={colors.soft} />
            <T style={{ flex: 1, fontSize: 12 }} muted numberOfLines={1}>{title || host}</T>
          </Row>
          <SiteWebView url={u} external onTitle={setTitle} />
        </>
      ) : <Notice tone="warn" text={t('loadFailed')} />}
    </View>
  );
}
