import React, { useEffect, useMemo, useState } from "react";
import LinearGradient from "react-native-linear-gradient";
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Image,
  ActivityIndicator, FlatList, StyleSheet, NativeModules, NativeEventEmitter,
  Alert, Clipboard, PermissionsAndroid, Platform, StatusBar, ScrollView,
} from "react-native";
import { LiquidGlassView, LiquidGlassProvider, isLiquidGlassSupported } from "liquid-glass-kit";

const { PythonBridgeModule } = NativeModules;
const pythonEvents = PythonBridgeModule ? new NativeEventEmitter(PythonBridgeModule) : null;

interface FormatItem {
  format_id: string; ext: string; resolution: string; filesize: number;
  has_video: boolean; has_audio: boolean; quality_note: string; height?: number; fps?: number;
}
interface MediaMetadata {
  id: string; title: string; thumbnail: string; duration: number;
  extractor: string; formats: FormatItem[]; success?: boolean; error?: string;
}
interface DownloadRecord { title: string; filePath: string; url: string; date: string; }

type Tab = "Home" | "Downloads" | "History" | "Settings";
const QUALITY_OPTIONS = [
  { label: "Best available", value: "best", note: "Highest available quality" },
  { label: "1080p", value: "1080", note: "Full HD, when available" },
  { label: "720p", value: "720", note: "HD, when available" },
  { label: "480p", value: "480", note: "SD, when available" },
  { label: "360p", value: "360", note: "Smaller file size" },
  { label: "Audio only", value: "audio", note: "Audio stream only" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("best");
  const [defaultQuality, setDefaultQuality] = useState("best");
  const [saveThumbnails, setSaveThumbnails] = useState(true);
  const [confirmBeforeDownload, setConfirmBeforeDownload] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, speed: 0 });
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadRecord[]>([]);

  useEffect(() => {
    if (!pythonEvents) return;
    const subscription = pythonEvents.addListener("onDownloadProgress", (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.percent !== undefined) setProgress({ percent: parsed.percent, speed: parsed.speed || 0 });
      } catch (e) { console.warn("Progress JSON parse error", e); }
    });
    return () => subscription.remove();
  }, []);

  const glassFallback = {
    backgroundColor: "rgba(15, 26, 22, 0.88)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderTopColor: "rgba(255,255,255,0.28)",
  };
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "Size unavailable";
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  };
  const qualityName = (value: string) => QUALITY_OPTIONS.find(x => x.value === value)?.label || value;
  const selectedFormatInfo = useMemo(
    () => mediaInfo?.formats?.find(f => f.format_id === selectedFormat),
    [mediaInfo, selectedFormat]
  );

  const requestStoragePermission = async () => {
    if (Platform.OS === "android" && (Platform.Version as number) <= 29) {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
        title: "Storage permission", message: "Vitre needs permission to save downloads.",
        buttonPositive: "Allow",
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const handlePaste = async () => {
    try { const text = await Clipboard.getString(); if (text) setUrl(text.trim()); }
    catch (e) { Alert.alert("Clipboard unavailable", "Paste the media URL into the field."); }
  };

  const handleFetch = async () => {
    if (!url.trim()) { Alert.alert("Link required", "Paste a YouTube, Instagram, or TikTok URL first."); return; }
    if (!PythonBridgeModule) { Alert.alert("Downloader unavailable", "PythonBridgeModule is not linked or initialized."); return; }
    setLoading(true); setMediaInfo(null); setImageFailed(false); setProgress({ percent: 0, speed: 0 });
    try {
      const raw = await PythonBridgeModule.fetchMediaInfo(url.trim());
      const result: MediaMetadata = JSON.parse(raw);
      if (result.success === false || result.error) throw new Error(result.error || "Could not analyze this link.");
      setMediaInfo(result);
      setSelectedFormat(defaultQuality);
      if (!result.formats?.length) Alert.alert("No formats found", "The link was analyzed, but no downloadable formats were returned.");
    } catch (err: any) { Alert.alert("Analysis failed", err?.message || "Could not read media details."); }
    finally { setLoading(false); }
  };

  const runDownload = async () => {
    const allowed = await requestStoragePermission();
    if (!allowed) { Alert.alert("Permission denied", "Vitre cannot save the file without storage permission."); return; }
    if (!PythonBridgeModule) { Alert.alert("Downloader unavailable", "PythonBridgeModule is not linked."); return; }
    setDownloading(true); setProgress({ percent: 0, speed: 0 });
    const record: DownloadRecord = {
      title: mediaInfo?.title || "Media download", filePath: "", url: url.trim(), date: new Date().toISOString(),
    };
    setActiveDownloads(prev => [record, ...prev]);
    try {
      const raw = await PythonBridgeModule.downloadMedia(url.trim(), selectedFormat);
      const result = JSON.parse(raw);
      if (result.success === false || result.error) throw new Error(result.error || "Download failed.");
      const complete = { ...record, title: result.title || record.title, filePath: result.filePath || "" };
      setHistory(prev => [complete, ...prev]);
      setActiveDownloads(prev => prev.filter(item => item !== record));
      Alert.alert("Download complete", `Saved to:\n${complete.filePath || "Downloads folder"}`);
      setTab("Downloads");
    } catch (err: any) {
      setActiveDownloads(prev => prev.filter(item => item !== record));
      Alert.alert("Download failed", err?.message || "Please try again.");
    } finally { setDownloading(false); }
  };

  const handleDownload = () => {
    if (confirmBeforeDownload) {
      Alert.alert("Start download?", `${mediaInfo?.title || "This media"}\nQuality: ${qualityName(selectedFormat)}`, [
        { text: "Cancel", style: "cancel" }, { text: "Download", onPress: () => { void runDownload(); } },
      ]);
    } else void runDownload();
  };

  const GlassPanel = ({ children, style }: any) => (
    <LiquidGlassView style={[styles.panel, !isLiquidGlassSupported && glassFallback, style]} intensity="medium">
      {children}
    </LiquidGlassView>
  );
  const PrimaryButton = ({ title, onPress, disabled = false, busy = false }: any) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.primaryButton, disabled && styles.disabled]}>
      {busy ? <ActivityIndicator color="#07130C" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </TouchableOpacity>
  );
  const ToggleRow = ({ title, subtitle, value, onChange }: any) => (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSubtitle}>{subtitle}</Text></View>
      <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </TouchableOpacity>
    </View>
  );

  const renderHome = () => (
    <>
      <View style={styles.hero}>
        <View style={styles.brandLine}><View style={styles.brandMark}><Text style={styles.brandMarkText}>V</Text></View><Text style={styles.logo}>vitre</Text><View style={styles.proPill}><Text style={styles.proText}>MEDIA</Text></View></View>
        <Text style={styles.eyebrow}>YOUR MEDIA, YOUR DEVICE</Text>
        <Text style={styles.heroTitle}>Save what{"\n"}moves you.</Text>
        <Text style={styles.heroSubtitle}>A clean, private way to save media from supported links.</Text>
      </View>
      <GlassPanel>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>New download</Text><Text style={styles.stepLabel}>01 / LINK</Text></View>
        <Text style={styles.fieldLabel}>MEDIA URL</Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} placeholder="Paste a video link here…" placeholderTextColor="#718078" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" selectionColor="#9BFFC0" />
          {url.length > 0 && <TouchableOpacity onPress={() => { setUrl(""); setMediaInfo(null); }} style={styles.clearButton}><Text style={styles.clearText}>×</Text></TouchableOpacity>}
          <TouchableOpacity onPress={handlePaste} style={styles.pasteButton}><Text style={styles.pasteText}>PASTE</Text></TouchableOpacity>
        </View>
        <View style={styles.platformRow}><View style={styles.platformDot}/><Text style={styles.platformText}>YouTube</Text><View style={styles.smallDot}/><Text style={styles.platformText}>Instagram</Text><View style={styles.smallDot}/><Text style={styles.platformText}>TikTok</Text></View>
        <PrimaryButton title="Analyze link  ↗" onPress={handleFetch} disabled={loading || downloading} busy={loading} />
        <Text style={styles.privacyNote}>⌁  Processing runs through the downloader on this device.</Text>
      </GlassPanel>

      {mediaInfo && (
        <GlassPanel>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Media preview</Text><View style={styles.readyPill}><Text style={styles.readyText}>READY</Text></View></View>
          {mediaInfo.thumbnail && !imageFailed ? (
            <Image source={{ uri: mediaInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" onError={() => setImageFailed(true)} />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailFallback]}><Text style={styles.playGlyph}>▶</Text><Text style={styles.fallbackText}>{imageFailed ? "Preview unavailable" : "MEDIA PREVIEW"}</Text></View>
          )}
          <Text style={styles.mediaTitle}>{mediaInfo.title || "Untitled media"}</Text>
          <View style={styles.metaRow}><Text style={styles.metaPill}>{(mediaInfo.extractor || "MEDIA").replace(/_/g, " ").toUpperCase()}</Text><Text style={styles.metaMuted}>{mediaInfo.formats?.length || 0} formats found</Text></View>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Quality</Text><Text style={styles.stepLabel}>02 / FORMAT</Text></View>
          {QUALITY_OPTIONS.map(option => {
            const active = selectedFormat === option.value;
            return <TouchableOpacity key={option.value} onPress={() => setSelectedFormat(option.value)} style={[styles.qualityRow, active && styles.qualityRowActive]}>
              <View style={[styles.qualityIcon, active && styles.qualityIconActive]}><Text style={[styles.qualityIconText, active && styles.qualityIconTextActive]}>{option.value === "audio" ? "♫" : option.value === "best" ? "✦" : "▣"}</Text></View>
              <View style={styles.qualityCopy}><Text style={styles.qualityTitle}>{option.label}</Text><Text style={styles.qualityNote}>{option.note}</Text></View>
              <View style={[styles.radioOuter, active && styles.radioOuterActive]}>{active && <View style={styles.radioInner}/>}</View>
            </TouchableOpacity>;
          })}
          {selectedFormatInfo && <Text style={styles.availabilityNote}>Exact format available: {selectedFormatInfo.resolution} · {selectedFormatInfo.ext.toUpperCase()} · {formatFileSize(selectedFormatInfo.filesize)}</Text>}
          {downloading && <View style={styles.progressBlock}><View style={styles.progressTop}><Text style={styles.progressLabel}>DOWNLOADING</Text><Text style={styles.progressPercent}>{Math.round(progress.percent)}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress.percent))}%` }]} /></View><Text style={styles.progressSpeed}>{(progress.speed / 1024 / 1024).toFixed(2)} MB/s</Text></View>}
          <PrimaryButton title="Download to device  ↓" onPress={handleDownload} disabled={downloading} busy={downloading}/>
        </GlassPanel>
      )}
      <View style={styles.tipCard}><Text style={styles.tipMark}>✳</Text><View style={{flex:1}}><Text style={styles.tipTitle}>A little tip</Text><Text style={styles.tipBody}>Choose “Best available” for the highest quality the source provides. Some platforms limit available formats.</Text></View></View>
    </>
  );

  const renderDownloads = () => (
    <>
      <View style={styles.pageHeader}><Text style={styles.eyebrow}>YOUR LIBRARY</Text><Text style={styles.pageTitle}>Downloads</Text><Text style={styles.pageSubtitle}>Track current and finished downloads.</Text></View>
      {downloading && <GlassPanel><View style={styles.downloadItem}><View style={styles.fileIcon}><Text style={styles.fileIconText}>↓</Text></View><View style={styles.fileCopy}><Text style={styles.rowTitle}>{mediaInfo?.title || "Downloading media"}</Text><Text style={styles.rowSubtitle}>Downloading · {Math.round(progress.percent)}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, {width:`${Math.min(100,progress.percent)}%`}]} /></View></View><ActivityIndicator color="#9BFFC0"/></View></GlassPanel>}
      {history.length ? history.map((item, i) => <GlassPanel key={item.date + i}><View style={styles.downloadItem}><View style={styles.fileIcon}><Text style={styles.fileIconText}>✓</Text></View><View style={styles.fileCopy}><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.rowSubtitle}>Completed · {new Date(item.date).toLocaleDateString()}</Text><Text style={styles.pathText} numberOfLines={2}>{item.filePath}</Text></View></View></GlassPanel>) : !downloading ? <View style={styles.emptyState}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>↓</Text></View><Text style={styles.emptyTitle}>Nothing downloaded yet</Text><Text style={styles.emptyBody}>Your completed files will appear here after you save your first video.</Text><PrimaryButton title="Analyze a link" onPress={() => setTab("Home")}/></View> : null}
    </>
  );

  const renderHistory = () => (
    <>
      <View style={styles.pageHeader}><Text style={styles.eyebrow}>RECENT ACTIVITY</Text><Text style={styles.pageTitle}>History</Text><Text style={styles.pageSubtitle}>Your download history for this session.</Text></View>
      {history.length ? <><TouchableOpacity onPress={() => Alert.alert("Clear history?", "This only clears the in-app list. Saved files will not be deleted.", [{text:"Cancel",style:"cancel"},{text:"Clear",style:"destructive",onPress:()=>setHistory([])}])} style={styles.clearHistory}><Text style={styles.clearHistoryText}>Clear history</Text></TouchableOpacity>{history.map((item, i) => <GlassPanel key={item.date + i}><View style={styles.historyRow}><View style={styles.historyBullet}><Text style={styles.historyBulletText}>✓</Text></View><View style={styles.fileCopy}><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.rowSubtitle}>{new Date(item.date).toLocaleString()}</Text></View></View></GlassPanel>)}</> : <View style={styles.emptyState}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>◷</Text></View><Text style={styles.emptyTitle}>No recent activity</Text><Text style={styles.emptyBody}>Completed downloads will show up here.</Text></View>}
    </>
  );

  const renderSettings = () => (
    <>
      <View style={styles.pageHeader}><Text style={styles.eyebrow}>MAKE IT YOURS</Text><Text style={styles.pageTitle}>Settings</Text><Text style={styles.pageSubtitle}>Tune your default download experience.</Text></View>
      <GlassPanel><Text style={styles.settingsGroupTitle}>DOWNLOAD PREFERENCES</Text><Text style={styles.fieldLabel}>DEFAULT QUALITY</Text>
        {QUALITY_OPTIONS.map(option => <TouchableOpacity key={option.value} onPress={() => setDefaultQuality(option.value)} style={[styles.qualityRow, defaultQuality === option.value && styles.qualityRowActive]}><View style={styles.qualityCopy}><Text style={styles.qualityTitle}>{option.label}</Text><Text style={styles.qualityNote}>{option.note}</Text></View><View style={[styles.radioOuter, defaultQuality === option.value && styles.radioOuterActive]}>{defaultQuality === option.value && <View style={styles.radioInner}/>}</View></TouchableOpacity>)}
      </GlassPanel>
      <GlassPanel><Text style={styles.settingsGroupTitle}>DOWNLOAD BEHAVIOUR</Text><ToggleRow title="Save thumbnail" subtitle="Ask the downloader to save the media thumbnail." value={saveThumbnails} onChange={setSaveThumbnails}/><View style={styles.separator}/><ToggleRow title="Confirm before download" subtitle="Show a confirmation before starting a download." value={confirmBeforeDownload} onChange={setConfirmBeforeDownload}/></GlassPanel>
      <GlassPanel><Text style={styles.settingsGroupTitle}>APPEARANCE</Text><View style={styles.appearancePreview}><View style={styles.appearanceSwatch}/><View style={styles.fileCopy}><Text style={styles.rowTitle}>Liquid Glass · Emerald</Text><Text style={styles.rowSubtitle}>Dark translucent panels and soft green highlights</Text></View><View style={styles.readyPill}><Text style={styles.readyText}>ACTIVE</Text></View></View></GlassPanel>
      <GlassPanel><Text style={styles.settingsGroupTitle}>ABOUT VITRE</Text><Text style={styles.aboutTitle}>Vitre Downloader</Text><Text style={styles.rowSubtitle}>Premium on-device media downloader UI.</Text><Text style={styles.aboutDisclaimer}>Only download content you own or have permission to save. Platform restrictions may affect format availability.</Text><TouchableOpacity style={styles.resetButton} onPress={() => Alert.alert("Reset settings?", "Restore the default quality and behaviour options?", [{text:"Cancel",style:"cancel"},{text:"Reset",onPress:()=>{setDefaultQuality("best");setSaveThumbnails(true);setConfirmBeforeDownload(false);}}])}><Text style={styles.resetText}>Reset preferences</Text></TouchableOpacity></GlassPanel>
    </>
  );

  return (
    <LiquidGlassProvider style={{flex:1}}>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#07110D"/>
        <LinearGradient colors={["#07110D","#0B2018","#08120F"]} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} pointerEvents="none"/>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === "Home" ? renderHome() : tab === "Downloads" ? renderDownloads() : tab === "History" ? renderHistory() : renderSettings()}
          <Text style={styles.footer}>VITRE  ·  MADE FOR YOUR DEVICE</Text>
        </ScrollView>
        <View style={styles.tabBar}>
          {([{key:"Home", icon:"⌂", label:"Home"},{key:"Downloads",icon:"↓",label:"Downloads"},{key:"History",icon:"◷",label:"History"},{key:"Settings",icon:"⚙",label:"Settings"}] as {key:Tab;icon:string;label:string}[]).map(item => (
            <TouchableOpacity key={item.key} onPress={() => setTab(item.key)} style={styles.tabButton} activeOpacity={0.7}>
              <View style={[styles.tabIconWrap, tab === item.key && styles.tabIconWrapActive]}><Text style={[styles.tabIcon, tab === item.key && styles.tabIconActive]}>{item.icon}</Text></View>
              <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </LiquidGlassProvider>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:"#07110D"},
  scrollContent:{paddingHorizontal:20,paddingTop:12,paddingBottom:22},
  hero:{paddingTop:14,paddingBottom:26},
  brandLine:{flexDirection:"row",alignItems:"center",gap:10},
  brandMark:{width:38,height:38,borderRadius:13,backgroundColor:"#A5FFC5",alignItems:"center",justifyContent:"center"},
  brandMarkText:{color:"#082015",fontSize:24,fontWeight:"900"},
  logo:{fontSize:25,fontWeight:"800",color:"#F3FFF7",letterSpacing:-0.8},
  proPill:{marginLeft:4,paddingHorizontal:9,paddingVertical:5,borderRadius:8,backgroundColor:"rgba(155,255,192,0.10)",borderWidth:1,borderColor:"rgba(155,255,192,0.18)"},
  proText:{color:"#A5FFC5",fontSize:9,fontWeight:"800",letterSpacing:1.1},
  eyebrow:{color:"#91DDAA",fontSize:10,fontWeight:"800",letterSpacing:2.1,marginTop:22,marginBottom:10},
  heroTitle:{color:"#F3FFF7",fontSize:42,lineHeight:46,fontWeight:"800",letterSpacing:-1.7},
  heroSubtitle:{color:"#9CAFA4",fontSize:14,lineHeight:21,marginTop:12,maxWidth:290},
  panel:{borderRadius:26,padding:18,marginBottom:16,overflow:"hidden",borderWidth:1,borderColor:"rgba(255,255,255,0.10)",backgroundColor:"rgba(15,26,22,0.75)"},
  sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  sectionTitle:{color:"#F0FFF5",fontSize:17,fontWeight:"700",letterSpacing:-0.3},
  stepLabel:{color:"#718B7C",fontSize:9,fontWeight:"800",letterSpacing:1.1},
  fieldLabel:{color:"#8EA497",fontSize:10,fontWeight:"800",letterSpacing:1.4,marginBottom:9},
  inputWrap:{height:56,borderRadius:16,borderWidth:1,borderColor:"rgba(255,255,255,0.12)",backgroundColor:"rgba(0,0,0,0.20)",flexDirection:"row",alignItems:"center",paddingLeft:14,paddingRight:7},
  input:{flex:1,color:"#F4FFF7",fontSize:14,paddingVertical:0},
  clearButton:{paddingHorizontal:7,paddingVertical:5},clearText:{fontSize:22,color:"#92A79A"},
  pasteButton:{paddingHorizontal:12,paddingVertical:10,borderRadius:11,backgroundColor:"rgba(155,255,192,0.12)"},pasteText:{fontSize:10,fontWeight:"900",letterSpacing:0.8,color:"#A5FFC5"},
  platformRow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:14,marginBottom:17,flexWrap:"wrap"},
  platformDot:{width:6,height:6,borderRadius:3,backgroundColor:"#9BFFC0"},platformText:{color:"#9AACA1",fontSize:11},smallDot:{width:3,height:3,borderRadius:2,backgroundColor:"#53665A"},
  primaryButton:{height:53,borderRadius:16,backgroundColor:"#A5FFC5",alignItems:"center",justifyContent:"center",marginTop:4},
  primaryButtonText:{color:"#082015",fontSize:14,fontWeight:"800",letterSpacing:0.1},disabled:{opacity:0.55},
  privacyNote:{color:"#6E8376",fontSize:10,marginTop:13,textAlign:"center"},
  readyPill:{paddingHorizontal:9,paddingVertical:5,borderRadius:8,backgroundColor:"rgba(155,255,192,0.10)",borderWidth:1,borderColor:"rgba(155,255,192,0.18)"},
  readyText:{color:"#A5FFC5",fontSize:9,fontWeight:"800",letterSpacing:0.8},
  thumbnail:{width:"100%",height:190,borderRadius:17,backgroundColor:"#101C16",marginBottom:15},
  thumbnailFallback:{alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(255,255,255,0.08)"},
  playGlyph:{fontSize:30,color:"#A5FFC5"},fallbackText:{color:"#718B7C",fontSize:10,fontWeight:"800",letterSpacing:1.5,marginTop:9},
  mediaTitle:{color:"#F1FFF5",fontSize:18,lineHeight:24,fontWeight:"700",marginBottom:10},
  metaRow:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:24},
  metaPill:{color:"#A5FFC5",fontSize:9,fontWeight:"800",letterSpacing:0.8,backgroundColor:"rgba(155,255,192,0.09)",paddingHorizontal:9,paddingVertical:5,borderRadius:7},
  metaMuted:{color:"#829589",fontSize:11},
  qualityRow:{flexDirection:"row",alignItems:"center",padding:12,borderRadius:15,borderWidth:1,borderColor:"transparent",marginBottom:6},
  qualityRowActive:{backgroundColor:"rgba(155,255,192,0.07)",borderColor:"rgba(155,255,192,0.24)"},
  qualityIcon:{width:36,height:36,borderRadius:12,backgroundColor:"rgba(255,255,255,0.05)",alignItems:"center",justifyContent:"center",marginRight:12},
  qualityIconActive:{backgroundColor:"rgba(155,255,192,0.12)"},qualityIconText:{color:"#9AACA1",fontSize:17,fontWeight:"700"},qualityIconTextActive:{color:"#A5FFC5"},
  qualityCopy:{flex:1},qualityTitle:{color:"#EAF8EF",fontSize:13,fontWeight:"700"},qualityNote:{color:"#809286",fontSize:11,marginTop:4},
  radioOuter:{width:19,height:19,borderRadius:10,borderWidth:1.5,borderColor:"#566A5D",alignItems:"center",justifyContent:"center"},
  radioOuterActive:{borderColor:"#A5FFC5"},radioInner:{width:9,height:9,borderRadius:5,backgroundColor:"#A5FFC5"},
  availabilityNote:{color:"#9AB6A4",fontSize:11,lineHeight:16,marginTop:8,marginBottom:10},
  progressBlock:{marginTop:18,marginBottom:5},progressTop:{flexDirection:"row",justifyContent:"space-between",marginBottom:8},progressLabel:{color:"#90A99A",fontSize:10,fontWeight:"800",letterSpacing:1},progressPercent:{color:"#A5FFC5",fontSize:12,fontWeight:"800"},
  progressTrack:{height:6,borderRadius:4,backgroundColor:"rgba(255,255,255,0.08)",overflow:"hidden",marginTop:8},progressFill:{height:"100%",backgroundColor:"#A5FFC5",borderRadius:4},progressSpeed:{color:"#7E9586",fontSize:10,textAlign:"right",marginTop:6},
  tipCard:{flexDirection:"row",gap:13,padding:16,marginTop:2,marginBottom:15,borderRadius:20,backgroundColor:"rgba(155,255,192,0.045)",borderWidth:1,borderColor:"rgba(155,255,192,0.10)"},
  tipMark:{color:"#A5FFC5",fontSize:21},tipTitle:{color:"#DDF9E6",fontSize:12,fontWeight:"800",marginBottom:4},tipBody:{color:"#819689",fontSize:11,lineHeight:17},
  pageHeader:{paddingTop:18,paddingBottom:22},pageTitle:{color:"#F3FFF7",fontSize:35,fontWeight:"800",letterSpacing:-1.2},pageSubtitle:{color:"#91A498",fontSize:13,marginTop:8},
  downloadItem:{flexDirection:"row",alignItems:"center",gap:12},fileIcon:{width:42,height:42,borderRadius:14,backgroundColor:"rgba(155,255,192,0.10)",alignItems:"center",justifyContent:"center"},fileIconText:{color:"#A5FFC5",fontSize:20,fontWeight:"800"},
  fileCopy:{flex:1},rowTitle:{color:"#EAF8EF",fontSize:13,fontWeight:"700",lineHeight:19},rowSubtitle:{color:"#829589",fontSize:11,lineHeight:17,marginTop:4},pathText:{color:"#7B9A86",fontSize:10,lineHeight:15,marginTop:5},
  emptyState:{alignItems:"center",paddingHorizontal:26,paddingTop:55,paddingBottom:65},emptyIcon:{width:68,height:68,borderRadius:24,backgroundColor:"rgba(155,255,192,0.08)",alignItems:"center",justifyContent:"center",marginBottom:18},emptyIconText:{fontSize:29,color:"#A5FFC5"},emptyTitle:{color:"#F0FFF5",fontSize:18,fontWeight:"800"},emptyBody:{color:"#819689",fontSize:12,lineHeight:19,textAlign:"center",marginTop:9,marginBottom:18},
  clearHistory:{alignSelf:"flex-end",paddingVertical:8,paddingHorizontal:12,marginBottom:8},clearHistoryText:{color:"#A5FFC5",fontSize:12,fontWeight:"700"},
  historyRow:{flexDirection:"row",alignItems:"center",gap:12},historyBullet:{width:32,height:32,borderRadius:11,backgroundColor:"rgba(155,255,192,0.10)",alignItems:"center",justifyContent:"center"},historyBulletText:{color:"#A5FFC5",fontSize:14,fontWeight:"800"},
  settingsGroupTitle:{color:"#8DA596",fontSize:10,fontWeight:"900",letterSpacing:1.5,marginBottom:16},
  settingRow:{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:10},settingCopy:{flex:1},separator:{height:1,backgroundColor:"rgba(255,255,255,0.07)",marginVertical:6},
  toggle:{width:46,height:27,borderRadius:14,backgroundColor:"#34453A",padding:3,justifyContent:"center"},toggleOn:{backgroundColor:"#78D99A"},toggleKnob:{width:21,height:21,borderRadius:11,backgroundColor:"#DDE8E0"},toggleKnobOn:{alignSelf:"flex-end",backgroundColor:"#092014"},
  appearancePreview:{flexDirection:"row",alignItems:"center",gap:12},appearanceSwatch:{width:40,height:40,borderRadius:13,backgroundColor:"#10291D",borderWidth:1,borderColor:"rgba(165,255,197,0.5)"},
  aboutTitle:{color:"#EAF8EF",fontSize:15,fontWeight:"800",marginBottom:6},aboutDisclaimer:{color:"#819689",fontSize:11,lineHeight:18,marginTop:15},
  resetButton:{alignSelf:"flex-start",paddingHorizontal:14,paddingVertical:10,borderRadius:12,borderWidth:1,borderColor:"rgba(255,255,255,0.12)",marginTop:16},resetText:{color:"#D7E8DD",fontSize:11,fontWeight:"700"},
  footer:{color:"#52665A",fontSize:9,fontWeight:"800",letterSpacing:1.5,textAlign:"center",paddingTop:10,paddingBottom:8},
  tabBar:{flexDirection:"row",paddingTop:9,paddingBottom:Platform.OS==="ios"?8:12,paddingHorizontal:12,backgroundColor:"rgba(8,18,13,0.97)",borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.08)"},
  tabButton:{flex:1,alignItems:"center",justifyContent:"center",gap:4},tabIconWrap:{width:42,height:28,borderRadius:12,alignItems:"center",justifyContent:"center"},tabIconWrapActive:{backgroundColor:"rgba(155,255,192,0.12)"},
  tabIcon:{color:"#718478",fontSize:19,fontWeight:"600"},tabIconActive:{color:"#A5FFC5"},tabLabel:{color:"#718478",fontSize:9,fontWeight:"600"},tabLabelActive:{color:"#BFFFD2",fontWeight:"800"},
});
