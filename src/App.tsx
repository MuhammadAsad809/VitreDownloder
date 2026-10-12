import React, { useState, useEffect, useMemo } from "react";
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
import {
  LiquidGlassProvider,
  LiquidGlassView,
  isLiquidGlassSupported,
} from "liquid-glass-kit";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule
  ? new NativeEventEmitter(PythonBridgeModule)
  : null;

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
      Alert.alert(
        "Download Completed",
        `Saved to:\n${res.filePath || "Downloads/Vitre/"}`
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

  const GlassFallback = ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: any;
  }) => (
    <View
      style={[
        {
          backgroundColor: "rgba(24,24,27,0.72)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.14)",
          borderTopColor: "rgba(255,255,255,0.28)",
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  const GlassCard = ({
    children,
    style,
    interactive = false,
  }: {
    children: React.ReactNode;
    style?: any;
    interactive?: boolean;
  }) => {
    if (isLiquidGlassSupported) {
      return (
        <LiquidGlassView
          style={style}
          interactive={interactive}
          chromaticAberration={0.25}
        >
          {children}
        </LiquidGlassView>
      );
    }
    return <GlassFallback style={style}>{children}</GlassFallback>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />
      <View style={styles.ambientOrbTop} pointerEvents="none" />
      <View style={styles.ambientOrbCenter} pointerEvents="none" />
      <View style={styles.ambientOrbBottom} pointerEvents="none" />

      <LiquidGlassProvider style={StyleSheet.absoluteFill}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.glassHeader} interactive>
            <View style={styles.headerTitleRow}>
              <Text style={styles.brandTitle}>VITRE</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>HD</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>
              Native yt-dlp Liquid Engine • YouTube, TikTok & Reels
            </Text>
          </GlassCard>

          <GlassCard style={styles.glassInputCard}>
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
          </GlassCard>

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

          {mediaInfo && (
            <GlassCard style={styles.glassMediaCard} interactive>
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
                        active && styles.glassChipActive,
                      ]}
                      onPress={() => setSelectedFormat(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.glassChipIcon}>{item.icon}</Text>
                      <Text
                        style={[
                          styles.glassChipLabel,
                          active && styles.glassChipLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.glassChipSub,
                          active && styles.glassChipSubActive,
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
                  <Text style={styles.sectionHeaderSub}>
                    Detected Raw Streams
                  </Text>
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
                            active && styles.glassStreamBadgeActive,
                          ]}
                          onPress={() => setSelectedFormat(item.format_id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.glassStreamText,
                              active && styles.glassStreamTextActive,
                            ]}
                          >
                            {item.resolution} ({item.ext})
                          </Text>
                          {sizeLabel ? (
                            <Text style={styles.glassStreamSize}>
                              {sizeLabel}
                            </Text>
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
                      { width: `${progress.percent}%` },
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
                  downloading && styles.buttonDisabled,
                ]}
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
            </GlassCard>
          )}
        </ScrollView>
      </LiquidGlassProvider>
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
  glassHeader: {
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
    overflow: "hidden",
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
  glassInputCard: {
    flexDirection: "row",
    borderRadius: 18,
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    overflow: "hidden",
    height: 54,
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
  glassPrimaryButton: {
    backgroundColor: "rgba(250, 250, 250, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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
  glassMediaCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    overflow: "hidden",
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
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
  },
  presetsList: {
    paddingRight: 8,
  },
  glassChip: {
    backgroundColor: "rgba(39, 39, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    alignItems: "center",
    minWidth: 78,
  },
  glassChipActive: {
    backgroundColor: "rgba(59, 130, 246, 0.35)",
    borderColor: "#3B82F6",
    borderTopColor: "rgba(147, 197, 253, 0.7)",
  },
  glassChipIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  glassChipLabel: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "700",
  },
  glassChipLabelActive: {
    color: "#FFFFFF",
  },
  glassChipSub: {
    color: "#A1A1AA",
    fontSize: 10,
    marginTop: 2,
  },
  glassChipSubActive: {
    color: "#BFDBFE",
  },
  streamsList: {
    paddingRight: 8,
  },
  glassStreamBadge: {
    backgroundColor: "rgba(39, 39, 42, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  glassStreamBadgeActive: {
    backgroundColor: "rgba(59, 130, 246, 0.3)",
    borderColor: "#60A5FA",
  },
  glassStreamText: {
    color: "#E4E4E7",
    fontSize: 12,
    fontWeight: "600",
  },
  glassStreamTextActive: {
    color: "#FFFFFF",
  },
  glassStreamSize: {
    color: "#A1A1AA",
    fontSize: 10,
    marginTop: 2,
  },
  glassProgressTrack: {
    height: 28,
    backgroundColor: "rgba(39, 39, 42, 0.7)",
    borderRadius: 14,
    marginTop: 16,
    overflow: "hidden",
    justifyContent: "center",
  },
  glassProgressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(59, 130, 246, 0.55)",
    borderRadius: 14,
  },
  glassProgressText: {
    color: "#FAFAFA",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    zIndex: 1,
  },
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
  },
  glassDownloadButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
