/**
 * DetailsScreen — media preview, real format selection and live download progress.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Palette, radius, typography } from '../theme';
import { GlassPanel, GlassButton, Badge, ProgressBar, GlassSpinner, EmptyState } from '../components/GlassUI';
import { GlassThumbnail } from '../components/GlassThumbnail';
import { QualitySheet, dedupeFormats } from '../components/QualitySheet';
import { MediaMetadata, FormatItem, ProgressPayload } from '../bridge';
import { formatBytes, formatDuration, qualityLabelSafe } from './detailsHelpers';

interface Props {
  t: Palette;
  analyzing: boolean;
  media: MediaMetadata | null;
  error?: string;
  onRetry: () => void;
  onBack: () => void;
  downloading: boolean;
  activeDownloadId?: string;
  progress: ProgressPayload | null;
  selectedFormat: string;
  onSelectFormat: (id: string) => void;
  onDownload: (formatId: string) => void;
  onCancel: () => void;
}

export const DetailsScreen: React.FC<Props> = ({
  t, analyzing, media, error, onRetry, onBack, downloading, progress,
  selectedFormat, onSelectFormat, onDownload, onCancel,
}) => {
  const [sheetVisible, setSheetVisible] = useState(false);
  const formats = useMemo(() => media?.formats ?? [], [media]);
  const unique = useMemo(() => dedupeFormats(formats), [formats]);
  const sel: FormatItem | undefined = useMemo(
    () => unique.find(f => f.format_id === selectedFormat),
    [unique, selectedFormat],
  );

  // If the default preset no longer exists after a new analysis, fall back to best available.
  const effectiveSelection = sel ?? unique[0];

  const pct = progress?.percent ?? 0;
  const merging = progress?.status === 'merging';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={[styles.backBtn, { borderColor: t.glassBorder, backgroundColor: t.glassBg }]} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={{ color: t.text, fontSize: 16 }}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: t.textSecondary }]}>Media details</Text>
          {downloading ? <Badge t={t} label="SAVING" tone="accent" /> : <View style={{ width: 38 }} />}
        </View>

        {analyzing && (
          <GlassPanel t={t}>
            <GlassSpinner t={t} label="Analyzing link · fetching metadata…" />
            <Text style={[styles.analyzingNote, { color: t.textMuted }]}>
              Reading real format data from the source. This does not download any media yet.
            </Text>
          </GlassPanel>
        )}

        {!analyzing && error && !media && (
          <GlassPanel t={t}>
            <EmptyState
              t={t}
              glyph="!"
              title="Couldn't analyze this link"
              body={error}
              action={<GlassButton t={t} title="Try again" variant="glass" onPress={onRetry} />}
            />
          </GlassPanel>
        )}

        {!analyzing && media && (
          <>
            <GlassPanel t={t}>
              <GlassThumbnail t={t} uri={media.thumbnail} title={media.title} />
              <View style={styles.metaRow}>
                <Badge t={t} label={(media.extractor || 'MEDIA').toUpperCase()} tone="accent" />
                {!!media.duration && <Badge t={t} label={formatDuration(media.duration)} tone="muted" />}
                <Badge t={t} label={`${unique.length} FORMATS`} tone="muted" />
              </View>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>{media.title || 'Untitled media'}</Text>
              {!!media.uploader && <Text style={[styles.uploader, { color: t.textMuted }]}>by {media.uploader}</Text>}
            </GlassPanel>

            {/* Quality card */}
            <GlassPanel t={t}>
              <View style={styles.panelHead}>
                <Text style={[styles.fieldLabel, { color: t.textMuted }]}>QUALITY &amp; FORMAT</Text>
                <Text style={[styles.stepLabel, { color: t.textMuted }]}>02 / SELECT</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSheetVisible(true)}
                activeOpacity={0.75}
                style={[styles.selectorBox, { borderColor: t.accentSoftBorder, backgroundColor: t.accentSoftBg }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectorValue, { color: t.accent }]}>
                    {effectiveSelection
                      ? effectiveSelection.has_video
                        ? `${effectiveSelection.height ? `${effectiveSelection.height}p` : effectiveSelection.resolution} · ${effectiveSelection.ext.toUpperCase()}`
                        : `Audio only · ${effectiveSelection.ext.toUpperCase()}`
                      : 'Best available'}
                  </Text>
                  <Text style={[styles.selectorSub, { color: t.textMuted }]}>
                    {effectiveSelection
                      ? `#${effectiveSelection.format_id}${effectiveSelection.filesize ? ` · ~${formatBytes(effectiveSelection.filesize)}` : ''} · tap to change`
                      : 'No exact formats returned — will use best available'}
                  </Text>
                </View>
                <Text style={{ color: t.accent, fontSize: 14 }}>⌄</Text>
              </TouchableOpacity>

              {unique.length > 0 && (
                <View style={styles.quickRow}>
                  {unique.filter(f => f.has_video).slice(0, 6).map(f => (
                    <Badge key={f.format_id} t={t} label={f.height ? `${f.height}p` : f.resolution} tone={effectiveSelection?.format_id === f.format_id ? 'accent' : 'muted'} />
                  ))}
                </View>
              )}

              <View style={[styles.explainBox, { borderColor: t.hairline }]}>
                <Text style={[styles.explainText, { color: t.textMuted }]}>
                  The downloader receives the exact format ID you pick. Adaptive video-only streams are merged with the best audio track using FFmpeg. If your choice becomes unavailable at download time, the engine reports the fallback it used.
                </Text>
              </View>
            </GlassPanel>

            {/* Download section */}
            <GlassPanel t={t}>
              <View style={styles.panelHead}>
                <Text style={[styles.fieldLabel, { color: t.textMuted }]}>SAVE TO DEVICE</Text>
                <Text style={[styles.stepLabel, { color: t.textMuted }]}>03 / DOWNLOAD</Text>
              </View>

              {downloading && (
                <View style={styles.progressBlock}>
                  <View style={styles.progressTop}>
                    <Text style={[styles.progressLabel, { color: t.textSecondary }]}>
                      {merging ? 'MERGING VIDEO + AUDIO…' : progress?.status === 'finished' ? 'VERIFYING FILE…' : 'DOWNLOADING'}
                    </Text>
                    <Text style={[styles.progressPct, { color: t.accent }]}>{Math.round(pct)}%</Text>
                  </View>
                  <ProgressBar t={t} percent={pct} height={7} />
                  <View style={styles.progressStats}>
                    <Text style={[styles.stat, { color: t.textMuted }]}>
                      {progress?.total ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}` : formatBytes(progress?.downloaded)}
                    </Text>
                    <Text style={[styles.stat, { color: t.textMuted }]}>
                      {progress?.speed ? `${(progress.speed / 1024 / 1024).toFixed(2)} MB/s` : ''}
                    </Text>
                    <Text style={[styles.stat, { color: t.textMuted }]}>
                      {progress?.eta ? `ETA ${Math.ceil(progress.eta)}s` : ''}
                    </Text>
                  </View>
                </View>
              )}

              <GlassButton
                t={t}
                title={downloading ? 'Saving…' : 'Download to device'}
                icon={downloading ? undefined : '↓'}
                busy={downloading}
                disabled={downloading || analyzing || unique.length === 0}
                onPress={() => effectiveSelection ? onDownload(effectiveSelection.format_id) : onDownload('best')}
              />
              {downloading && (
                <GlassButton t={t} title="Cancel download" variant="danger" size="sm" style={{ marginTop: 10 }} onPress={() => {
                  Alert.alert('Cancel download?', 'The partial file will be discarded.', [
                    { text: 'Keep downloading', style: 'cancel' },
                    { text: 'Cancel', style: 'destructive', onPress: onCancel },
                  ]);
                }} />
              )}
              {unique.length === 0 && !downloading && (
                <Text style={[styles.noFormats, { color: t.warning }]}>No downloadable formats were found for this link.</Text>
              )}
            </GlassPanel>
          </>
        )}
      </ScrollView>

      <QualitySheet
        visible={sheetVisible}
        t={t}
        formats={formats}
        selected={selectedFormat}
        onSelect={onSelectFormat}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: 4 },
  backBtn: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 13, fontWeight: '700', ...typography.body },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fieldLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6 },
  stepLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 10 },
  uploader: { fontSize: 11.5, marginTop: 5 },
  selectorBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, borderWidth: 1 },
  selectorValue: { fontSize: 15, fontWeight: '800' },
  selectorSub: { fontSize: 10.5, marginTop: 4 },
  quickRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  explainBox: { borderTopWidth: 1, paddingTop: 10, marginTop: 12 },
  explainText: { fontSize: 10.5, lineHeight: 15 },
  analyzingNote: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  progressBlock: { marginBottom: 14 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  progressPct: { fontSize: 13, fontWeight: '800' },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stat: { fontSize: 10.5, fontWeight: '600' },
  noFormats: { fontSize: 11.5, marginTop: 10, textAlign: 'center' },
});

// keep tree-shaking honest — re-export helper used by parent for toast copy
export { qualityLabelSafe };
