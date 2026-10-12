import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BlurView } from "@react-native-community/blur";
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
          backgroundColor: "rgba(192, 211, 255, 0.085)",
          borderWidth: 1,
          borderColor: "rgba(226, 236, 255, 0.20)",
          borderTopColor: "rgba(255,255,255,0.52)",
        },
        style,
      ]}
    >
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="dark"
        blurAmount={24}
        overlayColor="rgba(106, 137, 190, 0.10)"
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
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />
      <View style={styles.ambientOrbTop} pointerEvents="none" />
      <View style={styles.ambientOrbCenter} pointerEvents="none" />
      <View style={styles.ambientOrbBottom} pointerEvents="none" />
      <View style={styles.ambientHighlight} pointerEvents="none" />

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
                    overlayColor="rgba(91, 120, 178, 0.08)"
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
            <TextInput
              style={styles.textInput}
              placeholder="Paste a link to get started"
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
              overlayColor="rgba(110, 146, 210, 0.22)"
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
              Find your media  →
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
              overlayColor="rgba(6, 9, 18, 0.72)"
            />
            <View style={styles.previewAuraBlue} pointerEvents="none" />
            <View style={styles.previewAuraViolet} pointerEvents="none" />
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
                overlayColor="rgba(22, 31, 52, 0.34)"
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
    backgroundColor: "#080B12",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 44,
  },
  ambientOrbTop: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(72, 121, 255, 0.20)",
  },
  ambientOrbCenter: {
    position: "absolute",
    top: 260,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(142, 91, 255, 0.13)",
  },
  ambientOrbBottom: {
    position: "absolute",
    bottom: 40,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(16, 185, 129, 0.10)",
  },
  ambientHighlight: {
    position: "absolute",
    top: 170,
    right: -100,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(56, 189, 248, 0.07)",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(134, 169, 235, 0.075)",
  },
  glassHeader: {
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(165, 196, 255, 0.10)",
    borderColor: "rgba(222, 235, 255, 0.22)",
    borderTopColor: "rgba(255,255,255,0.58)",
    shadowColor: "#8AB4FF",
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
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderTopColor: "rgba(255,255,255,0.48)",
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
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6EE7B7",
    marginRight: 6,
  },
  statusText: {
    color: "#D1FAE5",
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
    color: "rgba(208,220,245,0.52)",
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
    backgroundColor: "rgba(220, 232, 255, 0.075)",
    borderWidth: 1,
    borderColor: "rgba(235, 243, 255, 0.17)",
    borderTopColor: "rgba(255,255,255,0.38)",
    shadowColor: "#88AFFF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 9,
    elevation: 3,
    overflow: "hidden",
  },
  categoryChipActive: {
    backgroundColor: "rgba(124, 164, 255, 0.25)",
    borderColor: "rgba(195, 219, 255, 0.64)",
    borderTopColor: "rgba(255,255,255,0.82)",
  },
  categoryChipTint: {
    backgroundColor: "rgba(173, 201, 255, 0.06)",
  },
  categoryChipTintActive: {
    backgroundColor: "rgba(115, 158, 255, 0.20)",
  },
  categoryIcon: {
    color: "rgba(226,236,255,0.72)",
    fontSize: 16,
    marginRight: 8,
    fontWeight: "700",
  },
  categoryIconActive: {
    color: "#FFFFFF",
  },
  categoryLabel: {
    color: "rgba(229,237,252,0.72)",
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
    color: "rgba(230,237,249,0.70)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
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
    backgroundColor: "rgba(178, 205, 255, 0.10)",
    borderColor: "rgba(227, 237, 255, 0.23)",
    borderTopColor: "rgba(255,255,255,0.58)",
    shadowColor: "#88AFFF",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  textInput: {
    flex: 1,
    height: 50,
    color: "#FAFAFA",
    fontSize: 14,
  },
  glassPasteButton: {
    backgroundColor: "rgba(224, 234, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderTopColor: "rgba(255,255,255,0.58)",
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
    backgroundColor: "rgba(174, 204, 255, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.74)",
    borderTopColor: "#FFFFFF",
    shadowColor: "#A9C9FF",
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
    color: "#F7FAFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  loadingCapsule: {
    backgroundColor: "rgba(112, 154, 241, 0.36)",
    borderColor: "rgba(211,228,255,0.78)",
    borderTopColor: "#FFFFFF",
  },
  loadingCapsuleOverlay: {
    backgroundColor: "rgba(67, 109, 203, 0.52)",
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
    backgroundColor: "rgba(3, 6, 14, 0.70)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  previewSheet: {
    width: "100%",
    maxHeight: "90%",
    borderRadius: 30,
    padding: 14,
    backgroundColor: "rgba(22, 31, 52, 0.42)",
    borderWidth: 1,
    borderColor: "rgba(225, 237, 255, 0.27)",
    borderTopColor: "rgba(255,255,255,0.70)",
    shadowColor: "#789BFF",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.30,
    shadowRadius: 32,
    elevation: 20,
    overflow: "hidden",
  },
  previewAuraBlue: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: "16%",
    right: -130,
    backgroundColor: "rgba(82, 141, 255, 0.19)",
  },
  previewAuraViolet: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: "12%",
    left: -130,
    backgroundColor: "rgba(155, 103, 255, 0.14)",
  },
  previewSheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(119, 153, 219, 0.08)",
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
    color: "#9FB9F8",
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
    backgroundColor: "rgba(164, 207, 255, 0.82)",
  },
  glassChromaticEdgeWarm: {
    position: "absolute",
    top: 2,
    left: "54%",
    width: "22%",
    height: 1,
    backgroundColor: "rgba(255, 182, 211, 0.52)",
  },
  glassSideReflection: {
    position: "absolute",
    top: 14,
    right: 0,
    width: 1,
    bottom: 14,
    backgroundColor: "rgba(206,225,255,0.20)",
  },
  glassMediaCard: {
    borderRadius: 26,
    padding: 16,
    marginBottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(165, 196, 255, 0.10)",
    borderColor: "rgba(222, 235, 255, 0.22)",
    borderTopColor: "rgba(255,255,255,0.58)",
    shadowColor: "#8AB4FF",
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
    backgroundColor: "rgba(11, 18, 34, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
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
    backgroundColor: "rgba(95, 156, 255, 0.32)",
    borderWidth: 1,
    borderColor: "rgba(170,205,255,0.65)",
    borderTopColor: "rgba(255,255,255,0.85)",
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
    backgroundColor: "rgba(207, 224, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(238, 245, 255, 0.21)",
    borderTopColor: "rgba(255,255,255,0.46)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    alignItems: "center",
    minWidth: 78,
  },
  glassChipActive: {
    backgroundColor: "rgba(112, 166, 255, 0.27)",
    borderColor: "rgba(185, 214, 255, 0.70)",
    borderTopColor: "rgba(255,255,255,0.86)",
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
    backgroundColor: "rgba(207, 224, 255, 0.085)",
    borderWidth: 1,
    borderColor: "rgba(238, 245, 255, 0.18)",
    borderTopColor: "rgba(255,255,255,0.42)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  glassStreamBadgeActive: {
    backgroundColor: "rgba(112, 166, 255, 0.24)",
    borderColor: "rgba(185, 214, 255, 0.65)",
    borderTopColor: "rgba(255,255,255,0.78)",
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
    backgroundColor: "rgba(217, 231, 255, 0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.17)",
    borderTopColor: "rgba(255,255,255,0.40)",
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
    backgroundColor: "rgba(122, 169, 255, 0.58)",
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
    backgroundColor: "rgba(87, 138, 255, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(191, 216, 255, 0.72)",
    borderTopColor: "rgba(255, 255, 255, 0.90)",
    shadowColor: "#6EA2FF",
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
