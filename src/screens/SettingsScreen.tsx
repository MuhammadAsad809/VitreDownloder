import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Clipboard,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { GlassContainer } from "../components/GlassContainer";
import { StorageService, DEFAULT_SETTINGS } from "../services/storage";
import { UserSettings } from "../types";

interface SettingsScreenProps {
  onSettingsChanged?: (settings: UserSettings) => void;
  accentColor?: string;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onSettingsChanged,
  accentColor = "#10B981",
}) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    StorageService.getSettings().then((s) => setSettings(s));
    checkStoragePermission();
  }, []);

  const checkStoragePermission = async () => {
    if (Platform.OS === "android" && (Platform.Version as number) <= 29) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      setHasPermission(granted);
    } else {
      setHasPermission(true);
    }
  };

  const requestPermission = async () => {
    if (Platform.OS === "android" && (Platform.Version as number) <= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: "Storage Permission Required",
          message: "Vitre needs storage permission to save downloads to public storage.",
          buttonPositive: "Grant Permission",
        }
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      Alert.alert("Permission Granted", "Storage permissions are active.");
    }
  };

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    val: UserSettings[K]
  ) => {
    const updated = await StorageService.saveSettings({ [key]: val });
    setSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleCopyStorage = () => {
    Clipboard.setString(settings.storageLocation);
    Alert.alert("Copied", "Storage path copied to clipboard.");
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear Download History",
      "Are you sure you want to clear your entire download history? (Downloaded files on your device will NOT be deleted).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await StorageService.clearAllDownloads();
            Alert.alert("Success", "Download history cleared.");
          },
        },
      ]
    );
  };

  const qualityOptions: Array<{ id: UserSettings["defaultQuality"]; label: string; sub: string }> = [
    { id: "best", label: "Best Available", sub: "Auto highest video/audio stream" },
    { id: "1080", label: "1080p FHD", sub: "Prefer 1080p if available" },
    { id: "720", label: "720p HD", sub: "Standard HD quality" },
    { id: "480", label: "480p SD", sub: "Data saver" },
    { id: "audio", label: "Audio Only", sub: "Extract sound as MP3" },
  ];

  const accents: Array<{ id: UserSettings["themeAccent"]; label: string; color: string }> = [
    { id: "emerald", label: "Emerald", color: "#10B981" },
    { id: "mint", label: "Mint", color: "#34D399" },
    { id: "cyan", label: "Cyan", color: "#06B6D4" },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenSubtitle}>
          Configure download defaults, appearance, and engine diagnostics
        </Text>
      </GlassContainer>

      {/* Default Quality Section */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Default Download Quality</Text>
        <Text style={styles.sectionDesc}>
          Pre-selected quality preset when analyzing new links:
        </Text>
        <View style={styles.optionsList}>
          {qualityOptions.map((opt) => {
            const isSelected = settings.defaultQuality === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionRow,
                  isSelected && { borderColor: accentColor, backgroundColor: "rgba(16, 185, 129, 0.08)" },
                ]}
                onPress={() => updateSetting("defaultQuality", opt.id)}
                activeOpacity={0.7}
              >
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionLabel, isSelected && { color: accentColor }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.optionSub}>{opt.sub}</Text>
                </View>
                <View style={[styles.radioCircle, isSelected && { borderColor: accentColor }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: accentColor }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassContainer>

      {/* Storage Location Section */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Storage Directory</Text>
        <Text style={styles.sectionDesc}>
          Downloaded files are organized into Videos and Audio folders:
        </Text>
        <View style={styles.storageBox}>
          <Text style={styles.storagePath} numberOfLines={2}>
            {settings.storageLocation}
          </Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopyStorage}>
            <Text style={styles.copyBtnText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </GlassContainer>

      {/* Theme Accent Section */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Theme Accent Color</Text>
        <View style={styles.accentsRow}>
          {accents.map((acc) => {
            const isSelected = settings.themeAccent === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[
                  styles.accentChip,
                  isSelected && { borderColor: acc.color, backgroundColor: "rgba(255,255,255,0.06)" },
                ]}
                onPress={() => updateSetting("themeAccent", acc.id)}
              >
                <View style={[styles.accentColorDot, { backgroundColor: acc.color }]} />
                <Text style={styles.accentLabel}>{acc.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassContainer>

      {/* Storage Permission Check */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Storage Permission</Text>
        <View style={styles.permissionRow}>
          <Text style={styles.permText}>
            Status: {hasPermission ? "✔ Granted" : "✘ Not Granted"}
          </Text>
          {!hasPermission && (
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: accentColor }]}
              onPress={requestPermission}
            >
              <Text style={styles.permBtnText}>Grant</Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassContainer>

      {/* Data Management Section */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>History Management</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearHistory}>
          <Text style={styles.dangerBtnText}>Clear All Download History</Text>
        </TouchableOpacity>
      </GlassContainer>

      {/* App & Engine Info */}
      <GlassContainer style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Engine & Diagnostics</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>App Version</Text>
          <Text style={styles.infoVal}>Vitre v1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Native Engine</Text>
          <Text style={styles.infoVal}>yt-dlp 2026.8.19 (Chaquopy 3.11)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>UI System</Text>
          <Text style={styles.infoVal}>Tamagui Design + Liquid Glass</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>React Native</Text>
          <Text style={styles.infoVal}>0.73.6 (Hermes)</Text>
        </View>
      </GlassContainer>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F4F4F5",
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    color: "#71717A",
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F4F4F5",
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: "#71717A",
    marginBottom: 12,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(24, 24, 27, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F4F4F5",
  },
  optionSub: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#52525B",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  storageBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(24, 24, 27, 0.7)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  storagePath: {
    color: "#34D399",
    fontSize: 12,
    flex: 1,
    fontFamily: "monospace",
  },
  copyBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8,
  },
  copyBtnText: {
    color: "#F4F4F5",
    fontSize: 11,
    fontWeight: "700",
  },
  accentsRow: {
    flexDirection: "row",
    gap: 10,
  },
  accentChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(24, 24, 27, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  accentColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  accentLabel: {
    color: "#F4F4F5",
    fontSize: 12,
    fontWeight: "600",
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  permText: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  permBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permBtnText: {
    color: "#052e16",
    fontSize: 12,
    fontWeight: "700",
  },
  dangerBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  dangerBtnText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  infoKey: {
    color: "#71717A",
    fontSize: 12,
  },
  infoVal: {
    color: "#F4F4F5",
    fontSize: 12,
    fontWeight: "600",
  },
});
