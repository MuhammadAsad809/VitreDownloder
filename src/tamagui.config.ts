import { createTamagui, createTokens } from "@tamagui/core";

const size = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  true: 16,
};

const space = {
  ...size,
  "-1": -4,
  "-2": -8,
};

const radius = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  true: 12,
};

const zIndex = {
  0: 0,
  1: 100,
  2: 200,
  3: 300,
  true: 100,
};

const color = {
  bg: "#090E0A",
  card: "rgba(16, 26, 19, 0.85)",
  cardBorder: "rgba(52, 211, 153, 0.18)",
  emerald: "#10B981",
  emeraldHover: "#34D399",
  emeraldDark: "#059669",
  mint: "#34D399",
  cyan: "#06B6D4",
  text: "#F4F4F5",
  subtext: "#A1A1AA",
  danger: "#EF4444",
};

const tokens = createTokens({
  size,
  space,
  zIndex,
  color,
  radius,
});

export const tamaguiConfig = createTamagui({
  tokens,
  themes: {
    dark: {
      background: tokens.color.bg,
      color: tokens.color.text,
      borderColor: tokens.color.cardBorder,
      cardBackground: tokens.color.card,
      primary: tokens.color.emerald,
    },
  },
  defaultTheme: "dark",
  shorthands: {
    bg: "backgroundColor",
    p: "padding",
    m: "margin",
    w: "width",
    h: "height",
    br: "borderRadius",
  } as const,
});

type Conf = typeof tamaguiConfig;
declare module "@tamagui/core" {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
