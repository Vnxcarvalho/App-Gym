// screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { useAuth } from "../context/AuthContext";
import { useWorkouts } from "../context/WorkoutsContext";
import { fetchProfile, updateProfile, Profile } from "../lib/profileApi";
import { useAdmin } from "../context/AdminContext";
import { useResponsive } from "../hooks/useResponsive";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullIndicator from "../components/PullIndicator";
import AvatarPickerSheet from "../components/AvatarPickerSheet";

function formatMemberSince(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------
// Linha de campo editável (rótulo + valor + lápis -> input + confirmar)
// ---------------------------------------------------------

function EditableField({
  label,
  value,
  placeholder,
  keyboardType = "default",
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: "default" | "numeric";
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Não foi possível salvar", err.message ?? "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <View style={styles.fieldEditRow}>
          <TextInput
            style={styles.fieldInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textTertiary}
            keyboardType={keyboardType}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Pressable style={styles.fieldConfirmButton} onPress={handleConfirm} hitSlop={8}>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.success} />
            ) : (
              <Ionicons name="checkmark" size={16} color={COLORS.success} />
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.fieldViewRow} onPress={() => setEditing(true)}>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {value || placeholder}
          </Text>
          <Ionicons name="create-outline" size={16} color={COLORS.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------
// Componente principal
// ---------------------------------------------------------

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { workouts, refetch: refetchWorkouts } = useWorkouts();
  const { isAdmin, effectiveUserId, viewingUser } = useAdmin();
  const { contentMaxWidth } = useResponsive();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  // Enquanto o admin está "visualizando como" outro usuário, essa tela lê e
  // salva os dados DELE (nome, altura) — só e-mail e sair da conta continuam
  // sempre ligados à sessão real do admin, que não tem acesso ao e-mail alheio.
  const userId = effectiveUserId;
  const email = viewingUser ? null : session?.user.email ?? "";

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchProfile(userId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => console.warn("Falha ao carregar perfil:", err.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleRefresh() {
    if (!userId) return;
    await Promise.all([fetchProfile(userId).then(setProfile), refetchWorkouts()]);
  }

  const { pullAnim, handlers: pullHandlers } = usePullToRefresh(handleRefresh);

  async function handleSaveName(name: string) {
    if (!userId || !name) return;
    await updateProfile(userId, { name });
    setProfile((prev) => (prev ? { ...prev, name } : prev));
  }

  function handleSignOut() {
    Alert.alert("Sair da conta", "Deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  }

  if (loading || !profile) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PullIndicator pullAnim={pullAnim} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} {...pullHandlers}>
      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
      <Text style={styles.screenTitle}>Perfil</Text>

      <View style={styles.avatarBlock}>
        <Pressable style={styles.avatarCircle} onPress={() => setAvatarPickerVisible(true)}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={36} color={COLORS.textTertiary} />
          )}
          <View style={styles.avatarEditOverlay}>
            <Ionicons name="camera" size={14} color="#FFF" />
          </View>
        </Pressable>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{email ?? "Editando via Painel Admin"}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workouts.length}</Text>
          <Text style={styles.statLabel}>
            treino{workouts.length !== 1 ? "s" : ""} cadastrado{workouts.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatMemberSince(profile.createdAt)}</Text>
          <Text style={styles.statLabel}>membro desde</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dados pessoais</Text>

        <EditableField label="Nome" value={profile.name} placeholder="Seu nome" onSave={handleSaveName} />

        {email && (
          <>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>E-mail</Text>
              <Text style={[styles.fieldValue, styles.fieldValueMuted]}>{email}</Text>
            </View>
          </>
        )}
      </View>

      {isAdmin && (
        <Pressable style={styles.adminButton} onPress={() => router.push("/admin")}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textPrimary} />
          <Text style={styles.adminButtonText}>Painel Admin</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
        </Pressable>
      )}

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.accent} />
        <Text style={styles.signOutText}>Sair da conta</Text>
      </Pressable>
      </View>
      </ScrollView>

      {userId && (
        <AvatarPickerSheet
          visible={avatarPickerVisible}
          userId={userId}
          currentAvatarUrl={profile.avatarUrl}
          onClose={() => setAvatarPickerVisible(false)}
          onChanged={(avatarUrl) => setProfile((prev) => (prev ? { ...prev, avatarUrl } : prev))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { alignItems: "center", justifyContent: "center" },
  scrollContent: { alignItems: "center" },
  content: { width: "100%", padding: 24, paddingBottom: 48 },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 24,
  },
  avatarBlock: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  avatarEditOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  fieldViewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
  },
  fieldValueMuted: {
    color: COLORS.textSecondary,
    fontWeight: "400",
  },
  fieldEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  fieldConfirmButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  adminButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.accent,
  },
});
