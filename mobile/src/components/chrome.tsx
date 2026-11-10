import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Pressable, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { clock, todayLine } from '../lib/i18n';
import type { Card } from '../lib/types';
import { isBreaking, open } from './cards';
import { LiveDot, Notice, ROW_RTL, Row, T } from './ui';

const LOGO = require('../../assets/logo.png');

/** The website's brand: round logo, WARTABIYE with the red TV box, the spaced tagline */
export function Brand({ size = 'full' }: { size?: 'full' | 'bar' }) {
  const { colors, t } = useSettings();
  const { width } = useWindowDimensions();
  const bar = size === 'bar';
  const small = width < 360;
  const logo = bar ? 34 : small ? 46 : 54;
  return (
    <Pressable onPress={() => router.navigate('/')} accessibilityRole="header" accessibilityLabel="Wartabiye TV">
      <Row style={{ gap: bar ? 10 : 12 }}>
        <View style={{ width: logo, height: logo, borderRadius: logo / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#037BDC', shadowOpacity: bar ? 0 : 0.18, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: bar ? 0 : 2, borderWidth: bar ? 0 : 1, borderColor: colors.line }}>
          <Image source={LOGO} style={{ width: logo - 2, height: logo - 2, borderRadius: logo / 2 }} accessibilityIgnoresInvertColors />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Row style={{ gap: 6 }}>
            <T f="brand" style={{ fontSize: bar ? 19 : small ? 24 : 28, lineHeight: bar ? 22 : small ? 27 : 31, letterSpacing: 0.6, color: bar || colors.dark ? '#fff' : colors.blue }}>WARTABIYE</T>
            <View style={{ backgroundColor: colors.red, borderRadius: 5, paddingHorizontal: bar ? 5 : 7, paddingVertical: 1 }}>
              <T f="brand" style={{ color: '#fff', fontSize: bar ? 15 : small ? 19 : 22, lineHeight: bar ? 19 : small ? 23 : 27, letterSpacing: 0.6 }}>TV</T>
            </View>
          </Row>
          {!bar ? <T f="bodyBold" muted style={{ fontSize: small ? 8.5 : 9.5, letterSpacing: small ? 1 : 1.9, textTransform: 'uppercase', marginTop: 5 }} numberOfLines={1}>{t('tagline')}</T> : null}
        </View>
      </Row>
    </Pressable>
  );
}

/** Top of the homepage, as on the website: dark-blue date bar, then the white logo band */
export function SiteTop() {
  const { colors, lang } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <View>
      <View style={{ backgroundColor: colors.bar, paddingTop: insets.top }}>
        <T f="bodyBold" style={{ color: '#fff', fontSize: 12.5, paddingHorizontal: 16, paddingVertical: 6 }}>{todayLine(lang)}</T>
      </View>
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 16, paddingVertical: 14 }}>
        <Brand />
      </View>
    </View>
  );
}

/** The website's blue menu bar with the red rule: MENU, search, alerts, saved and LIVE TV */
export function MenuBar({ withBrand }: { withBrand?: boolean }) {
  const { colors, t } = useSettings();
  const insets = useSafeAreaInsets();
  const ico = (name: keyof typeof Ionicons.glyphMap, label: string, go: () => void) => (
    <Pressable onPress={go} hitSlop={6} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={name} size={21} color="#fff" />
    </Pressable>
  );
  return (
    <View style={{ backgroundColor: colors.blue, borderBottomWidth: 3, borderBottomColor: colors.red, paddingTop: withBrand ? insets.top : 0, shadowColor: '#0263b3', shadowOpacity: 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 3, zIndex: 3 }}>
      <Row style={{ height: 50, paddingHorizontal: 8, justifyContent: 'space-between' }}>
        {withBrand ? <View style={{ flexShrink: 1, paddingStart: 6 }}><Brand size="bar" /></View> : (
          <Pressable onPress={() => router.navigate('/more')} accessibilityRole="button" accessibilityLabel={t('menu')} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
            <Row style={{ gap: 10 }}>
              <Ionicons name="menu" size={24} color="#fff" />
              <T f="display" style={{ color: '#fff', fontSize: 14, letterSpacing: 1.4 }}>{t('menu').toUpperCase()}</T>
            </Row>
          </Pressable>
        )}
        <Row style={{ gap: 0 }}>
          {ico('search', t('search'), () => router.push('/search'))}
          {ico('notifications-outline', t('notifications'), () => router.push('/notifications'))}
          {!withBrand ? ico('bookmark-outline', t('saved'), () => router.navigate('/saved')) : null}
          {!withBrand ? (
            <Pressable onPress={() => router.navigate('/videos')} accessibilityRole="link" style={{ marginStart: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5 }}>
              <T f="display" style={{ color: '#fff', fontSize: 12, letterSpacing: 1.2 }}>LIVE TV</T>
            </Pressable>
          ) : null}
        </Row>
      </Row>
    </View>
  );
}

/** Header of the other screens: the same blue bar with the red rule, the logo and name */
export function AppHeader(_: { title?: string }) {
  return <MenuBar withBrand />;
}

/** DEGDEG ticker, built like the website's: owner's manual items, then breaking stories (12 h), then the newest */
export function Ticker() {
  const { colors, t, lang, rtl } = useSettings();
  const { items, meta } = useContent();
  const list = useMemo(() => {
    const pool = items.filter(c => !c.sponsored);
    const brk = pool.filter(c => isBreaking(c));
    const rest = pool.filter(c => !isBreaking(c));
    let tk: { title: string; card?: Card }[] = meta?.breaking?.mode === 'manual' ? [] : [...brk, ...rest].slice(0, 8).map(c => ({ title: c.title, card: c }));
    const manual = (meta?.breaking?.items || []).map(x => (typeof x === 'string' ? { text: x } : x)).filter(x => x && x.text) as { text: string; [k: string]: unknown }[];
    tk = manual.map(x => ({ title: (lang !== 'so' && typeof x[lang] === 'string' && (x[lang] as string).trim()) || x.text })).concat(tk);
    return tk;
  }, [items, meta, lang]);
  const [w, setW] = useState(0);
  const [paused, setPaused] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w || paused) return;
    const anim = Animated.loop(Animated.timing(x, { toValue: 1, duration: Math.max(24000, w * 26), easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [w, x, paused]);
  if (!list.length) return null;
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: rtl ? [0, w] : [0, -w] });
  const label = lang === 'so' && meta?.breaking?.label ? meta.breaking.label : t('breakingLabel');
  const strip = (k: number) => (
    <View style={{ flexDirection: rtl ? ROW_RTL : 'row' }} onLayout={k === 0 ? (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width) : undefined}>
      {list.map((it, i) => (
        <Pressable key={k + '-' + i} onPress={() => it.card && open(it.card)} accessibilityElementsHidden={k === 1} importantForAccessibility={k === 1 ? 'no-hide-descendants' : 'auto'}>
          <Row style={{ paddingHorizontal: 22, gap: 12 }}>
            <View style={{ width: 6, height: 6, backgroundColor: colors.blue, transform: [{ rotate: '45deg' }] }} />
            <T f="bodyBold" style={{ fontSize: 14 }} numberOfLines={1}>{it.title}</T>
          </Row>
        </Pressable>
      ))}
    </View>
  );
  return (
    <Row style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, height: 40, overflow: 'hidden' }}>
      <Row style={{ backgroundColor: colors.red, height: '100%', paddingHorizontal: 14, gap: 8, zIndex: 2 }}>
        <LiveDot size={7} color="#fff" />
        <T f="display" style={{ color: '#fff', fontSize: 12, letterSpacing: 1.9 }}>{label}</T>
      </Row>
      <View style={{ width: 0, height: 0, borderTopWidth: 20, borderBottomWidth: 20, borderLeftWidth: rtl ? 0 : 10, borderRightWidth: rtl ? 10 : 0, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: colors.red, borderRightColor: colors.red, zIndex: 2 }} />
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: rtl ? ROW_RTL : 'row', transform: [{ translateX: tx }] }}>
          {strip(0)}
          {strip(1)}
        </Animated.View>
      </View>
      <Pressable onPress={() => setPaused(p => !p)} accessibilityRole="button" accessibilityLabel={paused ? '▶' : 'II'} style={{ width: 40, height: '100%', alignItems: 'center', justifyContent: 'center', borderStartWidth: 1, borderStartColor: colors.line }}>
        <Ionicons name={paused ? 'play' : 'pause'} size={14} color={colors.muted} />
      </Pressable>
    </Row>
  );
}

/** The website's blue footer: logo, about text, contact email (from /admin/), motto and rights */
export function SiteFooter() {
  const { colors, t } = useSettings();
  const { meta } = useContent();
  const email = meta?.contact?.email || '';
  return (
    <View style={{ backgroundColor: colors.foot, padding: 22, marginTop: 30, gap: 12 }}>
      <Row style={{ gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={LOGO} style={{ width: 42, height: 42, borderRadius: 21 }} />
        </View>
        <Row style={{ gap: 6 }}>
          <T f="brand" style={{ color: '#fff', fontSize: 22, letterSpacing: 0.6 }}>WARTABIYE</T>
          <View style={{ backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: 5 }}><T f="brand" style={{ color: '#fff', fontSize: 17, lineHeight: 22 }}>TV</T></View>
        </Row>
      </Row>
      <T style={{ color: colors.footFg, fontSize: 14, lineHeight: 21 }}>{t('about')}</T>
      {email ? (
        <Pressable onPress={() => Linking.openURL('mailto:' + email)} accessibilityRole="link" accessibilityLabel={'Email: ' + email} hitSlop={8}>
          <Row style={{ gap: 8 }}>
            <Ionicons name="mail-outline" size={18} color="#fff" />
            <T f="bodyBold" style={{ color: '#fff', fontSize: 14 }}>{email}</T>
          </Row>
        </Pressable>
      ) : null}
      <T f="bodyBold" style={{ color: colors.footFg, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>{t('motto')}</T>
      <T style={{ color: colors.footFg, fontSize: 12, opacity: 0.85 }}>© {new Date().getFullYear()} Wartabiye TV. {t('rights')}</T>
    </View>
  );
}

/** Offline / error line shown above lists */
export function StatusLine() {
  const { t, lang } = useSettings();
  const { offline, status, refresh, lastOk } = useContent();
  if (offline) return <Notice tone="warn" text={t('offline') + (lastOk ? ' · ' + t('updatedAt', { t: clock(new Date(lastOk).toISOString()) }) : '')} action={t('retry')} onAction={refresh} />;
  if (status === 'error') return <Notice tone="error" text={t('loadFailed')} action={t('retry')} onAction={refresh} />;
  void lang;
  return null;
}

/** "3 new stories" pill: appears when the website publishes while the list is open */
export function NewStories({ onPress }: { onPress: () => void }) {
  const { colors, t } = useSettings();
  const { newIds } = useContent();
  if (!newIds.length) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ position: 'absolute', top: 10, alignSelf: 'center', zIndex: 10, backgroundColor: colors.blue, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}>
      <Row style={{ gap: 6 }}>
        <Ionicons name="arrow-up" size={15} color="#fff" />
        <T f="bodyBold" style={{ color: '#fff', fontSize: 13 }}>{t('newStories', { n: newIds.length })}</T>
      </Row>
    </Pressable>
  );
}
