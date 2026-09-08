// components/CreateStudentModal.tsx
//
// Form do Painel Admin pra cadastrar um aluno: staff define nome, e-mail e
// uma senha provisória (passada ao aluno fora do app, ex. verbalmente/WhatsApp).
// A conta já sai pronta pra uso — sem depender de e-mail de confirmação.
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { createStudent } from "../lib/profileApi";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function generatePassword() {
  // 6 dígitos numéricos — fácil de repassar verbalmente/por WhatsApp na recepção.
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function CreateStudentModal({ visible, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPassword(generatePassword());
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || password.length < 6 || submitting) return;
    setSubmitting(true);
    try {
      await createStudent(name.trim(), email.trim(), password);
      Alert.alert(
        "Aluno cadastrado",
        `Conta criada para ${name.trim()}.\nE-mail: ${email.trim()}\nSenha provisória: ${password}\n\nRepasse esses dados pro aluno.`
      );
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert("Não foi possível cadastrar", err.message ?? "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!name.trim() && !!email.trim() && password.length >= 6;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={COLORS.textSecondary} />
            </Pressable>
            <Text style={styles.headerTitle}>Cadastrar aluno</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do aluno"
              placeholderTextColor={COLORS.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="aluno@exemplo.com"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Senha provisória</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.regenButton} onPress={() => setPassword(generatePassword())} hitSlop={8}>
                <Ionicons name="refresh" size={18} color={COLORS.accent} />
              </Pressable>
            </View>
            <Text style={styles.hint}>
              O aluno usa esses dados pra entrar. Ele pode trocar a senha depois, no perfil.
            </Text>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Cadastrar</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  regenButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hint: { fontSize: 12, color: COLORS.textTertiary, marginTop: 8, lineHeight: 17 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { backgroundColor: COLORS.surfaceAlt },
  submitButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
