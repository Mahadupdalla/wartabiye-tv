import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '../lib/settings';
import { useContent } from '../lib/content';
import { clock, todayLine } from '../lib/i18n';
import type { Card } from '../lib/types';
import { isBreaking, open } from './cards';
import { LiveDot, Notice, ROW_RTL, Row, T } from './ui';
import { LangButton } from './lang';
import { useAlerts } from '../lib/alerts';

const LOGO = require('../../assets/logo.png');

/** The website's brand: round logo, WARTABIYE with the red TV box, the spaced tagline */
export function Brand({ size = 'full' }: { size?: 'full' | 'bar' }) {
  const { colors, t } = useSettings();
  const { width } = useWindowDimensions();
  const bar = size === 'bar';
  const small = width < 360;
  const logo = bar ? (small ? 28 : 31) : small ? 46 : 54;
  const word = bar ? (small ? 14 : width < 400 ? 16 : 18) : small ? 24 : 28;
  return (
    <Pressable onPress={() => router.navigate('/')} accessibilityRole="header" accessibilityLabel="Wartabiye TV" hitSlop={4}>
      <Row style={{ gap: bar ? 8 : 12 }}>
        <View style={{ width: logo, height: logo, borderRadius: logo / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#037BDC', shadowOpacity: bar ? 0 : 0.18, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: bar ? 0 : 2, borderWidth: bar ? 0 : 1, borderColor: colors.line }}>
          <Image source={LOGO} style={{ width: logo - 2, height: logo - 2, borderRadius: logo / 2 }} accessibilityIgnoresInvertColors />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Row style={{ gap: bar ? 4 : 6, flexShrink: 1 }}>
            <T f="brand" numberOfLines={1} style={{ fontSize: word, lineHeight: word + 3, letterSpacing: 0.5, color: bar || colors.dark ? '#fff' : colors.blue }}>WARTABIYE</T>
            <View style={{ backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: bar ? 4 : 7, paddingVertical: bar ? 0 : 1 }}>
              <T f="brand" style={{ color: '#fff', fontSize: word * 0.8, lineHeight: word * 0.8 + 4, letterSpacing: 0.5 }}>TV</T>
            </View>
          </Row>
          {!bar ? <T f="bodyBold" muted style={{ fontSize: small ? 8.5 : 9.5, letterSpacing: small ? 1 : 1.9, textTransform: 'uppercase', marginTop: 5 }} numberOfLines={1}>{t('tagline')}</T> : null}
        </View>
      </Row>
    </Pressable>
  );
}

/** Today's date in the reader's language: a quiet line at the top of Home (the website's dark-blue date bar) */
export function DateLine() {
  const { colors, lang } = useSettings();
  return (
    <Row style={{ paddingHorizontal: 16, paddingTop: 14, gap: 6 }}>
      <Ionicons name="calendar-clear-outline" size={13} color={colors.sub} />
      <T f="bodyBold" style={{ fontSize: 12.5, color: colors.sub }}>{todayLine(lang)}</T>
    </Row>
  );
}

/** @deprecated kept for older imports: the date now sits in DateLine and the brand in the top bar */
export function SiteTop() {
  return <DateLine />;
}

const NATIVE = Platform.OS !== 'web';

/** The three menu lines: they turn into an X while the menu is open (p: 0 = lines, 1 = X) and back when it closes */
function MenuIcon({ p }: { p: Animated.Value }) {
  const line = { position: 'absolute' as const, left: 2, width: 18, height: 2, borderRadius: 2, backgroundColor: '#fff' };
  const move = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 5.5, 5.5] });
  const moveUp = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -5.5, -5.5] });
  const turn = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '0deg', '45deg'] });
  const turnBack = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '0deg', '-45deg'] });
  const mid = p.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const midW = p.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.2, 0.2] });
  return (
    <View style={{ width: 22, height: 22 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[line, { top: 5, transform: [{ translateY: move }, { rotate: turn }] }]} />
      <Animated.View style={[line, { top: 10.5, opacity: mid, transform: [{ scaleX: midW }] }]} />
      <Animated.View style={[line, { top: 16, transform: [{ translateY: moveUp }, { rotate: turnBack }] }]} />
    </View>
  );
}

type Rect = { x: number; y: number; w: number; h: number };

/** The app's top bar, in the website's blue with the red rule: menu, logo, language, search and alerts.
 *  The same bar is on every main screen, so the reader always finds the language and search in one place. */
export function MenuBar(_: { withBrand?: boolean }) {
  const { colors, t, rtl } = useSettings();
  const insets = useSafeAreaInsets();
  const { height: screenH, width: screenW } = useWindowDimensions();
  const ico = (name: keyof typeof Ionicons.glyphMap, label: string, go: () => void, id?: string) => (
    <Pressable testID={id} onPress={go} hitSlop={4} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={name} size={21} color="#fff" />
    </Pressable>
  );
  // the menu opens under the bar with a short slide and fade, and closes the same way backwards
  const p = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [bar, setBar] = useState<Rect | null>(null);
  const [btn, setBtn] = useState<Rect | null>(null);
  const barRef = useRef<any>(null);
  const btnRef = useRef<any>(null);
  const run = (to: 0 | 1) => {
    p.stopAnimation();
    Animated.timing(p, { toValue: to, duration: to ? 260 : 200, easing: to ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic), useNativeDriver: NATIVE }).start(({ finished }) => {
      if (finished && !to) setShown(false);
    });
  };
  const openMenu = () => {
    const show = () => { setOpen(true); setShown(true); run(1); };
    let left = 2;
    const done = () => { if (--left === 0) show(); };
    barRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => { setBar({ x, y, w, h }); done(); });
    btnRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => { setBtn({ x, y, w, h }); done(); });
    if (!barRef.current || !btnRef.current) show();
  };
  const closeMenu = () => { setOpen(false); run(0); };
  const toggle = () => (open ? closeMenu() : openMenu());
  const go = (to: () => void) => () => { closeMenu(); to(); };
  const nav = (h: Href) => go(() => router.push(h));
  const top = bar ? bar.y + bar.h : 0;
  const slide = p.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  const fade = p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0.95, 1] });
  const sections: [keyof typeof Ionicons.glyphMap, string, () => void, boolean?][] = [
    ['home-outline', t('allNews'), go(() => router.navigate('/'))],
    ['time-outline', t('latest'), nav('/latest')],
    ['flag-outline', t('somaliaNav'), nav('/section/somalia')],
    ['earth-outline', t('world'), nav('/section/world')],
    ['football-outline', t('sports'), nav('/section/sports')],
    ['radio-outline', t('liveNewsNav'), go(() => router.navigate('/live')), true],
    ['flash-outline', t('breakingTitle'), nav('/breaking'), true],
    ['play-circle-outline', t('videosNav'), go(() => router.navigate('/videos'))],
  ];
  const tools: [keyof typeof Ionicons.glyphMap, string, () => void][] = [
    ['search-outline', t('search'), nav('/search')],
    ['bookmark-outline', t('savedBtn'), go(() => router.navigate('/saved'))],
    ['notifications-outline', t('notifications'), nav('/notifications')],
    ['settings-outline', t('settings'), nav('/settings')],
    ['megaphone-outline', t('advertise'), nav('/ads')],
    ['ellipsis-horizontal-circle-outline', t('more'), go(() => router.navigate('/more'))],
  ];
  const face = <MenuIcon p={p} />;
  const btnStyle = ({ pressed }: { pressed: boolean }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' });
  return (
    <View ref={barRef} collapsable={false} style={{ backgroundColor: colors.blue, borderBottomWidth: 3, borderBottomColor: colors.red, paddingTop: insets.top, zIndex: 3 }}>
      <Row style={{ height: 52, paddingHorizontal: 6, gap: 2 }}>
        <Pressable ref={btnRef} collapsable={false} testID="menu-button" onPress={toggle} accessibilityRole="button" accessibilityLabel={t('menu')} aria-expanded={open} style={btnStyle}>
          {face}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 2, alignItems: rtl && NATIVE ? 'flex-end' : 'flex-start', overflow: 'hidden' }}><Brand size="bar" /></View>
        <Row style={{ gap: 2 }}>
          <View style={{ marginHorizontal: 2 }}><LangButton /></View>
          {ico('search', t('search'), () => router.push('/search'), 'search-button')}
          {screenW >= 360 ? <Bell /> : null}
        </Row>
      </Row>
      <Modal visible={shown} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeMenu}>
        <Pressable testID="menu-scrim" onPress={closeMenu} accessibilityElementsHidden importantForAccessibility="no" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View style={{ position: 'absolute', top, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,28,51,0.5)', opacity: p }} />
        </Pressable>
        {btn ? (
          <Pressable testID="menu-button-close" onPress={closeMenu} accessibilityRole="button" accessibilityLabel={t('menu')} aria-expanded style={(st) => [btnStyle(st), { position: 'absolute', left: btn.x, top: btn.y, width: btn.w, height: btn.h }]}>
            {face}
          </Pressable>
        ) : null}
        <Animated.View testID="menu-panel" style={{ position: 'absolute', top, left: 0, right: 0, maxHeight: Math.max(200, screenH - top - insets.bottom), backgroundColor: colors.surface, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, opacity: fade, transform: [{ translateY: slide }], shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 10, overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14 }} bounces={false}>
            {sections.map(([icon, text, onPress, live]) => (
              <Pressable key={text} onPress={onPress} accessibilityRole="link" style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                <Row style={{ gap: 14 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: live ? (colors.dark ? '#3b0d0e' : '#fdecec') : colors.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={17} color={live ? colors.red : colors.blue} />
                  </View>
                  <T f="display" style={{ flex: 1, fontSize: 15, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: rtl ? 'right' : 'left' }}>{text}</T>
                  <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.sub} />
                </Row>
              </Pressable>
            ))}
            <View style={{ height: 1, backgroundColor: colors.hair, marginVertical: 8, marginHorizontal: 10 }} />
            <View style={{ flexDirection: rtl && NATIVE ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, justifyContent: 'space-between' }}>
              {tools.map(([icon, text, onPress]) => (
                <Pressable key={text} onPress={onPress} accessibilityRole="link" style={({ pressed }) => ({ width: '31.6%', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.hair, alignItems: 'center', gap: 4, backgroundColor: pressed ? colors.tint : 'transparent' })}>
                  <Ionicons name={icon} size={18} color={colors.blue} />
                  <T f="bodyBold" numberOfLines={1} style={{ fontSize: 12, textAlign: 'center' }}>{text}</T>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

/** The bell in the top bar, with the number of new alerts in the reader's chosen categories */
function Bell() {
  const { colors, t } = useSettings();
  const { unread } = useAlerts();
  const n = unread > 99 ? '99+' : String(unread);
  return (
    <Pressable testID="bell-button" onPress={() => router.push('/notifications')} hitSlop={4} accessibilityRole="button" accessibilityLabel={t('notifications') + (unread ? ', ' + t('unreadN', { n: unread }) : '')} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={21} color="#fff" />
      {unread ? (
        <View style={{ position: 'absolute', top: 3, right: 2, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
          <T f="bodyBold" allowFontScaling={false} style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>{n}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

/** In-app breaking alert: when the website publishes a breaking story while the app is open, a red card slides in
 *  under the status bar (and the Dynamic Island). Tap opens the story; it closes by itself after 12 seconds. */
export function FreshBreaking() {
  const { colors, t, rtl } = useSettings();
  const { fresh, dismissFresh } = useAlerts();
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => {
    if (!fresh) return;
    setCard(fresh);
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    const tm = setTimeout(() => hide(), 12000);
    return () => clearTimeout(tm);
  }, [fresh?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const hide = (then?: () => void) => {
    Animated.timing(a, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(() => { setCard(null); dismissFresh(); then?.(); });
  };
  if (!card) return null;
  const drop = a.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  return (
    <Animated.View testID="fresh-breaking" pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 10, right: 10, zIndex: 50, opacity: a, transform: [{ translateY: drop }] }}>
      <Pressable onPress={() => hide(() => open(card))} accessibilityRole="link" accessibilityLiveRegion="polite" accessibilityLabel={t('breakingLabel') + ': ' + card.title} style={{ backgroundColor: colors.red, borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="flash" size={18} color="#fff" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <T f="display" style={{ color: '#fff', fontSize: 11, letterSpacing: 1.6, textAlign: rtl ? 'right' : 'left' }}>{t('breakingLabel')}</T>
            <T f="displayBold" numberOfLines={3} style={{ color: '#fff', fontSize: 15.5, lineHeight: 20, marginTop: 2, textAlign: rtl ? 'right' : 'left' }}>{card.title}</T>
          </View>
          <Pressable onPress={() => hide()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </Row>
      </Pressable>
    </Animated.View>
  );
}

/** Header of the other main screens: the same top bar */
export function AppHeader(_: { title?: string }) {
  return <MenuBar />;
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
          <Row style={{ paddingHorizontal: 18, gap: 10 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.red }} />
            <T f="bodyBold" style={{ fontSize: 13.5 }} numberOfLines={1}>{it.title}</T>
          </Row>
        </Pressable>
      ))}
    </View>
  );
  return (
    <Row style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.hair, height: 36, overflow: 'hidden' }}>
      <Row style={{ backgroundColor: colors.red, height: '100%', paddingHorizontal: 12, gap: 7, zIndex: 2 }}>
        <LiveDot size={6} color="#fff" />
        <T f="display" style={{ color: '#fff', fontSize: 11, letterSpacing: 1.6 }}>{label}</T>
      </Row>
      <View style={{ width: 0, height: 0, borderTopWidth: 18, borderBottomWidth: 18, borderLeftWidth: rtl ? 0 : 10, borderRightWidth: rtl ? 10 : 0, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: colors.red, borderRightColor: colors.red, zIndex: 2 }} />
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: rtl ? ROW_RTL : 'row', transform: [{ translateX: tx }] }}>
          {strip(0)}
          {strip(1)}
        </Animated.View>
      </View>
      <Pressable onPress={() => setPaused(p => !p)} accessibilityRole="button" accessibilityLabel={paused ? '▶' : 'II'} style={{ width: 36, height: '100%', alignItems: 'center', justifyContent: 'center', borderStartWidth: 1, borderStartColor: colors.hair }}>
        <Ionicons name={paused ? 'play' : 'pause'} size={12} color={colors.sub} />
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

/** Breaking-news banner at the top of Home: only while a story the newsroom marked "breaking" is under 12 hours old */
export function BreakingBanner() {
  const { colors, t, rtl } = useSettings();
  const { items } = useContent();
  const list = useMemo(() => items.filter(c => !c.sponsored && isBreaking(c)).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)), [items]);
  const a = useRef(new Animated.Value(0)).current;
  const top = list[0];
  useEffect(() => {
    if (!top) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!top) return null;
  const rise = a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View testID="breaking-banner" style={{ marginHorizontal: 16, marginTop: 14, opacity: a, transform: [{ translateY: rise }] }}>
      <Pressable onPress={() => open(top)} accessibilityRole="link" accessibilityLabel={t('breakingLabel') + ': ' + top.title} style={({ pressed }) => ({ borderRadius: 12, overflow: 'hidden', backgroundColor: colors.red, transform: [{ scale: pressed ? 0.985 : 1 }], shadowColor: '#F2060A', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 })}>
        <View style={{ padding: 14, gap: 8 }}>
          <Row style={{ gap: 8 }}>
            <Row style={{ gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
              <LiveDot size={7} color="#fff" />
              <T f="display" style={{ color: '#fff', fontSize: 11, letterSpacing: 1.6 }}>{t('breakingLabel')}</T>
            </Row>
            <T f="bodyBold" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>{top.timeVerified === false ? '' : clock(top.publishedAt)}</T>
          </Row>
          <Row style={{ gap: 10, alignItems: 'flex-start' }}>
            <T f="display" style={{ flex: 1, color: '#fff', fontSize: 18.5, lineHeight: 23 }} numberOfLines={3}>{top.title}</T>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color="#fff" style={{ marginTop: 2 }} />
          </Row>
        </View>
      </Pressable>
      {list.length > 1 ? (
        <Pressable onPress={() => router.push('/breaking')} accessibilityRole="link" hitSlop={6} style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          <T f="bodyBold" style={{ color: colors.red, fontSize: 13 }}>{t('moreBreaking', { n: list.length - 1 })} ›</T>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** The section bar under the ticker, as in a newspaper's app: plain words, the page you are on underlined in blue.
 *  It stays at the top with the ticker while Home scrolls. LIVE and Breaking carry a red dot. */
export function SectionTabs({ active = 'home' }: { active?: string }) {
  const { colors, t, rtl } = useSettings();
  const flip = rtl && Platform.OS !== 'web';
  const tabs: [string, string, () => void, boolean?][] = [
    ['home', t('home'), () => router.navigate('/')],
    ['somalia', t('somaliaNav'), () => router.push('/section/somalia')],
    ['world', t('world'), () => router.push('/section/world')],
    ['sports', t('sports'), () => router.push('/section/sports')],
    ['live', t('liveNewsNav'), () => router.navigate('/live'), true],
    ['breaking', t('breakingTitle'), () => router.push('/breaking'), true],
    ['videos', t('videosNav'), () => router.navigate('/videos')],
    ['latest', t('latestShort'), () => router.push('/latest')],
  ];
  return (
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.hair }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t('sectionsBar')} style={{ flexGrow: 0, transform: flip ? [{ scaleX: -1 }] : undefined }} contentContainerStyle={{ paddingHorizontal: 8 }}>
        {tabs.map(([k, label, go, red]) => {
          const on = k === active;
          return (
            <Pressable key={k} onPress={on ? undefined : go} accessibilityRole="link" accessibilityState={{ selected: on }} style={({ pressed }) => ({ transform: flip ? [{ scaleX: -1 }] : undefined, height: 42, paddingHorizontal: 10, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Row style={{ gap: 6 }}>
                {red ? <LiveDot size={6} /> : null}
                <T f={on ? 'bodyBold' : 'bodyMed'} style={{ fontSize: 14, color: on ? colors.fg : colors.sub }}>{label}</T>
              </Row>
              <View style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: on ? colors.blue : 'transparent' }} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Quick section bar under the menu: Soomaaliya, Caalamka, Ciyaaraha, LIVE, Degdeg, Muuqaal (the same sections as MENU) */
export function SectionChips() {
  const { colors, t, rtl } = useSettings();
  const chips: [string, keyof typeof Ionicons.glyphMap, () => void, boolean?][] = [
    [t('somaliaNav'), 'flag-outline', () => router.push('/section/somalia')],
    [t('world'), 'earth-outline', () => router.push('/section/world')],
    [t('sports'), 'football-outline', () => router.push('/section/sports')],
    [t('liveNewsNav'), 'radio-outline', () => router.navigate('/live'), true],
    [t('breakingTitle'), 'flash-outline', () => router.push('/breaking'), true],
    [t('videosNav'), 'play-circle-outline', () => router.navigate('/videos')],
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t('sectionsBar')} style={{ flexGrow: 0, transform: rtl && Platform.OS !== 'web' ? [{ scaleX: -1 }] : undefined }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
      {chips.map(([label, icon, go, red]) => (
        <Pressable key={label} onPress={go} accessibilityRole="link" style={({ pressed }) => ({ transform: [{ scaleX: rtl && Platform.OS !== 'web' ? -1 : 1 }, { scale: pressed ? 0.96 : 1 }], flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: red ? (colors.dark ? '#5a1a1c' : '#f6c3c4') : colors.hair, backgroundColor: pressed ? colors.tint : colors.surface })}>
          {red ? <LiveDot size={7} /> : <Ionicons name={icon} size={15} color={colors.blue} />}
          <T f="bodyBold" style={{ fontSize: 13, color: red ? colors.red : colors.fg }}>{label}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}
