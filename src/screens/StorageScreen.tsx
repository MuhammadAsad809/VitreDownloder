/**
 * StorageScreen — real filesystem stats for the Vitre downloads folder.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, NativeModules } from 'react-native';
import { Palette, radius, typography } from '../theme';
import { GlassPanel, Badge, EmptyState, GlassButton } from '../components/GlassUI';
import { formatBytes } from '../history';

const { PythonBridgeModule } = NativeModules;

interface FileStat { name: string; path: string; size: number; ext: string; modified: number; }

interface Props { t: Palette; onBack: () => void; }

export const StorageScreen: React.FC<Props> = ({ t, onBack }) => {
  const [files, setFiles] = useState<FileStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      if (!PythonBridgeModule) throw new Error('Downloader module unavailable.');
      const raw = await PythonBridgeModule.listDownloadFolder();
      const res = JSON.parse(raw);
      if (!res.success) throw new Error(res.error || 'Could not read the downloads folder.');
      setFiles((res.files || []) as FileStat[]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  const videos = files.filter(f => ['mp4', 'webm', 'mkv', 'mov'].includes(f.ext));
  const audios = files.filter(f => ['m4a', 'mp3', 'opus', 'aac', 'wav'].includes(f.ext));
  const images = files.filter(f => ['jpg', 'jpeg', 'png', 'webp'].includes(f.ext));
  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 10);

  const deleteFile = (f: FileStat) => {
    Alert.alert('Delete file?', `"${f.name}" (${formatBytes(f.size)}) will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const raw = await PythonBridgeModule.deleteFile(f.path);
          const res = JSON.parse(raw);
          if (!res.success) Alert.alert('Delete failed', res.error || 'The file could not be removed.');
          else void refresh();
        } catch (e: any) { Alert.alert('Delete failed', e?.message || String(e)); }
      } },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { borderColor: t.glassBorder, backgroundColor: t.glassBg }]}>
          <Text style={{ color: t.text, fontSize: 16 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: t.text }]}>Storage</Text>
        <GlassButton t={t} size="sm" variant="glass" title="Refresh" onPress={() => void refresh()} style={{ marginLeft: 'auto' }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassPanel t={t}>
          <Text style={[styles.bigNumber, { color: t.accent }]}>{formatBytes(totalSize)}</Text>
          <Text style={[styles.bigLabel, { color: t.textMuted }]}>USED BY VITRE · DOWNLOADS/VITRE</Text>
          <View style={styles.statRow}>
            <Stat t={t} value={String(files.length)} label="FILES" />
            <Stat t={t} value={String(videos.length)} label="VIDEO" />
            <Stat t={t} value={String(audios.length)} label="AUDIO" />
            <Stat t={t} value={String(images.length)} label="THUMBS" />
          </View>
        </GlassPanel>

        {!!error && (
          <GlassPanel t={t}>
            <Badge t={t} label="STORAGE ERROR" tone="danger" />
            <Text style={[styles.errText, { color: t.danger }]}>{error}</Text>
          </GlassPanel>
        )}

        {!loading && !error && files.length === 0 && (
          <EmptyState t={t} glyph="▤" title="No files yet" body="Downloads you save will appear here with their real on-disk sizes." />
        )}

        <GlassPanel t={t} padded={false}>
          <View style={styles.listHead}>
            <Text style={[styles.groupTitle, { color: t.textMuted }]}>LARGEST DOWNLOADS</Text>
          </View>
          {largest.map(f => (
            <View key={f.path} style={[styles.fileRow, { borderTopColor: t.hairline }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: t.text }]} numberOfLines={1}>{f.name}</Text>
                <Text style={[styles.fileMeta, { color: t.textMuted }]}>
                  {formatBytes(f.size)} · {f.ext.toUpperCase()} · {new Date(f.modified * 1000).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteFile(f)} accessibilityRole="button" style={[styles.delBtn, { borderColor: 'rgba(255,120,120,0.3)' }]}>
                <Text style={{ color: t.danger, fontSize: 11, fontWeight: '800' }}>DELETE</Text>
              </TouchableOpacity>
            </View>
          ))}
          {loading && <Text style={[styles.fileMeta, { color: t.textMuted, padding: 14 }]}>Reading folder…</Text>}
        </GlassPanel>

        <Text style={[styles.disclaimer, { color: t.textMuted }]}>
          Statistics come from the actual filesystem each time this screen opens. Deleting here removes media files permanently — history records are handled separately in Downloads.
        </Text>
      </ScrollView>
    </View>
  );
};

const Stat: React.FC<{ t: Palette; value: string; label: string }> = ({ t, value, label }) => (
  <View style={styles.stat}>
    <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{value}</Text>
    <Text style={{ color: t.textMuted, fontSize: 8.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 3 }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 22, ...typography.pageTitle, fontSize: 24 },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  bigNumber: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  bigLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6, marginTop: 6 },
  statRow: { flexDirection: 'row', marginTop: 16, gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  errText: { fontSize: 11.5, marginTop: 10, lineHeight: 16 },
  listHead: { paddingHorizontal: 14, paddingTop: 14 },
  groupTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, marginTop: 6 },
  fileName: { fontSize: 12.5, fontWeight: '700' },
  fileMeta: { fontSize: 10.5, marginTop: 3 },
  delBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1 },
  disclaimer: { fontSize: 10.5, lineHeight: 15, marginTop: 12, paddingHorizontal: 4 },
});
