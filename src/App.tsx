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
  const [activeScreen, setActiveScreen] = useState<"Home" | "Downloads" | "Settings">("Home");
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoAudio, setAutoAudio] = useState(false);
  const [organize, setOrganize] = useState(true);
  const [askDestination, setAskDestination] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [glassFrost, setGlassFrost] = useState("Balanced");
  const [recentDownloads, setRecentDownloads] = useState<Array<{title:string;format:string}>>([]);
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
      setActiveScreen("Downloads");
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
      setRecentDownloads((items) => [{title: mediaInfo?.title || "Downloaded media", format: selectedFormat.toUpperCase()}, ...items].slice(0, 12));
      Alert.alert("Download Completed", `Saved to:\n${res.filePath || "Downloads/Vitre/"}`);
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
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <LinearGradient
        colors={["#000000", "#030303", "#070707", "#000000"]}
        locations={[0, 0.38, 0.67, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LiquidGlassProvider style={StyleSheet.absoluteFill}>
        {activeScreen === "Home" ? (
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
                selectionColor="#FFFFFF"
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
        ) : activeScreen === "Downloads" ? (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            <View style={styles.screenHeader}><Text style={styles.screenTitle}>Your Downloads</Text><Text style={styles.screenSubtitle}>{downloading ? "1 active" : "No active downloads"}  •  {recentDownloads.length} completed</Text></View>
            <View style={styles.filterRow}><View style={[styles.filterChip,styles.filterChipActive]}><Text style={styles.filterTextActive}>All</Text></View><View style={styles.filterChip}><Text style={styles.filterText}>Downloading</Text></View><View style={styles.filterChip}><Text style={styles.filterText}>Completed</Text></View></View>
            {downloading ? <View style={styles.glassPanel}><Text style={styles.eyebrow}>IN PROGRESS</Text><Text style={styles.itemTitle}>{mediaInfo?.title || "Media download"}</Text><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${Math.min(100,progress.percent)}%`}]} /></View><View style={styles.progressMeta}><Text style={styles.mutedText}>{progress.percent}% complete</Text><Text style={styles.mutedText}>{(progress.speed/1024/1024).toFixed(2)} MB/s</Text></View></View> : null}
            <Text style={styles.sectionLabel}>RECENTLY COMPLETED</Text>
            {recentDownloads.length ? recentDownloads.map((item,index)=><View key={item.title+index} style={styles.downloadRow}><View style={styles.fileIcon}><Text style={styles.fileIconText}>{item.format==="AUDIO"?"♫":"▶"}</Text></View><View style={styles.downloadCopy}><Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.mutedText}>{item.format}  •  Completed</Text></View><Text style={styles.checkMark}>✓</Text></View>) : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>↓</Text><Text style={styles.itemTitle}>No completed downloads yet</Text><Text style={styles.mutedText}>Your downloaded media will appear here.</Text><TouchableOpacity style={styles.secondaryButton} onPress={()=>setActiveScreen("Home")}><Text style={styles.secondaryButtonText}>Find media</Text></TouchableOpacity></View>}
            <View style={styles.noteCard}><Text style={styles.mutedText}>Files are saved to your device’s Downloads/Vitre folder.</Text></View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            <View style={styles.screenHeader}><Text style={styles.screenTitle}>Settings</Text><Text style={styles.screenSubtitle}>Preferences &amp; Storage</Text></View>
            <View style={styles.storageCard}><Text style={styles.eyebrow}>STORAGE</Text><Text style={styles.storageNumber}>Downloads / Vitre</Text><Text style={styles.mutedText}>Files are saved to your device storage.</Text><View style={styles.storageTrack}><View style={styles.storageFill}/></View><TouchableOpacity onPress={()=>Alert.alert("Clear cache","Vitre does not currently maintain a separate cache to clear.")}><Text style={styles.actionText}>Clear cache</Text></TouchableOpacity></View>
            <Text style={styles.sectionLabel}>DOWNLOAD PREFERENCES</Text>
            <View style={styles.settingsGroup}>
              <TouchableOpacity style={styles.settingRow} onPress={()=>Alert.alert("Default Quality","Choose a quality from the media preview after fetching a link.")}><View style={styles.settingIcon}><Text style={styles.settingIconText}>HD</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Default Quality</Text><Text style={styles.mutedText}>Choose quality in media preview</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>Wi</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Download Over Wi-Fi Only</Text><Text style={styles.mutedText}>Preference only; enforcement not connected</Text></View><TouchableOpacity onPress={()=>setWifiOnly(!wifiOnly)} style={[styles.toggle,wifiOnly&&styles.toggleOn]}><View style={[styles.toggleKnob,wifiOnly&&styles.toggleKnobOn]}/></TouchableOpacity></View>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>×{maxConcurrent}</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Max Concurrent Downloads</Text><Text style={styles.mutedText}>Queue limit preference</Text></View><View style={styles.stepper}><TouchableOpacity onPress={()=>setMaxConcurrent(n=>Math.max(1,n-1))}><Text style={styles.stepperText}>−</Text></TouchableOpacity><Text style={styles.stepperValue}>{maxConcurrent}</Text><TouchableOpacity onPress={()=>setMaxConcurrent(n=>Math.min(5,n+1))}><Text style={styles.stepperText}>+</Text></TouchableOpacity></View></View>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>♫</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Auto-extract Audio</Text><Text style={styles.mutedText}>Select the audio preset</Text></View><TouchableOpacity onPress={()=>{setAutoAudio(!autoAudio);if(!autoAudio)setSelectedFormat("audio")}} style={[styles.toggle,autoAudio&&styles.toggleOn]}><View style={[styles.toggleKnob,autoAudio&&styles.toggleKnobOn]}/></TouchableOpacity></View>
            </View>
            <Text style={styles.sectionLabel}>STORAGE &amp; LOCATION</Text>
            <View style={styles.settingsGroup}>
              <TouchableOpacity style={styles.settingRow} onPress={()=>Alert.alert("Save Directory","Current location: Downloads/Vitre. Custom folder selection is not yet connected.")}><View style={styles.settingIcon}><Text style={styles.settingIconText}>▣</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Save Directory</Text><Text style={styles.mutedText}>/Download/Vitre</Text></View><Text style={styles.actionText}>View</Text></TouchableOpacity>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>▤</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Organize by Media Type</Text><Text style={styles.mutedText}>Preference; folder routing not connected</Text></View><TouchableOpacity onPress={()=>setOrganize(!organize)} style={[styles.toggle,organize&&styles.toggleOn]}><View style={[styles.toggleKnob,organize&&styles.toggleKnobOn]}/></TouchableOpacity></View>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>↗</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Ask Destination</Text><Text style={styles.mutedText}>Prompt for folder per download</Text></View><TouchableOpacity onPress={()=>setAskDestination(!askDestination)} style={[styles.toggle,askDestination&&styles.toggleOn]}><View style={[styles.toggleKnob,askDestination&&styles.toggleKnobOn]}/></TouchableOpacity></View>
            </View>
            <Text style={styles.sectionLabel}>APPEARANCE &amp; SYSTEM</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>◐</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Theme</Text><Text style={styles.mutedText}>Pure Black OLED</Text></View><Text style={styles.activeLabel}>ACTIVE</Text></View>
              <View style={styles.frostBlock}><Text style={styles.settingTitle}>Glass Frost Intensity</Text><Text style={styles.mutedText}>Liquid glass surface contrast</Text><View style={styles.frostRow}>{["Minimal","Balanced","Extreme"].map(v=><TouchableOpacity key={v} onPress={()=>setGlassFrost(v)} style={[styles.frostChip,glassFrost===v&&styles.frostChipActive]}><Text style={glassFrost===v?styles.filterTextActive:styles.filterText}>{v}</Text></TouchableOpacity>)}</View></View>
              <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>⌁</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Haptic Feedback</Text><Text style={styles.mutedText}>Tactile feedback preference</Text></View><TouchableOpacity onPress={()=>setHaptics(!haptics)} style={[styles.toggle,haptics&&styles.toggleOn]}><View style={[styles.toggleKnob,haptics&&styles.toggleKnobOn]}/></TouchableOpacity></View>
              <TouchableOpacity style={styles.settingRow} onPress={()=>Alert.alert("Notifications","Download notifications are managed by Android.")}><View style={styles.settingIcon}><Text style={styles.settingIconText}>◉</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Notifications</Text><Text style={styles.mutedText}>Download progress notifications</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
            </View>
            <Text style={styles.sectionLabel}>ABOUT VITRE</Text>
            <View style={styles.settingsGroup}><View style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.settingTitle}>Version</Text><Text style={styles.mutedText}>Vitre Downloader • Android</Text></View><Text style={styles.stableBadge}>STABLE</Text></View><View style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.settingTitle}>Network Engine</Text><Text style={styles.mutedText}>yt-dlp • on-device Python bridge</Text></View><Text style={styles.mutedText}>LOCAL</Text></View><TouchableOpacity style={styles.settingRow} onPress={()=>Alert.alert("Vitre","Privacy policy and open-source notices can be added here.")}><Text style={styles.settingTitle}>Privacy Policy &amp; Open Source Licenses</Text><Text style={styles.chevron}>↗</Text></TouchableOpacity></View>
          </ScrollView>
        )}
      </LiquidGlassProvider>
      <View style={styles.bottomNav}>
        {(["Home","Downloads","Settings"] as const).map(screen=><TouchableOpacity key={screen} onPress={()=>setActiveScreen(screen)} style={[styles.navItem,activeScreen===screen&&styles.navItemActive]}><Text style={[styles.navIcon,activeScreen===screen&&styles.navIconActive]}>{screen==="Home"?"⌂":screen==="Downloads"?"↓":"⚙"}</Text><Text style={[styles.navLabel,activeScreen===screen&&styles.navLabelActive]}>{screen}</Text></TouchableOpacity>)}
      </View>
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
    backgroundColor: "#000000",
  },
  screenContent: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 120 },
  screenHeader: { marginBottom: 24 },
  screenTitle: { color: "#FFFFFF", fontSize: 32, fontWeight: "700", letterSpacing: -0.8 },
  screenSubtitle: { color: "#999999", fontSize: 13, marginTop: 5 },
  glassPanel: { backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderTopColor: "rgba(255,255,255,0.28)", borderRadius: 24, padding: 16, marginBottom: 22 },
  storageCard: { backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderTopColor: "rgba(255,255,255,0.28)", borderRadius: 24, padding: 16, marginBottom: 28 },
  eyebrow: { color: "#888888", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 },
  storageNumber: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginVertical: 10 },
  storageTrack: { height: 6, borderRadius: 4, backgroundColor: "#292929", overflow: "hidden", marginVertical: 14 },
  storageFill: { height: "100%", width: "28%", backgroundColor: "#E6E6E6", borderRadius: 4 },
  actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.035)" },
  filterChipActive: { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.32)" },
  filterText: { color: "#999999", fontSize: 11, fontWeight: "600" },
  filterTextActive: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  sectionLabel: { color: "#888888", fontSize: 10, fontWeight: "700", letterSpacing: 1.6, marginBottom: 12, marginTop: 4, paddingHorizontal: 3 },
  itemTitle: { color: "#F5F5F5", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  mutedText: { color: "#929292", fontSize: 11, lineHeight: 17 },
  progressTrack: { height: 5, backgroundColor: "#2A2A2A", borderRadius: 4, overflow: "hidden", marginTop: 18 },
  progressFill: { height: "100%", backgroundColor: "#E8E8E8", borderRadius: 4 },
  progressMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 9 },
  downloadRow: { flexDirection: "row", alignItems: "center", padding: 13, marginBottom: 9, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  fileIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#171717", borderWidth: 1, borderColor: "#333333", alignItems: "center", justifyContent: "center", marginRight: 12 },
  fileIconText: { color: "#FFFFFF", fontSize: 17 },
  downloadCopy: { flex: 1, gap: 4 },
  checkMark: { color: "#FFFFFF", fontSize: 18, marginLeft: 8 },
  emptyCard: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 34, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.025)" },
  emptyIcon: { color: "#D8D8D8", fontSize: 30, marginBottom: 12 },
  secondaryButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(255,255,255,0.08)" },
  secondaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  noteCard: { padding: 14, marginTop: 18, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.025)" },
  settingsGroup: { borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.035)", marginBottom: 27 },
  settingRow: { minHeight: 70, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.09)", gap: 11 },
  settingIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#171717", borderWidth: 1, borderColor: "#333333", alignItems: "center", justifyContent: "center" },
  settingIconText: { color: "#E5E5E5", fontSize: 11, fontWeight: "700" },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: "#F5F5F5", fontSize: 13, fontWeight: "600" },
  chevron: { color: "#8C8C8C", fontSize: 23 },
  toggle: { width: 42, height: 24, borderRadius: 13, padding: 3, backgroundColor: "#262626", borderWidth: 1, borderColor: "#444444", justifyContent: "center", alignItems: "flex-start" },
  toggleOn: { backgroundColor: "#DADADA", borderColor: "#F0F0F0", alignItems: "flex-end" },
  toggleKnob: { width: 16, height: 16, borderRadius: 9, backgroundColor: "#8C8C8C" },
  toggleKnobOn: { backgroundColor: "#111111" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 16, backgroundColor: "#171717", borderWidth: 1, borderColor: "#383838" },
  stepperText: { color: "#FFFFFF", fontSize: 18 },
  stepperValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  frostBlock: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.09)" },
  frostRow: { flexDirection: "row", gap: 7, marginTop: 14 },
  frostChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.025)" },
  frostChipActive: { backgroundColor: "rgba(255,255,255,0.13)", borderColor: "rgba(255,255,255,0.35)" },
  activeLabel: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  stableBadge: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "#242424", borderWidth: 1, borderColor: "#454545" },
  bottomNav: { position: "absolute", left: 12, right: 12, bottom: 8, minHeight: 68, borderRadius: 25, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: "rgba(12,12,12,0.96)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderTopColor: "rgba(255,255,255,0.25)", elevation: 18 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 5, borderRadius: 18, gap: 2 },
  navItemActive: { backgroundColor: "rgba(255,255,255,0.11)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  navIcon: { color: "#858585", fontSize: 19 },
  navIconActive: { color: "#FFFFFF" },
  navLabel: { color: "#858585", fontSize: 10, fontWeight: "600" },
  navLabelActive: { color: "#FFFFFF", fontWeight: "700" },

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
    backgroundColor: "rgba(10,10,10,0.72)",
    borderColor: "rgba(205, 255, 223, 0.19)",
    borderTopColor: "rgba(245,255,248,0.56)",
    shadowColor: "#FFFFFF",
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
    backgroundColor: "#D5D5D5",
    marginRight: 6,
  },
  statusText: {
    color: "#F4F4F4",
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
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 9,
    elevation: 3,
    overflow: "hidden",
  },
  categoryChipActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
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
    color: "#D9D9D9",
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(90, 236, 140, 0.56)",
    borderTopColor: "rgba(209,255,222,0.74)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proBadgeText: {
    color: "#E6E6E6",
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
    backgroundColor: "rgba(8,8,8,0.82)",
    borderColor: "rgba(218, 255, 231, 0.19)",
    borderTopColor: "rgba(250,255,251,0.56)",
    shadowColor: "#FFFFFF",
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
    shadowColor: "#FFFFFF",
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
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(148,255,185,0.62)",
    borderTopColor: "rgba(255,255,255,0.82)",
  },
  loadingCapsuleOverlay: {
    backgroundColor: "rgba(255,255,255,0.06)",
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
    shadowColor: "#FFFFFF",
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
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  previewAuraMint: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: "12%",
    left: -130,
    backgroundColor: "rgba(255,255,255,0.018)",
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
    color: "#E4E4E4",
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
    backgroundColor: "rgba(10,10,10,0.72)",
    borderColor: "rgba(205, 255, 223, 0.19)",
    borderTopColor: "rgba(245,255,248,0.56)",
    shadowColor: "#FFFFFF",
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
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(119,255,164,0.62)",
    borderTopColor: "rgba(244,255,248,0.86)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  platformBadgeText: {
    color: "#F0F0F0",
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
    backgroundColor: "rgba(18,18,18,0.78)",
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
    backgroundColor: "rgba(255,255,255,0.12)",
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
    color: "#E6E6E6",
  },
  streamsList: {
    paddingRight: 8,
  },
  glassStreamBadge: {
    backgroundColor: "rgba(18,18,18,0.78)",
    borderWidth: 1,
    borderColor: "rgba(224,255,235,0.16)",
    borderTopColor: "rgba(250,255,251,0.44)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  glassStreamBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
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
    backgroundColor: "rgba(255,255,255,0.28)",
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
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(132,255,175,0.66)",
    borderTopColor: "rgba(255,255,255,0.86)",
    shadowColor: "#FFFFFF",
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
