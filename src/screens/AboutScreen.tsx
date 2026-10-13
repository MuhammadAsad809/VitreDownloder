/**
 * AboutScreen — branding, version, platforms, licenses, privacy & troubleshooting.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Palette, radius, typography } from '../theme';
import { GlassPanel, Badge } from '../components/GlassUI';

interface Props { t: Palette; onBack: () => void; }

const REPO_URL = 'https://github.com/MuhammadAsad809/VitreDownloder';

export const AboutScreen: React.FC<Props> = ({ t, onBack }) => (
  <View style={styles.root}>
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, { borderColor: t.glassBorder, backgroundColor: t.glassBg }]}>
        <Text style={{ color: t.text, fontSize: 16 }}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.pageTitle, { color: t.text }]}>About</Text>
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <GlassPanel t={t}>
        <View style={styles.brandRow}>
          <View style={[styles.mark, { backgroundColor: t.accent }]}><Text style={{ color: t.accentInk, fontSize: 20, fontWeight: '900' }}>V</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.appName, { color: t.text }]}>Vitre Downloader</Text>
            <Text style={[styles.appSub, { color: t.textMuted }]}>Version 1.0.0 · build 1</Text>
          </View>
          <Badge t={t} label="PREMIUM" tone="accent" />
        </View>
        <Text style={[styles.body, { color: t.textSecondary }]}>
          A private, on-device media downloader with a Liquid Glass interface. Analysis and downloads run locally through an embedded Python engine.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(REPO_URL).catch(() => Alert.alert('Cannot open link', 'No browser available on this device.'))} accessibilityRole="link">
          <Text style={[styles.link, { color: t.accent }]}>github.com/MuhammadAsad809/VitreDownloder ↗</Text>
        </TouchableOpacity>
      </GlassPanel>

      <GlassPanel t={t}>
        <Text style={[styles.groupTitle, { color: t.textMuted }]}>SUPPORTED PLATFORMS</Text>
        {[
          ['▶ YouTube', 'Public videos up to the highest resolution the source provides, including merged adaptive streams.'],
          ['◉ Instagram', 'Public reels, posts and stories metadata. Private or restricted content is not supported.'],
          ['♪ TikTok', 'Public videos via the watermark-free source where available.'],
        ].map(([title, sub]) => (
          <View key={title} style={styles.capRow}>
            <Text style={[styles.capTitle, { color: t.text }]}>{title}</Text>
            <Text style={[styles.capSub, { color: t.textMuted }]}>{sub}</Text>
          </View>
        ))}
      </GlassPanel>

      <GlassPanel t={t}>
        <Text style={[styles.groupTitle, { color: t.textMuted }]}>OPEN SOURCE &amp; CREDITS</Text>
        <Text style={[styles.body, { color: t.textSecondary }]}>
          Vitre bundles and thanks: React Native (Meta), Chaquopy (Chaquopy Ltd), yt-dlp and its contributors, parth-dl for Instagram extraction, FFmpeg merging support via system codecs, and the community RN modules listed in package.json. Each library remains under its original license.
        </Text>
      </GlassPanel>

      <GlassPanel t={t}>
        <Text style={[styles.groupTitle, { color: t.textMuted }]}>PRIVACY</Text>
        <Text style={[styles.body, { color: t.textSecondary }]}>
          • All data stays on this device: settings and download history are stored in local app storage; media files are saved to Downloads/Vitre.{'\n'}
          • No accounts, no cookies, no analytics SDKs are included.{'\n'}
          • The app contacts only the public platform servers for the links you choose to analyze.{'\n'}
          • Thumbnails and signed media URLs can contain expiring tokens — they are never written to logs.
        </Text>
      </GlassPanel>

      <GlassPanel t={t}>
        <Text style={[styles.groupTitle, { color: t.textMuted }]}>TROUBLESHOOTING</Text>
        <Text style={[styles.body, { color: t.textSecondary }]}>
          • “Sign in to confirm you’re not a bot”: YouTube rate-limited your network/IP. Retry later or from a different connection.{'\n'}
          • Missing high resolutions: the source simply may not offer them, or DRM-restricted formats are unavailable.{'\n'}
          • Blank preview after hours: Instagram thumbnail URLs expire — re-analyze the link.{'\n'}
          • Failed merge: ensure enough free storage; partial files are cleaned automatically.{'\n'}
          • Report issues (without cookies or private URLs) through the GitHub repository above.
        </Text>
      </GlassPanel>

      <Text style={[styles.legal, { color: t.textMuted }]}>
        Only download content you own or have permission to save. Respect each platform’s Terms of Service and local copyright law.
      </Text>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 24, ...typography.pageTitle, fontSize: 24 },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  mark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: '800' },
  appSub: { fontSize: 10.5, marginTop: 3 },
  body: { fontSize: 12, lineHeight: 18 },
  link: { fontSize: 12, fontWeight: '700', marginTop: 12 },
  groupTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6, marginBottom: 12 },
  capRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  capTitle: { fontSize: 12.5, fontWeight: '700' },
  capSub: { fontSize: 10.5, marginTop: 4, lineHeight: 15 },
  legal: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 16, paddingHorizontal: 10 },
});
