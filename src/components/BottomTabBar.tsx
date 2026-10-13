/**
 * BottomTabBar — premium Liquid Glass navigation bar.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LiquidGlassView } from 'liquid-glass-kit';
import { Palette, radius } from '../theme';

export type Route =
  | 'home' | 'downloads' | 'settings' | 'about' | 'storage'
  | { name: 'details'; url: string }
  | { name: 'player'; filePath: string; title?: string };

interface TabDef { key: string; label: string; glyph: string; route: Route; }

const TABS: TabDef[] = [
  { key: 'home', label: 'Home', glyph: '⌂', route: 'home' },
  { key: 'downloads', label: 'Downloads', glyph: '↓', route: 'downloads' },
  { key: 'settings', label: 'Settings', glyph: '⚙', route: 'settings' },
];

interface Props { t: Palette; activeKey: string; onNavigate: (r: Route) => void; visible: boolean; }

export const BottomTabBar: React.FC<Props> = ({ t, activeKey, onNavigate, visible }) => {
  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <LiquidGlassView intensity="heavy" borderRadius={radius.xxl} style={[styles.bar, { backgroundColor: t.glassBgHeavy, borderColor: t.glassBorder }]}>
        {TABS.map(tab => {
          const active = tab.key === activeKey;
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onNavigate(tab.route)}
              activeOpacity={0.75}
              style={styles.tab}
            >
              <View style={[styles.iconWrap, active && { backgroundColor: t.accentSoftBg, borderColor: t.accentSoftBorder }]}>
                <Text style={[styles.glyph, { color: active ? t.accent : t.textMuted }]}>{tab.glyph}</Text>
              </View>
              <Text style={[styles.label, { color: active ? t.accent : t.textMuted }, active && styles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </LiquidGlassView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  bar: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  iconWrap: { width: 44, height: 30, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 9.5, fontWeight: '600' },
  labelActive: { fontWeight: '800' },
});
