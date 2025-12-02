import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { colors, spacing } from "../../theme";
import PrimaryButton from "../PrimaryButton";

type Props = {
  visible: boolean;
  email: string;
  inviting: boolean;
  onEmailChange: (email: string) => void;
  onInvite: () => void;
  onClose: () => void;
};

export default function InviteModal({
  visible,
  email,
  inviting,
  onEmailChange,
  onInvite,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Invite User</Text>
          <Text style={styles.modalSubtitle}>
            Enter the email address of the user you want to invite
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="user@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={onEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <PrimaryButton
              title={inviting ? "Inviting..." : "Send Invite"}
              onPress={onInvite}
              loading={inviting}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modalCancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
  },
});

