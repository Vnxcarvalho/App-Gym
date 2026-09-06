// screens/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import { useAuth } from "../context/AuthContext";

type Mode = "signIn" | "signUp";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "signUp";
  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && (!isSignUp || name.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);

    const result = isSignUp
      ? await signUp(email.trim(), password, name.trim())
      : await signIn(email.trim(), password);

    setLoading(false);

    if (result.error) {
      setError(translateAuthError(result.error));
    } else if (isSignUp) {
      setError(null);
      setMode("signIn");
      setError("Conta criada. Verifique seu e-mail para confirmar o cadastro, se necessário.");
    }
    // sucesso no login: AuthContext atualiza a sessão e a navegação troca de tela sozinha
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formColumn}>
        <View style={styles.logoMark}>
          <Ionicons name="barbell" size={26} color={COLORS.accent} />
        </View>

        <Text style={styles.title}>{isSignUp ? "Criar conta" : "Bem-vindo de volta"}</Text>
        <Text style={styles.subtitle}>
          {isSignUp
            ? "Cadastre-se para começar a registrar seus treinos"
            : "Entre para continuar sua evolução"}
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isSignUp && (
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu nome"
              placeholderTextColor={COLORS.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="voce@email.com"
            placeholderTextColor={COLORS.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={COLORS.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>{isSignUp ? "Criar conta" : "Entrar"}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchModeButton}
          onPress={() => {
            setMode(isSignUp ? "signIn" : "signUp");
            setError(null);
          }}
        >
          <Text style={styles.switchModeText}>
            {isSignUp ? "Já tem conta? " : "Ainda não tem conta? "}
            <Text style={styles.switchModeTextAccent}>{isSignUp ? "Entrar" : "Criar conta"}</Text>
          </Text>
        </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function translateAuthError(message: string): string {
  const known: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "User already registered": "Já existe uma conta com este e-mail.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  };
  return known[message] ?? message;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingTop: 80,
    paddingBottom: 48,
  },
  formColumn: {
    width: "100%",
    maxWidth: 400,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 28,
  },
  errorBanner: {
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  field: {
    marginBottom: 18,
  },
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
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 8,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
  submitText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  switchModeButton: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  switchModeTextAccent: {
    color: COLORS.accent,
    fontWeight: "700",
  },
});
