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
  quality_note?: string;
}

export interface MediaMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  extractor: string;
  formats: FormatItem[];
}

export interface DownloadRecord {
  id: string;
  title: string;
  url: string;
  formatId: string;
  formatLabel: string;
  actualResolution?: string;
  actualHeight?: number;
  filePath: string;
  fileSize: number;
  thumbnail: string;
  duration: number;
  createdAt: number;
  category: "video" | "audio" | "image";
}

export interface UserSettings {
  defaultQuality: "best" | "1080" | "720" | "480" | "360" | "240" | "144" | "audio";
  storageLocation: string;
  autoClearHistoryDays: number;
  themeAccent: "emerald" | "mint" | "cyan";
  concurrentDownloads: number;
}
