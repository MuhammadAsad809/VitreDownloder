import React, { useState } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import {
  BannerAd,
  BannerAdSize,
} from "react-native-google-mobile-ads";
import { getBannerAdUnitId } from "../services/admob";

interface AdBannerProps {
  size?: BannerAdSize;
  style?: StyleProp<ViewStyle>;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  style,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const adUnitId = getBannerAdUnitId();

  if (loadError) {
    // If ad fails to load, gracefully collapse view
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        isLoaded ? styles.loadedBorder : styles.hidden,
        style,
      ]}
    >
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          setIsLoaded(true);
          setLoadError(null);
        }}
        onAdFailedToLoad={(error) => {
          console.warn("[AdBanner] Ad failed to load:", error);
          setLoadError(error.message);
          setIsLoaded(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    width: "100%",
    backgroundColor: "rgba(9, 14, 10, 0.75)",
  },
  loadedBorder: {
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  hidden: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
  },
});
