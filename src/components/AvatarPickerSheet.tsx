// components/AvatarPickerSheet.tsx
//
// Menu de opções pra trocar a foto de perfil: câmera, galeria/arquivos e,
// se já existe uma foto, removê-la (volta a exibir o avatar padrão "ghost").
import React, { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { uploadAvatar, removeAvatar } from "../lib/profileApi";

type Props = {
  visible: boolean;
  userId: string;
  currentAvatarUrl: string | null;
  onClose: () => void;
  onChanged: (avatarUrl: string | null) => void;
};

export default function AvatarPickerSheet({
  visible,
  userId,
  currentAvatarUrl,
  onClose,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handlePickedAsset(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      const url = await uploadAvatar(userId, asset.uri, asset.mimeType ?? "image/jpeg");
      onChanged(url);
      onClose();
    } catch (err: any) {
      Alert.alert("Não foi possível enviar a foto", err.message ?? "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o acesso à câmera pra tirar a foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    await handlePickedAsset(result);
  }

  async function handleLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o acesso às fotos/arquivos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    await handlePickedAsset(result);
  }

  async function handleRemove() {
    if (!currentAvatarUrl) return;
    setBusy(true);
    try {
      await removeAvatar(userId, currentAvatarUrl);
      onChanged(null);
      onClose();
    } catch (err: any) {
      Alert.alert("Não foi possível remover a foto", err.message ?? "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop} edges={["top", "bottom"]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Foto de perfil</Text>

          {busy ? (
            <ActivityIndicator color={COLORS.accent} style={{ paddingVertical: 24 }} />
          ) : (
            <View style={styles.optionsRow}>
              <Pressable style={styles.option} onPress={handleCamera}>
                <View style={styles.optionIconCircle}>
                  <Ionicons name="camera-outline" size={24} color={COLORS.accent} />
                </View>
                <Text style={styles.optionLabel}>Câmera</Text>
              </Pressable>

              <Pressable style={styles.option} onPress={handleLibrary}>
                <View style={styles.optionIconCircle}>
                  <Ionicons
                    name={Platform.OS === "web" ? "folder-outline" : "images-outline"}
                    size={24}
                    color={COLORS.accent}
                  />
                </View>
                <Text style={styles.optionLabel}>{Platform.OS === "web" ? "Arquivos" : "Galeria"}</Text>
              </Pressable>

              {currentAvatarUrl && (
                <Pressable style={styles.option} onPress={handleRemove}>
                  <View style={[styles.optionIconCircle, styles.optionIconCircleDanger]}>
                    <Ionicons name="trash-outline" size={24} color="#FF4D4D" />
                  </View>
                  <Text style={[styles.optionLabel, styles.optionLabelDanger]}>Remover</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable style={styles.cancelButton} onPress={onClose} disabled={busy}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 20,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    marginBottom: 20,
  },
  option: {
    alignItems: "center",
    gap: 8,
  },
  optionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconCircleDanger: {
    backgroundColor: "rgba(255,77,77,0.12)",
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  optionLabelDanger: {
    color: "#FF4D4D",
  },
  cancelButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
});
