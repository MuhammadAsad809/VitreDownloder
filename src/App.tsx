import React, { useState, useEffect } from "react";
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
  Dimensions,
  ScrollView,
} from "react-native";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule
  ? new NativeEventEmitter(PythonBridgeModule)
  : null;

const { width } = Dimensions.get("window");

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

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#030305" />

      {/* Ambient background orbs */}
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />
      <View style={styles.orbMid} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>VITRE</Text>
          <Text style={styles.tagline}>Premium On-Device Downloader</Text>
        </View>

        {/* Glass Input Card */}
        <View style={styles.glassPanel}>
          <Text style={styles.label}>Media Link</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Paste YouTube • TikTok • Instagram..."
              placeholderTextColor="rgba(255,255,255,0.28)"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor="#60A5FA"
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
        </View>

        {/* Media Result Card */}
        {mediaInfo && (
          <View style={styles.glassPanel}>
            {/* Top highlight line */}
            <View style={styles.panelHighlight} />

            {mediaInfo.thumbnail ? (
              <View style={styles.thumbWrapper}>
                <Image
                  source={{ uri: mediaInfo.thumbnail }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
                <View style={styles.thumbOverlay} />
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

            {/* Premium Progress */}
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
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#030305",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },

  // Ambient orbs
  orbTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(59, 130, 246, 0.11)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -140,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(124, 58, 237, 0.09)",
  },
  orbMid: {
    position: "absolute",
    top: "42%",
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(14, 165, 233, 0.06)",
  },

  // Header
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
    color: "rgba(255,255,255,0.42)",
    marginTop: 6,
    letterSpacing: 0.6,
  },

  // Glass Panel
  glassPanel: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 20,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
  panelHighlight: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },

  // Input
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

  // Analyze Button
  analyzeBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
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

  // Thumbnail
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
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
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
    color: "rgba(255,255,255,0.42)",
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
    backgroundColor: "rgba(59, 130, 246, 0.28)",
    borderColor: "rgba(147, 197, 253, 0.5)",
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
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginTop: 3,
  },
  formatChipSubActive: {
    color: "rgba(255,255,255,0.8)",
  },

  // Progress
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
    backgroundColor: "#3B82F6",
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
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
  },

  // Download Button
  downloadBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(37, 99, 235, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  downloadBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
