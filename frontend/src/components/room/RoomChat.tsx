import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
} from "react-native";
import { ChatMessage, MessageType } from "../../api/chat";
import { colors, radii, spacing, roomThemes, RoomThemeId } from "../../theme";

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onSendText: (text: string) => void;
  onSendImage: (imageBase64: string) => void;
  onSendGif: (gifUrl: string) => void;
  onSendVoice: (audioBase64: string, duration: number) => void;
  roomTheme: RoomThemeId;
};

const GIPHY_API_KEY = "GlVGYHkr3WSBnllca54iNt0yFbjz7L65"; // Public beta key

// Component to handle GIF messages with dynamic aspect ratio
function GifMessage({ url }: { url: string }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    Image.getSize(
      url,
      (width, height) => {
        if (width && height) {
          setAspectRatio(width / height);
        }
      },
      () => {
        // On error, use default square aspect ratio
        setAspectRatio(1);
      }
    );
  }, [url]);

  return (
    <View style={styles.messageGifContainer}>
      <Image
        source={{ uri: url }}
        style={[
          styles.messageGif,
          aspectRatio ? { aspectRatio } : { aspectRatio: 1 },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

export default function RoomChat({
  messages,
  loading,
  sending,
  onSendText,
  onSendImage,
  onSendGif,
  onSendVoice,
  roomTheme,
}: Props) {
  const [text, setText] = useState("");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [searchingGifs, setSearchingGifs] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0); // Ref to track recording time for closure
  const streamRef = useRef<MediaStream | null>(null); // Store stream for cleanup

  const theme = roomThemes[roomTheme] || roomThemes.synthwave;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSendText(text);
    setText("");
  };

  // GIF search
  const searchGifs = async () => {
    if (!gifQuery.trim()) return;
    try {
      setSearchingGifs(true);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
        gifQuery
      )}&limit=20&rating=pg`;
      const res = await fetch(url);
      const json = await res.json();
      setGifResults(json.data || []);
    } catch (e) {
      console.log("Giphy search error", e);
    } finally {
      setSearchingGifs(false);
    }
  };

  const selectGif = (gifUrl: string) => {
    onSendGif(gifUrl);
    setShowGifPicker(false);
    setGifQuery("");
    setGifResults([]);
  };

  // Compress image to reduce size for Firestore storage
  const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      const canvas = document.createElement("canvas");
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to JPEG for better compression
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
          console.log("📷 Image compressed:", Math.round(compressedBase64.length / 1024), "KB");
          resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  // Image handling
  const handleImageSelect = () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        
        console.log("📷 Image selected:", file.name, file.type, Math.round(file.size / 1024), "KB");
        
        try {
          // Compress the image before sending
          const compressedBase64 = await compressImage(file);
          console.log("📷 Sending compressed image...");
          onSendImage(compressedBase64);
        } catch (err) {
          console.log("📷 Error compressing image:", err);
        }
      };
      input.click();
    }
  };

  // Handle paste for images
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          try {
            console.log("📷 Image pasted:", file.type, Math.round(file.size / 1024), "KB");
            const compressedBase64 = await compressImage(file);
            onSendImage(compressedBase64);
          } catch (err) {
            console.log("📷 Error compressing pasted image:", err);
          }
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onSendImage]);

  // Voice recording
  const startRecording = async () => {
    if (Platform.OS !== "web") return;

    try {
      console.log("🎤 Starting recording...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingTimeRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("🎤 Recording stopped, duration:", recordingTimeRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          console.log("🎤 Audio loaded, sending...");
          onSendVoice(base64, recordingTimeRef.current);
        };
        reader.onerror = (err) => {
          console.log("🎤 Error reading audio:", err);
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        setRecordingTime(0);
        recordingTimeRef.current = 0;
      };

      mediaRecorder.start(100); // Collect data every 100ms for better reliability
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer - update both state and ref
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);
      
      console.log("🎤 Recording started");
    } catch (e) {
      console.log("🎤 Error starting recording", e);
    }
  };

  const stopRecording = () => {
    console.log("🎤 Stop recording called, isRecording:", isRecording);
    if (mediaRecorderRef.current && isRecording) {
      // Stop the timer first
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Then stop the recorder (this triggers onstop)
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderMessage = (item: ChatMessage) => {
    const messageType = item.type || "text";

    return (
      <View style={styles.messageRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.userName?.[0]?.toUpperCase() || "?"}
          </Text>
        </View>
        <View style={styles.bubbleWrapper}>
          <View style={[styles.bubble, { borderColor: theme.accentSoft }]}>
            <Text style={styles.userName}>{item.userName}</Text>
            
            {messageType === "text" && item.text && (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
            
            {messageType === "image" && item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            )}
            
            {messageType === "gif" && item.gifUrl && (
              <GifMessage url={item.gifUrl} />
            )}
            
            {messageType === "voice" && item.voiceUrl && (
              <View style={styles.voiceMessage}>
                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      const audio = new Audio(item.voiceUrl);
                      audio.play();
                    }
                  }}
                >
                  <Text style={styles.playIcon}>▶</Text>
                </TouchableOpacity>
                <View style={styles.voiceWaveform}>
                  {[...Array(12)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveBar,
                        { 
                          height: 8 + Math.random() * 12,
                          backgroundColor: theme.accent,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.voiceDuration}>
                  {item.voiceDuration ? formatTime(item.voiceDuration) : "0:00"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room chat</Text>
      <Text style={styles.subtitle}>
        Talk about the vibe, share GIFs, images & voice notes.
      </Text>

      <View style={styles.messagesCard}>
        {loading && messages.length === 0 ? (
          <Text style={styles.helperText}>Loading messages…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.helperText}>No messages yet. Say hi 👋</Text>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderMessage(item)}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        )}
      </View>

      {/* Input Row with Icons */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          {/* GIF Button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowGifPicker(true)}
          >
            <Text style={styles.iconText}>GIF</Text>
          </TouchableOpacity>

          {/* Image Button */}
          <TouchableOpacity style={styles.iconButton} onPress={handleImageSelect}>
            <Text style={styles.iconEmoji}>🖼️</Text>
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
          />

          {/* Voice/Send Button */}
          {text.trim() ? (
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.accent }]}
              onPress={handleSubmit}
              disabled={sending}
            >
              <Text style={styles.sendText}>{sending ? "…" : "→"}</Text>
            </TouchableOpacity>
          ) : isRecording ? (
            <TouchableOpacity
              style={[styles.recordingButton, { backgroundColor: "#ef4444" }]}
              onPress={stopRecording}
            >
              <Text style={styles.recordingText}>⏹ {formatTime(recordingTime)}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.iconButton, styles.micButton]}
              onPress={startRecording}
            >
              <Text style={styles.iconEmoji}>🎤</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>


      {/* GIF Picker Modal */}
      <Modal
        visible={showGifPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGifPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.gifPickerModal}>
            <View style={styles.gifPickerHeader}>
              <Text style={styles.gifPickerTitle}>Search GIFs</Text>
              <TouchableOpacity onPress={() => setShowGifPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gifSearchRow}>
              <TextInput
                style={styles.gifSearchInput}
                placeholder="Search for GIFs…"
                placeholderTextColor={colors.textMuted}
                value={gifQuery}
                onChangeText={setGifQuery}
                onSubmitEditing={searchGifs}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: theme.accent }]}
                onPress={searchGifs}
                disabled={searchingGifs}
              >
                <Text style={styles.searchButtonText}>
                  {searchingGifs ? "…" : "🔍"}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={gifResults}
              keyExtractor={(item) => item.id}
              numColumns={2}
              style={styles.gifGrid}
              renderItem={({ item }) => {
                const gifUrl = item.images.fixed_height.url;
                return (
                  <TouchableOpacity
                    style={styles.gifItem}
                    onPress={() => selectGif(gifUrl)}
                  >
                    <Image source={{ uri: gifUrl }} style={styles.gifPreview} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                !searchingGifs ? (
                  <Text style={styles.gifEmptyText}>
                    Search for GIFs to send in chat
                  </Text>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
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
    marginBottom: spacing.sm,
  },
  messagesCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
    minHeight: 100,
    maxHeight: 400,
    height: 300,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    paddingVertical: spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(31,41,55,1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubble: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  userName: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
  },
  messageImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginTop: 4,
  },
  messageGifContainer: {
    maxWidth: "50%",
    marginTop: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  messageGif: {
    width: "100%",
    height: undefined,
    borderRadius: 8,
  },
  voiceMessage: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    color: "#fff",
    fontSize: 12,
  },
  voiceWaveform: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    flex: 1,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceDuration: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 8,
  },
  inputContainer: {
    marginTop: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(31,41,55,0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
  },
  iconText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
  },
  iconEmoji: {
    fontSize: 16,
  },
  micButton: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderColor: "rgba(59,130,246,0.5)",
  },
  input: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: "rgba(15,23,42,0.95)",
    fontSize: 13,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingButton: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  recordingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  gifPickerModal: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    maxHeight: "70%",
  },
  gifPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  gifPickerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    color: colors.textMuted,
    fontSize: 20,
    padding: 4,
  },
  gifSearchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.md,
  },
  gifSearchInput: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: "rgba(15,23,42,0.95)",
    fontSize: 14,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: {
    fontSize: 18,
  },
  gifGrid: {
    flex: 1,
  },
  gifItem: {
    flex: 1,
    margin: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  gifPreview: {
    width: "100%",
    height: 120,
  },
  gifEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    padding: spacing.lg,
  },
});
