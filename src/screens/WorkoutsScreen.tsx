// screens/WorkoutsScreen.tsx
//
// Requer: react-native-safe-area-context, react-native-gesture-handler
// (GestureHandlerRootView deve envolver a raiz do app — normalmente já é o caso
// quando se usa React Navigation).
import React, { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { MUSCLE_GROUP_LABELS, WEEKDAY_LABELS } from "../constants/muscleGroups";
import WorkoutFormModal, { WorkoutDraft } from "../components/WorkoutFormModal";
import { useWorkouts } from "../context/WorkoutsContext";
import { useResponsive } from "../hooks/useResponsive";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullIndicator from "../components/PullIndicator";

function getMuscleGroups(workout: WorkoutDraft): string[] {
  return [...new Set(workout.exercises.map((e) => e.muscleGroup))];
}

// ---------------------------------------------------------
// Card de treino (com swipe-to-delete)
// ---------------------------------------------------------

function WorkoutCard({
  workout,
  onPress,
  onDelete,
}: {
  workout: WorkoutDraft;
  onPress: () => void;
  onDelete: () => void;
}) {
  const muscleGroups = getMuscleGroups(workout);

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable style={styles.swipeDelete} onPress={onDelete}>
          <Ionicons name="trash-outline" size={22} color="#FFF" />
        </Pressable>
      )}
      overshootRight={false}
    >
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{workout.name}</Text>

          <View style={styles.badgeRow}>
            {muscleGroups.slice(0, 3).map((mg) => (
              <View key={mg} style={styles.badge}>
                <Text style={styles.badgeText}>{MUSCLE_GROUP_LABELS[mg]}</Text>
              </View>
            ))}
          </View>

          <View style={styles.cardFooterRow}>
            <Text style={styles.exerciseCount}>
              {workout.exercises.length} exercício{workout.exercises.length !== 1 ? "s" : ""}
            </Text>

            <View style={styles.weekdayDots}>
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
  // em telas largas o conteúdo fica centralizado com espaço vazio nas laterais —
  // o FAB acompanha a borda direita da coluna de conteúdo, não a da janela
  const fabRightOffset = 20 + Math.max(0, (width - contentMaxWidth) / 2);

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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PullIndicator pullAnim={pullAnim} />
      <FlatList
        key={columns}
        data={workouts}
        numColumns={columns}
        keyExtractor={(item) => item.id ?? String(Math.random())}
        style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}
        {...pullHandlers}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Meus Treinos</Text>
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
              onPress={() => openEdit(item)}
              onDelete={() => handleDelete(item.id!)}
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
              <Ionicons name="barbell-outline" size={32} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>Nenhum treino cadastrado ainda</Text>
            </View>
          )
        }
      />

      {/* FAB — zona de fácil alcance do polegar, canto inferior direito */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20, right: fabRightOffset }]}
        onPress={openCreate}
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
    paddingHorizontal: 20,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    minHeight: 88, // alvo de toque generoso, o card inteiro é clicável
  },
  cardPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exerciseCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  weekdayDots: {
    flexDirection: "row",
    gap: 3,
  },
  weekdayDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  weekdayDotActive: {
    backgroundColor: COLORS.accent,
  },
  weekdayDotText: {
    fontSize: 8,
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
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textTertiary,
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
});
