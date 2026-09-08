// screens/DashboardScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import { MUSCLE_GROUP_LABELS } from "../constants/muscleGroups";
import { useWorkouts } from "../context/WorkoutsContext";
import { useAdmin } from "../context/AdminContext";
import { Alert } from "../lib/alert";
import { useResponsive } from "../hooks/useResponsive";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { fetchWeeklyCompletedDays } from "../lib/sessionsApi";
import WorkoutFormModal, { WorkoutDraft } from "../components/WorkoutFormModal";
import PullIndicator from "../components/PullIndicator";

// index 0 = Domingo .. 6 = Sábado, mesma convenção de Date.getDay() e de workout.weekdays
const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function getMuscleGroups(workout: WorkoutDraft): string[] {
  return [...new Set(workout.exercises.map((e) => e.muscleGroup))];
}

function findWorkoutForDay(workouts: WorkoutDraft[], dayIndex: number) {
  return workouts.find((w) => w.weekdays.includes(dayIndex));
}

type Props = {
  onStartWorkout?: (workoutId: string) => void;
  onProfilePress?: () => void;
};

export default function DashboardScreen({ onStartWorkout, onProfilePress }: Props) {
  const { workouts, loading, refetch: refetchWorkouts, addWorkout, updateWorkout, deleteWorkout } =
    useWorkouts();
  const { viewingUser, profile, effectiveUserId } = useAdmin();
  const { contentMaxWidth } = useResponsive();
  const [formVisible, setFormVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutDraft | null>(null);
  const [completedDaysCount, setCompletedDaysCount] = useState(0);
  const todayIndex = new Date().getDay();
  const todayWorkout = findWorkoutForDay(workouts, todayIndex);
  const hasWorkouts = workouts.length > 0;
  const greetingName = viewingUser?.name ?? profile?.name ?? "";
  const scheduledDaysCount = new Set(workouts.flatMap((w) => w.weekdays)).size;

  const refetchWeeklyProgress = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const days = await fetchWeeklyCompletedDays(effectiveUserId);
      setCompletedDaysCount(days.length);
    } catch {
      // silencioso: é só um indicador auxiliar, não bloqueia a tela
    }
  }, [effectiveUserId]);

  useEffect(() => {
    refetchWeeklyProgress();
  }, [refetchWeeklyProgress]);

  const { pullAnim, handlers: pullHandlers } = usePullToRefresh(async () => {
    await Promise.all([refetchWorkouts(), refetchWeeklyProgress()]);
  });

  function openCreate() {
    setEditingWorkout(null);
    setFormVisible(true);
  }

  function openEdit(workout: WorkoutDraft) {
    setEditingWorkout(workout);
    setFormVisible(true);
  }

  async function handleSaveWorkout(draft: WorkoutDraft) {
    try {
      if (draft.id) {
        await updateWorkout(draft);
      } else {
        await addWorkout(draft);
      }
      setFormVisible(false);
    } catch (err: any) {
      Alert.alert("Não foi possível salvar o treino", err.message ?? "Tente novamente.");
    }
  }

  async function handleDeleteWorkout(id: string) {
    try {
      await deleteWorkout(id);
      setFormVisible(false);
    } catch (err: any) {
      Alert.alert("Não foi possível excluir o treino", err.message ?? "Tente novamente.");
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (!hasWorkouts) {
    return (
      <View style={styles.container} {...pullHandlers}>
        <PullIndicator pullAnim={pullAnim} />
        <View style={[styles.centeredColumn, styles.content, { maxWidth: contentMaxWidth, flex: 1 }]}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Olá{greetingName ? `, ${greetingName}` : ""}</Text>
            <Pressable style={styles.profileButton} onPress={onProfilePress}>
              <Ionicons name="person-outline" size={20} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>Nenhum treino cadastrado</Text>
            <Text style={styles.emptySubtitle}>
              Crie seu primeiro treino e escolha os dias da semana em que ele acontece —
              sua rotina de segunda a domingo aparece aqui.
            </Text>
            <Pressable style={styles.emptyCta} onPress={openCreate}>
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.emptyCtaText}>Adicionar treino</Text>
            </Pressable>
          </View>
        </View>

        <WorkoutFormModal
          visible={formVisible}
          initialWorkout={editingWorkout}
          onClose={() => setFormVisible(false)}
          onSave={handleSaveWorkout}
          onDelete={handleDeleteWorkout}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PullIndicator pullAnim={pullAnim} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} {...pullHandlers}>
        <View style={[styles.centeredColumn, styles.content, { maxWidth: contentMaxWidth }]}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá{greetingName ? `, ${greetingName}` : ""}</Text>
        <Pressable style={styles.profileButton} onPress={onProfilePress}>
          <Ionicons name="person-outline" size={20} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekHeaderRow}>
        <Text style={styles.sectionTitle}>Sua semana</Text>
        {scheduledDaysCount > 0 && (
          <Text style={styles.weekProgressText}>
            {Math.min(completedDaysCount, scheduledDaysCount)}/{scheduledDaysCount} treinos
          </Text>
        )}
      </View>
      {scheduledDaysCount > 0 && (
        <View style={styles.weekProgressTrack}>
          <View
            style={[
              styles.weekProgressFill,
              {
                width: `${Math.min(100, (completedDaysCount / scheduledDaysCount) * 100)}%`,
              },
            ]}
          />
        </View>
      )}
      <View style={styles.weekRow}>
        {WEEKDAY_SHORT.map((label, index) => {
          const isToday = index === todayIndex;
          const workout = findWorkoutForDay(workouts, index);
          return (
            <View key={label} style={styles.dayPill}>
              <Text style={[styles.dayLabel, isToday && { color: COLORS.accent }]}>{label}</Text>
              <View
                style={[
                  styles.dayDot,
                  !!workout && styles.dayDotTrained,
                  isToday && styles.dayDotToday,
                  !workout && !isToday && styles.dayDotRest,
                ]}
              />
            </View>
          );
        })}
      </View>

      {todayWorkout ? (
        <View style={styles.todayCard}>
          <Pressable style={{ flex: 1 }} onPress={() => openEdit(todayWorkout)}>
            <View style={styles.todayLabelRow}>
              <Text style={styles.todayLabel}>TREINO DE HOJE</Text>
              <Ionicons name="create-outline" size={13} color={COLORS.accent} />
            </View>
            <Text style={styles.todayMuscle}>{todayWorkout.name}</Text>
            <Text style={styles.todaySub}>
              {todayWorkout.exercises.length} exercício
              {todayWorkout.exercises.length !== 1 ? "s" : ""} ·{" "}
              {getMuscleGroups(todayWorkout)
                .map((mg) => MUSCLE_GROUP_LABELS[mg])
                .join(" e ")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.startButton}
            onPress={() => todayWorkout.id && onStartWorkout?.(todayWorkout.id)}
          >
            <Ionicons name="play" size={18} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.restCard}>
          <Ionicons name="moon-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.restText}>Dia de descanso</Text>
        </View>
      )}

      {todayWorkout && (
        <Pressable
          style={styles.ctaButton}
          onPress={() => todayWorkout.id && onStartWorkout?.(todayWorkout.id)}
        >
          <Text style={styles.ctaText}>Iniciar Treino</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      )}

      <WorkoutFormModal
        visible={formVisible}
        initialWorkout={editingWorkout}
        onClose={() => setFormVisible(false)}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout}
      />
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { alignItems: "center", justifyContent: "center" },
  scrollContent: { alignItems: "center" },
  centeredColumn: { width: "100%", alignSelf: "center" },
  content: { padding: 24, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  greeting: { fontSize: 24, fontWeight: "700", color: COLORS.textPrimary },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  weekProgressText: { fontSize: 12, fontWeight: "700", color: COLORS.accent },
  weekProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  weekProgressFill: { height: "100%", borderRadius: 2, backgroundColor: COLORS.accent },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  dayPill: { flex: 1, alignItems: "center", gap: 8 },
  dayLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dayDotTrained: { backgroundColor: "#3A3A3A" },
  dayDotToday: { backgroundColor: COLORS.accent, width: 10, height: 10, borderRadius: 5 },
  dayDotRest: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  todayLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  todayLabel: { fontSize: 11, fontWeight: "700", color: COLORS.accent, letterSpacing: 0.8 },
  todayMuscle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 4 },
  todaySub: { fontSize: 13, color: COLORS.textSecondary },
  startButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  restCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  restText: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
    gap: 6,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 24,
    height: 52,
  },
  emptyCtaText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
