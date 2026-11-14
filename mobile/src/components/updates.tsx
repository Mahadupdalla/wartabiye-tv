import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useSettings } from '../lib/settings';
import { fullDate } from '../lib/i18n';
import { checkOta, onOtaStatus, otaStatus, type OtaStatus } from '../lib/ota';
import { Row, T } from './ui';

// Settings → App updates (only in builds that receive over-the-air updates: the iPhone app installed from Xcode).
// It says which code is running (the version built into the app, or an update, its date and id), when the app last
// checked, whether a new update is waiting for the next start, and the last problem (with expo-updates' own error log),
// so a failed update can be seen. "Check for updates" checks at once; a downloaded update starts with "Restart now".
export function UpdatesCard() {
  const { colors, t, lang } = useSettings();
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState<OtaStatus>(otaStatus());
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => onOtaStatus(setSt), []);
  useEffect(() => {
    if (!Updates.isEnabled) return;
    Updates.readLogEntriesAsync(3 * 24 * 3600_000)
      .then(l => setLog(l.filter(e => e.level === 'error' || e.level === 'fatal').slice(-3).map(e => `${new Date(e.timestamp).toISOString().slice(0, 16).replace('T', ' ')} ${e.code}: ${e.message}`.slice(0, 220))))
      .catch(() => undefined);
  }, [st.lastCheck]);
  if (!Updates.isEnabled) return null;
  const when = (iso?: string) => (iso ? fullDate(lang, iso) : '');
  const running = (Updates.isEmbeddedLaunch || !Updates.createdAt ? t('updBuiltIn') : t('updFrom', { t: fullDate(lang, Updates.createdAt.toISOString()) }))
    // the first characters of the update id: the same as in the GitHub "iPhone app update" summary
    + (Updates.updateId && !Updates.isEmbeddedLaunch ? ' · ' + Updates.updateId.slice(0, 8) : '');
  const check = async () => { setBusy(true); try { await checkOta(); } finally { setBusy(false); } };
  const waiting = !!st.downloaded;
  const failed = st.result === 'error' || Updates.isEmergencyLaunch;
  return (
    <View style={{ padding: 14, gap: 8 }}>
      <Row style={{ gap: 10 }}>
        <T style={{ flex: 1, fontSize: 14, color: colors.fg }} testID="update-running">{running}</T>
        {busy ? <ActivityIndicator color={colors.blue} /> : null}
      </Row>
      {st.lastCheck ? <T muted style={{ fontSize: 12.5 }}>{t('updLastCheck', { t: when(st.lastCheck) })}{st.result === 'none' ? ' · ' + t('updLatest') : ''}</T> : null}
      {waiting ? <T style={{ fontSize: 13.5, color: colors.fg }}>{t('updReady')}</T> : null}
      {failed ? (
        <View style={{ backgroundColor: colors.dark ? '#3b0d0e' : '#fdecec', borderRadius: 8, padding: 10, gap: 4 }}>
          <T f="bodyBold" style={{ fontSize: 13, color: colors.red }}>{Updates.isEmergencyLaunch ? t('updEmergency') : t('updFailed')}</T>
          {st.lastError ? <T selectable style={{ fontSize: 11.5, color: colors.fg }}>{when(st.lastErrorAt)} · {st.lastError}</T> : null}
        </View>
      ) : null}
      {log.length ? <T selectable muted style={{ fontSize: 11 }}>{log.join('\n')}</T> : null}
      {Updates.runtimeVersion ? <T muted selectable style={{ fontSize: 11 }}>{Updates.channel || 'personal'} · {Updates.runtimeVersion}</T> : null}
      <Pressable
        testID="update-check"
        disabled={busy}
        onPress={waiting ? () => Updates.reloadAsync().catch(() => undefined) : check}
        accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: 'flex-start', marginTop: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: pressed ? colors.blueD : colors.blue, opacity: busy ? 0.6 : 1 })}
      >
        <T f="bodyBold" style={{ color: '#fff', fontSize: 14 }}>{waiting ? t('updRestart') : t('updCheck')}</T>
      </Pressable>
    </View>
  );
}
