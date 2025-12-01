import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
  Platform,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { Room, fetchRooms, createRoom, joinRoomByCode, deleteRoom } from "../api/rooms";
import GradientBackground from "../components/GradientBackground";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { colors, radii, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Rooms">;

type RoomItemProps = {
  item: Room;
  index: number;
  user: any;
  deletingRoomId: string | null;
  onDelete: (roomId: string, roomName: string) => void;
  onPress: (slug: string) => void;
};

function RoomItem({ item, index, user, deletingRoomId, onDelete, onPress }: RoomItemProps) {
  const itemAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 350,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const isCreator = user && item.createdBy === user.uid;
  const isDeleting = deletingRoomId === item.id;

  // Debug logging
  React.useEffect(() => {
    if (isCreator) {
      console.log("Room is deletable:", item.name, "createdBy:", item.createdBy, "user.uid:", user?.uid);
    }
  }, []);

  return (
    <Animated.View
      style={{
        opacity: itemAnim,
        transform: [
          {
            translateY: itemAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <View style={styles.roomCard}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.85}
            onPress={() => onPress(item.slug || item.id)}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.roomDescription}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.roomPill}>Enter</Text>
            </View>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity
              onPress={() => {
                console.log("Delete button clicked for room:", item.id, item.name);
                onDelete(item.id, item.name);
              }}
              disabled={isDeleting}
              style={[
                styles.deleteButton,
                { opacity: isDeleting ? 0.5 : 1 }
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteButtonText}>
                {isDeleting ? "..." : "🗑️"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function RoomListScreen({ navigation }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const { logOut, user } = useAuth();

  const anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await fetchRooms();
      setRooms(data);
    } catch (e) {
      console.log("Error loading rooms", e);
      Alert.alert("Error", "Could not load rooms.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      Alert.alert("Hold up 🛑", "Give your room a name first ✨");
      return;
    }

    try {
      const newRoom = await createRoom({ name, description });
      setRooms((prev) => [newRoom, ...prev]);
      setName("");
      setDescription("");
      Alert.alert("Success 🎉", "Your magical place is ready ✨");
    } catch (e) {
      console.log("Error creating room", e);
      Alert.alert(
        "Oops 💥",
        "Something went wrong when creating your magical place💥"
      );
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      Alert.alert("Hold up 🛑", "Please enter a room code");
      return;
    }

    try {
      setJoining(true);
      const result = await joinRoomByCode(joinCode.trim().toUpperCase());
      
      if (result.alreadyMember) {
        Alert.alert("Already a member", "You're already in this room!");
      } else {
        Alert.alert("Success 🎉", `Joined ${result.room.name}!`);
        // Reload rooms to show the newly joined room
        await loadRooms();
        // Navigate to the room using slug
        if (result.room.slug) {
          navigation.navigate("RoomDetail", { slug: result.room.slug });
        }
      }
      setJoinCode("");
    } catch (e: any) {
      console.log("Error joining room", e);
      const errorMessage =
        e.response?.data?.error || "Invalid room code. Please try again.";
      Alert.alert("Oops 💥", errorMessage);
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    console.log("handleDeleteRoom called:", roomId, roomName);
    
    const performDelete = async () => {
      console.log("Delete confirmed, calling API...");
      try {
        setDeletingRoomId(roomId);
        const result = await deleteRoom(roomId);
        console.log("Delete successful:", result);
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        
        if (Platform.OS === "web") {
          alert("Success 🎉\nRoom deleted successfully");
        } else {
          Alert.alert("Success 🎉", "Room deleted successfully");
        }
      } catch (e: any) {
        console.log("Error deleting room", e);
        console.log("Error response:", e.response?.data);
        const errorMessage =
          e.response?.data?.error || "Failed to delete room. Please try again.";
        
        if (Platform.OS === "web") {
          alert(`Oops 💥\n${errorMessage}`);
        } else {
          Alert.alert("Oops 💥", errorMessage);
        }
      } finally {
        setDeletingRoomId(null);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${roomName}"? This action cannot be undone.`
      );
      if (confirmed) {
        await performDelete();
      } else {
        console.log("Delete cancelled");
      }
    } else {
      Alert.alert(
        "Delete Room",
        `Are you sure you want to delete "${roomName}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => console.log("Delete cancelled") },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ]
      );
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const headerAnimStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, 0],
        }),
      },
    ],
  };


  return (
    <GradientBackground>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.topRow, headerAnimStyle]}>
          <View>
            <Text style={styles.title}>Your rooms</Text>
            <Text style={styles.subtitle}>Craft different vibes & moods.</Text>
          </View>
          <TouchableOpacity onPress={logOut}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.formCard, headerAnimStyle]}>
          <Text style={styles.label}>Create new room</Text>
          <TextInput
            style={styles.input}
            placeholder="Room name (e.g. Study Focus)"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />
          <PrimaryButton title="Create room" onPress={handleCreateRoom} />
        </Animated.View>

        <Animated.View style={[styles.formCard, headerAnimStyle]}>
          <Text style={styles.label}>Join room by code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit room code"
            placeholderTextColor={colors.textMuted}
            value={joinCode}
            onChangeText={(text) => setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            autoCapitalize="characters"
            maxLength={6}
          />
          <PrimaryButton
            title={joining ? "Joining..." : "Join room"}
            onPress={handleJoinByCode}
            disabled={joining || !joinCode.trim()}
          />
        </Animated.View>

        <Text style={styles.sectionTitle}>
          {loading ? "Loading..." : "Active rooms"}
        </Text>

        {rooms.map((item, index) => (
          <RoomItem
            key={item.id}
            item={item}
            index={index}
            user={user}
            deletingRoomId={deletingRoomId}
            onDelete={handleDeleteRoom}
            onPress={(slug) => navigation.navigate("RoomDetail", { slug })}
          />
        ))}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  logout: {
    color: colors.textMuted,
    fontSize: 12,
  },
  formCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.6)",
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.cardSoft,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  roomCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roomName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  roomDescription: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  roomPill: {
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    marginLeft: spacing.sm,
    padding: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 40,
    minHeight: 40,
    borderRadius: spacing.xs,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  deleteButtonText: {
    fontSize: 18,
    lineHeight: 20,
  },
});
