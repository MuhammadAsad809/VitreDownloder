import AsyncStorage from "@react-native-async-storage/async-storage";
import { DownloadRecord, UserSettings } from "../types";

const DOWNLOADS_KEY = "@vitre_downloads_v1";
const SETTINGS_KEY = "@vitre_settings_v1";

export const DEFAULT_SETTINGS: UserSettings = {
  defaultQuality: "best",
  storageLocation: "/storage/emulated/0/Download/Vitre",
  autoClearHistoryDays: 0,
  themeAccent: "emerald",
  concurrentDownloads: 1,
};

// In-memory fallback in case native storage has issues
let memoryDownloads: DownloadRecord[] = [];
let memorySettings: UserSettings = { ...DEFAULT_SETTINGS };

export const StorageService = {
  async getDownloads(): Promise<DownloadRecord[]> {
    try {
      const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
      if (data) {
        const parsed: DownloadRecord[] = JSON.parse(data);
        memoryDownloads = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn("StorageService.getDownloads error, using fallback:", e);
    }
    return memoryDownloads;
  },

  async saveDownload(record: DownloadRecord): Promise<void> {
    try {
      const current = await this.getDownloads();
      // Prepend newest download first, avoid duplicates
      const filtered = current.filter((item) => item.id !== record.id);
      const updated = [record, ...filtered];
      memoryDownloads = updated;
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("StorageService.saveDownload error:", e);
      memoryDownloads = [record, ...memoryDownloads.filter((i) => i.id !== record.id)];
    }
  },

  async removeDownload(id: string): Promise<void> {
    try {
      const current = await this.getDownloads();
      const updated = current.filter((item) => item.id !== id);
      memoryDownloads = updated;
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("StorageService.removeDownload error:", e);
      memoryDownloads = memoryDownloads.filter((item) => item.id !== id);
    }
  },

  async clearAllDownloads(): Promise<void> {
    try {
      memoryDownloads = [];
      await AsyncStorage.removeItem(DOWNLOADS_KEY);
    } catch (e) {
      console.warn("StorageService.clearAllDownloads error:", e);
      memoryDownloads = [];
    }
  },

  async getSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        memorySettings = { ...DEFAULT_SETTINGS, ...parsed };
        return memorySettings;
      }
    } catch (e) {
      console.warn("StorageService.getSettings error, using defaults:", e);
    }
    return memorySettings;
  },

  async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      memorySettings = updated;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn("StorageService.saveSettings error:", e);
      memorySettings = { ...memorySettings, ...settings };
      return memorySettings;
    }
  },
};
