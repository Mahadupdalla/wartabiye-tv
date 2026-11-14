import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { T } from './ui';

// The opening screen, in the design of the Wartabiye TV admin sign-in page: deep-blue gradient with a fine grid and
// rings, a soft red glow, and a white card with the blue/red top stripe, the round logo, "Wartabiye TV" and a loading
// line. It follows the native splash (same blue, same logo), stays until the news is ready (at least 1.2 s, at most
// 3 s) and then fades into the app. Phones only; the web app opens directly.
const LOGO = require('../../assets/logo-hd.png');
const MIN_MS = 1200;
const MAX_MS = 3000;

export function Intro() {
  const { colors, t, ready } = useSettings();
  const { status } = useContent();
  const { width: W, height: H } = useWindowDimensions();
  // the web app opens directly (?intro=1 shows the screen there, for a preview)
  const [gone, setGone] = useState(Platform.OS === 'web' && !(typeof window !== 'undefined' && /[?&]intro=1/.test(window.location.search)));
  const start = useRef(Date.now()).current;
  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    if (gone) return;
    Animated.timing(rise, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(Animated.timing(bar, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true })).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setGone(true));
  };
  useEffect(() => {
    if (gone) return;
    const max = setTimeout(close, MAX_MS);
    if (ready && status !== 'loading') {
      const wait = Math.max(0, MIN_MS - (Date.now() - start));
      const tm = setTimeout(close, wait);
      return () => { clearTimeout(tm); clearTimeout(max); };
    }
    return () => clearTimeout(max);
  }, [ready, status, gone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (gone) return null;
  const cardW = Math.min(W - 48, 360);
  const ring = Math.max(W, H) * 0.9;
  const lift = rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const scale = fade.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] });
  const slide = bar.interpolate({ inputRange: [0, 1], outputRange: [-cardW * 0.4, cardW * 0.9] });
  const lines = (n: number, step: number, vertical: boolean) => Array.from({ length: n }, (_, i) => (
    <View key={(vertical ? 'v' : 'h') + i} style={vertical ? { position: 'absolute', top: 0, bottom: 0, left: i * step, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)' } : { position: 'absolute', left: 0, right: 0, top: i * step, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)' }} />
  ));
  // a soft glow: stacked circles, each a little larger and fainter (no blur filter needed)
  const glow = (x: number, y: number, d: number, rgb: string, a: number) => [1, 0.85, 0.7, 0.56, 0.44, 0.33].map((k, i) => (
    <View key={rgb + i} style={{ position: 'absolute', width: d * k, height: d * k, borderRadius: (d * k) / 2, left: x + (d - d * k) / 2, top: y + (d - d * k) / 2, backgroundColor: `rgba(${rgb},${a})` }} />
  ));
  return (
    <Animated.View testID="intro" pointerEvents={closing.current ? 'none' : 'auto'} accessibilityLabel="Wartabiye TV" style={[StyleSheet.absoluteFill, { zIndex: 100, opacity: fade, transform: [{ scale }] }]}>
      <LinearGradient colors={['#04213f', '#0a3a6e', '#0263b3']} locations={[0, 0.45, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {lines(Math.ceil(W / 44) + 1, 44, true)}
        {lines(Math.ceil(H / 44) + 1, 44, false)}
        <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, left: (W - ring) / 2, top: (H - ring) / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', width: ring * 0.68, height: ring * 0.68, borderRadius: ring * 0.34, left: (W - ring * 0.68) / 2, top: (H - ring * 0.68) / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }} />
        {glow(-W * 0.25, -W * 0.2, W * 1.0, '3,123,220', 0.07)}
        {glow(W * 0.55, H - W * 0.45, W * 0.9, '242,6,10', 0.045)}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ width: cardW, opacity: rise, transform: [{ translateY: lift }], backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', shadowColor: '#000a1e', shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 18 }}>
          <View style={{ flexDirection: 'row', height: 5 }}>
            <View style={{ flex: 7, backgroundColor: colors.blue }} />
            <View style={{ flex: 3, backgroundColor: colors.red }} />
          </View>
          <View style={{ padding: 24, paddingTop: 26, alignItems: 'center' }}>
            <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#037BDC', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
              <Image source={LOGO} style={{ width: 92, height: 92, borderRadius: 46 }} accessibilityIgnoresInvertColors />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 }}>
              <T f="brand" style={{ fontSize: 30, lineHeight: 34, letterSpacing: 0.3, color: colors.fg, textAlign: 'center' }}>Wartabiye</T>
              <View style={{ backgroundColor: colors.red, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 1 }}>
                <T f="brand" style={{ color: '#fff', fontSize: 24, lineHeight: 30 }}>TV</T>
              </View>
            </View>
            <T f="bodyBold" style={{ marginTop: 8, fontSize: 10.5, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.sub, textAlign: 'center' }} numberOfLines={2}>{t('tagline')}</T>
            <View style={{ alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.dark ? colors.chip : '#e3ebf5', overflow: 'hidden', marginTop: 22 }}>
              <Animated.View style={{ width: cardW * 0.4, height: 4, borderRadius: 2, backgroundColor: colors.blue, transform: [{ translateX: slide }] }} />
            </View>
            <T muted style={{ marginTop: 10, fontSize: 12.5, textAlign: 'center' }}>{t('loading')}</T>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
