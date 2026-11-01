import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { GlassContainer } from "./GlassContainer";
import { AdMobService } from "../services/admob";

interface DeveloperSupportModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
}

export const DeveloperSupportModal: React.FC<DeveloperSupportModalProps> = ({
  visible,
  onClose,
  accentColor = "#10B981",
}) => {
  const [adLoading, setAdLoading] = useState(false);

  const handleWatchAd = async () => {
    setAdLoading(true);
    try {
      // Try to show the App Open Ad (user's live ad unit)
      let shown = await AdMobService.showAppOpen();

      // If not ready, try rewarded ad
      if (!shown) {
        shown = await AdMobService.showRewarded(() => {
          Alert.alert(
            "Heartfelt Thanks! ❤️",
            "Thank you so much for your support! Your view directly keeps Vitre Downloader active and continuously improved."
          );
        });
      }

      // If rewarded ad wasn't ready, try showing interstitial
      if (!shown) {
        shown = await AdMobService.showInterstitial();
      }

      if (!shown) {
        Alert.alert(
          "Ad Loading",
          "The ad is still preparing in the background. Thank you for your kindness! You can also support anytime from Settings."
        );
      }
    } catch (e) {
      console.warn("Failed to present ad:", e);
    } finally {
      setAdLoading(false);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.ambientGlow} pointerEvents="none" />

        <GlassContainer style={styles.modalCard} interactive>
          {/* Header Icon & Tag */}
          <View style={styles.iconContainer}>
            <Text style={styles.headerEmoji}>👨‍💻</Text>
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>INDEPENDENT CREATOR</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Message From Developer</Text>

          {/* User's Exact Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              "I'm an independent developer, and your support means a lot to me.
              Please consider watching the ad that appears when you open the
              app. It helps me maintain and improve the app as a solo developer.
              Every view makes a difference. Thank you for your support!"
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: accentColor },
                adLoading && styles.buttonDisabled,
              ]}
              onPress={handleWatchAd}
              disabled={adLoading}
              activeOpacity={0.8}
            >
              {adLoading ? (
                <ActivityIndicator color="#052e16" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Watch Ad & Support ❤️
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              disabled={adLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Continue to App</Text>
            </TouchableOpacity>
          </View>
        </GlassContainer>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  ambientGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  headerEmoji: {
    fontSize: 44,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: "#052e16",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    color: "#F4F4F5",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  messageContainer: {
    backgroundColor: "rgba(24, 24, 27, 0.65)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 20,
  },
  messageText: {
    color: "#D4D4D8",
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
    fontStyle: "italic",
  },
  actionsContainer: {
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#052e16",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
  },
});
