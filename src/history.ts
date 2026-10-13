/**
 * Vitre history store — persistent download records via AsyncStorage.
 * Records reflect real download events (verified file paths from the Python bridge).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DownloadStatus = 'downloading' | 'completed' | 'failed' | 'cancelled';

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  extractor?: string;
  duration?: number;
  /** Requested quality preset or exact format id. */
  requestedQuality: string;
  /** Actual resolution reported by the downloader after completion. */
  actualHeight?: number;
  actualFormatId?: string;
  actualExt?: string;
  filePath?: string;
  fileSize?: number;
  status: DownloadStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const HISTORY_KEY = 'vitre.history.v1';
const MAX_ENTRIES = 200;

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch (e) {
    console.warn('[Vitre] history load failed:', e);
    return [];
  }
}

export async function persistHistory(entries: HistoryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (e) {
    console.warn('[Vitre] history persist failed:', e);
  }
}

export function upsertEntry(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const idx = list.findIndex(x => x.id === entry.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = entry;
    return next;
  }
  return [entry, ...list].slice(0, MAX_ENTRIES);
}

export function removeEntry(list: HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter(x => x.id !== id);
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Size unavailable';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
