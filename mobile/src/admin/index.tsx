import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from '../components/AdminWebView';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Image } from 'expo-image';
import { load, save } from '../lib/storage';
import { useSettings } from '../lib/settings';
import { Group, Row, T } from '../components/ui';
import { UpdatesCard } from '../components/updates';

// The owner's admin dashboard (the same pages and the same sign-in as in Safari: GitHub plus the 6-digit code; the
// session is a cookie of the dashboard's own server, nothing secret is kept by the app). After sign-in the app adds
// two tabs of its own: App updates (what was last sent to the public iPhone app, and this app's own updates) and
// Sign out.
const ADMIN = 'https://wartabiye-admin.wartabiye.workers.dev';
const ALLOWED = [ADMIN, 'https://github.com'];
const LOGO = require('../../assets/logo-hd.png');
const EAS = 'https://u.expo.dev/ec499f36-c73d-45f2-8675-cad04e52ccd2';
const cfgExtra = (Constants.expoConfig?.extra || {}) as { publicRuntime?: string };
// the public app's runtime is this app's own runtime without "-admin" (app.config.js derives one from the other)
const ownRuntime = String(Updates.runtimeVersion || (Constants.expoConfig as any)?.runtimeVersion || '');
const extra = { publicRuntime: cfgExtra.publicRuntime || (ownRuntime.includes('-admin-') ? ownRuntime.replace('-admin-', '-') : undefined) };

// after every page load: ask the dashboard who is signed in (same origin, its own cookie) and tell the app
const WHO = `fetch('/api/me',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).then(function(j){window.ReactNativeWebView.postMessage(JSON.stringify({me:j&&j.login||null}))}).catch(function(){window.ReactNativeWebView.postMessage(JSON.stringify({me:null}))});true;`;
const SIGN_OUT = `fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json'}}).finally(function(){location.href='/login?bye=1'});true;`;

type Tab = 'dash' | 'updates';

export default function Admin() {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<boolean | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dash');
  const [loading, setLoading] = useState(true);
  const web = useRef<any>(null);
  useEffect(() => { load<boolean>('adminStarted', false).then(v => setStart(!!v)); }, []);

  if (start === null) return <View style={{ flex: 1, backgroundColor: '#0a3a6e' }} />;
  if (!start) return <Welcome onStart={() => { save('adminStarted', true); setStart(true); }} />;

  const onMessage = (e: WebViewMessageEvent) => {
    try { const m = JSON.parse(e.nativeEvent.data); setMe(m.me || null); if (!m.me) setTab('dash'); } catch (err) { /* not ours */ }
  };
  // only the dashboard and GitHub's sign-in open inside; any other link goes to Safari
  const onNav = (r: WebViewNavigation) => {
    if (ALLOWED.some(o => r.url === o || r.url.startsWith(o + '/'))) return true;
    if (/^https?:/.test(r.url)) Linking.openURL(r.url).catch(() => undefined);
    return false;
  };
  const bar = (title: string) => (
    <View style={{ backgroundColor: colors.blue, borderBottomWidth: 3, borderBottomColor: colors.red, paddingTop: insets.top }}>
      <Row style={{ height: 50, paddingHorizontal: 14, gap: 10 }}>
        <Image source={LOGO} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff' }} />
        <T f="display" style={{ color: '#fff', fontSize: 18, flex: 1 }} numberOfLines={1}>{title}</T>
        {tab === 'dash' ? (
          <Pressable onPress={() => web.current?.reload()} hitSlop={8} accessibilityRole="button" style={{ padding: 6 }}>
            <Ionicons name="refresh" size={21} color="#fff" />
          </Pressable>
        ) : null}
      </Row>
    </View>
  );
  const tabBtn = (k: Tab | 'out', icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => {
    const on = tab === k;
    return (
      <Pressable key={k} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 7 }}>
        <View style={{ width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.tint : 'transparent' }}>
          <Ionicons name={icon} size={21} color={on ? colors.blue : colors.sub} />
        </View>
        <T f="bodyBold" style={{ fontSize: 10.5, color: on ? colors.blue : colors.sub }}>{label}</T>
      </Pressable>
    );
  };
  const signOut = () => { setTab('dash'); web.current?.injectJavaScript(SIGN_OUT); setMe(null); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {bar(tab === 'updates' ? 'App updates' : me ? 'Admin dashboard' : 'Wartabiye TV Admin')}
      <View style={{ flex: 1 }}>
        <WebView
          ref={web}
          source={{ uri: ADMIN + '/' }}
          style={{ flex: 1, backgroundColor: colors.bg }}
          onMessage={onMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => { setLoading(false); web.current?.injectJavaScript(WHO); }}
          onShouldStartLoadWithRequest={onNav}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled
          incognito={false}
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          applicationNameForUserAgent="WartabiyeAdminApp/1"
        />
        {loading && tab === 'dash' ? <View style={{ position: 'absolute', top: 12, alignSelf: 'center' }}><ActivityIndicator color={colors.blue} /></View> : null}
        {tab === 'updates' ? (
          <ScrollView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 30 }}>
            <PublicAppCard />
            <T f="bodyBold" style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, fontSize: 12, letterSpacing: 1, color: colors.sub, textTransform: 'uppercase' }}>This admin app</T>
            <Group><UpdatesCard /></Group>
          </ScrollView>
        ) : null}
      </View>
      {me ? (
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.hair, paddingBottom: Math.max(insets.bottom, 8) }}>
          {tabBtn('dash', tab === 'dash' ? 'grid' : 'grid-outline', 'Dashboard', () => setTab('dash'))}
          {tabBtn('updates', tab === 'updates' ? 'cloud-download' : 'cloud-download-outline', 'App updates', () => setTab('updates'))}
          {tabBtn('out', 'log-out-outline', 'Sign out', signOut)}
        </View>
      ) : null}
    </View>
  );
}

/** First start: the sign-in card in the design of the dashboard's own sign-in page */
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <LinearGradient colors={['#04213f', '#0a3a6e', '#0263b3']} locations={[0, 0.45, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxWidth: 380, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', height: 5 }}><View style={{ flex: 7, backgroundColor: '#037BDC' }} /><View style={{ flex: 3, backgroundColor: '#F2060A' }} /></View>
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Image source={LOGO} style={{ width: 88, height: 88, borderRadius: 44 }} />
          <Row style={{ gap: 7, marginTop: 14 }}>
            <T f="brand" style={{ fontSize: 30, lineHeight: 34, color: '#0b1c33' }}>Wartabiye</T>
            <View style={{ backgroundColor: '#F2060A', borderRadius: 5, paddingHorizontal: 7 }}><T f="brand" style={{ color: '#fff', fontSize: 24, lineHeight: 30 }}>TV</T></View>
          </Row>
          <View style={{ marginTop: 10, backgroundColor: '#0b1c33', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T f="display" style={{ color: '#fff', fontSize: 12, letterSpacing: 1.6 }}>ADMIN</T>
          </View>
          <T style={{ color: '#5b6b80', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 14 }}>For the owner only. Sign in with the same GitHub account and 6-digit code as the admin dashboard.</T>
          <Pressable testID="admin-signin" onPress={onStart} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 20, alignSelf: 'stretch', backgroundColor: pressed ? '#0263b3' : '#037BDC', borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}>
            <T f="bodyBold" style={{ color: '#fff', fontSize: 16 }}>Sign in</T>
          </Pressable>
          <T style={{ color: '#5b6b80', fontSize: 12, textAlign: 'center', marginTop: 14 }}>Your session stays on Wartabiye's server; nothing secret is stored in the app.</T>
        </View>
      </View>
    </View>
  );
}

type Served = { id: string; createdAt: string } | null;

/** What Expo serves to the public iPhone app right now (the same question the phones ask) */
function PublicAppCard() {
  const { colors } = useSettings();
  const [st, setSt] = useState<{ busy: boolean; served?: Served; error?: string; at?: Date }>({ busy: true });
  const run = async () => {
    setSt(s => ({ ...s, busy: true }));
    try {
      if (!extra.publicRuntime) throw new Error('unknown public app version');
      const r = await fetch(EAS, { headers: { 'expo-platform': 'ios', 'expo-runtime-version': extra.publicRuntime, 'expo-channel-name': 'personal', 'expo-protocol-version': '1', accept: 'application/expo+json,application/json,multipart/mixed' } });
      const txt = await r.text();
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const id = (txt.match(/"id"\s*:\s*"([0-9a-f-]{36})"/) || [])[1];
      const createdAt = (txt.match(/"createdAt"\s*:\s*"([^"]+)"/) || [])[1] || '';
      setSt({ busy: false, served: id ? { id, createdAt } : null, at: new Date() });
    } catch (e) {
      setSt({ busy: false, error: String((e as Error)?.message || e), at: new Date() });
    }
  };
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const row = (k: string, v: React.ReactNode) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 7, gap: 12 }}>
      <T style={{ fontSize: 14.5 }}>{k}</T>
      {typeof v === 'string' ? <T style={{ fontSize: 13.5, color: colors.sub, flexShrink: 1, textAlign: 'right' }}>{v}</T> : v}
    </Row>
  );
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <View>
      <T f="bodyBold" style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, fontSize: 12, letterSpacing: 1, color: colors.sub, textTransform: 'uppercase' }}>Public app (Wartabiye TV)</T>
      <Group style={{ padding: 14 }}>
        {st.busy ? <ActivityIndicator color={colors.blue} /> : st.error ? (
          <T style={{ color: colors.red, fontSize: 14 }}>Could not ask Expo: {st.error}</T>
        ) : st.served ? (
          <View>
            {row('Newest update', <View style={{ backgroundColor: colors.chip, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><T f="bodyBold" style={{ fontSize: 13.5 }}>{st.served.id.slice(0, 8)}</T></View>)}
            {row('Sent', fmt(st.served.createdAt))}
            {row('Expo is delivering it', <T f="bodyBold" style={{ color: '#11804a', fontSize: 13.5 }}>Yes ✓</T>)}
          </View>
        ) : (
          row('Newest update', 'None yet: phones run the version built into the app')
        )}
        <T style={{ fontSize: 12.5, lineHeight: 18, color: colors.sub, marginTop: 8 }}>Readers' phones download updates quietly and use them the next time the app is opened. No message is shown to them. App version {extra.publicRuntime || '?'} · channel personal.</T>
        <Pressable onPress={run} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', marginTop: 12, backgroundColor: pressed ? colors.blueD : colors.blue, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 })}>
          <T f="bodyBold" style={{ color: '#fff', fontSize: 14 }}>Check again</T>
        </Pressable>
      </Group>
    </View>
  );
}
