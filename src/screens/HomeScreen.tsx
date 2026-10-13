/**
 * HomeScreen — premium URL input, platform detection, analyze action, recent downloads.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Clipboard, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Palette, radius, typography } from '../theme';
import { GlassPanel, GlassButton, Badge, GlassChip } from '../components/GlassUI';
import { GlassThumbnail } from '../components/GlassThumbnail';
import { HistoryEntry, formatBytes, formatDate } from '../history';

interface Props {
  t: Palette;
  onAnalyze: (url: string) => void;
  analyzing: boolean;
  lastError?: string;
  history: HistoryEntry[];
  onOpenEntry: (entry: HistoryEntry) => void;
  onGoDownloads: () => void;
}

export function detectPlatform(url: string): { name: string; glyph: string; ok: boolean } | null {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return { name: 'YouTube', glyph: '▶', ok: true };
  if (/instagram\.com|instagr\.am/.test(u)) return { name: 'Instagram', glyph: '◉', ok: true };
  if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(u)) return { name: 'TikTok', glyph: '♪', ok: true };
  if (/^https?:\/\//.test(u.trim())) return { name: 'Other link', glyph: '🔗', ok: true };
  return null;
}

export const HomeScreen: React.FC<Props> = ({ t, onAnalyze, analyzing, lastError, history, onOpenEntry, onGoDownloads }) => {
  const [url, setUrl] = useState('');
  const platform = useMemo(() => detectPlatform(url), [url]);
  const recent = useMemo(() => history.filter(h => h.status === 'completed').slice(0, 3), [history]);

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.trim()) setUrl(text.trim());
      else Alert.alert('Clipboard is empty', 'Copy a media link first, then paste it here.');
    } catch {
      Alert.alert('Clipboard unavailable', 'Paste the media URL into the field manually.');
    }
  };

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) { Alert.alert('Link required', 'Paste a YouTube, Instagram, or TikTok URL first.'); return; }
    if (!/^https?:\/\/\S+\.\S+/i.test(trimmed)) { Alert.alert('Invalid link', 'That does not look like a valid URL. Include http(s):// and try again.'); return; }
    onAnalyze(trimmed);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Brand header */}
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <LinearGradient colors={['#B8FFD4', '#6FE3A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandMark}>
            <Text style={styles.brandMarkText}>V</Text>
          </LinearGradient>
          <Text style={[styles.logo, { color: t.text }]}>vitre</Text>
          <Badge t={t} label="MEDIA" tone="accent" />
        </View>
        <Text style={[styles.eyebrow, { color: t.accentStrong }]}>YOUR MEDIA · YOUR DEVICE</Text>
        <Text style={[styles.heroTitle, { color: t.text }]}>Save what{'\n'}moves you.</Text>
        <Text style={[styles.heroSub, { color: t.textSecondary }]}>A private, on-device downloader with real quality selection.</Text>
      </View>

      {/* URL input panel */}
      <GlassPanel t={t}>
        <View style={styles.panelHead}>
          <Text style={[styles.fieldLabel, { color: t.textMuted }]}>MEDIA URL</Text>
          <Text style={[styles.stepLabel, { color: t.textMuted }]}>01 / LINK</Text>
        </View>
        <View style={[styles.inputWrap, { borderColor: t.glassBorder, backgroundColor: t.isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)' }]}>
          <TextInput
            style={[styles.input, { color: t.text }]}
            placeholder="Paste a video link here…"
            placeholderTextColor={t.textMuted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectionColor={t.accent}
            onSubmitEditing={submit}
            returnKeyType="go"
            accessibilityLabel="Media URL input"
          />
          {url.length > 0 && (
            <TouchableOpacity onPress={() => setUrl('')} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Clear URL">
              <Text style={{ color: t.textSecondary, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handlePaste} style={[styles.pasteBtn, { backgroundColor: t.accentSoftBg }]} accessibilityRole="button">
            <Text style={{ color: t.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>PASTE</Text>
          </TouchableOpacity>
        </View>

        {!!platform && (
          <View style={styles.detectRow}>
            <Badge t={t} label={`${platform.glyph} ${platform.name.toUpperCase()}`} tone={platform.ok ? 'accent' : 'warning'} />
            <Text style={[styles.detectHint, { color: t.textMuted }]}>Ready to analyze</Text>
          </View>
        )}
        {!platform && url.trim().length > 0 && (
          <View style={styles.detectRow}>
            <Badge t={t} label="CHECK LINK" tone="warning" />
            <Text style={[styles.detectHint, { color: t.textMuted }]}>Make sure the URL starts with https://</Text>
          </View>
        )}

        <GlassButton t={t} title={analyzing ? 'Analyzing…' : 'Analyze Video'} onPress={submit} busy={analyzing} disabled={analyzing} icon={analyzing ? undefined : '↗'} />

        {!!lastError && (
          <View style={[styles.errorBox, { backgroundColor: t.dangerBg, borderColor: 'rgba(255,120,120,0.3)' }]}>
            <Text style={[styles.errorText, { color: t.danger }]}>{lastError}</Text>
          </View>
        )}

        <View style={styles.platformsRow}>
          {([['▶', 'YouTube'], ['◉', 'Instagram'], ['♪', 'TikTok']] as const).map(([g, n]) => (
            <GlassChip key={n} t={t} label={`${g} ${n}`} />
          ))}
        </View>
      </GlassPanel>

      {/* Recent downloads */}
      <GlassPanel t={t} intensity="light">
        <View style={styles.panelHead}>
          <Text style={[styles.fieldLabel, { color: t.textMuted }]}>RECENT DOWNLOADS</Text>
          <TouchableOpacity onPress={onGoDownloads} accessibilityRole="button">
            <Text style={{ color: t.accent, fontSize: 11, fontWeight: '800' }}>See all ›</Text>
          </TouchableOpacity>
        </View>
        {recent.length === 0 ? (
          <View style={styles.emptyMini}>
            <Text style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Nothing downloaded yet.{'\n'}Your saved files will appear here.
            </Text>
          </View>
        ) : recent.map(item => (
          <TouchableOpacity key={item.id} style={styles.recentRow} onPress={() => onOpenEntry(item)} activeOpacity={0.75} accessibilityRole="button">
            <GlassThumbnail t={t} uri={item.thumbnail} title={item.title} rounded={radius.md} style={styles.recentThumb} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recentTitle, { color: t.text }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.recentMeta, { color: t.textMuted }]}>
                {[item.actualHeight ? `${item.actualHeight}p` : null, item.actualExt?.toUpperCase(), formatBytes(item.fileSize), formatDate(item.createdAt)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={{ color: t.accent, fontSize: 16 }}>›</Text>
          </TouchableOpacity>
        ))}
      </GlassPanel>

      <View style={[styles.tipCard, { borderColor: t.accentSoftBorder, backgroundColor: t.accentSoftBg }]}>
        <Text style={{ color: t.accent, fontSize: 18 }}>✳</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tipTitle, { color: t.text }]}>On-device privacy</Text>
          <Text style={[styles.tipBody, { color: t.textMuted }]}>Analysis and downloads run through the local Python engine. No accounts, no cookies, public media only.</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 120 },
  hero: { paddingTop: 10, paddingBottom: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#082015', fontSize: 21, fontWeight: '900' },
  logo: { fontSize: 24, ...typography.heroTitle, fontSize: 24, letterSpacing: -0.8 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  heroTitle: { fontSize: 36, lineHeight: 40, ...typography.heroTitle },
  heroSub: { fontSize: 13, lineHeight: 19, marginTop: 10, maxWidth: 300 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fieldLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6 },
  stepLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  inputWrap: { height: 54, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6 },
  input: { flex: 1, fontSize: 13.5 },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  pasteBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11 },
  detectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  detectHint: { fontSize: 11 },
  errorBox: { marginTop: 12, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  errorText: { fontSize: 11.5, lineHeight: 16 },
  platformsRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  emptyMini: { paddingVertical: 18 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  recentThumb: { width: 74, aspectRatio: 16 / 9, flexBasis: 74, flexGrow: 0 },
  recentTitle: { fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  recentMeta: { fontSize: 10.5, marginTop: 4 },
  tipCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, marginTop: 4 },
  tipTitle: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  tipBody: { fontSize: 11, lineHeight: 16 },
});
