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
 *
 * NOTE FOR PRODUCTION:
 * Replace test IDs with your live AdMob ad unit IDs from Google AdMob console
 * (https://admob.google.com). During development & testing, keep TestIds to avoid account strikes.
 */
export const ADMOB_CONFIG = {
  // Set to true to force test IDs even in production builds
  useTestAds: __DEV__,

  android: {
    // Replace with your real AdMob Ad Unit IDs for production release:
    bannerAdUnitId: TestIds.BANNER,
    adaptiveBannerAdUnitId: TestIds.ADAPTIVE_BANNER,
    interstitialAdUnitId: TestIds.INTERSTITIAL,
    rewardedAdUnitId: TestIds.REWARDED,
    appOpenAdUnitId: TestIds.APP_OPEN,
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
  private interstitial: InterstitialAd | null = null;
  private isInterstitialLoaded: boolean = false;
  private rewarded: RewardedAd | null = null;
  private isRewardedLoaded: boolean = false;
  private appOpen: AppOpenAd | null = null;
  private isAppOpenLoaded: boolean = false;

  /**
   * Initialize Google Mobile Ads SDK
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Set request configuration
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });

      const adapterStatuses = await mobileAds().initialize();
      this.initialized = true;
      console.log("[AdMob] SDK initialized successfully:", adapterStatuses);

      // Preload ads
      this.preloadInterstitial();
      this.preloadRewarded();
      this.preloadAppOpen();
    } catch (error) {
      console.warn("[AdMob] SDK initialization failed:", error);
    }
  }

  isReady(): boolean {
    return this.initialized;
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
        console.log("[AdMob] Interstitial ad closed, preloading next ad");
        // Automatically preload the next interstitial ad
        this.preloadInterstitial();
      });

      this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isInterstitialLoaded = false;
        console.warn("[AdMob] Interstitial ad error:", error);
      });

      this.interstitial.load();
    } catch (e) {
      console.warn("[AdMob] Error creating interstitial ad:", e);
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (this.interstitial && this.isInterstitialLoaded) {
      try {
        await this.interstitial.show();
        return true;
      } catch (e) {
        console.warn("[AdMob] Error showing interstitial ad:", e);
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
        console.log("[AdMob] Rewarded ad closed, preloading next ad");
        this.preloadRewarded();
      });

      this.rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isRewardedLoaded = false;
        console.warn("[AdMob] Rewarded ad error:", error);
      });

      this.rewarded.load();
    } catch (e) {
      console.warn("[AdMob] Error creating rewarded ad:", e);
    }
  }

  async showRewarded(onRewarded: (reward: { type: string; amount: number }) => void): Promise<boolean> {
    if (this.rewarded && this.isRewardedLoaded) {
      try {
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
        this.preloadRewarded();
        return false;
      }
    } else {
      console.log("[AdMob] Rewarded ad not ready, preloading now");
      this.preloadRewarded();
      return false;
    }
  }

  // ==========================================
  // App Open Ads
  // ==========================================

  preloadAppOpen(): void {
    try {
      const adUnitId = getAppOpenAdUnitId();
      this.appOpen = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      this.appOpen.addAdEventListener(AdEventType.LOADED, () => {
        this.isAppOpenLoaded = true;
        console.log("[AdMob] App Open ad loaded");
      });

      this.appOpen.addAdEventListener(AdEventType.CLOSED, () => {
        this.isAppOpenLoaded = false;
        console.log("[AdMob] App Open ad closed, preloading next ad");
        this.preloadAppOpen();
      });

      this.appOpen.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isAppOpenLoaded = false;
        console.warn("[AdMob] App Open ad error:", error);
      });

      this.appOpen.load();
    } catch (e) {
      console.warn("[AdMob] Error creating App Open ad:", e);
    }
  }

  async showAppOpen(): Promise<boolean> {
    if (this.appOpen && this.isAppOpenLoaded) {
      try {
        await this.appOpen.show();
        return true;
      } catch (e) {
        console.warn("[AdMob] Error showing App Open ad:", e);
        this.preloadAppOpen();
        return false;
      }
    } else {
      console.log("[AdMob] App Open ad not ready yet, preloading now");
      this.preloadAppOpen();
      return false;
    }
  }
}

export const AdMobService = new AdMobManager();
