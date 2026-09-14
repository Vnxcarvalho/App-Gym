// components/AvatarEditModal.tsx
//
// Ajuste da foto antes de confirmar: arrasta pra reposicionar, +/- pra dar
// zoom e um botão de rotação em passos de 90°. O resultado final é sempre um
// quadrado (vira o avatar redondo na tela de perfil).
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImageManipulator from "expo-image-manipulator";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";

const FRAME = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onConfirm: (result: { uri: string; mimeType: string }) => void;
};

export default function AvatarEditModal({ visible, uri, onCancel, onConfirm }: Props) {
  const [workingUri, setWorkingUri] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotating, setRotating] = useState(false);
  const [saving, setSaving] = useState(false);

  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Reseta o editor sempre que uma imagem nova é aberta (ou o modal fecha).
  useEffect(() => {
    if (!visible || !uri) return;
    setWorkingUri(uri);
    setNaturalSize(null);
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    Image.getSize(
      uri,
      (width, height) => setNaturalSize({ width, height }),
      () => Alert.alert("Não foi possível abrir a imagem", "Tente escolher outra foto.")
    );
  }, [visible, uri]);

  function displayScaleFor(zoomValue: number, size: { width: number; height: number }) {
    const baseScale = FRAME / Math.min(size.width, size.height);
    return baseScale * zoomValue;
  }

  function clampOffset(
    candidate: { x: number; y: number },
    zoomValue: number,
    size: { width: number; height: number }
  ) {
    const scale = displayScaleFor(zoomValue, size);
    const displayWidth = size.width * scale;
    const displayHeight = size.height * scale;
    const minX = FRAME - displayWidth;
    const minY = FRAME - displayHeight;
    return {
      x: Math.min(0, Math.max(minX, candidate.x)),
      y: Math.min(0, Math.max(minY, candidate.y)),
    };
  }

  // Centraliza a imagem no frame sempre que ela muda de tamanho (foto nova ou
  // depois de rotacionar) — ponto de partida prevísivel antes de arrastar/zoom.
  useEffect(() => {
    if (!naturalSize) return;
    const scale = displayScaleFor(zoom, naturalSize);
    const displayWidth = naturalSize.width * scale;
    const displayHeight = naturalSize.height * scale;
    setOffset({ x: (FRAME - displayWidth) / 2, y: (FRAME - displayHeight) / 2 });
  }, [naturalSize]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = offsetRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!naturalSize) return;
        setOffset(
          clampOffset(
            { x: dragStartRef.current.x + gesture.dx, y: dragStartRef.current.y + gesture.dy },
            zoom,
            naturalSize
          )
        );
      },
    })
  ).current;

  function handleZoom(delta: number) {
    if (!naturalSize) return;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev, nextZoom, naturalSize));
  }

  async function handleRotate() {
    if (!workingUri || rotating || saving) return;
    setRotating(true);
    try {
      const result = await ImageManipulator.manipulateAsync(workingUri, [{ rotate: 90 }], {
        format: ImageManipulator.SaveFormat.JPEG,
      });
      setWorkingUri(result.uri);
      setZoom(MIN_ZOOM);
      setNaturalSize({ width: result.width, height: result.height });
    } catch (err: any) {
      Alert.alert("Não foi possível rotacionar", err.message ?? "Tente novamente.");
    } finally {
      setRotating(false);
    }
  }

  async function handleConfirm() {
    if (!workingUri || !naturalSize || saving) return;
    setSaving(true);
    try {
      const scale = displayScaleFor(zoom, naturalSize);
      const cropSize = Math.round(FRAME / scale);
      const cropX = Math.min(
        Math.max(0, Math.round(-offset.x / scale)),
        naturalSize.width - cropSize
      );
      const cropY = Math.min(
        Math.max(0, Math.round(-offset.y / scale)),
        naturalSize.height - cropSize
      );

      const result = await ImageManipulator.manipulateAsync(
        workingUri,
        [
          { crop: { originX: cropX, originY: cropY, width: cropSize, height: cropSize } },
          { resize: { width: 512, height: 512 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onConfirm({ uri: result.uri, mimeType: "image/jpeg" });
    } catch (err: any) {
      Alert.alert("Não foi possível ajustar a foto", err.message ?? "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const scale = naturalSize ? displayScaleFor(zoom, naturalSize) : 1;
  const displayWidth = naturalSize ? naturalSize.width * scale : FRAME;
  const displayHeight = naturalSize ? naturalSize.height * scale : FRAME;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <SafeAreaView style={styles.backdrop} edges={["top", "bottom"]}>
        <Text style={styles.title}>Ajustar foto</Text>

        <View style={styles.frameWrapper}>
          <View style={styles.frame} {...panResponder.panHandlers}>
            {workingUri && naturalSize && (
              <Image
                source={{ uri: workingUri }}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: displayWidth,
                  height: displayHeight,
                }}
              />
            )}
            {(!naturalSize || rotating) && (
              <View style={styles.frameLoading}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            )}
          </View>
          <View pointerEvents="none" style={styles.frameRing} />
        </View>

        <Text style={styles.hint}>Arraste pra reposicionar</Text>

        <View style={styles.controlsRow}>
          <Pressable
            style={styles.controlButton}
            onPress={() => handleZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
          >
            <Ionicons
              name="remove"
              size={20}
              color={zoom <= MIN_ZOOM ? COLORS.textTertiary : COLORS.textPrimary}
            />
          </Pressable>

          <Pressable style={styles.controlButton} onPress={handleRotate} disabled={rotating || saving}>
            <Ionicons name="reload-outline" size={20} color={COLORS.textPrimary} />
          </Pressable>

          <Pressable
            style={styles.controlButton}
            onPress={() => handleZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
          >
            <Ionicons
              name="add"
              size={20}
              color={zoom >= MAX_ZOOM ? COLORS.textTertiary : COLORS.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={saving || !naturalSize}>
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.confirmText}>Usar foto</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 20,
  },
  frameWrapper: {
    width: FRAME,
    height: FRAME,
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: FRAME / 2,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceAlt,
  },
  frameLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  frameRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: FRAME / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 14,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 22,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
    width: "100%",
    maxWidth: FRAME,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  confirmButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});
