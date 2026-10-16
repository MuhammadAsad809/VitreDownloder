import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from "liquid-glass-kit";

interface GlassContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({
  children,
  style,
  interactive = false,
}) => {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        style={style}
        interactive={interactive}
        chromaticAberration={0.2}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <View style={[styles.fallback, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "rgba(16, 24, 18, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.14)",
    borderTopColor: "rgba(52, 211, 153, 0.28)",
    borderRadius: 16,
    overflow: "hidden",
  },
});
