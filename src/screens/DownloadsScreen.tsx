import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  Share,
  Linking,
  Clipboard,
} from "react-native";
import { GlassContainer } from "../components/GlassContainer";
import { StorageService } from "../services/storage";
import { DownloadRecord } from "../types";

interface DownloadsScreenProps {
  onNavigateHome: () => void;
  accentColor?: string;
}

export const DownloadsScreen: React.FC<DownloadsScreenProps> = ({
  onNavigateHome,
  accentColor = "#10B981",
}) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "video" | "audio" | "image">("all");
  const [loading, setLoading] = useState(true);

  const loadDownloads = useCallback(async () => {
    setLoading(true);
    try {
      const records = await StorageService.getDownloads();
      setDownloads(records);
    } catch (e) {
      console.warn("Failed to load downloads:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  const filteredDownloads = useMemo(() => {
    return downloads.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.filePath.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        activeCategory === "all" || item.category === activeCategory;

      return matchesSearch && matchesCat;
    });
  }, [downloads, searchQuery, activeCategory]);

  const handleOpenFile = async (item: DownloadRecord) => {
    try {
      const uri = item.filePath.startsWith("file://")
        ? item.filePath
        : `file://${item.filePath}`;
      const supported = await Linking.canOpenURL(uri);
      if (supported) {
        await Linking.openURL(uri);
      } else {
        Clipboard.setString(item.filePath);
        Alert.alert(
          "File Path Copied",
          `Cannot automatically launch player.\nFile location copied to clipboard:\n\n${item.filePath}`
        );
      }
    } catch (e) {
      Clipboard.setString(item.filePath);
      Alert.alert(
        "File Location",
        `Saved at:\n${item.filePath}\n\nPath copied to clipboard.`
      );
    }
  };

  const handleShare = async (item: DownloadRecord) => {
    try {
      await Share.share({
        title: item.title,
        message: `${item.title}\nSaved with Vitre Downloader`,
        url: item.filePath.startsWith("file://") ? item.filePath : `file://${item.filePath}`,
      });
    } catch (e) {
      console.warn("Share failed:", e);
    }
  };

  const handleCopyPath = (filePath: string) => {
    Clipboard.setString(filePath);
    Alert.alert("Copied", "File path copied to clipboard.");
  };

  const handleDelete = (item: DownloadRecord) => {
    Alert.alert(
      "Remove Download",
      `Remove "${item.title}" from download history?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await StorageService.removeDownload(item.id);
            await loadDownloads();
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <GlassContainer style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Downloads</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{downloads.length}</Text>
          </View>
        </View>

        {/* Search Input */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search downloads..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filters */}
        <View style={styles.filtersRow}>
          {(
            [
              { id: "all", label: "All" },
              { id: "video", label: "Videos" },
              { id: "audio", label: "Audio" },
              { id: "image", label: "Images" },
            ] as const
          ).map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: accentColor },
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassContainer>

      {/* Downloads List */}
      <FlatList
        data={filteredDownloads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <GlassContainer style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No matching files" : "No downloads yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "Try searching for a different title or keyword."
                : "Downloaded videos, audio tracks, and covers will appear here."}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={[styles.startDownloadBtn, { backgroundColor: accentColor }]}
                onPress={onNavigateHome}
                activeOpacity={0.8}
              >
                <Text style={styles.startDownloadBtnText}>⚡ Start a Download</Text>
              </TouchableOpacity>
            )}
          </GlassContainer>
        }
        renderItem={({ item }) => (
          <GlassContainer style={styles.itemCard} interactive>
            <View style={styles.itemContent}>
              {item.thumbnail ? (
                <View style={styles.thumbWrapper}>
                  <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
                  {item.duration > 0 && (
                    <View style={styles.thumbDuration}>
                      <Text style={styles.thumbDurationText}>
                        {formatDuration(item.duration)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {item.category.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.thumbWrapper, styles.placeholderThumb]}>
                  <Text style={styles.placeholderIcon}>
                    {item.category === "audio"
                      ? "🎵"
                      : item.category === "image"
                      ? "🖼️"
                      : "🎬"}
                  </Text>
                </View>
              )}

              <View style={styles.detailsCol}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  {(item.actualResolution || item.formatLabel) ? (
                    <View style={styles.formatTag}>
                      <Text style={styles.formatTagText}>{item.actualResolution || item.formatLabel}</Text>
                    </View>
                  ) : null}
                  {item.fileSize > 0 && (
                    <Text style={styles.metaText}>
                      {formatFileSize(item.fileSize)}
                    </Text>
                  )}
                  <Text style={styles.metaText}>•</Text>
                  <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>
            </View>

            {/* Action Bar */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => handleOpenFile(item)}
              >
                <Text style={styles.actionBtnPrimaryText}>▶ Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => handleShare(item)}
              >
                <Text style={styles.actionBtnSecondaryText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => handleCopyPath(item.filePath)}
              >
                <Text style={styles.actionBtnSecondaryText}>Copy Path</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnDanger}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.actionBtnDangerText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </GlassContainer>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerCard: {
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F4F4F5",
    letterSpacing: 0.5,
  },
  countBadge: {
    marginLeft: 10,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(24, 24, 27, 0.65)",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: "#F4F4F5",
    fontSize: 14,
    paddingVertical: 8,
  },
  clearSearch: {
    color: "#71717A",
    fontSize: 14,
    padding: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(24, 24, 27, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#052e16",
    fontWeight: "800",
  },
  listContent: {
    paddingBottom: 90,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
    marginTop: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F4F4F5",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  startDownloadBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  startDownloadBtnText: {
    color: "#052e16",
    fontWeight: "700",
    fontSize: 14,
  },
  itemCard: {
    padding: 12,
    marginBottom: 10,
  },
  itemContent: {
    flexDirection: "row",
    gap: 12,
  },
  thumbWrapper: {
    width: 90,
    height: 70,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#18181B",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  placeholderThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIcon: {
    fontSize: 28,
  },
  thumbDuration: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbDurationText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  categoryBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(16, 185, 129, 0.8)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  categoryBadgeText: {
    color: "#052e16",
    fontSize: 8,
    fontWeight: "800",
  },
  detailsCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  itemTitle: {
    color: "#F4F4F5",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  formatTag: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  formatTagText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "700",
  },
  metaText: {
    color: "#71717A",
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  actionBtnPrimary: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.4)",
  },
  actionBtnPrimaryText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "700",
  },
  actionBtnSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionBtnSecondaryText: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
  },
  actionBtnDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionBtnDangerText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "600",
  },
});
