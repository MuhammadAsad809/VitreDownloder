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
} from "react-native";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule ? new NativeEventEmitter(PythonBridgeModule) : null;

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
      const resultStr = await PythonBridgeModule.downloadMedia(url.trim(), selectedFormat);
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050508" />

      {/* Ambient background glow */}
      <View style={styles.ambientTop} />
      <View style={styles.ambientBottom} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>VITRE</Text>
        <Text style={styles.brandSubtitle}>On-device yt-dlp • Liquid Engine</Text>
      </View>

      {/* Glass Input */}
      <View style={styles.glassInputWrapper}>
        <TextInput
          style={styles.textInput}
          placeholder="Paste YouTube, TikTok or Instagram link..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.pasteButton} onPress={handlePaste} activeOpacity={0.7}>
          <Text style={styles.pasteButtonText}>Paste</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Glass Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (loading || downloading) && styles.buttonDisabled]}
        onPress={handleFetch}
        disabled={loading || downloading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Analyze Video</Text>
        )}
      </TouchableOpacity>

      {/* Media Glass Card */}
      {mediaInfo && (
        <View style={styles.glassCard}>
          {/* Inner highlight line */}
          <View style={styles.cardHighlight} />

          {mediaInfo.thumbnail ? (
            <Image source={{ uri: mediaInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
          ) : null}

          <Text style={styles.cardTitle} numberOfLines={2}>
            {mediaInfo.title}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.platformBadge}>
              <Text style={styles.platformBadgeText}>{mediaInfo.extractor.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Select Quality</Text>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={mediaInfo.formats.slice(0, 8)}
            keyExtractor={(item) => item.format_id}
            contentContainerStyle={{ paddingVertical: 4 }}
            renderItem={({ item }) => {
              const active = selectedFormat === item.format_id;
              const sizeLabel = formatFileSize(item.filesize);
              return (
                <TouchableOpacity
                  style={[styles.formatBadge, active && styles.formatBadgeActive]}
                  onPress={() => setSelectedFormat(item.format_id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.formatBadgeText, active && styles.formatBadgeTextActive]}>
                    {item.resolution} · {item.ext}
                  </Text>
                  {sizeLabel ? (
                    <Text style={[styles.formatSizeText, active && { color: "rgba(255,255,255,0.85)" }]}>
                      {sizeLabel}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />

          {/* Progress */}
          {downloading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${Math.min(progress.percent, 100)}%` }]} />
              <Text style={styles.progressText}>
                {progress.percent.toFixed(0)}%  •  {(progress.speed / 1024 / 1024).toFixed(2)} MB/s
              </Text>
            </View>
          )}

          {/* Download Button */}
          <TouchableOpacity
            style={[styles.downloadButton, downloading && styles.buttonDisabled]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.85}
          >
            {downloading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.downloadButtonText}>Save to Storage</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050508",
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  ambientTop: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  ambientBottom: {
    position: "absolute",
    bottom: -100,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(139, 92, 246, 0.09)",
  },
  header: {
    marginBottom: 28,
    marginTop: 8,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    marginTop: 6,
    letterSpacing: 0.5,
  },
  glassInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    height: 56,
    // soft shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  textInput: {
    flex: 1,
    height: 56,
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  pasteButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pasteButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 16,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(59, 130, 246, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  glassCard: {
    marginTop: 24,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    padding: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  cardHighlight: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  thumbnail: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 14,
    lineHeight: 24,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  platformBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  platformBadgeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  sectionHeader: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  formatBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    minWidth: 90,
  },
  formatBadgeActive: {
    backgroundColor: "rgba(59, 130, 246, 0.35)",
    borderColor: "rgba(147, 197, 253, 0.55)",
  },
  formatBadgeText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600",
  },
  formatBadgeTextActive: {
    color: "#FFFFFF",
  },
  formatSizeText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 3,
  },
  progressContainer: {
    height: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 18,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  progressBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(59, 130, 246, 0.7)",
    borderRadius: 14,
  },
  progressText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  downloadButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(37, 99, 235, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
