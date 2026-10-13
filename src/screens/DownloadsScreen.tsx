/**
 * DownloadsScreen — active downloads, completed/failed/cancelled history,
 * search, filters, sorting and real file actions (play/open/share/delete).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Palette, radius, typography } from '../theme';
import { GlassPanel, GlassButton, Badge, ProgressBar, EmptyState, GlassChip } from '../components/GlassUI';
import { GlassThumbnail } from '../components/GlassThumbnail';
import { HistoryEntry, DownloadStatus, formatBytes, formatDate } from '../history';
import { ProgressPayload } from '../bridge';

interface Props {
  t: Palette;
  history: HistoryEntry[];
  /** entries currently downloading with live progress keyed by entry id */
  liveProgress: Record<string, ProgressPayload>;
  onRetry: (entry: HistoryEntry) => void;
  onPlayOrOpen: (entry: HistoryEntry) => void;
  onShare: (entry: HistoryEntry) => void;
  onShowInFolder: (entry: HistoryEntry) => void;
  onDeleteFile: (entry: HistoryEntry) => void;
  onRemoveFromHistory: (entry: HistoryEntry) => void;
  onCancelActive: (entry: HistoryEntry) => void;
}

type Filter = 'all' | 'downloading' | 'completed' | 'failed';
type SortKey = 'date' | 'name' | 'size' | 'status';

const STATUS_TONE: Record<DownloadStatus, 'accent' | 'danger' | 'warning' | 'muted'> = {
  downloading: 'accent', completed: 'muted', failed: 'danger', cancelled: 'warning',
};

export const DownloadsScreen: React.FC<Props> = ({
  t, history, liveProgress, onRetry, onPlayOrOpen, onShare, onShowInFolder, onDeleteFile, onRemoveFromHistory, onCancelActive,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...history];
    if (filter !== 'all') list = list.filter(h => h.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(h => (h.title || '').toLowerCase().includes(q) || (h.url || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name': return (a.title || '').localeCompare(b.title || '');
        case 'size': return (b.fileSize || 0) - (a.fileSize || 0);
        case 'status': return a.status.localeCompare(b.status);
        default: return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return list;
  }, [history, filter, query, sortKey]);

  const counts = useMemo(() => ({
    all: history.length,
    downloading: history.filter(h => h.status === 'downloading').length,
    completed: history.filter(h => h.status === 'completed').length,
    failed: history.filter(h => h.status === 'failed' || h.status === 'cancelled').length,
  }), [history]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: t.accentStrong }]}>YOUR LIBRARY</Text>
          <Text style={[styles.pageTitle, { color: t.text }]}>Downloads</Text>
        </View>

        <TextInput
          style={[styles.search, { color: t.text, borderColor: t.glassBorder, backgroundColor: t.glassBg }]}
          placeholder="Search titles or links…"
          placeholderTextColor={t.textMuted}
          value={query}
          onChangeText={setQuery}
        />

        <View style={styles.filterRow}>
          {(['all', 'downloading', 'completed', 'failed'] as Filter[]).map(f => (
            <GlassChip key={f} t={t} label={`${f[0].toUpperCase()}${f.slice(1)} (${counts[f]})`} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
        <View style={styles.sortRow}>
          <Text style={[styles.sortLabel, { color: t.textMuted }]}>SORT</Text>
          {(['date', 'name', 'size', 'status'] as SortKey[]).map(s => (
            <GlassChip key={s} t={t} label={s.toUpperCase()} active={sortKey === s} onPress={() => setSortKey(s)} />
          ))}
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            t={t}
            glyph="↓"
            title={history.length ? 'No matches' : 'Nothing downloaded yet'}
            body={history.length ? 'Try a different search or filter.' : 'Completed files will appear here with live progress, actions and details.'}
          />
        ) : filtered.map(entry => {
          const live = liveProgress[entry.id];
          const expanded = expandedId === entry.id;
          return (
            <GlassPanel t={t} key={entry.id} padded={false}>
              <TouchableOpacity onPress={() => setExpandedId(expanded ? null : entry.id)} activeOpacity={0.8} style={styles.rowMain}>
                <GlassThumbnail t={t} uri={entry.thumbnail} title={entry.title} rounded={radius.md} style={styles.thumb} glyph={entry.actualExt && ['mp3','m4a','aac','opus','wav'].includes(entry.actualExt) ? '♫' : '▶'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>{entry.title}</Text>
                  <View style={styles.badgeRow}>
                    <Badge t={t} label={entry.status.toUpperCase()} tone={STATUS_TONE[entry.status]} />
                    {!!entry.actualHeight && <Badge t={t} label={`${entry.actualHeight}p`} tone="muted" />}
                    {!!entry.actualExt && <Badge t={t} label={entry.actualExt.toUpperCase()} tone="muted" />}
                  </View>
                  <Text style={[styles.meta, { color: t.textMuted }]}>
                    {[formatBytes(entry.fileSize), formatDate(entry.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                  {entry.status === 'downloading' && (
                    <View style={{ marginTop: 8 }}>
                      <ProgressBar t={t} percent={live?.percent ?? 0} height={5} />
                      <Text style={[styles.meta, { color: t.textMuted, marginTop: 5 }]}>
                        {live ? `${Math.round(live.percent ?? 0)}% · ${live.speed ? `${(live.speed / 1048576).toFixed(1)} MB/s` : 'starting…'}` : 'waiting for engine…'}
                      </Text>
                    </View>
                  )}
                  {entry.status === 'failed' && !!entry.error && (
                    <Text style={[styles.errText, { color: t.danger }]} numberOfLines={2}>{entry.error}</Text>
                  )}
                </View>
                <Text style={{ color: t.textMuted, fontSize: 14 }}>{expanded ? '⌃' : '⌄'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={[styles.actions, { borderTopColor: t.hairline }]}>
                  {entry.status === 'downloading' && (
                    <GlassButton t={t} size="sm" variant="danger" title="Cancel" onPress={() => onCancelActive(entry)} style={styles.actionBtn} />
                  )}
                  {(entry.status === 'failed' || entry.status === 'cancelled') && (
                    <GlassButton t={t} size="sm" variant="glass" title="Retry" icon="↻" onPress={() => onRetry(entry)} style={styles.actionBtn} />
                  )}
                  {entry.status === 'completed' && (
                    <>
                      <GlassButton t={t} size="sm" title={entry.actualExt && ['mp3','m4a','aac','opus','wav'].includes(entry.actualExt) ? 'Open' : 'Play'} icon="▶" onPress={() => onPlayOrOpen(entry)} style={styles.actionBtn} />
                      <GlassButton t={t} size="sm" variant="glass" title="Share" onPress={() => onShare(entry)} style={styles.actionBtn} />
                    </>
                  )}
                  {entry.status === 'completed' && !!entry.filePath && (
                    <>
                      <GlassButton t={t} size="sm" variant="glass" title="Show in folder" onPress={() => onShowInFolder(entry)} style={styles.actionBtn} />
                      <GlassButton t={t} size="sm" variant="danger" title="Delete file" onPress={() => {
                        if (!entry.filePath) { Alert.alert('No file', 'There is no saved file path for this record.'); return; }
                        Alert.alert('Delete file?', `"${entry.title}" will be permanently removed from your device.`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => onDeleteFile(entry) },
                        ]);
                      }} style={styles.actionBtn} />
                    </>
                  )}
                  <GlassButton t={t} size="sm" variant="ghost" title="Remove from history" onPress={() => onRemoveFromHistory(entry)} style={styles.actionBtn} />
                  {!!entry.filePath && <Text style={[styles.path, { color: t.textMuted }]} numberOfLines={2}>{entry.filePath}</Text>}
                </View>
              )}
            </GlassPanel>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 120 },
  header: { marginBottom: 14 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  pageTitle: { fontSize: 30, ...typography.pageTitle },
  search: { height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 13, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  sortRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 },
  sortLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  rowMain: { flexDirection: 'row', gap: 12, padding: 14 },
  thumb: { width: 84, aspectRatio: 16 / 9, flexBasis: 84, flexGrow: 0 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  meta: { fontSize: 10.5, marginTop: 5 },
  errText: { fontSize: 10.5, marginTop: 6, lineHeight: 14 },
  actions: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  actionBtn: {},
  path: { fontSize: 10, marginTop: 6 },
});
