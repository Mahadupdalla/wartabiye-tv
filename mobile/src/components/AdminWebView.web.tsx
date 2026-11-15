// Web preview only (the admin app runs on the iPhone): the dashboard cannot be shown in a browser frame, so this stands
// in for it; ?me=<login> makes the preview behave as signed in, to show the tabs.
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Text, View } from 'react-native';
export type WebViewMessageEvent = { nativeEvent: { data: string } };
export type WebViewNavigation = { url: string };
export const WebView = forwardRef<unknown, { onMessage?: (e: WebViewMessageEvent) => void; onLoadEnd?: () => void; style?: unknown }>((p, ref) => {
  useImperativeHandle(ref, () => ({ reload() {}, injectJavaScript() {} }));
  useEffect(() => {
    const me = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('me') : null;
    p.onLoadEnd?.();
    p.onMessage?.({ nativeEvent: { data: JSON.stringify({ me }) } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: '#5b6b80', textAlign: 'center' }}>The admin dashboard opens here on the iPhone.</Text></View>;
});
