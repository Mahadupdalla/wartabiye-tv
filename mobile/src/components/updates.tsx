import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useSettings } from '../lib/settings';
import { fullDate } from '../lib/i18n';
import { Row, T } from './ui';

// Settings → App updates (only in builds that receive over-the-air updates: the iPhone app installed from Xcode).
// It says which code is running (the version built into the app, or an update and its date), and checks for a newer one
// on request. New code is otherwise downloaded by itself when the app starts and used from the next start.
type St = 'idle' | 'busy' | 'latest' | 'ready' | 'failed';
export function UpdatesCard() {
  const { colors, t, lang } = useSettings();
  const [st, setSt] = useState<St>('idle');
  if (!Updates.isEnabled) return null;
  const running = (Updates.isEmbeddedLaunch || !Updates.createdAt ? t('updBuiltIn') : t('updFrom', { t: fullDate(lang, Updates.createdAt.toISOString()) }))
    // the first characters of the update id: the same as in the GitHub "iPhone app update" summary
    + (Updates.updateId && !Updates.isEmbeddedLaunch ? ' · ' + Updates.updateId.slice(0, 8) : '');
  const check = async () => {
    setSt('busy');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) { setSt('latest'); return; }
      await Updates.fetchUpdateAsync();
      setSt('ready');
    } catch (e) {
      setSt('failed');
    }
  };
  const note = st === 'latest' ? t('updLatest') : st === 'ready' ? t('updReady') : st === 'failed' ? t('updFailed') : '';
  return (
    <View style={{ padding: 14, gap: 10 }}>
      <Row style={{ gap: 10 }}>
        <T style={{ flex: 1, fontSize: 14, color: colors.sub }} testID="update-running">{running}</T>
        {st === 'busy' ? <ActivityIndicator color={colors.blue} /> : null}
      </Row>
      {Updates.runtimeVersion ? <T muted selectable style={{ fontSize: 11.5 }}>{Updates.channel || 'personal'} · {Updates.runtimeVersion}</T> : null}
      {note ? <T style={{ fontSize: 13.5, color: st === 'failed' ? colors.red : colors.fg }}>{note}</T> : null}
      <Pressable
        testID="update-check"
        disabled={st === 'busy'}
        onPress={st === 'ready' ? () => Updates.reloadAsync().catch(() => setSt('failed')) : check}
        accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: pressed ? colors.blueD : colors.blue, opacity: st === 'busy' ? 0.6 : 1 })}
      >
        <T f="bodyBold" style={{ color: '#fff', fontSize: 14 }}>{st === 'ready' ? t('updRestart') : t('updCheck')}</T>
      </Pressable>
    </View>
  );
}
