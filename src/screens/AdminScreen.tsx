// screens/AdminScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useAdmin } from "../context/AdminContext";
import { useAuth } from "../context/AuthContext";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullIndicator from "../components/PullIndicator";
import { Alert } from "../lib/alert";
import { fetchAllProfiles, deleteProfile, Profile } from "../lib/profileApi";
import { fetchWorkoutCountsByUser } from "../lib/workoutsApi";

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function AdminScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAdmin, startViewingUser, viewingUser, stopViewingUser } = useAdmin();
  const { contentMaxWidth } = useResponsive();
  const [users, setUsers] = useState<Profile[]>([]);
  const [workoutCounts, setWorkoutCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([fetchAllProfiles(), fetchWorkoutCountsByUser()])
      .then(([profiles, counts]) => {
        if (!cancelled) {
          setUsers(profiles);
          setWorkoutCounts(counts);
        }
      })
      .catch((err) => {
        console.warn("Falha ao carregar usuários:", err.message);
        if (!cancelled) Alert.alert("Não foi possível carregar os usuários", err.message ?? "Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function handleRefresh() {
    const [profiles, counts] = await Promise.all([fetchAllProfiles(), fetchWorkoutCountsByUser()]);
    setUsers(profiles);
    setWorkoutCounts(counts);
  }

  const { pullAnim, handlers: pullHandlers } = usePullToRefresh(handleRefresh);

  const filtered = useMemo(
    () => users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase())),
    [users, search]
  );

  // Sempre volta pras abas via replace — nunca via back(). Essa tela pode ter
  // sido aberta direto por URL (refresh, link compartilhado), caso em que não
  // há histórico de navegação e back() trava com "GO_BACK not handled".
  function closeAdmin() {
    router.replace("/(tabs)");
  }

  function handleSelect(user: Profile) {
    startViewingUser({ id: user.id, name: user.name });
    closeAdmin();
  }

  function handleDeleteUser(user: Profile) {
    Alert.alert(
      "Excluir perfil?",
      `O perfil de "${user.name}" e TODOS os treinos e o histórico dele serão apagados permanentemente. Essa ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProfile(user.id);
              if (viewingUser?.id === user.id) stopViewingUser();
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch (err: any) {
              Alert.alert("Não foi possível excluir", err.message ?? "Tente novamente.");
            }
          },
        },
      ]
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.deniedState}>
          <Ionicons name="lock-closed-outline" size={28} color={COLORS.textTertiary} />
          <Text style={styles.deniedText}>Área restrita ao super admin.</Text>
          <Pressable style={styles.backLink} onPress={closeAdmin}>
            <Text style={styles.backLinkText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.centeredColumn, { maxWidth: contentMaxWidth }]}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={closeAdmin} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Painel Admin</Text>
        </View>

        <Text style={styles.subtitle}>
          Selecione um usuário pra visualizar e editar os treinos dele.
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuário"
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>

        <PullIndicator pullAnim={pullAnim} />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          {...pullHandlers}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
            ) : (
              <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
            )
          }
          renderItem={({ item }) => {
            const isSelf = item.id === session?.user.id;
            const workoutCount = workoutCounts[item.id] ?? 0;
            return (
              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>{getInitial(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      {item.role === "admin" && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>ADMIN</Text>
                        </View>
                      )}
                      {isSelf && <Text style={styles.selfLabel}>você</Text>}
                    </View>
                    <Text style={styles.rowMeta}>
                      {workoutCount} treino{workoutCount !== 1 ? "s" : ""} cadastrado
                      {workoutCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Ionicons name="eye-outline" size={18} color={COLORS.textTertiary} />
                </Pressable>

                {!isSelf && (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteUser(item)}
                    hitSlop={8}
                    accessibilityLabel={`Excluir perfil de ${item.name}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.textTertiary} />
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centeredColumn: { flex: 1, width: "100%", alignSelf: "center", paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 8, paddingBottom: 4 },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 18 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    minHeight: 64,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowPressed: { opacity: 0.7 },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 15, fontWeight: "700", color: COLORS.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  rowMeta: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  adminBadge: { backgroundColor: COLORS.accentMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  adminBadgeText: { fontSize: 9, fontWeight: "700", color: COLORS.accent, letterSpacing: 0.4 },
  selfLabel: { fontSize: 11, color: COLORS.textTertiary },
  emptyText: { fontSize: 13, color: COLORS.textTertiary, textAlign: "center", marginTop: 24 },
  deniedState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  deniedText: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center" },
  backLink: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16 },
  backLinkText: { fontSize: 13, fontWeight: "700", color: COLORS.accent },
});
