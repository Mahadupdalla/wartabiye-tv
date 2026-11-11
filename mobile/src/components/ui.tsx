import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type TextProps, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { FONT } from '../lib/theme';
import { abs } from '../lib/config';

type Font = 'brand' | 'display' | 'displayBold' | 'body' | 'bodyMed' | 'bodyBold';

/** Text in the app's type; Arabic uses the phone's own font (Archivo and Public Sans have no Arabic letters) */
export function T({ f = 'body', style, children, muted, ...rest }: TextProps & { f?: Font; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const { colors, rtl } = useSettings();
  const weight: TextStyle['fontWeight'] = f === 'brand' ? '900' : f === 'display' ? '800' : f === 'displayBold' || f === 'bodyBold' ? '700' : f === 'bodyMed' ? '500' : '400';
  return (
    <Text
      {...rest}
      style={[{ color: muted ? colors.muted : colors.fg, fontFamily: rtl ? undefined : FONT[f], fontWeight: rtl ? weight : undefined, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }, style]}
    >
      {children}
    </Text>
  );
}

/** Right-to-left rows: on the web the page itself is dir="rtl" (the browser mirrors rows); on phones the app mirrors them */
export const ROW_RTL = Platform.OS === 'web' ? 'row' : 'row-reverse';

export function Row({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const { rtl } = useSettings();
  return <View style={[{ flexDirection: rtl ? ROW_RTL : 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Pill({ label, color, fg = '#fff', style }: { label: string; color: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: color, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' }, style]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

/** Pulsing red dot for genuinely active LIVE coverage */
export function LiveDot({ size = 8, color = '#F2060A' }: { size?: number; color?: string }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: a }} />;
}

const LOGO_IMG = require('../../assets/logo.png');

/** "Sawir muujin ah": the website's label on an illustrative photo */
export function IllusBadge() {
  const { t, rtl } = useSettings();
  return (
    <View style={{ position: 'absolute', top: 8, [rtl ? 'left' : 'right']: 8, zIndex: 2, backgroundColor: 'rgba(11,28,51,0.72)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }}>
      <T f="bodyBold" style={{ color: '#fff', fontSize: 10.5 }}>{t('illus')}</T>
    </View>
  );
}

/** The article's own photo, or the website's blue "no image" tile with the faint logo (never another story's picture) */
export function Photo({ uri, alt, style, rounded = 6, priority, illus, children }: { uri?: string | null; alt?: string; style?: StyleProp<ViewStyle>; label?: string; rounded?: number; priority?: 'high' | 'normal' | 'low'; illus?: boolean; children?: React.ReactNode }) {
  const { colors, t } = useSettings();
  const src = abs(uri);
  return (
    <View style={[{ borderRadius: rounded, overflow: 'hidden', backgroundColor: src ? colors.chip : colors.blue }, style]}>
      {src ? (
        <Image
          source={{ uri: src }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          priority={priority}
          accessibilityLabel={alt || undefined}
          alt={alt}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueD }]} accessibilityLabel={t('noImg')}>
          <Image source={LOGO_IMG} style={{ width: '45%', aspectRatio: 1, opacity: 0.14 }} contentFit="contain" />
        </View>
      )}
      {src && illus ? <IllusBadge /> : null}
      {children}
    </View>
  );
}

/** Category label, exactly as the website's .cat: blue, red for breaking (with a pulsing dot) and for sponsored */
export function CatTag({ label, red, dot, style }: { label: string; red?: boolean; dot?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  return (
    <Row style={[{ backgroundColor: red ? colors.red : colors.blue, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start', gap: 6 }, style]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} /> : null}
      <T f="display" style={{ color: '#fff', fontSize: 10.5, lineHeight: 12, letterSpacing: 0.9, textTransform: 'uppercase' }}>{label}</T>
    </Row>
  );
}

/** Section heading: a short brand-coloured bar, the title, and "See all ›" on the other side */
export function BlockHead({ title, red, onMore, moreLabel, style }: { title: string; red?: boolean; onMore?: () => void; moreLabel?: string; style?: StyleProp<ViewStyle> }) {
  const { colors, rtl } = useSettings();
  const c = red ? colors.red : colors.blue;
  return (
    <Row style={[{ marginHorizontal: 16, marginTop: 30, marginBottom: 14, justifyContent: 'space-between', gap: 12 }, style]}>
      <Row style={{ gap: 9, flexShrink: 1 }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: c }} />
        <T f="display" numberOfLines={2} style={{ fontSize: 17, lineHeight: 21, letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1 }} accessibilityRole="header">{title}</T>
      </Row>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="link" accessibilityLabel={moreLabel ? moreLabel.replace(/[→←›]/g, '').trim() + ': ' + title : title} style={({ pressed }) => ({ flexDirection: rtl && Platform.OS !== 'web' ? 'row-reverse' : 'row', alignItems: 'center', gap: 2, opacity: pressed ? 0.6 : 1 })}>
          <T f="bodyBold" style={{ color: colors.link, fontSize: 13 }}>{(moreLabel || '').replace(/\s*[→←›]\s*$/, '')}</T>
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.link} />
        </Pressable>
      ) : null}
    </Row>
  );
}

/** Shimmering placeholder while the news loads */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const opacity = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] });
  return <Animated.View style={[{ backgroundColor: colors.skeleton, borderRadius: 6, opacity }, style]} />;
}

export function FeedSkeleton() {
  return (
    <View style={{ padding: 16, gap: 18 }}>
      <Skeleton style={{ height: 210, borderRadius: 12 }} />
      <Skeleton style={{ height: 22, width: '85%' }} />
      <Skeleton style={{ height: 16, width: '60%' }} />
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton style={{ width: 112, height: 76, borderRadius: 8 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 14, width: '95%' }} />
            <Skeleton style={{ height: 14, width: '80%' }} />
            <Skeleton style={{ height: 11, width: '40%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SectionHead({ title, color, onMore, moreLabel }: { title: string; color?: string; onMore?: () => void; moreLabel?: string }) {
  const { colors } = useSettings();
  return (
    <Row style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 10, justifyContent: 'space-between' }}>
      <Row style={{ gap: 8 }}>
        <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: color || colors.blue }} />
        <T f="display" style={{ fontSize: 18, letterSpacing: 0.2, textTransform: 'uppercase' }}>{title}</T>
      </Row>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="link">
          <T f="bodyBold" style={{ color: colors.link, fontSize: 13 }}>{moreLabel || '›'}</T>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Notice({ text, tone = 'info', action, onAction }: { text: string; tone?: 'info' | 'warn' | 'error'; action?: string; onAction?: () => void }) {
  const { colors } = useSettings();
  const bg = tone === 'warn' ? colors.amberBg : tone === 'error' ? (colors.dark ? '#3b0d0e' : '#fdecec') : colors.chip;
  const fg = tone === 'warn' ? colors.amber : tone === 'error' ? (colors.dark ? '#ff9b9d' : '#9b1114') : colors.fg;
  return (
    <View style={{ backgroundColor: bg, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8 }} accessibilityRole="alert">
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name={tone === 'error' ? 'alert-circle-outline' : tone === 'warn' ? 'cloud-offline-outline' : 'information-circle-outline'} size={18} color={fg} style={{ marginTop: 1 }} />
        <T style={{ color: fg, fontSize: 14, lineHeight: 20, flex: 1 }}>{text}</T>
      </Row>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', marginStart: 28 }}>
          <T f="bodyBold" style={{ color: colors.link, fontSize: 14 }}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export const s = StyleSheet.create({
  flex: { flex: 1 },
});

/** Page title band, as at the top of the website's section pages: blue gradient (red for breaking), big title, one line of text */
export function PageHero({ title, sub, red, children }: { title: string; sub?: string; red?: boolean; children?: React.ReactNode }) {
  const { colors } = useSettings();
  return (
    <LinearGradient colors={red ? [colors.red, '#b80407'] : [colors.blue, colors.blueD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 22 }}>
      <T f="brand" style={{ color: '#fff', fontSize: 25, lineHeight: 29, letterSpacing: 0.3 }} accessibilityRole="header">{title}</T>
      {sub ? <T style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14, marginTop: 6, lineHeight: 20 }}>{sub}</T> : null}
      {children}
    </LinearGradient>
  );
}

/** A designed empty state: an icon in a soft circle, one line of title and one of help */
export function EmptyState({ icon, title, text, action, onAction }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text?: string; action?: string; onAction?: () => void }) {
  const { colors } = useSettings();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Ionicons name={icon} size={28} color={colors.blue} />
      </View>
      <T f="display" style={{ fontSize: 18, textAlign: 'center' }}>{title}</T>
      {text ? <T style={{ fontSize: 14.5, lineHeight: 21, textAlign: 'center', color: colors.sub }}>{text}</T> : null}
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 8, backgroundColor: colors.blue, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, opacity: pressed ? 0.85 : 1 })}>
          <T f="bodyBold" style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A grouped box (settings, menus): white card with soft corners */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  return <View style={[{ backgroundColor: colors.surface, marginHorizontal: 16, borderRadius: 14, borderWidth: colors.dark ? 1 : 0, borderColor: colors.hair, overflow: 'hidden', shadowColor: '#0b1c33', shadowOpacity: colors.dark ? 0 : 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, style]}>{children}</View>;
}

/** One row of a Group: icon tile, label, optional value, chevron */
export function GroupRow({ icon, label, value, onPress, color, first, right }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value?: string; onPress?: () => void; color?: string; first?: boolean; right?: React.ReactNode }) {
  const { colors, rtl } = useSettings();
  const c = color || colors.blue;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'link' : undefined} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: pressed ? colors.tint : 'transparent', borderTopWidth: first ? 0 : 1, borderTopColor: colors.hair })}>
      <Row style={{ gap: 12 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c === colors.red ? (colors.dark ? '#3b0d0e' : '#fdecec') : colors.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={17} color={c} />
        </View>
        <T f="bodyMed" style={{ flex: 1, fontSize: 15.5 }}>{label}</T>
        {value ? <T style={{ fontSize: 14, color: colors.sub }}>{value}</T> : null}
        {right ?? (onPress ? <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.sub} /> : null)}
      </Row>
    </Pressable>
  );
}
