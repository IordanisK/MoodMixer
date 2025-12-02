import React, { useState, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { Track } from "../../api/rooms";
import { TrackMetadata } from "../../api/metadata";
import { colors, radii, RoomThemeId, roomThemes, spacing } from "../../theme";

type Props = {
  tracks: Track[];
  loading: boolean;
  nowPlayingId: string | null;
  trackMeta: Record<string, TrackMetadata>;
  roomTheme: RoomThemeId;
  onVote: (trackId: string, value: 1 | -1) => void;
  onSetNowPlaying: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onReorderTrack: (trackId: string, direction: "up" | "down") => void;
  onReorderTracks: (newTracks: Track[]) => void;
  settingNowPlayingFor: string | null;
};

function TrackList({
  tracks,
  loading,
  nowPlayingId,
  trackMeta,
  roomTheme,
  onVote,
  onSetNowPlaying,
  onDeleteTrack,
  onReorderTrack,
  onReorderTracks,
  settingNowPlayingFor,
}: Props) {
  const theme = roomThemes[roomTheme] || roomThemes.synthwave;
  
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  
  // Track layout positions
  const itemLayouts = useRef<{ top: number; height: number }[]>([]);
  const containerRef = useRef<View>(null);
  const containerTop = useRef(0);
  const isDragging = useRef(false);

  const updateTargetIndex = useCallback((clientY: number) => {
    if (draggedIndex === null) return;
    
    const relativeY = clientY - containerTop.current;
    let newTargetIndex = 0;
    
    for (let i = 0; i < itemLayouts.current.length; i++) {
      const layout = itemLayouts.current[i];
      if (layout && relativeY > layout.top + layout.height / 2) {
        newTargetIndex = i + 1;
      }
    }
    
    newTargetIndex = Math.max(0, Math.min(tracks.length - 1, newTargetIndex));
    setTargetIndex(newTargetIndex);
  }, [draggedIndex, tracks.length]);

  const handleDragStart = useCallback((index: number, clientY: number) => {
    isDragging.current = true;
    setDraggedIndex(index);
    setTargetIndex(index);
    setDragStartY(clientY);
    setDragY(0);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
      const newTracks = [...tracks];
      const [movedTrack] = newTracks.splice(draggedIndex, 1);
      newTracks.splice(targetIndex, 0, movedTrack);
      onReorderTracks(newTracks);
    }
    
    isDragging.current = false;
    setDraggedIndex(null);
    setTargetIndex(null);
    setDragY(0);
  }, [draggedIndex, targetIndex, tracks, onReorderTracks]);

  // Web-specific: track mouse movement globally when dragging
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current && draggedIndex !== null) {
        updateTargetIndex(e.clientY);
        setDragY(e.clientY - dragStartY);
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging.current) {
        handleDragEnd();
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedIndex, dragStartY, updateTargetIndex, handleDragEnd]);

  const handleContainerLayout = useCallback(() => {
    if (Platform.OS === 'web') {
      const element = containerRef.current as any;
      if (element?.getBoundingClientRect) {
        const rect = element.getBoundingClientRect();
        containerTop.current = rect.top + window.scrollY;
      }
    } else {
      containerRef.current?.measureInWindow((x, y) => {
        containerTop.current = y;
      });
    }
  }, []);

  const handleItemLayout = useCallback((index: number, event: any) => {
    const { y, height } = event.nativeEvent.layout;
    itemLayouts.current[index] = { top: y, height };
  }, []);

  return (
    <View 
      ref={containerRef}
      style={styles.container}
      onLayout={handleContainerLayout}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {loading ? "Loading tracks..." : "Tracks in this room"}
        </Text>
        <Text style={styles.subtitle}>
          Queue plays from top to bottom. Drag ☰ to reorder.
        </Text>
      </View>

      {tracks.length === 0 && !loading && (
        <Text style={styles.emptyText}>
          No tracks yet. Be the first DJ in here 🎧
        </Text>
      )}

      <View style={{ paddingBottom: spacing.lg }}>
        {tracks.map((item, index) => {
          const isNowPlaying = nowPlayingId === item.id;
          const meta = trackMeta[item.id];
          const isFirst = index === 0;
          const isLast = index === tracks.length - 1;
          const isBeingDragged = draggedIndex === index;
          const showDropAbove = targetIndex === index && draggedIndex !== null && draggedIndex > index;
          const showDropBelow = targetIndex === index && draggedIndex !== null && draggedIndex < index;

          return (
            <View 
              key={item.id}
              onLayout={(e) => handleItemLayout(index, e)}
            >
              {showDropAbove && (
                <View style={[styles.dropIndicator, { backgroundColor: theme.accent }]} />
              )}
              
              <TrackCard
                item={item}
                index={index}
                meta={meta}
                isNowPlaying={isNowPlaying}
                isFirst={isFirst}
                isLast={isLast}
                isBeingDragged={isBeingDragged}
                dragY={isBeingDragged ? dragY : 0}
                theme={theme}
                settingNowPlayingFor={settingNowPlayingFor}
                onVote={onVote}
                onSetNowPlaying={onSetNowPlaying}
                onDeleteTrack={onDeleteTrack}
                onReorderTrack={onReorderTrack}
                onDragStart={handleDragStart}
              />
              
              {showDropBelow && (
                <View style={[styles.dropIndicator, { backgroundColor: theme.accent }]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(TrackList);

type TrackCardProps = {
  item: Track;
  index: number;
  meta?: TrackMetadata;
  isNowPlaying: boolean;
  isFirst: boolean;
  isLast: boolean;
  isBeingDragged: boolean;
  dragY: number;
  theme: any;
  settingNowPlayingFor: string | null;
  onVote: (trackId: string, value: 1 | -1) => void;
  onSetNowPlaying: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onReorderTrack: (trackId: string, direction: "up" | "down") => void;
  onDragStart: (index: number, clientY: number) => void;
};

const TrackCard = memo(function TrackCard({
  item,
  index,
  meta,
  isNowPlaying,
  isFirst,
  isLast,
  isBeingDragged,
  dragY,
  theme,
  settingNowPlayingFor,
  onVote,
  onSetNowPlaying,
  onDeleteTrack,
  onReorderTrack,
  onDragStart,
}: TrackCardProps) {

  const handleDragHandleMouseDown = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    onDragStart(index, e.clientY);
  }, [index, onDragStart]);

  // Dynamic styles for dragging
  const dragStyle = isBeingDragged && Platform.OS === 'web' ? {
    transform: `translateY(${dragY}px) scale(1.02)`,
    boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
    zIndex: 1000,
    position: 'relative' as const,
  } : {};

  return (
    <View
      style={[
        styles.trackCard,
        isNowPlaying && { borderColor: theme.accent },
        isBeingDragged && styles.dragging,
        isBeingDragged && { borderColor: theme.accent },
        Platform.OS === 'web' && dragStyle,
      ]}
    >
      {/* Drag handle */}
      <View 
        style={styles.queueControls}
        // @ts-ignore - web specific props
        onMouseDown={Platform.OS === 'web' ? handleDragHandleMouseDown : undefined}
      >
        <View style={[
          styles.dragHandleContainer,
          Platform.OS === 'web' && { cursor: isBeingDragged ? 'grabbing' : 'grab' } as any,
        ]}>
          <Text style={[
            styles.dragHandle, 
            isBeingDragged && { color: theme.accent }
          ]}>☰</Text>
        </View>
        <Text style={styles.queueNumber}>{index + 1}</Text>
        <TouchableOpacity
          onPress={() => onReorderTrack(item.id, "up")}
          disabled={isFirst}
          style={[styles.reorderButton, isFirst && styles.reorderButtonDisabled]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.reorderText, isFirst && styles.reorderTextDisabled]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onReorderTrack(item.id, "down")}
          disabled={isLast}
          style={[styles.reorderButton, isLast && styles.reorderButtonDisabled]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.reorderText, isLast && styles.reorderTextDisabled]}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.trackPreviewRow}>
          {meta?.thumbnail ? (
            <Image
              source={{ uri: meta.thumbnail }}
              style={styles.trackThumbnail}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.trackTitle}>
              {meta?.title || item.url}
            </Text>
            {meta?.author || item.note ? (
              <Text style={styles.trackAuthor} numberOfLines={1}>
                {meta?.author || item.note}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.trackActions}>
          <TouchableOpacity
            onPress={() => onSetNowPlaying(item.id)}
            disabled={settingNowPlayingFor === item.id || isBeingDragged}
          >
            <Text style={styles.setNowPlayingText}>
              {settingNowPlayingFor === item.id
                ? "Setting…"
                : isNowPlaying
                ? "Now playing ✅"
                : "Set as now playing"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onDeleteTrack(item.id)}
            style={styles.deleteButton}
            disabled={isBeingDragged}
          >
            <Text style={styles.deleteText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.voteColumn}>
        <TouchableOpacity
          onPress={() => onVote(item.id, 1)}
          activeOpacity={0.7}
          style={styles.voteButton}
          disabled={isBeingDragged}
        >
          <Text style={styles.voteText}>👍</Text>
          <Text style={styles.voteCount}>{item.upvotes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onVote(item.id, -1)}
          activeOpacity={0.7}
          style={styles.voteButton}
          disabled={isBeingDragged}
        >
          <Text style={styles.voteText}>👎</Text>
          <Text style={styles.voteCount}>{item.downvotes}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
  },
  headerRow: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: "center",
  },
  dropIndicator: {
    height: 3,
    borderRadius: 2,
    marginVertical: 2,
    marginHorizontal: 4,
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: "rgba(55,65,81,0.9)",
    // @ts-ignore - web transition
    transition: 'transform 0.05s ease-out, box-shadow 0.15s ease-out',
  },
  dragging: {
    backgroundColor: colors.card,
  },
  queueControls: {
    alignItems: "center",
    marginRight: spacing.sm,
    minWidth: 32,
  },
  dragHandleContainer: {
    padding: 4,
    marginBottom: 2,
  },
  dragHandle: {
    color: colors.textMuted,
    fontSize: 18,
  },
  queueNumber: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  reorderButton: {
    padding: 2,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  reorderText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "600",
  },
  reorderTextDisabled: {
    color: colors.textMuted,
  },
  trackPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  trackThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  trackAuthor: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  trackActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  setNowPlayingText: {
    color: colors.accent,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  deleteButton: {
    marginTop: spacing.xs,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
  },
  voteColumn: {
    marginLeft: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  voteButton: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  voteText: {
    fontSize: 16,
  },
  voteCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
