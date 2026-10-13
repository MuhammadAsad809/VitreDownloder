/**
 * PlayerScreen — Android-compatible local playback.
 *
 * A JS video-player dependency (react-native-video) is not installed in this
 * project and cannot be added without a native rebuild here, so we hand off to
 * the device's stock video/audio player via a FileProvider content URI
 * (PythonBridgeModule.openFile). This plays the actual downloaded file with
 * full system controls (seek, volume, fullscreen, PiP where supported) and
 * handles missing files / unsupported formats with clear errors.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Palette, radius, typography } from '../theme';
import { GlassThumbnail } from './GlassThumbnail';
import { getFileSize, openFile } from '../bridge';
import { formatBytes } from '../history';

interface Props {
  t: Palette;
  filePath: string;
  title?: string;
  thumbnail?: string;
  isAudio?: boolean;
  onBack: () => void;
}

type Phase = 'checking' | 'ready' | 'missing';

export const PlayerScreen: React.FC<Props> = ({ t, filePath, title, thumbnail, isAudio, onBack }) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [size, setSize] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getFileSize(filePath);
      if (!alive) return;
      setSize(s);
      setPhase(s > 0 ? 'ready' : 'missing');
    })();
    return () => { alive = false; };
  }, [filePath]);

  const launch = async () => {
    setError(undefined);
    try {
      await openFile(filePath, isAudio ? 'audio/*' : 'video/*');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...t.gradient].reverse()} style={StyleSheet.absoluteFillObject} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Close player" style={[styles.backBtn, { borderColor: t.glassBorder, backgroundColor: t.glassBg }]}>
          <Text style={{ color: t.text, fontSize: 16 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: t.textSecondary }]} numberOfLines={1}>{title || 'Player'}</Text>
      </View>

      <View style={styles.stage}>
        {phase === 'checking' && <ActivityIndicator color={t.accent} size="large" />}

        {phase === 'missing' && (
          <View style={styles.centerBlock}>
            <Text style={{ color: t.danger, fontSize: 30 }}>⚠</Text>
            <Text style={[styles.missingTitle, { color: t.text }]}>File not found</Text>
            <Text style={[styles.missingBody, { color: t.textMuted }]}>
              This download is no longer at its saved location. It may have been deleted or moved outside Vitre. Re-download it from the Downloads screen.
            </Text>
          </View>
        )}

        {phase === 'ready' && (
          <>
            {!isAudio && (
              <GlassThumbnail t={t} uri={thumbnail} title={title} rounded={radius.xl} style={styles.preview} />
            )}
            {isAudio && (
              <View style={[styles.audioMark, { borderColor: t.accentSoftBorder, backgroundColor: t.accentSoftBg }]}>
                <Text style={{ fontSize: 40, color: t.accent }}>♫</Text>
              </View>
            )}
            <Text style={[styles.fileMeta, { color: t.textSecondary }]} numberOfLines={2}>{title}</Text>
            <Text style={[styles.fileSize, { color: t.textMuted }]}>{formatBytes(size)} · {isAudio ? 'AUDIO' : 'VIDEO'} · LOCAL FILE</Text>

            <TouchableOpacity onPress={launch} activeOpacity={0.8} accessibilityRole="button">
              <LinearGradient colors={['#B8FFD4', '#6FE3A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playBtn}>
                <Text style={{ fontSize: 26, color: '#082015' }}>▶</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={[styles.launchNote, { color: t.textMuted }]}>
              Opens in your device’s player with seek, volume, speed and full-screen controls.
            </Text>
            {!!error && <Text style={[styles.err, { color: t.danger }]}>{error}</Text>}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 10, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 13, fontWeight: '700', ...typography.body },
  stage: { flex: 1, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  preview: { width: '100%', marginBottom: 6 },
  audioMark: { width: 110, height: 110, borderRadius: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  fileMeta: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  fileSize: { fontSize: 11 },
  playBtn: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  launchNote: { fontSize: 10.5, textAlign: 'center', maxWidth: 260, lineHeight: 15 },
  err: { fontSize: 11, textAlign: 'center' },
  centerBlock: { alignItems: 'center', paddingHorizontal: 30, gap: 10 },
  missingTitle: { fontSize: 17, fontWeight: '800' },
  missingBody: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
