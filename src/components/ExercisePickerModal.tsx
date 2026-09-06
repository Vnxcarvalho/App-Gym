// components/ExercisePickerModal.tsx
//
// Modal full-screen para buscar/filtrar exercícios do catálogo (exercises).
// FlatList virtualizada (a lista pode crescer bastante com exercícios custom do usuário)
// em vez de ScrollView + .map — evita renderizar linhas fora da tela em telas pequenas.
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_OPTIONS, MUSCLE_GROUP_ORDER } from "../constants/muscleGroups";
import { useExerciseLibrary } from "../context/ExerciseLibraryContext";
import { useResponsive } from "../hooks/useResponsive";

export type ExerciseCatalogItem = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
};

// Catálogo padrão (exercises.user_id = null no schema — visível a todos por padrão).
// Exercícios criados pelo usuário entram na "biblioteca" viva via ExerciseLibraryContext.
export const DEFAULT_EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  { id: "ex-1", name: "Agachamento Livre", muscleGroup: "legs", equipment: "barbell" },
  { id: "ex-2", name: "Leg Press 45°", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-3", name: "Cadeira Extensora", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-4", name: "Stiff com Barra", muscleGroup: "legs", equipment: "barbell" },
  { id: "ex-5", name: "Supino Reto", muscleGroup: "chest", equipment: "barbell" },
  { id: "ex-6", name: "Supino Inclinado", muscleGroup: "chest", equipment: "dumbbell" },
  { id: "ex-7", name: "Crucifixo", muscleGroup: "chest", equipment: "dumbbell" },
  { id: "ex-8", name: "Puxada Alta", muscleGroup: "back", equipment: "cable" },
  { id: "ex-9", name: "Remada Curvada", muscleGroup: "back", equipment: "barbell" },
  { id: "ex-10", name: "Remada Baixa", muscleGroup: "back", equipment: "cable" },
  { id: "ex-11", name: "Desenvolvimento Militar", muscleGroup: "shoulders", equipment: "barbell" },
  { id: "ex-12", name: "Elevação Lateral", muscleGroup: "shoulders", equipment: "dumbbell" },
  { id: "ex-13", name: "Rosca Direta", muscleGroup: "biceps", equipment: "barbell" },
  { id: "ex-14", name: "Tríceps Corda", muscleGroup: "triceps", equipment: "cable" },
  { id: "ex-15", name: "Panturrilha em Pé", muscleGroup: "calves", equipment: "machine" },
  { id: "ex-16", name: "Abdominal Supra", muscleGroup: "abs", equipment: "bodyweight" },
  { id: "ex-17", name: "Supino Inclinado no Smith", muscleGroup: "chest", equipment: "machine" },
  { id: "ex-18", name: "Desenvolvimento com Halter", muscleGroup: "shoulders", equipment: "dumbbell" },
  { id: "ex-19", name: "Cadeira Adutora", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-20", name: "RDL (Levantamento Romeno)", muscleGroup: "legs", equipment: "barbell" },
  { id: "ex-21", name: "Cadeira Flexora", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-22", name: "Desenvolvimento no Smith", muscleGroup: "shoulders", equipment: "machine" },
  { id: "ex-23", name: "Supino Reto com Halter", muscleGroup: "chest", equipment: "dumbbell" },
  { id: "ex-24", name: "Crucifixo Inclinado na Polia", muscleGroup: "chest", equipment: "cable" },
  { id: "ex-25", name: "Cadeira Abdutora", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-26", name: "Mesa Flexora", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-27", name: "Flexor Unilateral", muscleGroup: "legs", equipment: "machine" },
  { id: "ex-28", name: "Elevação Pélvica", muscleGroup: "glutes", equipment: "barbell" },
  { id: "ex-29", name: "Adução de Glúteo na Polia", muscleGroup: "glutes", equipment: "cable" },
  { id: "ex-30", name: "Coice na Polia", muscleGroup: "glutes", equipment: "cable" },
];

type Props = {
  visible: boolean;
  alreadyAddedIds: string[];
  onClose: () => void;
  onAdd: (exercise: ExerciseCatalogItem) => void;
};

type ListRow =
  | { kind: "header"; muscleGroup: string }
  | { kind: "item"; exercise: ExerciseCatalogItem };

export default function ExercisePickerModal({ visible, alreadyAddedIds, onClose, onAdd }: Props) {
  const { library, addCustomExercise, removeExercise } = useExerciseLibrary();
  const { contentMaxWidth } = useResponsive();
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState<string | null>(null);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  const filtered = useMemo(() => {
    return library.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesMuscle = !muscleFilter || ex.muscleGroup === muscleFilter;
      return matchesSearch && matchesMuscle;
    });
  }, [search, muscleFilter, library]);

  // Agrupado na ordem peito / costas / ombros / braços / pernas (+ demais
  // grupos depois), em vez da ordem alfabética crua que vinha do banco.
  const rows = useMemo<ListRow[]>(() => {
    const sorted = [...filtered].sort((a, b) => {
      const orderDiff = MUSCLE_GROUP_ORDER.indexOf(a.muscleGroup) - MUSCLE_GROUP_ORDER.indexOf(b.muscleGroup);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const result: ListRow[] = [];
    let lastGroup: string | null = null;
    for (const exercise of sorted) {
      if (exercise.muscleGroup !== lastGroup) {
        result.push({ kind: "header", muscleGroup: exercise.muscleGroup });
        lastGroup = exercise.muscleGroup;
      }
      result.push({ kind: "item", exercise });
    }
    return result;
  }, [filtered]);

  function handleDeleteExercise(exercise: ExerciseCatalogItem) {
    Alert.alert("Excluir exercício?", `"${exercise.name}" será removido da biblioteca.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await removeExercise(exercise.id);
          } catch (err: any) {
            const inUse = err?.code === "23503" || String(err?.message ?? "").includes("workout_exercises");
            Alert.alert(
              "Não foi possível excluir",
              inUse
                ? "Esse exercício já está em uso em um treino. Remova-o do treino antes de excluir da biblioteca."
                : err.message ?? "Tente novamente."
            );
          }
        },
      },
    ]);
  }

  function handleClose() {
    setSearch("");
    setMuscleFilter(null);
    closeCreateForm();
    onClose();
  }

  function openCreateForm(prefillName = "") {
    // Se o nome já veio preenchido (buscou, não achou, tocou em "Criar"), o
    // teclado some pra deixar os grupos musculares visíveis — a pessoa só
    // digita de novo se tocar no campo. Sem prefill (toque manual em "Criar
    // exercício personalizado"), o teclado abre normal pro nome.
    if (prefillName) Keyboard.dismiss();
    setCustomName(prefillName);
    setCustomMuscle(null);
    setCreating(true);
  }

  function closeCreateForm() {
    setCreating(false);
    setCustomName("");
    setCustomMuscle(null);
  }

  function handleAdd(exercise: ExerciseCatalogItem) {
    onAdd(exercise);
    setSearch(""); // limpa a busca pra facilitar adicionar o próximo exercício
  }

  async function handleCreateCustom() {
    if (!customName.trim() || !customMuscle || submittingCustom) return;
    setSubmittingCustom(true);
    try {
      const created = await addCustomExercise({
        name: customName.trim(),
        muscleGroup: customMuscle,
        equipment: "other",
      }); // entra na biblioteca — outros treinos/usuários também acham
      handleAdd(created); // e já entra no treino atual, limpando a busca
      closeCreateForm();
    } catch (err: any) {
      Alert.alert("Não foi possível criar o exercício", err.message ?? "Tente novamente.");
    } finally {
      setSubmittingCustom(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={[styles.centeredColumn, { maxWidth: contentMaxWidth }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={8}
            accessibilityLabel="Voltar"
          >
            <Ionicons name="chevron-back" size={26} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Adicionar exercício</Text>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row) => (row.kind === "header" ? `header-${row.muscleGroup}` : row.exercise.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar exercício"
                  placeholderTextColor={COLORS.textTertiary}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              <FlatList
                horizontal
                data={MUSCLE_GROUP_OPTIONS}
                keyExtractor={(item) => item.value}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => {
                  const active = muscleFilter === item.value;
                  return (
                    <Pressable
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setMuscleFilter(active ? null : item.value)}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              {creating ? (
                <View style={styles.createCard}>
                  <Text style={styles.createLabel}>Nome do exercício</Text>
                  <TextInput
                    style={styles.createInput}
                    placeholder="Ex: Cadeira Abdutora"
                    placeholderTextColor={COLORS.textTertiary}
                    value={customName}
                    onChangeText={setCustomName}
                    autoFocus={!customName.trim()}
                    returnKeyType="done"
                  />

                  <Text style={[styles.createLabel, { marginTop: 14 }]}>Grupo muscular</Text>
                  <View style={styles.createMuscleGrid}>
                    {MUSCLE_GROUP_OPTIONS.map((item) => {
                      const active = customMuscle === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          style={[styles.filterChip, active && styles.filterChipActive]}
                          onPress={() => setCustomMuscle(item.value)}
                        >
                          <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.createActionsRow}>
                    <Pressable style={styles.createCancelButton} onPress={closeCreateForm}>
                      <Text style={styles.createCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.createConfirmButton,
                        (!customName.trim() || !customMuscle) && styles.createConfirmButtonDisabled,
                      ]}
                      onPress={handleCreateCustom}
                      disabled={!customName.trim() || !customMuscle || submittingCustom}
                    >
                      {submittingCustom ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.createConfirmText}>Adicionar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.createToggle} onPress={() => openCreateForm()}>
                  <Ionicons name="add" size={18} color={COLORS.accent} />
                  <Text style={styles.createToggleText}>Criar exercício personalizado</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item: row }) => {
            if (row.kind === "header") {
              return (
                <Text style={styles.groupHeader}>{MUSCLE_GROUP_LABELS[row.muscleGroup] ?? row.muscleGroup}</Text>
              );
            }

            const exercise = row.exercise;
            const added = alreadyAddedIds.includes(exercise.id);
            return (
              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.rowMain, pressed && !added && styles.rowPressed]}
                  disabled={added}
                  onPress={() => handleAdd(exercise)}
                >
                  <Text style={styles.rowName}>{exercise.name}</Text>
                  <Text style={styles.rowMeta}>{MUSCLE_GROUP_LABELS[exercise.muscleGroup]}</Text>
                </Pressable>

                <Pressable
                  style={styles.deleteBadge}
                  onPress={() => handleDeleteExercise(exercise)}
                  hitSlop={8}
                  accessibilityLabel={`Excluir ${exercise.name}`}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.textTertiary} />
                </Pressable>

                <Pressable
                  style={[styles.addBadge, added && styles.addBadgeDone]}
                  disabled={added}
                  onPress={() => handleAdd(exercise)}
                  hitSlop={4}
                >
                  <Ionicons
                    name={added ? "checkmark" : "add"}
                    size={20}
                    color={added ? COLORS.success : "#FFF"}
                  />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            !creating ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {search.trim()
                    ? `Nenhum exercício encontrado para "${search.trim()}"`
                    : "Nenhum exercício encontrado"}
                </Text>
                {search.trim().length > 0 && (
                  <Pressable
                    style={styles.emptyCreateButton}
                    onPress={() => openCreateForm(search.trim())}
                  >
                    <Ionicons name="add" size={16} color={COLORS.accent} />
                    <Text style={styles.emptyCreateText}>Criar "{search.trim()}"</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />

        <View style={styles.footer}>
          <Pressable style={styles.doneButton} onPress={handleClose}>
            <Text style={styles.doneButtonText}>Concluir</Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredColumn: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48, // alvo de toque confortável + área de digitação
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.accent,
  },
  createToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 20,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.accent,
  },
  createToggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.accent,
  },
  createCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  createLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  createInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  createMuscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  createActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  createCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  createCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  createConfirmButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  createConfirmButtonDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
  createConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64, // linha inteira é o alvo de toque, não só o ícone
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  rowMain: {
    flex: 1,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  rowMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  deleteBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  addBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addBadgeDone: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.success,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  emptyCreateText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  doneButton: {
    height: 52, // CTA principal, acima do mínimo de 44px
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
