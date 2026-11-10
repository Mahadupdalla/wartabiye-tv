import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { clock } from '../lib/i18n';
import type { Card } from '../lib/types';
import { isBreaking, open } from './cards';
import { Notice, Row, T } from './ui';

const LOGO = require('../../assets/logo.png');

/** Top bar: official logo and name, search and alerts */
export function AppHeader({ title }: { title?: string }) {
  const { colors, t } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.bar, paddingTop: insets.top }}>
      <Row style={{ height: 56, paddingHorizontal: 12, justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.navigate('/')} accessibilityRole="header" accessibilityLabel="Wartabiye TV">
          <Row style={{ gap: 10 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 2 }}>
              <Image source={LOGO} style={{ width: 34, height: 34 }} accessibilityIgnoresInvertColors />
            </View>
            <View>
              <T f="display" style={{ color: '#fff', fontSize: 18, letterSpacing: 0.6 }}>{title || 'WARTABIYE TV'}</T>
              {!title ? <T style={{ color: '#cfe4f8', fontSize: 10, letterSpacing: 0.4 }} numberOfLines={1}>{t('tagline')}</T> : null}
            </View>
          </Row>
        </Pressable>
        <Row style={{ gap: 4 }}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel={t('search')}>
            <Ionicons name="search" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel={t('notifications')}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </Pressable>
        </Row>
      </Row>
    </View>
  );
}

/** Breaking-news ticker, built like the website's: owner's manual items, then breaking stories (12 h), then the newest */
export function Ticker() {
  const { colors, t, lang, rtl } = useSettings();
  const { items, meta } = useContent();
  const list = useMemo(() => {
    const pool = items.filter(c => !c.sponsored);
    const brk = pool.filter(c => isBreaking(c));
    const rest = pool.filter(c => !isBreaking(c));
    let tk: { title: string; card?: Card; at?: string }[] = meta?.breaking?.mode === 'manual' ? [] : [...brk, ...rest].slice(0, 8).map(c => ({ title: c.title, card: c, at: c.publishedAt }));
    const manual = (meta?.breaking?.items || []).map(x => (typeof x === 'string' ? { text: x } : x)).filter(x => x && x.text) as { text: string; [k: string]: unknown }[];
    tk = manual.map(x => ({ title: (lang !== 'so' && typeof x[lang] === 'string' && (x[lang] as string).trim()) || x.text })).concat(tk);
    return tk;
  }, [items, meta, lang]);
  const hasBreaking = list.some(x => x.card && isBreaking(x.card));
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const anim = Animated.loop(Animated.timing(x, { toValue: 1, duration: Math.max(18000, w * 22), easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [w, x]);
  if (!list.length) return null;
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: rtl ? [0, w] : [0, -w] });
  const strip = (k: number) => (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row' }} onLayout={k === 0 ? (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width) : undefined}>
      {list.map((it, i) => (
        <Pressable key={k + '-' + i} onPress={() => it.card && open(it.card)} accessibilityElementsHidden={k === 1} importantForAccessibility={k === 1 ? 'no-hide-descendants' : 'auto'}>
          <Row style={{ paddingHorizontal: 14, gap: 6 }}>
            {it.at ? <T f="bodyBold" style={{ color: colors.red, fontSize: 13 }}>{clock(it.at)}</T> : null}
            <T f="bodyMed" style={{ fontSize: 13 }} numberOfLines={1}>{it.title}</T>
          </Row>
        </Pressable>
      ))}
    </View>
  );
  return (
    <Row style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, height: 38, overflow: 'hidden' }}>
      <View style={{ backgroundColor: hasBreaking ? colors.red : colors.blue, height: '100%', justifyContent: 'center', paddingHorizontal: 10, zIndex: 2 }}>
        <T f="display" style={{ color: '#fff', fontSize: 12, letterSpacing: 0.8 }}>{hasBreaking ? meta?.breaking?.label && lang === 'so' ? meta.breaking.label : t('breakingLabel') : t('latestShort').toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: rtl ? 'row-reverse' : 'row', transform: [{ translateX: tx }] }}>
          {strip(0)}
          {strip(1)}
        </Animated.View>
      </View>
    </Row>
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
