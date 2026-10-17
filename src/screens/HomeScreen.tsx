import React, { useState, useEffect, useMemo } from "react";
import {
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
} from "react-native";
import { GlassContainer } from "../components/GlassContainer";
import { StorageService } from "../services/storage";
import { FormatItem, MediaMetadata } from "../types";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule
  ? new NativeEventEmitter(PythonBridgeModule)
  : null;

interface HomeScreenProps {
  onDownloadCompleted?: () => void;
  accentColor?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onDownloadCompleted,
  accentColor = "#10B981",
}) => {
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
    const subscription = pythonEvents.addListener(
      "onDownloadProgress",
      (data: string) => {
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
      }
    );
    return () => subscription.remove();
  }, []);

  const requestStoragePermission = async () => {
    if (Platform.OS === "android" && (Platform.Version as number) <= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: "Storage Permission Required",
          message:
            "Vitre needs storage permission to save downloads to your device.",
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
      Alert.alert(
        "Bridge Error",
        "PythonBridgeModule is not linked or initialized."
      );
      return;
    }
    setLoading(true);
    setMediaInfo(null);
    setProgress({ percent: 0, speed: 0 });
    try {
      const responseStr = await PythonBridgeModule.fetchMediaInfo(url.trim());
      const res = JSON.parse(responseStr);
      if (!res || res.success === false) {
        throw new Error(
          res?.error || "Unable to extract media info from this URL."
        );
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
      const resultStr = await PythonBridgeModule.downloadMedia(
        url.trim(),
        selectedFormat
      );
      const res = JSON.parse(resultStr);
      if (!res || res.success === false) {
        throw new Error(res?.error || "Download failed.");
      }

      // Catalog downloaded item into persistent storage
      const recordTitle = res.title || mediaInfo?.title || "Downloaded Media";
      const recordPath = res.filePath || "Downloads/Vitre/";
      const recordCategory =
        res.category ||
        (selectedFormat === "audio"
          ? "audio"
          : selectedFormat === "thumbnail"
          ? "image"
          : "video");

      const actualResolution =
        res.actualResolution ||
        (res.actualHeight ? `${res.actualHeight}p` : selectedFormat === "best" ? "Best" : `${selectedFormat}p`);

      await StorageService.saveDownload({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: recordTitle,
        url: url.trim(),
        formatId: res.formatId || selectedFormat,
        formatLabel: actualResolution,
        actualResolution: actualResolution,
        actualHeight: res.actualHeight,
        filePath: recordPath,
        fileSize: res.fileSize || 0,
        thumbnail: mediaInfo?.thumbnail || "",
        duration: mediaInfo?.duration || 0,
        createdAt: Date.now(),
        category: recordCategory,
      });

      if (onDownloadCompleted) {
        onDownloadCompleted();
      }

      Alert.alert(
        "Download Completed",
        `Saved to:\n${recordPath}\n\nDownloaded Resolution: ${actualResolution}`
      );
    } catch (err: any) {
      Alert.alert("Download Error", err?.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const availablePresets = useMemo(() => {
    if (!mediaInfo) return [];
    const videoFormats = (mediaInfo.formats || []).filter(
      (f) => f.has_video && (f.height || 0) > 0
    );
    const maxHeight = videoFormats.reduce(
      (max, f) => Math.max(max, f.height || 0),
      0
    );
    const presets: Array<{
      id: string;
      label: string;
      sub: string;
      icon: string;
    }> = [];
    if (maxHeight >= 1080)
      presets.push({ id: "1080", label: "1080p", sub: "Full HD", icon: "🎬" });
    if (maxHeight >= 720)
      presets.push({ id: "720", label: "720p", sub: "HD", icon: "📺" });
    if (maxHeight >= 480)
      presets.push({ id: "480", label: "480p", sub: "SD", icon: "⚡" });
    if (maxHeight >= 360)
      presets.push({ id: "360", label: "360p", sub: "Standard", icon: "📱" });
    if (maxHeight >= 240)
      presets.push({ id: "240", label: "240p", sub: "Low", icon: "🔋" });
    if (maxHeight >= 144)
      presets.push({ id: "144", label: "144p", sub: "Data Saver", icon: "📶" });
    presets.push({
      id: "best",
      label: "Best",
      sub: maxHeight > 0 ? `Max (${maxHeight}p)` : "Auto Best",
      icon: "✨",
    });
    presets.push({ id: "audio", label: "Audio", sub: "MP3 / M4A", icon: "🎵" });
    presets.push({
      id: "thumbnail",
      label: "Thumbnail",
      sub: "Cover Art",
      icon: "🖼️",
    });
    return presets;
  }, [mediaInfo]);

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
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <GlassContainer style={styles.glassHeader} interactive>
        <View style={styles.headerTitleRow}>
          <Text style={styles.brandTitle}>VITRE</Text>
          <View style={[styles.proBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.proBadgeText}>HD</Text>
          </View>
        </View>
        <Text style={styles.brandSubtitle}>
          Native yt-dlp Liquid Engine • YouTube, TikTok & Reels
        </Text>
      </GlassContainer>

      <GlassContainer style={styles.glassInputCard}>
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
      </GlassContainer>

      <TouchableOpacity
        style={[
          styles.glassPrimaryButton,
          { backgroundColor: accentColor },
          loading && styles.buttonDisabled,
        ]}
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

      {mediaInfo && (
        <GlassContainer style={styles.glassMediaCard} interactive>
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

          <Text style={styles.sectionHeader}>Available Quality Presets</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={availablePresets}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.presetsList}
            renderItem={({ item }) => {
              const active = selectedFormat === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.glassChip,
                    active && {
                      borderColor: accentColor,
                      backgroundColor: "rgba(16, 185, 129, 0.18)",
                    },
                  ]}
                  onPress={() => setSelectedFormat(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.glassChipIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.glassChipLabel,
                      active && { color: accentColor, fontWeight: "800" },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.glassChipSub,
                      active && { color: "#34D399" },
                    ]}
                  >
                    {item.sub}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {mediaInfo.formats && mediaInfo.formats.length > 0 && (
            <>
              <Text style={styles.sectionHeaderSub}>Detected Raw Streams</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={mediaInfo.formats.slice(0, 8)}
                keyExtractor={(item) => item.format_id}
                contentContainerStyle={styles.streamsList}
                renderItem={({ item }) => {
                  const active = selectedFormat === item.format_id;
                  const sizeLabel = formatFileSize(item.filesize);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.glassStreamBadge,
                        active && { borderColor: accentColor },
                      ]}
                      onPress={() => setSelectedFormat(item.format_id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.glassStreamText,
                          active && { color: accentColor },
                        ]}
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

          {downloading && (
            <View style={styles.glassProgressTrack}>
              <View
                style={[
                  styles.glassProgressBar,
                  { width: `${progress.percent}%`, backgroundColor: accentColor },
                ]}
              />
              <Text style={styles.glassProgressText}>
                {progress.percent}% •{" "}
                {(progress.speed / 1024 / 1024).toFixed(2)} MB/s
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.glassDownloadButton,
              { backgroundColor: accentColor },
              downloading && styles.buttonDisabled,
            ]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            {downloading ? (
              <ActivityIndicator color="#052e16" />
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
        </GlassContainer>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  glassHeader: {
    padding: 18,
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#F4F4F5",
    letterSpacing: 2,
  },
  proBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#052e16",
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 6,
    fontWeight: "400",
  },
  glassInputCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    paddingVertical: 10,
  },
  glassPasteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  glassPasteText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "600",
  },
  glassPrimaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  glassPrimaryButtonText: {
    color: "#052e16",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  glassMediaCard: {
    padding: 16,
    marginBottom: 20,
  },
  thumbnailWrapper: {
    width: "100%",
    height: 190,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#18181B",
    marginBottom: 12,
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
  },
  durationBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  platformBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  platformBadgeText: {
    color: "#052e16",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F4F4F5",
    lineHeight: 21,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A1A1AA",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  presetsList: {
    paddingVertical: 4,
    gap: 8,
    marginBottom: 12,
  },
  glassChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(24, 24, 27, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    minWidth: 78,
  },
  glassChipIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  glassChipLabel: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "700",
  },
  glassChipSub: {
    color: "#71717A",
    fontSize: 10,
    marginTop: 2,
  },
  sectionHeaderSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#71717A",
    marginTop: 4,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  streamsList: {
    paddingVertical: 2,
    gap: 6,
    marginBottom: 16,
  },
  glassStreamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(24, 24, 27, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  glassStreamText: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
  },
  glassStreamSize: {
    color: "#71717A",
    fontSize: 10,
  },
  glassProgressTrack: {
    height: 28,
    backgroundColor: "rgba(24, 24, 27, 0.8)",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    position: "relative",
  },
  glassProgressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
  },
  glassProgressText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "700",
  },
  glassDownloadButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  glassDownloadButtonText: {
    color: "#052e16",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
