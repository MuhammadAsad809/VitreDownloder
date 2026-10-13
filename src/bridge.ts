/**
 * Vitre native bridge — thin, typed wrapper over the Chaquopy PythonBridgeModule
 * plus local file helpers (size check, delete, share/open intents).
 */
import { NativeModules, NativeEventEmitter, Share, Alert } from 'react-native';

const { PythonBridgeModule } = NativeModules;

export interface FormatItem {
  format_id: string;
  ext: string;
  resolution: string;
  height?: number;
  width?: number;
  filesize: number;
  has_video: boolean;
  has_audio: boolean;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  quality_note?: string;
  tbr?: number;
}

export interface MediaMetadata {
  success: boolean;
  id?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  extractor?: string;
  uploader?: string;
  webpage_url?: string;
  formats?: FormatItem[];
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  title?: string;
  fileSize?: number;
  actualFormatId?: string;
  actualHeight?: number;
  actualExt?: string;
  isAudio?: boolean;
  error?: string;
}

export interface ProgressPayload {
  status: 'downloading' | 'finished' | 'merging' | 'cancelled';
  downloaded?: number;
  total?: number;
  percent?: number;
  speed?: number;
  eta?: number;
  downloadId?: string;
}

export const bridgeAvailable = (): boolean => !!PythonBridgeModule;

export async function fetchMediaInfo(url: string): Promise<MediaMetadata> {
  if (!PythonBridgeModule) throw new Error('Downloader service is not available on this device.');
  const raw = await PythonBridgeModule.fetchMediaInfo(url);
  return JSON.parse(raw) as MediaMetadata;
}

export async function downloadMedia(
  url: string,
  formatId: string,
  opts: { saveThumbnail: boolean; wifiOnly: boolean; safeFilenames: boolean },
): Promise<DownloadResult> {
  if (!PythonBridgeModule) throw new Error('Downloader service is not available on this device.');
  const optionsJson = JSON.stringify({
    save_thumbnail: opts.saveThumbnail,
    wifi_only: opts.wifiOnly,
    safe_filenames: opts.safeFilenames,
  });
  const raw = await PythonBridgeModule.downloadMedia(url, formatId, optionsJson);
  return JSON.parse(raw) as DownloadResult;
}

export async function cancelDownload(downloadId: string): Promise<boolean> {
  if (!PythonBridgeModule) return false;
  try {
    const raw = await PythonBridgeModule.cancelDownload(downloadId);
    const res = JSON.parse(raw);
    return !!res.cancelled;
  } catch (e) {
    console.warn('[Vitre] cancel failed:', e);
    return false;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  if (!PythonBridgeModule) return 0;
  try {
    const raw = await PythonBridgeModule.getFileSize(filePath);
    const res = JSON.parse(raw);
    return Number(res.size) || 0;
  } catch {
    return 0;
  }
}

export async function deleteFile(filePath: string): Promise<boolean> {
  if (!PythonBridgeModule) return false;
  try {
    const raw = await PythonBridgeModule.deleteFile(filePath);
    const res = JSON.parse(raw);
    return !!res.success;
  } catch {
    return false;
  }
}

export async function openFile(filePath: string, mimeHint?: string): Promise<void> {
  if (!PythonBridgeModule) { Alert.alert('Unavailable', 'File actions require the downloader module.'); return; }
  try {
    const raw = await PythonBridgeModule.openFile(filePath, mimeHint ?? '');
    const res = JSON.parse(raw);
    if (!res.success) Alert.alert('Cannot open file', res.error || 'No Android app can handle this file type.');
  } catch (e: any) {
    Alert.alert('Cannot open file', e?.message ?? String(e));
  }
}

export async function showInFolder(filePath: string): Promise<void> {
  if (!PythonBridgeModule) return;
  try {
    const raw = await PythonBridgeModule.showInFolder(filePath);
    const res = JSON.parse(raw);
    if (!res.success) Alert.alert('Cannot open folder', res.error || 'No file manager available.');
  } catch (e: any) {
    Alert.alert('Cannot open folder', e?.message ?? String(e));
  }
}

export async function shareFile(title: string, filePath: string): Promise<void> {
  try {
    await Share.share({ message: `${title}\n${filePath}` });
  } catch (e) {
    console.warn('[Vitre] share cancelled/failed:', e);
  }
}

export function subscribeProgress(cb: (p: ProgressPayload) => void): () => void {
  if (!PythonBridgeModule) return () => {};
  const emitter = new NativeEventEmitter(PythonBridgeModule);
  const sub = emitter.addListener('onDownloadProgress', (data: string) => {
    try {
      cb(JSON.parse(data) as ProgressPayload);
    } catch (e) {
      console.warn('[Vitre] progress parse error', e);
    }
  });
  return () => sub.remove();
}
