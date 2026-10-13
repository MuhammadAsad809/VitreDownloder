/**
 * Vitre Glass UI kit — reusable Liquid Glass components bound to the theme.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  StyleProp, ViewStyle, Animated, Easing, useReducedMotion, ViewProps,
} from 'react-native';
import { LiquidGlassView } from 'liquid-glass-kit';
import { Palette, radius } from '../theme';

/* ---------------- GlassPanel ---------------- */

interface PanelProps extends ViewProps {
  t: Palette;
  intensity?: 'light' | 'medium' | 'heavy';
  padded?: boolean;
}
export const GlassPanel: React.FC<PanelProps> = ({ t, children, style, intensity = 'medium', padded = true, ...rest }) => (
  <LiquidGlassView
    intensity={intensity}
    borderRadius={radius.xl}
    style={[
      styles.panelBase,
      { backgroundColor: t.glassBg, borderColor: t.glassBorder },
      padded && styles.panelPad,
      style,
    ]}
    {...rest}
  >
    {children}
  </LiquidGlassView>
);

/* ---------------- Buttons ---------------- */

interface BtnProps {
  t: Palette;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'glass' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  icon?: string;
  style?: StyleProp<ViewStyle>;
}
export const GlassButton: React.FC<BtnProps> = ({ t, title, onPress, disabled, busy, variant = 'primary', size = 'md', icon, style }) => {
  const bg =
    variant === 'primary' ? t.accent :
    variant === 'danger' ? t.dangerBg :
    variant === 'ghost' ? 'transparent' : t.glassBg;
  const fg = variant === 'primary' ? t.accentInk : variant === 'danger' ? t.danger : t.text;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.75}
      style={[
        styles.button,
        { backgroundColor: bg, borderRadius: radius.lg },
        (variant === 'glass' || variant === 'ghost') && { borderWidth: 1, borderColor: t.glassBorder },
        variant === 'danger' && { borderWidth: 1, borderColor: 'rgba(255,120,120,0.3)' },
        size === 'sm' && styles.buttonSm,
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }, size === 'sm' && styles.buttonTextSm]}>
          {icon ? `${icon}  ` : ''}{title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

/* ---------------- Chips / Pills ---------------- */

interface ChipProps { t: Palette; label: string; active?: boolean; onPress?: () => void; muted?: boolean; }
export const GlassChip: React.FC<ChipProps> = ({ t, label, active, onPress, muted }) => {
  const chip = (
    <View
      style={[
        styles.chip,
        { borderRadius: radius.pill },
        active && { backgroundColor: t.accentSoftBg, borderColor: t.accentSoftBorder },
        muted && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? t.accent : t.textSecondary }]}>{label}</Text>
    </View>
  );
  if (!onPress) return chip;
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.7}>{chip}</TouchableOpacity>
  );
};

export const Badge: React.FC<{ t: Palette; label: string; tone?: 'accent' | 'danger' | 'warning' | 'muted' }> = ({ t, label, tone = 'accent' }) => {
  const map = {
    accent: { bg: t.accentSoftBg, fg: t.accent, bd: t.accentSoftBorder },
    danger: { bg: t.dangerBg, fg: t.danger, bd: 'rgba(255,120,120,0.3)' },
    warning: { bg: 'rgba(255,200,120,0.10)', fg: t.warning, bd: 'rgba(255,200,120,0.28)' },
    muted: { bg: t.track, fg: t.textSecondary, bd: t.hairline },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg, borderColor: map.bd }]}>
      <Text style={[styles.badgeText, { color: map.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

/* ---------------- Section header ---------------- */

export const SectionHeader: React.FC<{ t: Palette; title: string; eyebrow?: string; right?: React.ReactNode }> = ({ t, title, eyebrow, right }) => (
  <View style={styles.sectionHead}>
    <View style={{ flex: 1 }}>
      {!!eyebrow && <Text style={[styles.eyebrow, { color: t.accentStrong }]}>{eyebrow.toUpperCase()}</Text>}
      <Text style={[styles.sectionTitle, { color: t.text }]} numberOfLines={1}>{title}</Text>
    </View>
    {right}
  </View>
);

/* ---------------- Toggle row ---------------- */

interface ToggleRowProps {
  t: Palette; title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}
export const ToggleRow: React.FC<ToggleRowProps> = ({ t, title, subtitle, value, onChange, disabled }) => (
  <View style={[styles.settingRow, disabled && { opacity: 0.5 }]}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.rowSubtitle, { color: t.textMuted }]}>{subtitle}</Text>}
    </View>
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.toggle, { backgroundColor: value ? t.accentStrong : t.track }]}
    >
      <View style={[styles.toggleKnob, { backgroundColor: value ? t.accentInk : t.textSecondary }, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  </View>
);

/* ---------------- Radio row ---------------- */

interface RadioRowProps {
  t: Palette; title: string; subtitle?: string; right?: React.ReactNode;
  selected: boolean; onPress: () => void; icon?: React.ReactNode; disabled?: boolean;
}
export const RadioRow: React.FC<RadioRowProps> = ({ t, title, subtitle, right, selected, onPress, icon, disabled }) => (
  <TouchableOpacity
    accessibilityRole="radio"
    accessibilityState={{ selected, disabled: !!disabled }}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.75}
    style={[
      styles.radioRow,
      { borderColor: selected ? t.accentSoftBorder : 'transparent', backgroundColor: selected ? t.accentSoftBg : 'transparent' },
      disabled && { opacity: 0.45 },
    ]}
  >
    {icon}
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowTitle, { color: selected ? t.accent : t.text }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.rowSubtitle, { color: t.textMuted }]} numberOfLines={2}>{subtitle}</Text>}
    </View>
    {right}
    <View style={[styles.radioOuter, { borderColor: selected ? t.accent : t.textMuted }]}>
      {selected && <View style={[styles.radioInner, { backgroundColor: t.accent }]} />}
    </View>
  </TouchableOpacity>
);

/* ---------------- Progress bar ---------------- */

export const ProgressBar: React.FC<{ t: Palette; percent: number; height?: number }> = ({ t, percent, height = 6 }) => (
  <View style={[styles.progressTrack, { backgroundColor: t.track, height, borderRadius: height / 2 }]}>
    <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', backgroundColor: t.accent, borderRadius: height / 2 }} />
  </View>
);

/* ---------------- Spinner (subtle pulse, respects reduced motion) ---------------- */

export const GlassSpinner: React.FC<{ t: Palette; label?: string }> = ({ t, label }) => {
  const reduced = useReducedMotion();
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.spinnerWrap}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <View style={[styles.spinnerRing, { borderColor: t.accentSoftBorder, borderTopColor: t.accent }]}>
          <ActivityIndicator size="small" color={t.accent} />
        </View>
      </Animated.View>
      {!!label && <Text style={[styles.spinnerLabel, { color: t.textSecondary }]}>{label}</Text>}
    </View>
  );
};

/* ---------------- Empty state ---------------- */

export const EmptyState: React.FC<{ t: Palette; glyph: string; title: string; body: string; action?: React.ReactNode }> = ({ t, glyph, title, body, action }) => (
  <View style={styles.empty}>
    <View style={[styles.emptyIcon, { backgroundColor: t.accentSoftBg, borderColor: t.accentSoftBorder }]}>
      <Text style={{ fontSize: 26, color: t.accent }}>{glyph}</Text>
    </View>
    <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
    <Text style={[styles.emptyBody, { color: t.textMuted }]}>{body}</Text>
    {action}
  </View>
);

const styles = StyleSheet.create({
  panelBase: { marginBottom: 14, overflow: 'hidden' },
  panelPad: { padding: 16 },
  button: { height: 50, alignItems: 'center', justifyContent: 'center' },
  buttonSm: { height: 40 },
  buttonText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  buttonTextSm: { fontSize: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  chipText: { fontSize: 11, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1, maxWidth: 180 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  rowSubtitle: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11 },
  toggleKnobOn: { alignSelf: 'flex-end' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: radius.md, borderWidth: 1, marginBottom: 6 },
  radioOuter: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 9, height: 9, borderRadius: 5 },
  progressTrack: { width: '100%', overflow: 'hidden', borderRadius: 3 },
  spinnerWrap: { alignItems: 'center', paddingVertical: 26, gap: 14 },
  spinnerRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  spinnerLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyBody: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, marginBottom: 18, maxWidth: 300 },
});
