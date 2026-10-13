import React, { useState, useEffect } from "react";
import LinearGradient from "react-native-linear-gradient";
import {
  SafeAreaView,
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
  ScrollView,
} from "react-native";

// Local pure-JS Liquid Glass kit for this React Native 0.73 app
import {
  LiquidGlassView,
  LiquidGlassProvider,
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
  filesize: number;
  has_video: boolean;
  has_audio: boolean;
  quality_note: string;
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
      const res: MediaMetadata = JSON.parse(responseStr);
      setMediaInfo(res);
      if (res.formats && res.formats.length > 0) {
        setSelectedFormat(res.formats[0].format_id);
      }
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
    try {
      const resultStr = await PythonBridgeModule.downloadMedia(
        url.trim(),
        selectedFormat
      );
      const res = JSON.parse(resultStr);
      Alert.alert("Download Completed", `Saved to:\n${res.filePath}`);
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

  // Fallback style when native glass is not available
  const glassFallback = {
    backgroundColor: "rgba(1, 8, 4, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(184, 255, 207, 0.19)",
    borderTopColor: "rgba(246,255,249,0.62)",
  };

  return (
    <LiquidGlassProvider style={{ flex: 1 }}>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#020503" />
        <LinearGradient
          colors={["#020403", "#04170C", "#062011", "#020604"]}
          locations={[0, 0.38, 0.68, 1]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.88, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>VITRE</Text>
            <Text style={styles.tagline}>
              {isLiquidGlassSupported
                ? "Native Liquid Glass Engine"
                : "Premium On-Device Downloader"}
            </Text>
          </View>

          {/* Input Glass Card */}
          <LiquidGlassView
            style={[styles.glassCard, !isLiquidGlassSupported && glassFallback]}
            interactive
            intensity="medium"
          >
            <Text style={styles.label}>Media Link</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Paste YouTube • TikTok • Instagram..."
                placeholderTextColor="rgba(245,255,249,0.42)"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor="#66F3A0"
              />
              <TouchableOpacity
                style={styles.pasteChip}
                onPress={handlePaste}
                activeOpacity={0.75}
              >
                <Text style={styles.pasteChipText}>Paste</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.analyzeBtn,
                (loading || downloading) && styles.btnDisabled,
              ]}
              onPress={handleFetch}
              disabled={loading || downloading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.analyzeBtnText}>Analyze Video</Text>
              )}
            </TouchableOpacity>
          </LiquidGlassView>

          {/* Media Result */}
          {mediaInfo && (
            <LiquidGlassView
              style={[
                styles.glassCard,
                !isLiquidGlassSupported && glassFallback,
              ]}
              interactive
              intensity="medium"
            >
              {mediaInfo.thumbnail ? (
                <View style={styles.thumbWrapper}>
                  <Image
                    source={{ uri: mediaInfo.thumbnail }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              <Text style={styles.mediaTitle} numberOfLines={2}>
                {mediaInfo.title}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.platformPill}>
                  <Text style={styles.platformPillText}>
                    {mediaInfo.extractor.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Quality & Format</Text>

              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={mediaInfo.formats.slice(0, 10)}
                keyExtractor={(item) => item.format_id}
                contentContainerStyle={styles.formatList}
                renderItem={({ item }) => {
                  const active = selectedFormat === item.format_id;
                  const sizeLabel = formatFileSize(item.filesize);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.formatChip,
                        active && styles.formatChipActive,
                      ]}
                      onPress={() => setSelectedFormat(item.format_id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.formatChipText,
                          active && styles.formatChipTextActive,
                        ]}
                      >
                        {item.resolution}
                      </Text>
                      <Text
                        style={[
                          styles.formatChipSub,
                          active && styles.formatChipSubActive,
                        ]}
                      >
                        {item.ext.toUpperCase()}
                        {sizeLabel ? ` · ${sizeLabel}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />

              {downloading && (
                <View style={styles.progressBlock}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(progress.percent, 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressPercent}>
                      {progress.percent.toFixed(0)}%
                    </Text>
                    <Text style={styles.progressSpeed}>
                      {(progress.speed / 1024 / 1024).toFixed(2)} MB/s
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  downloading && styles.btnDisabled,
                ]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.85}
              >
                {downloading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.downloadBtnText}>Save to Device</Text>
                )}
              </TouchableOpacity>
            </LiquidGlassView>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </LiquidGlassProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 28,
    marginTop: 12,
  },
  logo: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(236,255,243,0.70)",
    marginTop: 6,
    letterSpacing: 0.6,
  },
  glassCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(237,255,243,0.72)",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingLeft: 16,
    paddingRight: 8,
    height: 54,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  pasteChip: {
    backgroundColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pasteChipText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  analyzeBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(4, 74, 35, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(140, 255, 179, 0.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  analyzeBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  thumbWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  thumbnail: {
    width: "100%",
    height: 190,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  mediaTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  platformPill: {
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  platformPillText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(236,255,243,0.70)",
    letterSpacing: 0.7,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  formatList: {
    paddingBottom: 4,
  },
  formatChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 10,
    minWidth: 100,
    alignItems: "center",
  },
  formatChipActive: {
    backgroundColor: "rgba(8, 105, 49, 0.42)",
    borderColor: "rgba(140, 255, 179, 0.62)",
  },
  formatChipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "700",
  },
  formatChipTextActive: {
    color: "#FFFFFF",
  },
  formatChipSub: {
    color: "rgba(226,243,232,0.62)",
    fontSize: 11,
    marginTop: 3,
  },
  formatChipSubActive: {
    color: "rgba(255,255,255,0.8)",
  },
  progressBlock: {
    marginTop: 20,
    marginBottom: 4,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#35E887",
    borderRadius: 4,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressPercent: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  progressSpeed: {
    color: "rgba(228,241,232,0.68)",
    fontSize: 13,
    fontWeight: "500",
  },
  downloadBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(4, 91, 42, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(140, 255, 179, 0.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
