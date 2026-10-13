import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * liquid-glass-kit v2 – Fully upgraded pure-JS Liquid Glass
 * Premium look with specular edge, inner glow, depth & intensity levels.
 * Real AGSL refraction still needs native module.
 */

export const isLiquidGlassSupported = false;

export function LiquidGlassProvider({ children, style, ...rest }) {
  return (
    <View style={[{ flex: 1, backgroundColor: '#030305' }, style]} {...rest}>
      {children}
    </View>
  );
}

export function LiquidGlassView({
  children,
  style,
  interactive = false,
  chromaticAberration = 0,
  intensity = 'medium',
  borderRadius = 22,
  ...rest
}) {
  const levels = {
    light: {
      bg: 'rgba(255,255,255,0.035)',
      border: 'rgba(255,255,255,0.09)',
      top: 'rgba(255,255,255,0.20)',
      inner: 'rgba(255,255,255,0.04)',
      shadow: 0.22,
      elevation: 8,
    },
    medium: {
      bg: 'rgba(255,255,255,0.065)',
      border: 'rgba(255,255,255,0.13)',
      top: 'rgba(255,255,255,0.28)',
      inner: 'rgba(255,255,255,0.06)',
      shadow: 0.35,
      elevation: 14,
    },
    heavy: {
      bg: 'rgba(255,255,255,0.10)',
      border: 'rgba(255,255,255,0.18)',
      top: 'rgba(255,255,255,0.36)',
      inner: 'rgba(255,255,255,0.08)',
      shadow: 0.48,
      elevation: 18,
    },
  };

  const s = levels[intensity] || levels.medium;

  return (
    <View
      style={[
        {
          backgroundColor: s.bg,
          borderWidth: 1,
          borderColor: s.border,
          borderTopColor: s.top,
          borderRadius,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: s.shadow,
          shadowRadius: 28,
          elevation: s.elevation,
        },
        style,
      ]}
      {...rest}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 18,
          right: 18,
          height: 1.5,
          backgroundColor: s.top,
          borderRadius: 1,
        }}
        pointerEvents="none"
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 42,
          backgroundColor: s.inner,
        }}
        pointerEvents="none"
      />
      <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
    </View>
  );
}
