// components/AlertHost.tsx
//
// Montado uma vez na raiz do app (_layout.tsx). Escuta o módulo lib/alert e
// renderiza um modal no estilo do app sempre que algo chama Alert.alert —
// substitui o Alert nativo (no-op no navegador) e o window.confirm/alert
// (feio e trava a página) por algo consistente com o resto da UI.
import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "../constants/theme";
import { subscribeAlert, dismissAlert, AlertState, AlertButton } from "../lib/alert";
import { useResponsive } from "../hooks/useResponsive";

export default function AlertHost() {
  const [state, setState] = useState<AlertState | null>(null);
  const { contentMaxWidth } = useResponsive();

  useEffect(() => subscribeAlert(setState), []);

  if (!state) return null;

  function handlePress(button: AlertButton) {
    dismissAlert();
    button.onPress?.();
  }

  const cancelButton = state.buttons.find((b) => b.style === "cancel");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => cancelButton && handlePress(cancelButton)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth: Math.min(360, contentMaxWidth) }]}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}

          <View style={state.buttons.length > 1 ? styles.buttonsRow : styles.buttonsColumn}>
            {state.buttons.map((button, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.button,
                  button.style === "destructive" && styles.destructiveButton,
                  button.style !== "destructive" && button.style !== "cancel" && styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handlePress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === "destructive" && styles.destructiveText,
                    button.style !== "destructive" && button.style !== "cancel" && styles.primaryText,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  buttonsColumn: {
    marginTop: 8,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  destructiveButton: {
    backgroundColor: "transparent",
    borderColor: COLORS.accent,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  primaryText: {
    color: "#FFF",
  },
  destructiveText: {
    color: COLORS.accent,
  },
});
