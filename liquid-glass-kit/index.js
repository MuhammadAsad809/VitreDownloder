import React from 'react';
import { View } from 'react-native';

export const isLiquidGlassSupported = false;

export function LiquidGlassProvider({ children, style, ...rest }) {
  return <View style={style} {...rest}>{children}</View>;
}

export function LiquidGlassView({ children, style, interactive, chromaticAberration, ...rest }) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(24, 24, 27, 0.72)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.14)',
          borderTopColor: 'rgba(255, 255, 255, 0.28)',
          borderRadius: 20,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
