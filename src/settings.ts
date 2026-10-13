/**
 * Vitre settings store — persisted with AsyncStorage so every setting
 * survives app restarts and drives real behavior.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from './theme';

export type QualityPreset = 'best' | '2160' | '1440' | '1080' | '720' | '480' | '360' | 'audio';

export const QUALITY_PRESETS: { label: string; value: QualityPreset; note: string }[] = [
  { label: 'Best available', value: 'best', note: 'Highest quality the source provides' },
  { label: '2160p · 4K', value: '2160', note: 'Ultra HD, when available' },
  { label: '1440p · 2K', value: '1440', note: 'Quad HD, when available' },
  { label: '1080p · Full HD', value: '1080', note: 'Full HD, when available' },
  { label: '720p · HD', value: '720', note: 'HD, when available' },
  { label: '480p', value: '480', note: 'Standard definition' },
  { label: '360p', value: '360', note: 'Smallest video file' },
  { label: 'Audio only', value: 'audio', note: 'Save the audio stream only' },
];

export interface VitreSettings {
  defaultQuality: QualityPreset;
  preferredExt: 'any' | 'mp4' | 'webm';
  audioOnlyDefault: boolean;
  saveThumbnails: boolean;
  confirmBeforeDownload: boolean;
  confirmBeforeDelete: boolean;
  safeFilenames: boolean;
  wifiOnly: boolean;
  maxConcurrent: 1 | 2 | 3;
  notifyComplete: boolean;
  notifyFailed: boolean;
  notifyProgress: boolean;
  keepAwake: boolean;
  themeMode: ThemeMode;
}

export const DEFAULT_SETTINGS: VitreSettings = {
  defaultQuality: 'best',
  preferredExt: 'any',
  audioOnlyDefault: false,
  saveThumbnails: true,
  confirmBeforeDownload: false,
  confirmBeforeDelete: true,
  safeFilenames: true,
  wifiOnly: false,
  maxConcurrent: 1,
  notifyComplete: true,
  notifyFailed: true,
  notifyProgress: false,
  keepAwake: false,
  themeMode: 'dark',
};

const SETTINGS_KEY = 'vitre.settings.v1';

export async function loadSettings(): Promise<VitreSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.warn('[Vitre] settings load failed, using defaults:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: VitreSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[Vitre] settings save failed:', e);
  }
}

export function qualityLabel(value: string): string {
  return QUALITY_PRESETS.find(q => q.value === value)?.label ?? value;
}
