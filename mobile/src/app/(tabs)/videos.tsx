import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { fetchVideos } from '../../lib/api';
import { ago } from '../../lib/i18n';
import type { Video } from '../../lib/types';
import { AppHeader } from '../../components/chrome';
import { VideoPlayer } from '../../components/VideoPlayer';
import { FeedSkeleton, Notice, Photo, Row, T } from '../../components/ui';

// Muuqaallo: Wartabiye TV's own videos (data/videos.json, /admin/) and the newest videos from publishers' official
// YouTube channels that allow embedding (the website's video feed). Tapping plays the video inside the app.
export default function Videos() {
  const { colors, t, lang } = useSettings();
  const { meta } = useContent();
  const [list, setList] = useState<Video[] | null>(null);
  const [err, setErr] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState('');
  const load = useCallback(async () => {
    try { setList(await fetchVideos(meta)); setErr(false); } catch (e) { setErr(true); setList(l => l || []); }
  }, [meta]);
  useEffect(() => { load(); }, [load]);
  const kinds = [['', t('all')], ['somalia', t('somalia')], ['world', t('world')], ['sports', t('sports')]];
  const shown = (list || []).filter(v => !kind || v.kind === kind);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      {list === null ? <FeedSkeleton /> : (
        <FlatList
          data={shown}
          keyExtractor={v => v.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.blue]} tintColor={colors.blue} />}
          ListHeaderComponent={
            <View>
              <View style={{ backgroundColor: colors.blueD, padding: 16 }}>
                <T f="display" style={{ color: '#fff', fontSize: 22 }}>{t('videoNewsTitle')}</T>
                <T style={{ color: '#e6f0fb', fontSize: 13, marginTop: 4, lineHeight: 18 }}>{t('videoNewsSub')}</T>
              </View>
              {err ? <Notice tone="error" text={t('loadFailed')} action={t('retry')} onAction={load} /> : null}
              <Row style={{ gap: 8, padding: 12, flexWrap: 'wrap' }}>
                {kinds.map(([k, label]) => (
                  <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" style={{ backgroundColor: kind === k ? colors.blue : colors.surface, borderWidth: 1, borderColor: kind === k ? colors.blue : colors.line, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <T f="bodyBold" style={{ fontSize: 13, color: kind === k ? '#fff' : colors.fg }}>{label}</T>
                  </Pressable>
                ))}
              </Row>
            </View>
          }
          ListEmptyComponent={<T muted style={{ padding: 16 }}>{t('noVideos')}</T>}
          ListFooterComponent={<T muted style={{ padding: 16, fontSize: 12, lineHeight: 17 }}>{t('videoRule')}</T>}
          renderItem={({ item: v }) => (
            <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
              {playing === v.id ? <VideoPlayer videoId={v.videoId!} title={v.title} /> : (
                <Pressable onPress={() => setPlaying(v.id)} accessibilityRole="button" accessibilityLabel={t('playVideo') + ': ' + v.title}>
                  <Photo uri={v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt={v.title} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0} />
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ backgroundColor: 'rgba(0,0,0,.6)', borderRadius: 34, padding: 12 }}><Ionicons name="play" size={30} color="#fff" /></View>
                  </View>
                </Pressable>
              )}
              <View style={{ padding: 12 }}>
                <T f="displayBold" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={3}>{v.title}</T>
                <T muted style={{ fontSize: 12, marginTop: 4 }}>{[v.source ? t('videoCredit') + ': ' + v.source : '', v.publishedAt ? ago(lang, v.publishedAt) : ''].filter(Boolean).join(' · ')}</T>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
