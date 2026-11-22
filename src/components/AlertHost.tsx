// components/AlertHost.tsx
//
// Montado uma vez na raiz do app (_layout.tsx). Escuta o módulo lib/alert e
// renderiza um modal no estilo do app sempre que algo chama Alert.alert —
// substitui o Alert nativo (no-op no navegador) e o window.confirm/alert
// (feio e trava a página) por algo consistente com o resto da UI.
//
// Dois formatos:
//  - até 2 botões: diálogo de confirmação centralizado, botões lado a lado;
//  - 3+ botões: menu de ações em lista vertical (bottom sheet no celular,
//    cartão centralizado em tela larga), com "Cancelar" separado no fim.
import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { COLORS } from "../constants/theme";
import { subscribeAlert, dismissAlert, AlertState, AlertButton } from "../lib/alert";
import { useResponsive } from "../hooks/useResponsive";

export default function AlertHost() {
  const [state, setState] = useState<AlertState | null>(null);
  const { isTablet, height } = useResponsive();

  useEffect(() => subscribeAlert(setState), []);

  if (!state) return null;

  function handlePress(button: AlertButton) {
    dismissAlert();
    button.onPress?.();
  }

  const cancelButton = state.buttons.find((b) => b.style === "cancel");
  const isMenu = state.buttons.length > 2;
  const sheet = isMenu && !isTablet; // menu ancorado embaixo só no celular

  if (isMenu) {
    const actions = state.buttons.filter((b) => b.style !== "cancel");
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => cancelButton && handlePress(cancelButton)}
      >
        <Pressable
          style={[styles.backdrop, sheet && styles.backdropSheet]}
          onPress={() => cancelButton && handlePress(cancelButton)}
        >
          {/* Pressable interno impede que tocar no cartão feche o menu */}
          <Pressable
            style={[styles.menuCard, sheet ? styles.menuCardSheet : styles.menuCardCentered]}
            onPress={() => {}}
          >
            {sheet && <View style={styles.grabber} />}

            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle} numberOfLines={2}>
                {state.title}
              </Text>
              {state.message ? (
                <Text style={styles.menuMessage} numberOfLines={2}>
                  {state.message}
                </Text>
              ) : null}
            </View>

            <ScrollView
              style={{ maxHeight: Math.max(200, height * 0.55) }}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.actionsGroup}>
                {actions.map((button, index) => {
                  const destructive = button.style === "destructive";
                  return (
                    <Pressable
                      key={index}
                      style={({ pressed }) => [
                        styles.actionRow,
                        index > 0 && styles.actionRowDivider,
                        pressed && styles.actionRowPressed,
                      ]}
                      onPress={() => handlePress(button)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.actionText, destructive && styles.actionTextDestructive]}>
                        {button.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {cancelButton && (
              <Pressable
                style={({ pressed }) => [styles.cancelRow, pressed && styles.actionRowPressed]}
                onPress={() => handlePress(cancelButton)}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>{cancelButton.text}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => cancelButton && handlePress(cancelButton)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
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
  backdropSheet: {
    justifyContent: "flex-end",
    padding: 0,
  },

  // ----- Diálogo de confirmação (1–2 botões) -----
  card: {
    width: "100%",
    maxWidth: 360,
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
    minHeight: 46,
    paddingHorizontal: 8,
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
    textAlign: "center",
  },
  primaryText: {
    color: "#FFF",
  },
  destructiveText: {
    color: COLORS.accent,
  },

  // ----- Menu de ações (3+ botões) -----
  menuCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  menuCardSheet: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
  },
  menuCardCentered: {
    maxWidth: 380,
    borderRadius: 22,
    paddingTop: 20,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.hairline,
    marginBottom: 12,
  },
  menuHeader: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 14,
    gap: 2,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  menuMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  actionsGroup: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  actionRow: {
    minHeight: 54,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionRowPressed: {
    backgroundColor: COLORS.border,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  actionTextDestructive: {
    color: COLORS.accent,
  },
  cancelRow: {
    minHeight: 54,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
});
