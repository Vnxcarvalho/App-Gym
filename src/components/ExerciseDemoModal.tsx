// components/ExerciseDemoModal.tsx
//
// Mostra o gif/vídeo/imagem de demonstração do exercício (exercises.demo_media_url).
// Sem link cadastrado ainda, cai num placeholder genérico — os links entram
// exercício a exercício conforme a academia for enviando o material.
import React, { useState } from "react";
import { Modal, View, Text, Image, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

type Props = {
  visible: boolean;
  exerciseName: string;
  demoMediaUrl?: string | null;
  onClose: () => void;
};

export default function ExerciseDemoModal({ visible, exerciseName, demoMediaUrl, onClose }: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  function handleClose() {
    setImageFailed(false);
    onClose();
  }

  const showImage = !!demoMediaUrl && !imageFailed;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <SafeAreaView style={styles.backdrop} edges={["top", "bottom"]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {showImage ? (
            <Image
              source={{ uri: demoMediaUrl! }}
              style={styles.media}
              resizeMode="contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIconCircle}>
                <Ionicons name="barbell-outline" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.placeholderTitle}>Demonstração em breve</Text>
              <Text style={styles.placeholderSubtitle}>
                {imageFailed
                  ? "Não conseguimos carregar o link cadastrado."
                  : "Essa academia ainda não cadastrou um gif ou vídeo pra esse exercício."}
              </Text>
            </View>
          )}

          {imageFailed && demoMediaUrl && (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(demoMediaUrl)}>
              <Ionicons name="open-outline" size={16} color={COLORS.accent} />
              <Text style={styles.linkButtonText}>Abrir link</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  media: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
  },
  placeholder: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  placeholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 17,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
  },
});
