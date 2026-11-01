import {
  Platform,
} from "react-native";
import mobileAds, {
  BannerAdSize,
  TestIds,
  InterstitialAd,
  RewardedAd,
  AppOpenAd,
  AdEventType,
  RewardedAdEventType,
  MaxAdContentRating,
} from "react-native-google-mobile-ads";

/**
 * AdMob Configuration for Vitre Downloader
 * Configured with User Production AdMob App ID and App Open Ad Unit ID.
 */
export const ADMOB_CONFIG = {
  // Set to false for live production ads
  useTestAds: false,

  android: {
    // Official App ID from user
    appId: "ca-app-pub-2775984163501785~5678049612",
    // Official App Open Ad Unit ID from user
    appOpenAdUnitId: "ca-app-pub-2775984163501785/1916614609",

    // Banner & Interstitial IDs (Default to TestIds or custom unit IDs)
    bannerAdUnitId: TestIds.BANNER,
    adaptiveBannerAdUnitId: TestIds.ADAPTIVE_BANNER,
    interstitialAdUnitId: TestIds.INTERSTITIAL,
    rewardedAdUnitId: TestIds.REWARDED,
  },
};

export const getBannerAdUnitId = (): string => {
  if (ADMOB_CONFIG.useTestAds) {
    return TestIds.BANNER;
  }
  return Platform.select({
    android: ADMOB_CONFIG.android.bannerAdUnitId,
    default: TestIds.BANNER,
  });
};

export const getInterstitialAdUnitId = (): string => {
  if (ADMOB_CONFIG.useTestAds) {
    return TestIds.INTERSTITIAL;
  }
  return Platform.select({
    android: ADMOB_CONFIG.android.interstitialAdUnitId,
    default: TestIds.INTERSTITIAL,
  });
};

export const getRewardedAdUnitId = (): string => {
  if (ADMOB_CONFIG.useTestAds) {
    return TestIds.REWARDED;
  }
  return Platform.select({
    android: ADMOB_CONFIG.android.rewardedAdUnitId,
    default: TestIds.REWARDED,
  });
};

export const getAppOpenAdUnitId = (): string => {
  if (ADMOB_CONFIG.useTestAds) {
    return TestIds.APP_OPEN;
  }
  return Platform.select({
    android: ADMOB_CONFIG.android.appOpenAdUnitId,
    default: TestIds.APP_OPEN,
  });
};

class AdMobManager {
  private initialized: boolean = false;
  private isShowingAd: boolean = false;

  // Interstitial
  private interstitial: InterstitialAd | null = null;
  private isInterstitialLoaded: boolean = false;

  // Rewarded
  private rewarded: RewardedAd | null = null;
  private isRewardedLoaded: boolean = false;

  // App Open (Google AdMob Policy: Expire after 4 hours, cooldown check)
  private appOpen: AppOpenAd | null = null;
  private isAppOpenLoaded: boolean = false;
  private appOpenLoadTime: number = 0;
  private lastAppOpenShowTime: number = 0;

  /**
   * Initialize Google Mobile Ads SDK
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Set request configuration compliant with Google AdMob policy
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });

      const adapterStatuses = await mobileAds().initialize();
      this.initialized = true;
      console.log("[AdMob] SDK initialized successfully:", adapterStatuses);

      // Preload ads
      this.preloadAppOpen();
      this.preloadInterstitial();
      this.preloadRewarded();
    } catch (error) {
      console.warn("[AdMob] SDK initialization failed:", error);
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  // ==========================================
  // App Open Ads (Google Guide & Policy Compliant)
  // ==========================================

  preloadAppOpen(): void {
    try {
      const adUnitId = getAppOpenAdUnitId();
      this.appOpen = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      this.appOpen.addAdEventListener(AdEventType.LOADED, () => {
        this.isAppOpenLoaded = true;
        this.appOpenLoadTime = Date.now();
        console.log("[AdMob] App Open ad loaded successfully");
      });

      this.appOpen.addAdEventListener(AdEventType.CLOSED, () => {
        this.isAppOpenLoaded = false;
        this.isShowingAd = false;
        this.lastAppOpenShowTime = Date.now();
        console.log("[AdMob] App Open ad closed, preloading next ad");
        this.preloadAppOpen();
      });

      this.appOpen.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isAppOpenLoaded = false;
        this.isShowingAd = false;
        console.warn("[AdMob] App Open ad error:", error);
      });

      this.appOpen.load();
    } catch (e) {
      console.warn("[AdMob] Error creating App Open ad:", e);
    }
  }

  /**
   * Shows App Open Ad with Google AdMob Policy Guardrails:
   * 1. Never show if another ad is already active
   * 2. Ad expiration: must be loaded < 4 hours ago
   * 3. Cooldown: minimum 20s between displays to protect user experience
   */
  async showAppOpen(): Promise<boolean> {
    if (this.isShowingAd) {
      console.log("[AdMob] An ad is already displaying, skipping App Open ad");
      return false;
    }

    // Cooldown check (minimum 20s between app open ads)
    if (Date.now() - this.lastAppOpenShowTime < 20000) {
      console.log("[AdMob] App Open ad cooldown active, skipping");
      return false;
    }

    // Expiration check (4 hours per Google Mobile Ads policy)
    if (
      this.appOpenLoadTime > 0 &&
      Date.now() - this.appOpenLoadTime > 4 * 3600 * 1000
    ) {
      console.log("[AdMob] App Open ad expired (>4 hrs), reloading fresh ad");
      this.isAppOpenLoaded = false;
      this.preloadAppOpen();
      return false;
    }

    if (this.appOpen && this.isAppOpenLoaded) {
      try {
        this.isShowingAd = true;
        await this.appOpen.show();
        return true;
      } catch (e) {
        console.warn("[AdMob] Error showing App Open ad:", e);
        this.isShowingAd = false;
        this.preloadAppOpen();
        return false;
      }
    } else {
      console.log("[AdMob] App Open ad not ready yet, preloading");
      this.preloadAppOpen();
      return false;
    }
  }

  // ==========================================
  // Interstitial Ads
  // ==========================================

  preloadInterstitial(): void {
    try {
      const adUnitId = getInterstitialAdUnitId();
      this.interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
        this.isInterstitialLoaded = true;
        console.log("[AdMob] Interstitial ad loaded");
      });

      this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        this.isInterstitialLoaded = false;
        this.isShowingAd = false;
        console.log("[AdMob] Interstitial ad closed, preloading next ad");
        this.preloadInterstitial();
      });

      this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isInterstitialLoaded = false;
        this.isShowingAd = false;
        console.warn("[AdMob] Interstitial ad error:", error);
      });

      this.interstitial.load();
    } catch (e) {
      console.warn("[AdMob] Error creating interstitial ad:", e);
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (this.isShowingAd) return false;

    if (this.interstitial && this.isInterstitialLoaded) {
      try {
        this.isShowingAd = true;
        await this.interstitial.show();
        return true;
      } catch (e) {
        console.warn("[AdMob] Error showing interstitial ad:", e);
        this.isShowingAd = false;
        this.preloadInterstitial();
        return false;
      }
    } else {
      console.log("[AdMob] Interstitial not ready yet, loading now");
      this.preloadInterstitial();
      return false;
    }
  }

  // ==========================================
  // Rewarded Ads
  // ==========================================

  preloadRewarded(): void {
    try {
      const adUnitId = getRewardedAdUnitId();
      this.rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.isRewardedLoaded = true;
        console.log("[AdMob] Rewarded ad loaded");
      });

      this.rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        this.isRewardedLoaded = false;
        this.isShowingAd = false;
        console.log("[AdMob] Rewarded ad closed, preloading next ad");
        this.preloadRewarded();
      });

      this.rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isRewardedLoaded = false;
        this.isShowingAd = false;
        console.warn("[AdMob] Rewarded ad error:", error);
      });

      this.rewarded.load();
    } catch (e) {
      console.warn("[AdMob] Error creating rewarded ad:", e);
    }
  }

  async showRewarded(
    onRewarded: (reward: { type: string; amount: number }) => void
  ): Promise<boolean> {
    if (this.isShowingAd) return false;

    if (this.rewarded && this.isRewardedLoaded) {
      try {
        this.isShowingAd = true;
        const unsubscribe = this.rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          (reward) => {
            console.log("[AdMob] User earned reward:", reward);
            if (onRewarded) onRewarded(reward);
            unsubscribe();
          }
        );

        await this.rewarded.show();
        return true;
      } catch (e) {
        console.warn("[AdMob] Error showing rewarded ad:", e);
        this.isShowingAd = false;
        this.preloadRewarded();
        return false;
      }
    } else {
      console.log("[AdMob] Rewarded ad not ready, preloading now");
      this.preloadRewarded();
      return false;
    }
  }
}

export const AdMobService = new AdMobManager();
