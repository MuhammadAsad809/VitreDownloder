/**
 * GlassThumbnail — robust media thumbnail with loading, error and branded fallback.
 *
 * Instagram thumbnails (cdninstagram.com) can 403 without a browser-like Referer,
 * expire after a few hours, or be missing entirely from parth_dl metadata.
 * This component:
 *  - validates the URI before requesting it (http/https only),
 *  - uses Android hardware acceleration + resize modes for low-end devices,
 *  - shows a shimmering loading state, then a branded placeholder on failure,
 *  - never retries in a loop (single attempt per uri; resets when uri changes).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { Palette, radius } from '../theme';

interface Props {
  t: Palette;
  uri?: string;
  /** Optional secondary candidate tried after the primary fails (e.g. yt-dlp thumbnail_url). */
  fallbackUri?: string;
  style?: StyleProp<ViewStyle>;
  title?: string;
  glyph?: string;
  rounded?: number;
}

type Phase = 'idle' | 'loading' | 'ok' | 'failed';

function isUsableUrl(uri?: string): boolean {
  if (!uri) return false;
  const trimmed = uri.trim();
  if (!(trimmed.startsWith('http://') || trimmed.startsWith('https://'))) return false;
  // Reject obviously truncated / malformed URLs
  if (trimmed.length < 12) return false;
  return true;
}

export const GlassThumbnail: React.FC<Props> = ({ t, uri, fallbackUri, style, title, glyph = '▶', rounded = radius.lg }) => {
  const candidates = useMemo(() => [uri, fallbackUri].filter(isUsableUrl) as string[], [uri, fallbackUri]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');

  // Reset whenever the source list changes (new analysis → no stale failures).
  useEffect(() => {
    setCandidateIndex(0);
    setPhase(candidates.length ? 'loading' : 'failed');
  }, [candidates]);

  const activeUri = candidates[candidateIndex];

  useEffect(() => {
    if (activeUri && phase === 'idle') setPhase('loading');
  }, [activeUri, phase]);

  return (
    <View style={[styles.frame, { backgroundColor: t.placeholderBg, borderRadius: rounded, borderColor: t.hairline }, style]}>
      {activeUri && phase !== 'failed' ? (
        <Image
          key={activeUri}
          source={{ uri: activeUri, cache: 'reload' }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          resizeMethod="resize"
          loadingEnabled
          renderToHardwareTextureAndroid
          accessibilityLabel={title ? `Thumbnail for ${title}` : 'Media thumbnail'}
          onLoadStart={() => setPhase('loading')}
          onLoad={() => setPhase('ok')}
          onError={(e) => {
            // Log host only — never the full signed/expiring URL (may contain tokens).
            try {
              const host = activeUri ? activeUri.split('/')[2] : 'unknown';
              console.warn(`[Vitre] thumbnail load failed from ${host}, event: ${JSON.stringify(e?.nativeEvent ?? {}).slice(0, 160)}`);
            } catch { /* noop */ }
            if (candidateIndex + 1 < candidates.length) {
              setCandidateIndex(candidateIndex + 1); // try next real candidate once, not in a loop
              setPhase('loading');
            } else {
              setPhase('failed');
            }
          }}
        />
      ) : null}

      {phase === 'loading' && !!activeUri && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={t.accent} size="small" />
        </View>
      )}

      {phase === 'failed' && (
        <View style={styles.fallback}>
          <View style={[styles.fallbackMark, { backgroundColor: t.accentSoftBg, borderColor: t.accentSoftBorder }]}>
            <Text style={{ fontSize: 22, color: t.accent }}>{glyph}</Text>
          </View>
          <Text style={[styles.fallbackTitle, { color: t.textSecondary }]} numberOfLines={1}>
            {title ? title.slice(0, 40) : 'VITRE MEDIA'}
          </Text>
          <Text style={[styles.fallbackSub, { color: t.textMuted }]}>PREVIEW UNAVAILABLE</Text>
        </View>
      )}

      {/* subtle glass sheen on top of everything */}
      <View style={styles.sheen} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', borderWidth: 1 },
  loadingOverlay: { position: 'absolute', alignSelf: 'center', top: '44%' },
  fallback: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  fallbackMark: { width: 52, height: 52, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackTitle: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  fallbackSub: { fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 26, backgroundColor: 'rgba(255,255,255,0.045)' },
});
