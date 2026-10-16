import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { GlassContainer } from "./GlassContainer";

export type TabType = "home" | "downloads" | "settings";

interface NavigationTabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  downloadsCount?: number;
}

export const NavigationTabBar: React.FC<NavigationTabBarProps> = ({
  activeTab,
  onSelectTab,
  downloadsCount = 0,
}) => {
  const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: "home", label: "Home", icon: "⚡" },
    { id: "downloads", label: "Downloads", icon: "📥" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <View style={styles.wrapper}>
      <GlassContainer style={styles.barContainer} interactive>
        <View style={styles.innerRow}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => onSelectTab(tab.id)}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                    {tab.icon}
                  </Text>
                  {tab.id === "downloads" && downloadsCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {downloadsCount > 99 ? "99+" : downloadsCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {tab.label}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
  },
  barContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "rgba(14, 24, 17, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.22)",
    elevation: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  innerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 16,
    position: "relative",
  },
  tabButtonActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  iconContainer: {
    position: "relative",
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.65,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#71717A",
  },
  tabLabelActive: {
    color: "#34D399",
    fontWeight: "700",
  },
  activeIndicator: {
    position: "absolute",
    bottom: 2,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#10B981",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: "center",
  },
  badgeText: {
    color: "#052e16",
    fontSize: 9,
    fontWeight: "800",
  },
});
