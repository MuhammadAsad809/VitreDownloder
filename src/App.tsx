import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SafeAreaView,
  View,
  StyleSheet,
  StatusBar,
  AppState,
  AppStateStatus,
} from "react-native";
import { TamaguiProvider } from "@tamagui/core";
import { LiquidGlassProvider } from "liquid-glass-kit";
import tamaguiConfig from "./tamagui.config";
import { NavigationTabBar, TabType } from "./components/NavigationTabBar";
import { HomeScreen } from "./screens/HomeScreen";
import { DownloadsScreen } from "./screens/DownloadsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StorageService } from "./services/storage";
import { UserSettings } from "./types";
import { AdMobService } from "./services/admob";
import { AdBanner } from "./components/AdBanner";
import { DeveloperSupportModal } from "./components/DeveloperSupportModal";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [downloadsCount, setDownloadsCount] = useState<number>(0);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshDownloadsCount = useCallback(async () => {
    try {
      const records = await StorageService.getDownloads();
      setDownloadsCount(records.length);
    } catch (e) {
      console.warn("Error refreshing downloads count:", e);
    }
  }, []);

  // Handle warm start (app returning to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("[AdMob] App returned to foreground, showing App Open ad");
          AdMobService.showAppOpen();
        }
        appStateRef.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    refreshDownloadsCount();
    StorageService.getSettings().then((s) => setSettings(s));
    AdMobService.init().then(() => {
      // Check if user is opening app for the first time
      StorageService.hasSeenDeveloperSupport().then((seen) => {
        if (!seen) {
          setTimeout(() => {
            setShowSupportModal(true);
            StorageService.setDeveloperSupportSeen();
          }, 1200);
        } else {
          // Regular cold start: trigger App Open Ad after brief initialization delay
          setTimeout(() => {
            AdMobService.showAppOpen();
          }, 1500);
        }
      });
    });
  }, [refreshDownloadsCount]);

  const accentColor =
    settings?.themeAccent === "mint"
      ? "#34D399"
      : settings?.themeAccent === "cyan"
      ? "#06B6D4"
      : "#10B981";

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#090E0A" />

        {/* Ambient background glowing orbs */}
        <View style={styles.ambientOrbTop} pointerEvents="none" />
        <View style={styles.ambientOrbCenter} pointerEvents="none" />
        <View style={styles.ambientOrbBottom} pointerEvents="none" />

        <LiquidGlassProvider style={StyleSheet.absoluteFill}>
          <View style={styles.contentArea}>
            {activeTab === "home" && (
              <HomeScreen
                onDownloadCompleted={refreshDownloadsCount}
                accentColor={accentColor}
              />
            )}
            {activeTab === "downloads" && (
              <DownloadsScreen
                onNavigateHome={() => setActiveTab("home")}
                accentColor={accentColor}
              />
            )}
            {activeTab === "settings" && (
              <SettingsScreen
                onSettingsChanged={(updated) => setSettings(updated)}
                accentColor={accentColor}
              />
            )}
          </View>

          {/* AdMob Banner Ad */}
          <AdBanner />

          {/* Bottom Glass Tab Bar */}
          <NavigationTabBar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            downloadsCount={downloadsCount}
          />

          {/* First Launch Developer Support Modal */}
          <DeveloperSupportModal
            visible={showSupportModal}
            onClose={() => setShowSupportModal(false)}
            accentColor={accentColor}
          />
        </LiquidGlassProvider>
      </SafeAreaView>
    </TamaguiProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090E0A",
  },
  contentArea: {
    flex: 1,
  },
  ambientOrbTop: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  ambientOrbCenter: {
    position: "absolute",
    top: 260,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
  },
  ambientOrbBottom: {
    position: "absolute",
    bottom: 40,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(52, 211, 153, 0.07)",
  },
});
