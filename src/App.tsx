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
} from "react-native";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule ? new NativeEventEmitter(PythonBridgeModule) : null;

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
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />
      <View style={styles.header}>
        <Text style={styles.brandTitle}>VITRE</Text>
        <Text style={styles.brandSubtitle}>Embedded Python yt-dlp Native Engine</Text>
      </View>

      {/* Input section */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Paste YouTube, TikTok, or Instagram link..."
          placeholderTextColor="#71717A"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.pasteButton} onPress={handlePaste} activeOpacity={0.7}>
          <Text style={styles.pasteButtonText}>Paste</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleFetch}
        disabled={loading || downloading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#09090B" />
        ) : (
          <Text style={styles.primaryButtonText}>Analyze Video</Text>
        )}
      </TouchableOpacity>

      {/* Media info card */}
      {mediaInfo && (
        <View style={styles.card}>
          {mediaInfo.thumbnail ? (
            <Image source={{ uri: mediaInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
          ) : null}

          <Text style={styles.cardTitle} numberOfLines={2}>
            {mediaInfo.title}
          </Text>
          <View style={styles.badgeRow}>
            <Text style={styles.platformBadge}>{mediaInfo.extractor.toUpperCase()}</Text>
          </View>

          {/* Formats list */}
          <Text style={styles.sectionHeader}>Select Quality & Format</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={mediaInfo.formats.slice(0, 8)}
            keyExtractor={(item) => item.format_id}
            renderItem={({ item }) => {
              const active = selectedFormat === item.format_id;
              const sizeLabel = formatFileSize(item.filesize);
              return (
                <TouchableOpacity
                  style={[styles.formatBadge, active && styles.formatBadgeActive]}
                  onPress={() => setSelectedFormat(item.format_id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.formatBadgeText, active && styles.formatBadgeTextActive]}>
                    {item.resolution} ({item.ext})
                  </Text>
                  {sizeLabel ? <Text style={styles.formatSizeText}>{sizeLabel}</Text> : null}
                </TouchableOpacity>
              );
            }}
          />

          {/* Download progress bar */}
          {downloading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress.percent}%` }]} />
              <Text style={styles.progressText}>
                {progress.percent}% • {(progress.speed / 1024 / 1024).toFixed(2)} MB/s
              </Text>
            </View>
          )}

          {/* Download button */}
          <TouchableOpacity
            style={[styles.downloadButton, downloading && styles.buttonDisabled]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            {downloading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.downloadButtonText}>Save Video to Storage</Text>
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
    backgroundColor: "#09090B",
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  header: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FAFAFA",
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#A1A1AA",
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    backgroundColor: "#18181B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    height: 48,
    color: "#FAFAFA",
    fontSize: 14,
  },
  pasteButton: {
    backgroundColor: "#27272A",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pasteButtonText: {
    color: "#E4E4E7",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#FAFAFA",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#09090B",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  card: {
    marginTop: 20,
    backgroundColor: "#18181B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 16,
  },
  thumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#27272A",
  },
  cardTitle: {
    color: "#FAFAFA",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  platformBadge: {
    backgroundColor: "#27272A",
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sectionHeader: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  formatBadge: {
    backgroundColor: "#27272A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#3F3F46",
    alignItems: "center",
  },
  formatBadgeActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#60A5FA",
  },
  formatBadgeText: {
    color: "#D4D4D8",
    fontSize: 12,
    fontWeight: "600",
  },
  formatBadgeTextActive: {
    color: "#FFFFFF",
  },
  formatSizeText: {
    color: "#9CA3AF",
    fontSize: 10,
    marginTop: 2,
  },
  progressContainer: {
    height: 24,
    backgroundColor: "#27272A",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
    justifyContent: "center",
  },
  progressBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#3B82F6",
  },
  progressText: {
    color: "#FAFAFA",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  downloadButton: {
    backgroundColor: "#2563EB",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
