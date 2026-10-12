import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  NativeModules,
  NativeEventEmitter,
  Alert,
  Clipboard,
  PermissionsAndroid,
  Platform,
  StatusBar,
} from "react-native";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule ? new NativeEventEmitter(PythonBridgeModule) : null;

interface FormatItem {
  format_id: string;
  ext: string;
  resolution: string;
  height?: number;
  filesize: number;
  has_video: boolean;
  has_audio: boolean;
  fps?: number;
  quality_note?: string;
}

interface MediaMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  extractor: string;
  formats: FormatItem[];
}

const QUALITY_PRESETS = [
  { id: "best", label: "Best", sub: "Max 1080p+", icon: "✨" },
  { id: "1080", label: "1080p", sub: "Full HD", icon: "🎬" },
  { id: "720", label: "720p", sub: "HD", icon: "📺" },
  { id: "480", label: "480p", sub: "SD", icon: "⚡" },
  { id: "360", label: "360p", sub: "Data Saver", icon: "📱" },
  { id: "audio", label: "Audio", sub: "MP3 / M4A", icon: "🎵" },
  { id: "thumbnail", label: "Thumbnail", sub: "Cover Art", icon: "🖼️" },
];

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("best");
  const [progress, setProgress] = useState<{ percent: number; speed: number }>({
    percent: 0,
    speed: 0,
  });

  useEffect(() => {
    if (!pythonEvents) return;
    const subscription = pythonEvents.addListener("onDownloadProgress", (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.percent !== undefined) {
          setProgress({
            percent: parsed.percent,
            speed: parsed.speed || 0,
          });
        }
      } catch (e) {
        console.error("Progress JSON parse error:", e);
      }
    });

    return () => subscription.remove();
  }, []);

  const requestStoragePermission = async () => {
    if (Platform.OS === "android" && (Platform.Version as number) <= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: "Storage Permission Required",
          message: "Vitre needs storage permission to save downloads to your device.",
          buttonPositive: "Allow",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) setUrl(text);
    } catch (e) {
      console.warn("Failed to read clipboard", e);
    }
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      Alert.alert("Input Required", "Please enter or paste a valid media URL.");
      return;
    }

    if (!PythonBridgeModule) {
      Alert.alert("Bridge Error", "PythonBridgeModule is not linked or initialized.");
      return;
    }

    setLoading(true);
    setMediaInfo(null);
    setProgress({ percent: 0, speed: 0 });

    try {
      const responseStr = await PythonBridgeModule.fetchMediaInfo(url.trim());
      const res = JSON.parse(responseStr);

      if (!res || res.success === false) {
        throw new Error(res?.error || "Unable to extract media info from this URL.");
      }

      setMediaInfo(res as MediaMetadata);
      setSelectedFormat("best");
    } catch (err: any) {
      Alert.alert("Lookup Failed", err?.message || "Failed to fetch metadata.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Cannot write to Downloads directory.");
      return;
    }

    if (!PythonBridgeModule) {
      Alert.alert("Bridge Error", "PythonBridgeModule is not linked.");
      return;
    }

    setDownloading(true);
    setProgress({ percent: 0, speed: 0 });
    try {
      const resultStr = await PythonBridgeModule.downloadMedia(url.trim(), selectedFormat);
      const res = JSON.parse(resultStr);

      if (!res || res.success === false) {
        throw new Error(res?.error || "Download failed.");
      }

      Alert.alert("Download Completed", `Saved to:\n${res.filePath || "Downloads/Vitre/"}`);
    } catch (err: any) {
      Alert.alert("Download Error", err?.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />

      {/* Liquid ambient refractive glowing orbs behind glass */}
      <View style={styles.ambientOrbTop} pointerEvents="none" />
      <View style={styles.ambientOrbCenter} pointerEvents="none" />
      <View style={styles.ambientOrbBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Liquid Glass Header */}
        <View style={styles.glassHeader}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.brandTitle}>VITRE</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>HD</Text>
            </View>
          </View>
          <Text style={styles.brandSubtitle}>
            Native yt-dlp Liquid Engine • YouTube, TikTok & Reels
          </Text>
        </View>

        {/* Liquid Glass Input Row */}
        <View style={styles.glassInputCard}>
          <TextInput
            style={styles.textInput}
            placeholder="Paste media link (YouTube, TikTok, Reels)..."
            placeholderTextColor="#71717A"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.glassPasteButton}
            onPress={handlePaste}
            activeOpacity={0.7}
          >
            <Text style={styles.glassPasteText}>Paste</Text>
          </TouchableOpacity>
        </View>

        {/* Primary Liquid Glass Analyze Button */}
        <TouchableOpacity
          style={[styles.glassPrimaryButton, loading && styles.buttonDisabled]}
          onPress={handleFetch}
          disabled={loading || downloading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#09090B" />
          ) : (
            <Text style={styles.glassPrimaryButtonText}>Analyze Video</Text>
          )}
        </TouchableOpacity>

        {/* Media Preview Liquid Glass Card */}
        {mediaInfo && (
          <View style={styles.glassMediaCard}>
            {mediaInfo.thumbnail ? (
              <View style={styles.thumbnailWrapper}>
                <Image
                  source={{ uri: mediaInfo.thumbnail }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
                <View style={styles.thumbnailGlassOverlay}>
                  {mediaInfo.duration > 0 && (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationBadgeText}>
                        {formatDuration(mediaInfo.duration)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.platformBadge}>
                    <Text style={styles.platformBadgeText}>
                      {(mediaInfo.extractor || "MEDIA").toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Text style={styles.cardTitle} numberOfLines={2}>
              {mediaInfo.title}
            </Text>

            {/* Quality Presets Selector (HD, Audio, Thumbnail) */}
            <Text style={styles.sectionHeader}>Select Quality & Preset</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUALITY_PRESETS}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.presetsList}
              renderItem={({ item }) => {
                const active = selectedFormat === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.glassChip, active && styles.glassChipActive]}
                    onPress={() => setSelectedFormat(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.glassChipIcon}>{item.icon}</Text>
                    <Text
                      style={[styles.glassChipLabel, active && styles.glassChipLabelActive]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.glassChipSub, active && styles.glassChipSubActive]}
                    >
                      {item.sub}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Raw Streams List if Available */}
            {mediaInfo.formats && mediaInfo.formats.length > 0 && (
              <>
                <Text style={styles.sectionHeaderSub}>Detected Raw Streams</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={mediaInfo.formats.slice(0, 6)}
                  keyExtractor={(item) => item.format_id}
                  contentContainerStyle={styles.streamsList}
                  renderItem={({ item }) => {
                    const active = selectedFormat === item.format_id;
                    const sizeLabel = formatFileSize(item.filesize);
                    return (
                      <TouchableOpacity
                        style={[styles.glassStreamBadge, active && styles.glassStreamBadgeActive]}
                        onPress={() => setSelectedFormat(item.format_id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.glassStreamText, active && styles.glassStreamTextActive]}
                        >
                          {item.resolution} ({item.ext})
                        </Text>
                        {sizeLabel ? (
                          <Text style={styles.glassStreamSize}>{sizeLabel}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}

            {/* Liquid Download Progress Bar */}
            {downloading && (
              <View style={styles.glassProgressTrack}>
                <View
                  style={[styles.glassProgressBar, { width: `${progress.percent}%` }]}
                />
                <Text style={styles.glassProgressText}>
                  {progress.percent}% • {(progress.speed / 1024 / 1024).toFixed(2)} MB/s
                </Text>
              </View>
            )}

            {/* Save to Storage Button */}
            <TouchableOpacity
              style={[styles.glassDownloadButton, downloading && styles.buttonDisabled]}
              onPress={handleDownload}
              disabled={downloading}
              activeOpacity={0.8}
            >
              {downloading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.glassDownloadButtonText}>
                  {selectedFormat === "thumbnail"
                    ? "Save Cover Thumbnail"
                    : selectedFormat === "audio"
                    ? "Save Audio Track"
                    : "Save Video to Storage"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* Liquid ambient refractive glowing orbs */
  ambientOrbTop: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(59, 130, 246, 0.16)",
  },
  ambientOrbCenter: {
    position: "absolute",
    top: 260,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(147, 51, 234, 0.12)",
  },
  ambientOrbBottom: {
    position: "absolute",
    bottom: 40,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },

  /* Liquid Glass Header */
  glassHeader: {
    backgroundColor: "rgba(24, 24, 27, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderTopColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FAFAFA",
    letterSpacing: 2,
  },
  proBadge: {
    marginLeft: 10,
    backgroundColor: "rgba(59, 130, 246, 0.25)",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderTopColor: "rgba(147, 197, 253, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proBadgeText: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 6,
    lineHeight: 16,
  },

  /* Liquid Glass Input Card */
  glassInputCard: {
    flexDirection: "row",
    backgroundColor: "rgba(24, 24, 27, 0.70)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderTopColor: "rgba(255, 255, 255, 0.26)",
    borderRadius: 18,
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    elevation: 4,
  },
  textInput: {
    flex: 1,
    height: 50,
    color: "#FAFAFA",
    fontSize: 14,
  },
  glassPasteButton: {
    backgroundColor: "rgba(39, 39, 42, 0.80)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderTopColor: "rgba(255, 255, 255, 0.30)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  glassPasteText: {
    color: "#FAFAFA",
    fontSize: 12,
    fontWeight: "700",
  },

  /* Primary Liquid Glass Button */
  glassPrimaryButton: {
    backgroundColor: "rgba(250, 250, 250, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 6,
    shadowColor: "#FFF",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  glassPrimaryButtonText: {
    color: "#09090B",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  /* Liquid Glass Media Card */
  glassMediaCard: {
    backgroundColor: "rgba(24, 24, 27, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderTopColor: "rgba(255, 255, 255, 0.30)",
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  thumbnailWrapper: {
    position: "relative",
    width: "100%",
    height: 190,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(39, 39, 42, 0.5)",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailGlassOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  durationBadge: {
    backgroundColor: "rgba(9, 9, 11, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationBadgeText: {
    color: "#FAFAFA",
    fontSize: 11,
    fontWeight: "700",
  },
  platformBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.35)",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderTopColor: "rgba(147, 197, 253, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  platformBadgeText: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardTitle: {
    color: "#FAFAFA",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    lineHeight: 22,
  },

  /* Quality Presets */
  sectionHeader: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sectionHeaderSub: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
  },
  presetsList: {
    paddingVertical: 4,
  },
  glassChip: {
    backgroundColor: "rgba(39, 39, 42, 0.60)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderTopColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 10,
    alignItems: "center",
    minWidth: 84,
  },
  glassChipActive: {
    backgroundColor: "rgba(59, 130, 246, 0.30)",
    borderColor: "#3B82F6",
    borderTopColor: "rgba(147, 197, 253, 0.85)",
  },
  glassChipIcon: {
    fontSize: 14,
    marginBottom: 4,
  },
  glassChipLabel: {
    color: "#D4D4D8",
    fontSize: 13,
    fontWeight: "700",
  },
  glassChipLabelActive: {
    color: "#FFFFFF",
  },
  glassChipSub: {
    color: "#71717A",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  glassChipSubActive: {
    color: "#93C5FD",
  },

  /* Stream badges */
  streamsList: {
    paddingVertical: 2,
  },
  glassStreamBadge: {
    backgroundColor: "rgba(39, 39, 42, 0.50)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    alignItems: "center",
  },
  glassStreamBadgeActive: {
    backgroundColor: "rgba(59, 130, 246, 0.25)",
    borderColor: "#3B82F6",
  },
  glassStreamText: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
  },
  glassStreamTextActive: {
    color: "#FFFFFF",
  },
  glassStreamSize: {
    color: "#71717A",
    fontSize: 9,
    marginTop: 1,
  },

  /* Liquid Glass Progress Bar */
  glassProgressTrack: {
    height: 28,
    backgroundColor: "rgba(39, 39, 42, 0.60)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderTopColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 16,
    justifyContent: "center",
  },
  glassProgressBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#3B82F6",
    borderRadius: 14,
  },
  glassProgressText: {
    color: "#FAFAFA",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  /* Save to Storage Button */
  glassDownloadButton: {
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.6)",
    borderTopColor: "rgba(255, 255, 255, 0.40)",
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    elevation: 6,
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  glassDownloadButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
