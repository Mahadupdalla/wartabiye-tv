import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type TextProps, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
    <Row style={[{ backgroundColor: red ? colors.red : colors.blue, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 6, alignSelf: 'flex-start', gap: 6 }, style]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} /> : null}
      <T f="display" style={{ color: '#fff', fontSize: 10.5, lineHeight: 11, letterSpacing: 0.95, textTransform: 'uppercase' }}>{label}</T>
    </Row>
  );
}

/** Website block heading (.blockhead): a filled blue (or red) label on a 2 px rule, "See all →" on the other side */
export function BlockHead({ title, red, onMore, moreLabel, style }: { title: string; red?: boolean; onMore?: () => void; moreLabel?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  const c = red ? colors.red : colors.blue;
  return (
    <Row style={[{ marginHorizontal: 16, marginTop: 28, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: c, justifyContent: 'space-between', alignItems: 'flex-end' }, style]}>
      <View style={{ backgroundColor: c, borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 1 }}>
        <T f="display" style={{ color: '#fff', fontSize: 14, letterSpacing: 1.1, textTransform: 'uppercase' }} accessibilityRole="header">{title}</T>
      </View>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="link" style={{ paddingBottom: 8, paddingStart: 10 }}>
          <T f="display" style={{ color: colors.link, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>{moreLabel}</T>
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
    <View style={{ backgroundColor: bg, marginHorizontal: 16, marginTop: 10, borderRadius: 8, padding: 12, gap: 8 }} accessibilityRole="alert">
      <T style={{ color: fg, fontSize: 14 }}>{text}</T>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button">
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
    <LinearGradient colors={red ? [colors.red, '#b80407'] : [colors.blue, colors.blueD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 26 }}>
      <T f="brand" style={{ color: '#fff', fontSize: 28, lineHeight: 32, letterSpacing: 0.3 }} accessibilityRole="header">{title}</T>
      {sub ? <T style={{ color: '#fff', fontSize: 14.5, marginTop: 10, lineHeight: 22, opacity: 0.95 }}>{sub}</T> : null}
      {children}
    </LinearGradient>
  );
}
