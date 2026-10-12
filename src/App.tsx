import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BlurView } from "@react-native-community/blur";
import LinearGradient from "react-native-linear-gradient";
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
  Animated,
  PanResponder,
  BackHandler,
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
  const [urlFocused, setUrlFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("best");
  const [activeCategory, setActiveCategory] = useState("Videos");
  const sheetTranslateY = useRef(new Animated.Value(700)).current;
  const sheetBackdropOpacity = sheetTranslateY.interpolate({
    inputRange: [0, 560],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const categoryItems = [
    { name: "Music", icon: "♫" },
    { name: "Videos", icon: "▶" },
    { name: "Photos", icon: "▧" },
    { name: "Downloads", icon: "↓" },
  ];
  const compactUrl = useMemo(
    () => (url.length > 28 ? `${url.slice(0, 16)}…${url.slice(-8)}` : url),
    [url]
  );
  const [progress, setProgress] = useState<{ percent: number; speed: number }>({
    percent: 0,
    speed: 0,
  });

  useEffect(() => {
    if (!mediaInfo) {
      sheetTranslateY.setValue(700);
      return;
    }
    sheetTranslateY.setValue(560);
    const animation = Animated.spring(sheetTranslateY, {
      toValue: 0,
      stiffness: 155,
      damping: 17,
      mass: 0.78,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [mediaInfo, sheetTranslateY]);

  useEffect(() => {
    const animation = Animated.timing(loadingProgress, {
      toValue: loading ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [loading, loadingProgress]);

  const dismissPreview = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 700,
      duration: 190,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMediaInfo(null);
    });
  }, [sheetTranslateY]);

  useEffect(() => {
    if (!mediaInfo) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        dismissPreview();
        return true;
      }
    );
    return () => subscription.remove();
  }, [mediaInfo, dismissPreview]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) sheetTranslateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 130 || gesture.vy > 1.15) {
            Animated.timing(sheetTranslateY, {
              toValue: 700,
              duration: 180,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) setMediaInfo(null);
            });
            return;
          }
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            stiffness: 190,
            damping: 15,
            mass: 0.75,
            useNativeDriver: true,
          }).start();
        },
      }),
    [sheetTranslateY]
  );

  const handleCategoryPress = (category: string) => {
    if (category === "Downloads") {
      Alert.alert(
        "Your downloads",
        "Saved media is stored in your device’s Downloads/Vitre folder."
      );
      return;
    }
    setActiveCategory(category);
    if (category === "Music") setSelectedFormat("audio");
    if (category === "Videos") setSelectedFormat("best");
    if (category === "Photos") setSelectedFormat("thumbnail");
  };

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
      setSelectedFormat(
        activeCategory === "Music"
          ? "audio"
          : activeCategory === "Photos"
          ? "thumbnail"
          : "best"
      );
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
          backgroundColor: "rgba(2, 7, 4, 0.48)",
          borderWidth: 1,
          borderColor: "rgba(211, 255, 227, 0.18)",
          borderTopColor: "rgba(242,255,247,0.52)",
        },
        style,
      ]}
    >
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="dark"
        blurAmount={24}
        overlayColor="rgba(1, 8, 4, 0.34)"
      />
      <View pointerEvents="none" style={styles.glassTint} />
      {children}
      <View pointerEvents="none" style={styles.glassSpecular}>
        <View style={styles.glassTopReflection} />
        <View style={styles.glassChromaticEdge} />
        <View style={styles.glassChromaticEdgeWarm} />
        <View style={styles.glassSideReflection} />
      </View>
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
      <StatusBar barStyle="light-content" backgroundColor="#020503" />
      <LinearGradient
        colors={["#020403", "#04170C", "#061F10", "#020604"]}
        locations={[0, 0.38, 0.67, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LiquidGlassProvider style={StyleSheet.absoluteFill}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.glassHeader} interactive>
            <View style={styles.headerTitleRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>V</Text>
              </View>
              <View style={styles.brandCopy}>
                <View style={styles.brandNameRow}>
                  <Text style={styles.brandTitle}>Vitre</Text>
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>HD</Text>
                  </View>
                </View>
                <Text style={styles.brandSubtitle}>A little more clarity.</Text>
              </View>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>READY</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Save what moves you.</Text>
            <Text style={styles.heroSubtitle}>
              Video, audio, and moments worth keeping — all in one place.
            </Text>
          </GlassCard>

          <View style={styles.categoryHeader}>
            <Text style={styles.categoryHeading}>Explore</Text>
            <Text style={styles.categoryHint}>Choose your format</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroller}
            contentContainerStyle={styles.categoryRow}
          >
            {categoryItems.map((category) => {
              const active = activeCategory === category.name;
              return (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                  ]}
                  onPress={() => handleCategoryPress(category.name)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <BlurView
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    blurType="dark"
                    blurAmount={16}
                    overlayColor="rgba(0, 8, 3, 0.28)"
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      styles.categoryChipTint,
                      active && styles.categoryChipTintActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.categoryIcon,
                      active && styles.categoryIconActive,
                    ]}
                  >
                    {category.icon}
                  </Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      active && styles.categoryLabelActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <GlassCard style={styles.glassInputCard}>
            <View style={styles.urlField}>
              <TextInput
                style={[
                  styles.textInput,
                  url.length > 0 && !urlFocused && styles.textInputHidden,
                ]}
                placeholder="Paste a link to get started"
                placeholderTextColor="#AAB6AE"
                value={url}
                onChangeText={setUrl}
                onFocus={() => setUrlFocused(true)}
                onBlur={() => setUrlFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor="#76F0A7"
              />
              {url.length > 0 && !urlFocused && (
                <View pointerEvents="none" style={styles.urlPreviewOverlay}>
                  <Text style={styles.urlPreview} numberOfLines={1}>
                    {compactUrl}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.glassPasteButton}
              onPress={handlePaste}
              activeOpacity={0.7}
            >
              <Text style={styles.glassPasteText}>Paste</Text>
            </TouchableOpacity>
          </GlassCard>

          <TouchableOpacity
            style={[styles.glassPrimaryButton, loading && styles.loadingCapsule]}
            onPress={handleFetch}
            disabled={loading || downloading}
            activeOpacity={0.8}
          >
            <BlurView
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              blurType="dark"
              blurAmount={18}
              overlayColor="rgba(0, 8, 3, 0.38)"
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                styles.loadingCapsuleOverlay,
                { opacity: loadingProgress },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.loadingCapsuleContent,
                { opacity: loadingProgress },
              ]}
            >
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.loadingCapsuleText}>Finding your media</Text>
            </Animated.View>
            <Animated.Text
              style={[
                styles.glassPrimaryButtonText,
                {
                  opacity: loadingProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
            >
              Find your media
            </Animated.Text>
          </TouchableOpacity>

        </ScrollView>
      </LiquidGlassProvider>
      {mediaInfo && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.previewBackdrop,
            { opacity: sheetBackdropOpacity },
          ]}
        >
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="dark"
              blurAmount={18}
              overlayColor="rgba(0, 5, 2, 0.78)"
            />
            <View style={styles.previewAuraGreen} pointerEvents="none" />
            <View style={styles.previewAuraMint} pointerEvents="none" />
            <Animated.View
              style={[
                styles.previewSheet,
                { transform: [{ translateY: sheetTranslateY }] },
              ]}
            >
              <BlurView
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                blurType="dark"
                blurAmount={28}
                overlayColor="rgba(1, 8, 4, 0.46)"
              />
              <View pointerEvents="none" style={styles.previewSheetTint} />
              <View
                style={styles.sheetDragArea}
                {...sheetPanResponder.panHandlers}
              >
                <View style={styles.sheetGrabber} />
              </View>
              <View style={styles.previewToolbar}>
                <View>
                  <Text style={styles.previewEyebrow}>MEDIA FOUND</Text>
                  <Text style={styles.previewHeading}>Your video</Text>
                </View>
                <TouchableOpacity
                  style={styles.previewCloseButton}
                  onPress={dismissPreview}
                  accessibilityRole="button"
                  accessibilityLabel="Close media preview"
                >
                  <Text style={styles.previewCloseText}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.previewScroll}
                contentContainerStyle={styles.previewScrollContent}
                showsVerticalScrollIndicator={false}
              >
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
              </ScrollView>
            </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020403",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 44,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1, 12, 6, 0.26)",
  },
  glassHeader: {
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(2, 8, 4, 0.48)",
    borderColor: "rgba(205, 255, 223, 0.19)",
    borderTopColor: "rgba(245,255,248,0.56)",
    shadowColor: "#00D778",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 8, 4, 0.56)",
    borderWidth: 1,
    borderColor: "rgba(221,255,234,0.24)",
    borderTopColor: "rgba(255,255,255,0.58)",
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
  brandCopy: {
    marginLeft: 11,
    flex: 1,
  },
  brandNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FAFAFA",
    letterSpacing: 0.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(0, 8, 4, 0.50)",
    borderWidth: 1,
    borderColor: "rgba(193,255,217,0.24)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6EE7B7",
    marginRight: 6,
  },
  statusText: {
    color: "#E9FFF1",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  categoryHeading: {
    color: "rgba(246,249,255,0.94)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  categoryHint: {
    color: "#B3C2B8",
    fontSize: 11,
  },
  categoryScroller: {
    flexGrow: 0,
    marginHorizontal: -20,
    marginBottom: 20,
  },
  categoryRow: {
    paddingHorizontal: 20,
    paddingVertical: 3,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    height: 43,
    borderRadius: 23,
    marginRight: 9,
    backgroundColor: "rgba(1, 7, 4, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(226, 255, 237, 0.18)",
    borderTopColor: "rgba(248,255,250,0.44)",
    shadowColor: "#00C76B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 9,
    elevation: 3,
    overflow: "hidden",
  },
  categoryChipActive: {
    backgroundColor: "rgba(15, 112, 57, 0.38)",
    borderColor: "rgba(111, 255, 166, 0.62)",
    borderTopColor: "rgba(224,255,233,0.78)",
  },
  categoryChipTint: {
    backgroundColor: "rgba(1, 10, 5, 0.34)",
  },
  categoryChipTintActive: {
    backgroundColor: "rgba(22, 132, 68, 0.22)",
  },
  categoryIcon: {
    color: "#D9E6DE",
    fontSize: 16,
    marginRight: 8,
    fontWeight: "700",
  },
  categoryIconActive: {
    color: "#FFFFFF",
  },
  categoryLabel: {
    color: "#E1EAE4",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 28,
  },
  heroSubtitle: {
    color: "#C1CCC4",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  proBadge: {
    marginLeft: 10,
    backgroundColor: "rgba(8, 60, 31, 0.56)",
    borderWidth: 1,
    borderColor: "rgba(90, 236, 140, 0.56)",
    borderTopColor: "rgba(209,255,222,0.74)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proBadgeText: {
    color: "#A4FFC1",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#B5C1B9",
    marginTop: 2,
    lineHeight: 16,
  },
  glassInputCard: {
    flexDirection: "row",
    borderRadius: 20,
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
    height: 58,
    backgroundColor: "rgba(1, 7, 4, 0.54)",
    borderColor: "rgba(218, 255, 231, 0.19)",
    borderTopColor: "rgba(250,255,251,0.56)",
    shadowColor: "#00CA70",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  urlField: {
    flex: 1,
    height: 50,
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    height: 50,
    color: "#F5FAF6",
    fontSize: 15,
    paddingVertical: 0,
  },
  textInputHidden: {
    color: "transparent",
  },
  urlPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  urlPreview: {
    color: "#F5FAF6",
    fontSize: 14,
    includeFontPadding: false,
  },
  glassPasteButton: {
    backgroundColor: "rgba(2, 10, 5, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(221,255,235,0.22)",
    borderTopColor: "rgba(250,255,251,0.60)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  glassPasteText: {
    color: "#F3FAF5",
    fontSize: 12,
    fontWeight: "700",
  },
  glassPrimaryButton: {
    backgroundColor: "rgba(1, 8, 4, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(224,255,235,0.43)",
    borderTopColor: "rgba(255,255,255,0.78)",
    shadowColor: "#00D778",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 8,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  glassPrimaryButtonText: {
    color: "#F5FFF8",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  loadingCapsule: {
    backgroundColor: "rgba(6, 58, 29, 0.62)",
    borderColor: "rgba(148,255,185,0.62)",
    borderTopColor: "rgba(255,255,255,0.82)",
  },
  loadingCapsuleOverlay: {
    backgroundColor: "rgba(4, 42, 19, 0.58)",
  },
  loadingCapsuleContent: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCapsuleText: {
    color: "#FFFFFF",
    marginLeft: 11,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.15,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  previewBackdrop: {
    flex: 1,
    zIndex: 1000,
    elevation: 30,
    backgroundColor: "rgba(0, 4, 2, 0.78)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  previewSheet: {
    width: "100%",
    maxHeight: "90%",
    borderRadius: 30,
    padding: 14,
    backgroundColor: "rgba(1, 7, 4, 0.48)",
    borderWidth: 1,
    borderColor: "rgba(207,255,224,0.24)",
    borderTopColor: "rgba(250,255,251,0.72)",
    shadowColor: "#00D778",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.30,
    shadowRadius: 32,
    elevation: 20,
    overflow: "hidden",
  },
  previewAuraGreen: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: "16%",
    right: -130,
    backgroundColor: "rgba(0, 200, 96, 0.14)",
  },
  previewAuraMint: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: "12%",
    left: -130,
    backgroundColor: "rgba(76, 255, 141, 0.08)",
  },
  previewSheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 14, 6, 0.18)",
  },
  sheetDragArea: {
    height: 34,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  sheetGrabber: {
    width: 39,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
    marginTop: 3,
  },
  previewToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 12,
  },
  previewEyebrow: {
    color: "#87F3AE",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  previewHeading: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
  },
  previewCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  previewCloseText: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 29,
    fontWeight: "300",
  },
  previewScroll: {
    flexShrink: 1,
  },
  previewScrollContent: {
    paddingBottom: 4,
  },
  glassSpecular: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  glassTopReflection: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.70)",
  },
  glassChromaticEdge: {
    position: "absolute",
    top: 1,
    left: 20,
    width: "34%",
    height: 1,
    backgroundColor: "rgba(106, 255, 157, 0.78)",
  },
  glassChromaticEdgeWarm: {
    position: "absolute",
    top: 2,
    left: "54%",
    width: "22%",
    height: 1,
    backgroundColor: "rgba(222, 255, 234, 0.46)",
  },
  glassSideReflection: {
    position: "absolute",
    top: 14,
    right: 0,
    width: 1,
    bottom: 14,
    backgroundColor: "rgba(105,255,158,0.22)",
  },
  glassMediaCard: {
    borderRadius: 26,
    padding: 16,
    marginBottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(2, 8, 4, 0.48)",
    borderColor: "rgba(205, 255, 223, 0.19)",
    borderTopColor: "rgba(245,255,248,0.56)",
    shadowColor: "#00D778",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
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
    backgroundColor: "rgba(1, 5, 3, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(235,255,241,0.24)",
    borderTopColor: "rgba(255,255,255,0.60)",
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
    backgroundColor: "rgba(5, 65, 29, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(119,255,164,0.62)",
    borderTopColor: "rgba(244,255,248,0.86)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  platformBadgeText: {
    color: "#C7FFD8",
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
    color: "#F0F7F2",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sectionHeaderSub: {
    color: "#C0CCC4",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
  },
  presetsList: {
    paddingRight: 8,
  },
  glassChip: {
    backgroundColor: "rgba(3, 12, 6, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(224,255,235,0.18)",
    borderTopColor: "rgba(250,255,251,0.48)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    alignItems: "center",
    minWidth: 78,
  },
  glassChipActive: {
    backgroundColor: "rgba(12, 103, 48, 0.38)",
    borderColor: "rgba(131,255,172,0.68)",
    borderTopColor: "rgba(250,255,251,0.86)",
  },
  glassChipIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  glassChipLabel: {
    color: "#F0F7F2",
    fontSize: 13,
    fontWeight: "700",
  },
  glassChipLabelActive: {
    color: "#FFFFFF",
  },
  glassChipSub: {
    color: "#BBC8BF",
    fontSize: 10,
    marginTop: 2,
  },
  glassChipSubActive: {
    color: "#B9FFD0",
  },
  streamsList: {
    paddingRight: 8,
  },
  glassStreamBadge: {
    backgroundColor: "rgba(3, 12, 6, 0.56)",
    borderWidth: 1,
    borderColor: "rgba(224,255,235,0.16)",
    borderTopColor: "rgba(250,255,251,0.44)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  glassStreamBadgeActive: {
    backgroundColor: "rgba(12, 103, 48, 0.34)",
    borderColor: "rgba(131,255,172,0.62)",
    borderTopColor: "rgba(250,255,251,0.84)",
  },
  glassStreamText: {
    color: "#EAF2EC",
    fontSize: 12,
    fontWeight: "600",
  },
  glassStreamTextActive: {
    color: "#FFFFFF",
  },
  glassStreamSize: {
    color: "#BBC8BF",
    fontSize: 10,
    marginTop: 2,
  },
  glassProgressTrack: {
    height: 28,
    backgroundColor: "rgba(4, 14, 7, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(224,255,235,0.17)",
    borderTopColor: "rgba(250,255,251,0.44)",
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
    backgroundColor: "rgba(33, 210, 112, 0.62)",
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
    backgroundColor: "rgba(5, 57, 27, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(132,255,175,0.66)",
    borderTopColor: "rgba(255,255,255,0.86)",
    shadowColor: "#00D778",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 7,
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
