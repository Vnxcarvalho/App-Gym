// screens/WorkoutsScreen.tsx
//
// Requer: react-native-safe-area-context, react-native-gesture-handler
// (GestureHandlerRootView deve envolver a raiz do app — normalmente já é o caso
// quando se usa React Navigation).
import React, { useRef, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { MUSCLE_GROUP_LABELS, WEEKDAY_FULL_LABELS, WEEKDAY_LABELS } from "../constants/muscleGroups";
import WorkoutFormModal, { WorkoutDraft } from "../components/WorkoutFormModal";
import { useWorkouts } from "../context/WorkoutsContext";
import { useResponsive } from "../hooks/useResponsive";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullIndicator from "../components/PullIndicator";

const MAX_BADGES = 3;

function getMuscleGroups(workout: WorkoutDraft): string[] {
  return [...new Set(workout.exercises.map((e) => e.muscleGroup))];
}

// ---------------------------------------------------------
// Card de treino (com swipe-to-delete)
// ---------------------------------------------------------

function WorkoutCard({
  workout,
  compact,
  onPress,
  onDelete,
}: {
  workout: WorkoutDraft;
  compact: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const muscleGroups = getMuscleGroups(workout);
  const extraBadges = muscleGroups.length - MAX_BADGES;
  const count = workout.exercises.length;
  const activeDays = workout.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_FULL_LABELS[d])
    .join(", ");

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <Pressable
          style={styles.swipeDelete}
          onPress={() => {
            swipeRef.current?.close(); // fecha antes de confirmar, não fica aberto atrás do diálogo
            onDelete();
          }}
          accessibilityLabel={`Excluir treino ${workout.name}`}
        >
          <Ionicons name="trash-outline" size={22} color="#FFF" />
        </Pressable>
      )}
      overshootRight={false}
    >
      <Pressable
        style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${workout.name}, ${count} exercício${count !== 1 ? "s" : ""}${
          activeDays ? `, ${activeDays}` : ""
        }`}
      >
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]} numberOfLines={2}>
              {workout.name}
            </Text>
            <Text style={styles.exerciseCount}>
              {count} exercício{count !== 1 ? "s" : ""}
            </Text>
          </View>

          {muscleGroups.length > 0 && (
            <View style={styles.badgeRow}>
              {muscleGroups.slice(0, MAX_BADGES).map((mg) => (
                <View key={mg} style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {MUSCLE_GROUP_LABELS[mg]}
                  </Text>
                </View>
              ))}
              {extraBadges > 0 && (
                <View style={[styles.badge, styles.badgeExtra]}>
                  <Text style={[styles.badgeText, styles.badgeExtraText]}>+{extraBadges}</Text>
                </View>
              )}
            </View>
          )}

          {/* Dias ocupam a largura toda, distribuídos — legíveis e fáceis de bater o olho */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => {
              const active = workout.weekdays.includes(index);
              return (
                <View key={index} style={[styles.weekdayDot, active && styles.weekdayDotActive]}>
                  <Text style={[styles.weekdayDotText, active && styles.weekdayDotTextActive]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
      </Pressable>
    </Swipeable>
  );
}

// ---------------------------------------------------------
// Componente principal
// ---------------------------------------------------------

export default function WorkoutsScreen() {
  const { workouts, loading, refetch, addWorkout, updateWorkout, deleteWorkout } = useWorkouts();
  const { pullAnim, handlers: pullHandlers } = usePullToRefresh(refetch);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutDraft | null>(null);
  const insets = useSafeAreaInsets();
  const { width, columns, contentMaxWidth } = useResponsive();
  // celulares estreitos (iPhone SE/mini, Android compacto): menos padding e fontes menores
  const compact = width < 380;
  const sidePadding = compact ? 14 : 20;
  // em telas largas o conteúdo fica centralizado com espaço vazio nas laterais —
  // o FAB acompanha a borda direita da coluna de conteúdo, não a da janela
  const fabRightOffset = sidePadding + Math.max(0, (width - contentMaxWidth) / 2);

  function openCreate() {
    setEditingWorkout(null);
    setModalVisible(true);
  }

  function openEdit(workout: WorkoutDraft) {
    setEditingWorkout(workout);
    setModalVisible(true);
  }

  async function handleSave(draft: WorkoutDraft) {
    try {
      if (draft.id) {
        await updateWorkout(draft);
      } else {
        await addWorkout(draft);
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert("Não foi possível salvar o treino", err.message ?? "Tente novamente.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWorkout(id);
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert("Não foi possível excluir o treino", err.message ?? "Tente novamente.");
    }
  }

  // O swipe apagava na hora, sem pedir confirmação — fácil de acionar sem querer no celular.
  function confirmDelete(workout: WorkoutDraft) {
    Alert.alert("Excluir treino?", `"${workout.name}" será removido permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => handleDelete(workout.id!) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PullIndicator pullAnim={pullAnim} />
      <FlatList
        key={columns}
        data={workouts}
        numColumns={columns}
        keyExtractor={(item, index) => item.id ?? `workout-${index}`}
        style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}
        {...pullHandlers}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: sidePadding, paddingBottom: insets.bottom + 110 },
        ]}
        columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.screenTitle, compact && styles.screenTitleCompact]}>Meus Treinos</Text>
            <Text style={styles.screenSubtitle}>
              {workouts.length} treino{workouts.length !== 1 ? "s" : ""} cadastrado
              {workouts.length !== 1 ? "s" : ""}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={columns > 1 ? styles.gridItem : undefined}>
            <WorkoutCard
              workout={item}
              compact={compact}
              onPress={() => openEdit(item)}
              onDelete={() => confirmDelete(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="barbell-outline" size={30} color={COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum treino ainda</Text>
              <Text style={styles.emptyText}>Crie seu primeiro treino e monte a rotina da semana.</Text>
              <Pressable
                style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
                onPress={openCreate}
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Criar treino</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* FAB — zona de fácil alcance do polegar, canto inferior direito */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 20, right: fabRightOffset },
          pressed && styles.fabPressed,
        ]}
        onPress={openCreate}
        hitSlop={8}
        accessibilityLabel="Criar novo treino"
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>

      <WorkoutFormModal
        visible={modalVisible}
        initialWorkout={editingWorkout}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingTop: 16,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  header: {
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  screenTitleCompact: {
    fontSize: 22,
  },
  screenSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    minHeight: 88, // alvo de toque generoso, o card inteiro é clicável
  },
  cardCompact: {
    padding: 14,
    borderRadius: 16,
  },
  cardPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  cardBody: {
    flex: 1,
    minWidth: 0, // deixa o texto quebrar/cortar em vez de empurrar o chevron pra fora
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  cardTitleCompact: {
    fontSize: 15,
  },
  exerciseCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "100%",
  },
  badgeExtra: {
    backgroundColor: COLORS.surfaceAlt,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  badgeExtraText: {
    color: COLORS.textSecondary,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: 260,
  },
  weekdayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  weekdayDotActive: {
    backgroundColor: COLORS.accent,
  },
  weekdayDotText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textTertiary,
  },
  weekdayDotTextActive: {
    color: "#FFF",
  },
  swipeDelete: {
    width: 76,
    marginLeft: 12,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    marginTop: 12,
  },
  emptyButtonPressed: {
    backgroundColor: COLORS.accentLight,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 12px rgba(232, 16, 42, 0.4)",
    elevation: 6,
  },
  fabPressed: {
    backgroundColor: COLORS.accentLight,
  },
});
