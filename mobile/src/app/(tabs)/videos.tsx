import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '../../lib/settings';
import { useContent } from '../../lib/content';
import { fetchVideos } from '../../lib/api';
import { ago } from '../../lib/i18n';
import type { Video } from '../../lib/types';
import { AppHeader } from '../../components/chrome';
import { VideoPlayer } from '../../components/VideoPlayer';
import { EmptyState, FeedSkeleton, Notice, Photo, Row, T, PageHero } from '../../components/ui';

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
              <PageHero title={t('videoNewsTitle')} sub={t('videoNewsSub')} />
              {err ? <Notice tone="error" text={t('loadFailed')} action={t('retry')} onAction={load} /> : null}
              <Row style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' }}>
                {kinds.map(([k, label]) => (
                  <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }} style={{ backgroundColor: kind === k ? colors.blue : colors.surface, borderWidth: 1, borderColor: kind === k ? colors.blue : colors.hair, borderRadius: 17, height: 34, justifyContent: 'center', paddingHorizontal: 13 }}>
                    <T f="bodyBold" style={{ fontSize: 13, color: kind === k ? '#fff' : colors.fg }}>{label}</T>
                  </Pressable>
                ))}
              </Row>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="play-circle-outline" title={t('noVideos')} />}
          ListFooterComponent={<T muted style={{ padding: 16, fontSize: 12, lineHeight: 17 }}>{t('videoRule')}</T>}
          renderItem={({ item: v }) => (
            <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: colors.dark ? 1 : 0, borderColor: colors.hair, shadowColor: '#0b1c33', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
              {playing === v.id ? <VideoPlayer videoId={v.videoId!} title={v.title} /> : (
                <Pressable onPress={() => setPlaying(v.id)} accessibilityRole="button" accessibilityLabel={t('playVideo') + ': ' + v.title}>
                  <Photo uri={v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt={v.title} style={{ width: '100%', aspectRatio: 16 / 9 }} rounded={0} />
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 58, height: 58, backgroundColor: 'rgba(242,6,10,0.92)', borderRadius: 29, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} /></View>
                  </View>
                </Pressable>
              )}
              <View style={{ padding: 14 }}>
                <T f="display" style={{ fontSize: 16.5, lineHeight: 21 }} numberOfLines={3}>{v.title}</T>
                <T style={{ fontSize: 12, marginTop: 6, color: colors.sub }}>{[v.source ? t('videoCredit') + ': ' + v.source : '', v.publishedAt ? ago(lang, v.publishedAt) : ''].filter(Boolean).join(' · ')}</T>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
