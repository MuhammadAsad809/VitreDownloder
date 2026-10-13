/**
 * SettingsScreen — every toggle drives real behavior and persists via AsyncStorage.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Palette, radius, typography, ThemeMode } from '../theme';
import { GlassPanel, ToggleRow, RadioRow, Badge } from '../components/GlassUI';
import { VitreSettings, QUALITY_PRESETS, QualityPreset } from '../settings';

interface Props {
  t: Palette;
  settings: VitreSettings;
  onChange: <K extends keyof VitreSettings>(key: K, value: VitreSettings[K]) => void;
  onReset: () => void;
  onOpenStorage: () => void;
  onOpenAbout: () => void;
  onClearHistory: () => void;
}

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Dark (Liquid Glass)', value: 'dark' },
  { label: 'Light', value: 'light' },
];

export const SettingsScreen: React.FC<Props> = ({ t, settings, onChange, onReset, onOpenStorage, onOpenAbout, onClearHistory }) => (
  <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <Text style={[styles.eyebrow, { color: t.accentStrong }]}>MAKE IT YOURS</Text>
      <Text style={[styles.pageTitle, { color: t.text }]}>Settings</Text>
    </View>

    <GlassPanel t={t}>
      <Text style={[styles.groupTitle, { color: t.textMuted }]}>DEFAULT VIDEO QUALITY</Text>
      {QUALITY_PRESETS.map(q => (
        <RadioRow
          key={q.value}
          t={t}
          title={q.label}
          subtitle={q.note}
          selected={settings.defaultQuality === q.value}
          onPress={() => onChange('defaultQuality', q.value as QualityPreset)}
        />
      ))}
      <Text style={[styles.hint, { color: t.textMuted }]}>
        New analyses preselect this quality when the source actually offers it; otherwise the closest available format is chosen and clearly shown before downloading.
      </Text>
    </GlassPanel>

    <GlassPanel t={t}>
      <Text style={[styles.groupTitle, { color: t.textMuted }]}>FORMAT PREFERENCES</Text>
      <View style={styles.chipGroup}>
        {(['any', 'mp4', 'webm'] as const).map(ext => (
          <TouchableOpacity
            key={ext}
            onPress={() => onChange('preferredExt', ext)}
            style={[
              styles.extChip,
              { borderColor: settings.preferredExt === ext ? t.accentSoftBorder : t.glassBorder, backgroundColor: settings.preferredExt === ext ? t.accentSoftBg : 'transparent' },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: settings.preferredExt === ext }}
          >
            <Text style={{ color: settings.preferredExt === ext ? t.accent : t.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {ext === 'any' ? 'Any container' : ext.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ToggleRow t={t} title="Audio-only by default" subtitle="Prefer saving just the audio stream when supported." value={settings.audioOnlyDefault} onChange={v => onChange('audioOnlyDefault', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Save thumbnail with media" subtitle="Store the cover image next to the downloaded file." value={settings.saveThumbnails} onChange={v => onChange('saveThumbnails', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Safe filenames" subtitle="Strip characters Android may reject from titles." value={settings.safeFilenames} onChange={v => onChange('safeFilenames', v)} />
    </GlassPanel>

    <GlassPanel t={t}>
      <Text style={[styles.groupTitle, { color: t.textMuted }]}>NETWORK &amp; STORAGE</Text>
      <ToggleRow t={t} title="Wi-Fi only downloads" subtitle="Requires network state access; enforced by the download engine." value={settings.wifiOnly} onChange={v => onChange('wifiOnly', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <Text style={[styles.subLabel, { color: t.textSecondary }]}>SIMULTANEOUS DOWNLOADS</Text>
      <View style={styles.chipGroup}>
        {([1, 2, 3] as const).map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange('maxConcurrent', n)}
            style={[
              styles.extChip,
              { borderColor: settings.maxConcurrent === n ? t.accentSoftBorder : t.glassBorder, backgroundColor: settings.maxConcurrent === n ? t.accentSoftBg : 'transparent' },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: settings.maxConcurrent === n }}
          >
            <Text style={{ color: settings.maxConcurrent === n ? t.accent : t.textSecondary, fontSize: 12, fontWeight: '700' }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.hint, { color: t.textMuted }]}>One download runs at a time through the Python engine; additional downloads wait in line up to this limit.</Text>
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <NavRow t={t} title="Storage manager" subtitle="Vitre folder size, file counts, cleanup." onPress={onOpenStorage} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <NavRow t={t} title="Clear download history" subtitle="Removes app records only — never your saved files." danger onPress={onClearHistory} />
    </GlassPanel>

    <GlassPanel t={t}>
      <Text style={[styles.groupTitle, { color: t.textMuted }]}>NOTIFICATIONS &amp; BEHAVIOUR</Text>
      <ToggleRow t={t} title="Completion notifications" subtitle="Android notification when a download finishes." value={settings.notifyComplete} onChange={v => onChange('notifyComplete', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Failure notifications" subtitle="Alert me when a download fails." value={settings.notifyFailed} onChange={v => onChange('notifyFailed', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Progress notifications" subtitle="Persistent notification with live percentage." value={settings.notifyProgress} onChange={v => onChange('notifyProgress', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Keep screen awake while downloading" subtitle="Prevents sleep during long saves." value={settings.keepAwake} onChange={v => onChange('keepAwake', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Confirm before download" subtitle="Show a summary sheet before starting." value={settings.confirmBeforeDownload} onChange={v => onChange('confirmBeforeDownload', v)} />
      <View style={[styles.separator, { backgroundColor: t.hairline }]} />
      <ToggleRow t={t} title="Confirm before deleting files" subtitle="Recommended — prevents accidental loss." value={settings.confirmBeforeDelete} onChange={v => onChange('confirmBeforeDelete', v)} />
    </GlassPanel>

    <GlassPanel t={t}>
      <Text style={[styles.groupTitle, { color: t.textMuted }]}>APPEARANCE</Text>
      {THEME_OPTIONS.map(opt => (
        <RadioRow key={opt.value} t={t} title={opt.label} selected={settings.themeMode === opt.value} onPress={() => onChange('themeMode', opt.value)} />
      ))}
      <Text style={[styles.hint, { color: t.textMuted }]}>Premium dark Liquid Glass is the designed default. Light mode keeps the same layout with readable contrast.</Text>
    </GlassPanel>

    <GlassPanel t={t}>
      <Text style={[styles.groupTitle, { color: t.textMuted }]}>ABOUT &amp; SUPPORT</Text>
      <View style={styles.aboutRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aboutTitle, { color: t.text }]}>Vitre Downloader</Text>
          <Text style={[styles.aboutSub, { color: t.textMuted }]}>On-device media downloader · YouTube · Instagram · TikTok</Text>
        </View>
        <Badge t={t} label="v1.0.0" tone="accent" />
      </View>
      <NavRow t={t} title="About, licenses & privacy" subtitle="Repository, third-party credits, data policy." onPress={onOpenAbout} />
      <TouchableOpacity
        onPress={() => Alert.alert('Reset settings?', 'Restore all preferences to their defaults?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: onReset },
        ])}
        style={[styles.resetBtn, { borderColor: t.danger }]}
        accessibilityRole="button"
      >
        <Text style={{ color: t.danger, fontSize: 12, fontWeight: '800' }}>Reset all settings to defaults</Text>
      </TouchableOpacity>
    </GlassPanel>
  </ScrollView>
);

const NavRow: React.FC<{ t: Palette; title: string; subtitle: string; onPress: () => void; danger?: boolean }> = ({ t, title, subtitle, onPress, danger }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.navRow} accessibilityRole="button">
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowTitle, { color: danger ? t.danger : t.text }]}>{title}</Text>
      <Text style={[styles.rowSub, { color: t.textMuted }]}>{subtitle}</Text>
    </View>
    <Text style={{ color: t.textMuted, fontSize: 15 }}>›</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 120 },
  header: { marginBottom: 16 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  pageTitle: { fontSize: 30, ...typography.pageTitle },
  groupTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6, marginBottom: 12 },
  hint: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  subLabel: { fontSize: 11, fontWeight: '700', marginTop: 6, marginBottom: 8 },
  chipGroup: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  extChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1 },
  separator: { height: 1, marginVertical: 8 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  rowSub: { fontSize: 10.5, marginTop: 3 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aboutTitle: { fontSize: 14, fontWeight: '800' },
  aboutSub: { fontSize: 10.5, marginTop: 3 },
  resetBtn: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
});
