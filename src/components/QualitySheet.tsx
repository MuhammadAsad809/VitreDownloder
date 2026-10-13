/**
 * QualitySheet — premium bottom sheet for real format selection.
 * Only shows formats actually returned by the extractor (never invented options).
 */
import React, { useMemo } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Palette, radius } from '../theme';
import { FormatItem } from '../bridge';
import { GlassChip, RadioRow, Badge } from './GlassUI';
import { formatBytes } from '../history';

interface Props {
  visible: boolean;
  t: Palette;
  formats: FormatItem[];
  selected: string;
  onSelect: (formatId: string) => void;
  onClose: () => void;
}

/** Deduplicate formats that share height+ext+codec profile, keep best bitrate/filesize. */
export function dedupeFormats(formats: FormatItem[]): FormatItem[] {
  const map = new Map<string, FormatItem>();
  for (const f of formats) {
    const kind = !f.has_video ? 'audio' : !f.has_audio ? 'video' : 'progressive';
    const key = `${kind}:${f.height || 0}:${f.ext}:${f.fps || 0}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, f); continue; }
    const score = (x: FormatItem) => (x.filesize || 0) + (x.tbr || 0) * 1000;
    if (score(f) > score(prev)) map.set(key, f);
  }
  const list = [...map.values()];
  list.sort((a, b) => {
    if (a.has_video !== b.has_video) return a.has_video ? -1 : 1; // video first
    if ((b.height || 0) !== (a.height || 0)) return (b.height || 0) - (a.height || 0);
    return (b.filesize || 0) - (a.filesize || 0);
  });
  return list;
}

function describeFormat(f: FormatItem): string {
  const parts: string[] = [];
  if (f.has_video && !f.has_audio) parts.push('video only · merges audio');
  else if (!f.has_video && f.has_audio) parts.push('audio only');
  else if (f.has_video && f.has_audio) parts.push('video + audio');
  if (f.fps && f.fps > 30) parts.push(`${Math.round(f.fps)} fps`);
  if (f.vcodec && f.vcodec !== 'none') parts.push(f.vcodec.split('.')[0].toUpperCase());
  if (f.quality_note) parts.push(f.quality_note);
  return parts.join(' · ');
}

export const QualitySheet: React.FC<Props> = ({ visible, t, formats, selected, onSelect, onClose }) => {
  const unique = useMemo(() => dedupeFormats(formats), [formats]);
  const heights = useMemo(() => {
    const s = new Set<number>();
    unique.forEach(f => { if (f.has_video && f.height) s.add(f.height); });
    return [...s].sort((a, b) => b - a);
  }, [unique]);
  const recommendedId = useMemo(() => {
    const bestVideo = unique.find(f => f.has_video && f.has_audio);
    return bestVideo?.format_id ?? unique[0]?.format_id ?? '';
  }, [unique]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.overlayFill, { backgroundColor: t.overlay }]} />
      </TouchableOpacity>
      <View style={[styles.sheet, { backgroundColor: t.isDark ? '#0B1310' : '#FFFFFF', borderColor: t.glassBorder }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>Quality &amp; format</Text>
          <GlassChip t={t} label={`${unique.length} available`} />
        </View>
        {heights.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <GlassChip t={t} label="All" active={selected === ''} onPress={() => onSelect('')} />
            {heights.map(h => (
              <GlassChip key={h} t={t} label={`${h}p`} active={unique.some(f => f.format_id === selected && f.height === h)} onPress={() => {
                const match = unique.find(f => f.has_video && f.height === h);
                if (match) onSelect(match.format_id);
              }} />
            ))}
          </ScrollView>
        )}
        <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.5 }} keyboardShouldPersistTaps="handled">
          {unique.map(f => {
            const isRecommended = f.format_id === recommendedId;
            return (
              <RadioRow
                key={f.format_id}
                t={t}
                selected={selected === f.format_id}
                onPress={() => { onSelect(f.format_id); onClose(); }}
                title={
                  f.has_video
                    ? `${f.height ? `${f.height}p` : f.resolution || 'Video'} · ${f.ext.toUpperCase()}`
                    : `Audio · ${f.ext.toUpperCase()}`
                }
                subtitle={`#${f.format_id} · ${describeFormat(f)}${f.filesize ? ` · ~${formatBytes(f.filesize)}` : ''}`}
                right={isRecommended ? <Badge t={t} label="RECOMMENDED" /> : undefined}
              />
            );
          })}
          {unique.length === 0 && (
            <Text style={[styles.emptyText, { color: t.textMuted }]}>No downloadable formats were returned for this link.</Text>
          )}
        </ScrollView>
        <Text style={[styles.note, { color: t.textMuted }]}>
          Adaptive streams (video-only) are merged with the best audio automatically. Only resolutions the source actually provides are listed.
        </Text>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  overlayFill: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: radius.xxl, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  filterRow: { gap: 8, paddingVertical: 6, marginBottom: 6 },
  emptyText: { fontSize: 12, paddingVertical: 18, textAlign: 'center' },
  note: { fontSize: 10.5, lineHeight: 15, marginTop: 10 },
});
