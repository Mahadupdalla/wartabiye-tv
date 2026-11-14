// The compact language selector: a small "🇸🇴 SO ▾" button that opens a 3 x 3 popover with the nine Wartabiye TV
// languages (flag + the language's own name + code). The same popover is used in the top bar and in Settings, so the reader
// changes language where they always did, without nine full-width rows. The choice is saved at once (settings.tsx).
import React, { useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../lib/settings';
import { LANG_INFO, LANGS, type Lang } from '../lib/types';
import { R } from '../lib/theme';
import { Row, T } from './ui';

const NATIVE = Platform.OS !== 'web';
type Rect = { x: number; y: number; w: number; h: number };

/** Short code shown on the button and in the popover */
export const code = (l: Lang) => l.toUpperCase();

function usePopover() {
  const ref = useRef<any>(null);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [shown, setShown] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  const open = () => {
    const show = (r: Rect | null) => {
      setAnchor(r);
      setShown(true);
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    };
    if (ref.current?.measureInWindow) ref.current.measureInWindow((x: number, y: number, w: number, h: number) => show({ x, y, w, h }));
    else show(null);
  };
  const close = (then?: () => void) => {
    Animated.timing(a, { toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(() => { setShown(false); then?.(); });
  };
  return { ref, anchor, shown, a, open, close };
}

/** The language's flag (an emoji, so it needs no image files and looks the same as in iOS itself) */
export function Flag({ l, size = 16 }: { l: Lang; size?: number }) {
  return <Text allowFontScaling={false} accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: size, lineHeight: Math.round(size * 1.25) }}>{LANG_INFO[l].flag}</Text>;
}

/** The popover itself: nine compact cells, the chosen language filled blue */
function LangPopover({ anchor, a, onClose }: { anchor: Rect | null; a: Animated.Value; onClose: (then?: () => void) => void }) {
  const { colors, lang, setLang, t, rtl } = useSettings();
  const { width: W, height: H } = useWindowDimensions();
  const w = Math.min(W - 24, 330);
  const h = 226;
  let left = anchor ? (rtl ? anchor.x : anchor.x + anchor.w - w) : (W - w) / 2;
  left = Math.max(12, Math.min(W - w - 12, left));
  let top = anchor ? anchor.y + anchor.h + 8 : 120;
  if (top + h > H - 20 && anchor) top = Math.max(20, anchor.y - h - 8);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const pick = (l: Lang) => onClose(() => setLang(l));
  return (
    <>
      <Pressable testID="lang-scrim" onPress={() => onClose()} accessibilityElementsHidden importantForAccessibility="no" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(11,28,51,0.28)', opacity: a }} />
      </Pressable>
      <Animated.View
        testID="lang-menu"
        accessibilityViewIsModal
        style={{ position: 'absolute', top, left, width: w, opacity: a, transform: [{ scale }], backgroundColor: colors.surface, borderRadius: R.lg, borderWidth: colors.dark ? 1 : 0, borderColor: colors.hair, padding: 10, shadowColor: '#0b1c33', shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}
      >
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 }}>
          <Row style={{ gap: 6 }}>
            <Ionicons name="language-outline" size={15} color={colors.sub} />
            <T f="bodyBold" style={{ fontSize: 11.5, letterSpacing: 1, color: colors.sub, textTransform: 'uppercase' }}>{t('language')}</T>
          </Row>
          <Pressable onPress={() => onClose()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={{ padding: 2 }}>
            <Ionicons name="close" size={18} color={colors.sub} />
          </Pressable>
        </Row>
        <View style={{ flexDirection: rtl && NATIVE ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {LANGS.map(l => {
            const on = l === lang;
            return (
              <Pressable
                key={l}
                testID={'lang-' + l}
                onPress={() => pick(l)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={LANG_INFO[l].name}
                style={({ pressed }) => ({ width: (w - 20 - 12) / 3, height: 56, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: on ? colors.blue : pressed ? colors.tint : colors.dark ? colors.chip : '#f3f6fa' })}
              >
                <Row style={{ gap: 5 }}>
                  <Flag l={l} size={17} />
                  <T f="display" style={{ fontSize: 12.5, letterSpacing: 0.8, textAlign: 'center', color: on ? '#fff' : colors.blue }}>{code(l)}</T>
                  {on ? <Ionicons name="checkmark-circle" size={13} color="#fff" /> : null}
                </Row>
                <T f="bodyMed" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 12.5, textAlign: 'center', writingDirection: LANG_INFO[l].rtl ? 'rtl' : 'ltr', color: on ? '#fff' : colors.fg }}>{LANG_INFO[l].name}</T>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}

/** Small "🇸🇴 SO ▾" button for the blue top bar */
export function LangButton() {
  const { lang, t } = useSettings();
  const { width } = useWindowDimensions();
  const p = usePopover();
  return (
    <>
      <Pressable
        ref={p.ref}
        collapsable={false}
        testID="lang-button"
        onPress={p.open}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('language') + ': ' + LANG_INFO[lang].name}
        style={({ pressed }) => ({ height: 30, paddingHorizontal: width >= 360 ? 9 : 7, borderRadius: R.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', justifyContent: 'center' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Flag l={lang} size={14} />
          <T f="display" style={{ color: '#fff', fontSize: 12.5, letterSpacing: 0.8, textAlign: 'center' }}>{code(lang)}</T>
          <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.85)" />
        </View>
      </Pressable>
      <Modal visible={p.shown} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => p.close()}>
        <LangPopover anchor={p.anchor} a={p.a} onClose={p.close} />
      </Modal>
    </>
  );
}

/** Settings row: "Language · English (EN) ▾", opening the same popover under it */
export function LangRow() {
  const { colors, lang, t } = useSettings();
  const p = usePopover();
  return (
    <>
      <Pressable
        ref={p.ref}
        collapsable={false}
        testID="lang-row"
        onPress={p.open}
        accessibilityRole="button"
        accessibilityLabel={t('language') + ': ' + LANG_INFO[lang].name}
        style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? colors.tint : 'transparent' })}
      >
        <Row style={{ gap: 12 }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}>
            <Flag l={lang} size={17} />
          </View>
          <T f="bodyMed" style={{ flex: 1, fontSize: 15.5 }}>{t('language')}</T>
          <T f="bodyBold" style={{ fontSize: 15, writingDirection: LANG_INFO[lang].rtl ? 'rtl' : 'ltr' }}>{LANG_INFO[lang].name}</T>
          <View style={{ backgroundColor: colors.tint, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
            <T f="display" style={{ fontSize: 11, color: colors.blue, letterSpacing: 0.6 }}>{code(lang)}</T>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.sub} />
        </Row>
      </Pressable>
      <Modal visible={p.shown} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => p.close()}>
        <LangPopover anchor={p.anchor} a={p.a} onClose={p.close} />
      </Modal>
    </>
  );
}
