import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type TextProps, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { useSettings } from '../lib/settings';
import { FONT } from '../lib/theme';
import { abs } from '../lib/config';

type Font = 'display' | 'displayBold' | 'body' | 'bodyMed' | 'bodyBold';

/** Text in the app's type; Arabic uses the phone's own font (Archivo and Public Sans have no Arabic letters) */
export function T({ f = 'body', style, children, muted, ...rest }: TextProps & { f?: Font; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const { colors, rtl } = useSettings();
  const weight: TextStyle['fontWeight'] = f === 'display' ? '800' : f === 'displayBold' || f === 'bodyBold' ? '700' : f === 'bodyMed' ? '500' : '400';
  return (
    <Text
      {...rest}
      style={[{ color: muted ? colors.muted : colors.fg, fontFamily: rtl ? undefined : FONT[f], fontWeight: rtl ? weight : undefined, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }, style]}
    >
      {children}
    </Text>
  );
}

export function Row({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const { rtl } = useSettings();
  return <View style={[{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Pill({ label, color, fg = '#fff', style }: { label: string; color: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: color, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' }, style]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

/** Pulsing red dot for genuinely active LIVE coverage */
export function LiveDot({ size = 8 }: { size?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F2060A', opacity: a }} />;
}

/** The article's own photo, or a clear "no image" tile (never another story's picture) */
export function Photo({ uri, alt, style, label, rounded = 8, priority }: { uri?: string | null; alt?: string; style?: StyleProp<ViewStyle>; label?: string; rounded?: number; priority?: 'high' | 'normal' | 'low' }) {
  const { colors, t } = useSettings();
  const src = abs(uri);
  if (!src) {
    return (
      <View style={[{ backgroundColor: colors.chip, borderRadius: rounded, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]} accessibilityLabel={t('noImg')}>
        <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 13 }}>{label || 'Wartabiye TV'}</Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{t('noImg')}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      style={[{ borderRadius: rounded, backgroundColor: colors.skeleton }, style as any]}
      contentFit="cover"
      transition={180}
      cachePolicy="memory-disk"
      priority={priority}
      accessibilityLabel={alt || undefined}
      alt={alt}
    />
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
