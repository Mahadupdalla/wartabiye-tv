import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useSettings } from '../lib/settings';
import { isInternal, openLink } from '../lib/links';
import { Notice } from './ui';

// The site's own header, menu, ticker, sidebar and footer are hidden: the app already shows its own (the website itself
// is not changed, only this in-app view of it)
const HIDE = '.skip,.progress,.topbar,.logoband,nav.menu,.notice,.degdeg,#barnaamijyada,footer#nala-soco,.sidebar,.totop,#cookieBar,.cookie{display:none!important}' +
  'body{padding-top:0!important}main{padding-top:8px}.wrap.layout{display:block!important}';

/**
 * A Wartabiye TV page (About, Contact, Privacy, ...) or, with `external`, another website, shown INSIDE the app.
 * Taps on links are routed by lib/links: Wartabiye TV links open the app's own screens, other sites the in-app browser.
 */
export function SiteWebView({ url, external, onTitle, onLoaded }: { url: string; external?: boolean; onTitle?: (t: string) => void; onLoaded?: () => void }) {
  const { colors, lang, t } = useSettings();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const ref = useRef<any>(null);
  const start = useRef(url.split('#')[0]);
  const before = useMemo(() => external ? '' : `(function(){try{localStorage.setItem('wartabiye-lang',${JSON.stringify(lang)});localStorage.setItem('wartabiye-theme',${JSON.stringify(colors.dark ? 'dark' : 'light')});}catch(e){}
    var s=document.createElement('style');s.textContent=${JSON.stringify(HIDE)};(document.head||document.documentElement).appendChild(s);})();true;`, [external, lang, colors.dark]);

  const onNav = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    const next = req.url || '';
    if (req.isTopFrame === false) return true;               // pictures, maps and video frames inside the page
    if (next.split('#')[0] === start.current) return true;   // the page itself (and its #sections)
    if (/^about:|^data:|^blob:/.test(next)) return true;
    if (external && !isInternal(next) && /^https?:/.test(next)) return true; // browsing on inside the in-app browser
    openLink(next);
    return false;
  };

  if (failed) return <Notice tone="error" text={t('loadFailed')} action={t('retry')} onAction={() => { setFailed(false); setLoading(true); ref.current?.reload(); }} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebView
        ref={ref}
        source={{ uri: url }}
        injectedJavaScriptBeforeContentLoaded={before || undefined}
        onShouldStartLoadWithRequest={onNav}
        setSupportMultipleWindows={false}
        onLoadEnd={() => { setLoading(false); onLoaded?.(); }}
        onError={() => setFailed(true)}
        onHttpError={e => { if (e.nativeEvent.statusCode >= 500) setFailed(true); }}
        onNavigationStateChange={s => { if (s.title && onTitle) onTitle(s.title); }}
        forceDarkOn={false}
        allowsBackForwardNavigationGestures={!!external}
        decelerationRate="normal"
        style={{ flex: 1, backgroundColor: colors.bg }}
        originWhitelist={['https://*', 'http://*', 'about:*', 'data:*']}
      />
      {loading ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }} pointerEvents="none">
          <ActivityIndicator color={colors.blue} size="large" accessibilityLabel={t('loading')} />
        </View>
      ) : null}
    </View>
  );
}
