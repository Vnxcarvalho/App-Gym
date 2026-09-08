// screens/ActiveWorkoutScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { useResponsive } from "../hooks/useResponsive";
import { useWorkouts } from "../context/WorkoutsContext";
import { useAdmin } from "../context/AdminContext";
import type { WorkoutDraft, WorkoutExerciseDraft } from "../components/WorkoutFormModal";
import ExerciseDemoModal from "../components/ExerciseDemoModal";
import {
  addSessionSet,
  discardSession,
  fetchLastFinishedSessionSets,
  fetchSessionSets,
  finishSession,
  getOrCreateOpenSession,
  removeSessionSet,
  type OpenSession,
  type SessionSetRow,
} from "../lib/sessionsApi";

// ---------------------------------------------------------
// Tipos (espelham workout_exercises / session_sets do schema)
// ---------------------------------------------------------

type ExerciseSet = {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  completed: boolean;
  sessionSetId: string | null; // linha correspondente em session_sets, quando concluída
  targetReps?: number;
  targetWeightKg?: number;
};

type SessionExercise = {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  demoMediaUrl?: string | null;
  targetSets: number;
  targetRepsLabel: string;
  sets: ExerciseSet[];
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function formatElapsed(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function targetRepsLabel(exercise: WorkoutExerciseDraft): string {
  if (exercise.sets.length === 0) return "";
  const reps = exercise.sets.map((s) => s.reps);
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return min === max ? `${min}` : `${min}-${max}`;
}

// Reconstrói o estado da tela a partir do template do treino + séries já
// registradas na sessão em aberto — é isso que faz o "feito" continuar verde
// quando o usuário sai e volta pro treino.
function buildSessionExercises(
  workout: WorkoutDraft,
  sessionSets: SessionSetRow[],
  lastSets: SessionSetRow[]
): SessionExercise[] {
  return workout.exercises.map((exercise) => {
    const recordedForExercise = sessionSets.filter((s) => s.workoutExerciseId === exercise.id);
    const recordedByNumber = new Map(recordedForExercise.map((s) => [s.setNumber, s]));
    const lastByNumber = new Map(
      lastSets.filter((s) => s.workoutExerciseId === exercise.id).map((s) => [s.setNumber, s])
    );
    const setCount = Math.max(exercise.sets.length, ...recordedForExercise.map((s) => s.setNumber), 0);

    const sets: ExerciseSet[] = Array.from({ length: setCount }, (_, i) => {
      const setNumber = i + 1;
      const target = exercise.sets[i];
      const recorded = recordedByNumber.get(setNumber);
      const last = lastByNumber.get(setNumber);
      return {
        id: `${exercise.id}-set-${setNumber}`,
        setNumber,
        weightKg: recorded ? String(recorded.weightKg) : last ? String(last.weightKg) : "",
        reps: recorded ? String(recorded.reps) : last ? String(last.reps) : "",
        completed: !!recorded,
        sessionSetId: recorded?.id ?? null,
        targetReps: target?.reps,
        targetWeightKg: target?.weightKg,
      };
    });

    return {
      workoutExerciseId: exercise.id,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      demoMediaUrl: exercise.demoMediaUrl,
      targetSets: exercise.sets.length,
      targetRepsLabel: targetRepsLabel(exercise),
      sets,
    };
  });
}

// ---------------------------------------------------------
// Componente
// ---------------------------------------------------------

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { contentMaxWidth } = useResponsive();
  const params = useLocalSearchParams<{ workoutId?: string }>();
  const workoutId = Array.isArray(params.workoutId) ? params.workoutId[0] : params.workoutId;
  const { workouts, loading: workoutsLoading } = useWorkouts();
  const { effectiveUserId } = useAdmin();

  const workout = useMemo(() => workouts.find((w) => w.id === workoutId), [workouts, workoutId]);

  const [session, setSession] = useState<OpenSession | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [demoExercise, setDemoExercise] = useState<SessionExercise | null>(null);

  // Abre (ou retoma) a sessão desse treino e carrega as séries já concluídas.
  useEffect(() => {
    if (!workout || !effectiveUserId) return;
    let cancelled = false;

    setLoadingSession(true);
    (async () => {
      try {
        const openSession = await getOrCreateOpenSession(effectiveUserId, workout.id!);
        const sessionSets = await fetchSessionSets(openSession.id);
        let lastSets: SessionSetRow[] = [];
        try {
          lastSets = await fetchLastFinishedSessionSets(effectiveUserId, workout.id!);
        } catch {
          // não bloqueia o treino — sem histórico, os campos ficam vazios
        }
        if (cancelled) return;
        setSession(openSession);
        setExercises(buildSessionExercises(workout, sessionSets, lastSets));
      } catch (err: any) {
        if (!cancelled) {
          Alert.alert("Não foi possível carregar o treino", err.message ?? "Tente novamente.");
        }
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workout?.id, effectiveUserId]);

  // Cronômetro real, baseado no started_at da sessão — não zera ao voltar pra tela.
  useEffect(() => {
    if (!session) return;
    const startMs = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.startedAt]);

  const completedSets = exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  function updateSet(workoutExerciseId: string, setId: string, patch: Partial<ExerciseSet>) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.workoutExerciseId !== workoutExerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
            }
      )
    );
  }

  async function toggleSetCompleted(exercise: SessionExercise, set: ExerciseSet) {
    if (!session) return;

    if (!set.completed) {
      if (!set.weightKg || !set.reps) {
        Alert.alert("Preencha carga e repetições", "Informe peso e reps antes de concluir a série.");
        return;
      }
      try {
        const sessionSetId = await addSessionSet(
          session.id,
          exercise.workoutExerciseId,
          set.setNumber,
          Number(set.weightKg),
          Number(set.reps)
        );
        updateSet(exercise.workoutExerciseId, set.id, { completed: true, sessionSetId });
      } catch (err: any) {
        Alert.alert("Não foi possível salvar a série", err.message ?? "Tente novamente.");
      }
    } else {
      try {
        if (set.sessionSetId) await removeSessionSet(set.sessionSetId);
        updateSet(exercise.workoutExerciseId, set.id, { completed: false, sessionSetId: null });
      } catch (err: any) {
        Alert.alert("Não foi possível desfazer a série", err.message ?? "Tente novamente.");
      }
    }
  }

  function addSet(workoutExerciseId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.workoutExerciseId !== workoutExerciseId
          ? ex
          : {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  id: `${workoutExerciseId}-set-${ex.sets.length + 1}-${Date.now()}`,
                  setNumber: ex.sets.length + 1,
                  weightKg: "",
                  reps: "",
                  completed: false,
                  sessionSetId: null,
                },
              ],
            }
      )
    );
  }

  async function handleFinish() {
    if (!session) return;
    if (completedSets === 0) {
      Alert.alert("Nenhuma série registrada", "Conclua ao menos uma série antes de finalizar.");
      return;
    }
    try {
      await finishSession(session.id);
    } catch (err: any) {
      Alert.alert("Não foi possível finalizar o treino", err.message ?? "Tente novamente.");
      return;
    }
    Alert.alert("Treino finalizado", `${completedSets} séries registradas.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  function handleDiscard() {
    Alert.alert("Descartar treino?", "O progresso desta sessão será perdido.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Descartar",
        style: "destructive",
        onPress: async () => {
          if (session) {
            try {
              await discardSession(session.id);
            } catch (err: any) {
              Alert.alert("Não foi possível descartar", err.message ?? "Tente novamente.");
              return;
            }
          }
          router.back();
        },
      },
    ]);
  }

  if (workoutsLoading || loadingSession || !workout) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleDiscard} hitSlop={12}>
          <Ionicons name="close" size={26} color={COLORS.textSecondary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{workout.name}</Text>
          <Text style={styles.headerTimer}>{formatElapsed(elapsed)}</Text>
        </View>

        <Pressable style={styles.finishButton} onPress={handleFinish}>
          <Text style={styles.finishButtonText}>Finalizar</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${totalSets ? (completedSets / totalSets) * 100 : 0}%` },
          ]}
        />
      </View>
      <Text
        style={[styles.progressLabel, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}
      >
        {completedSets}/{totalSets} séries concluídas
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContentOuter}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.scrollContent, { maxWidth: contentMaxWidth }]}>
        {exercises.map((exercise) => (
          <View key={exercise.workoutExerciseId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <View style={styles.exerciseMetaRow}>
                  <View style={styles.muscleBadge}>
                    <Text style={styles.muscleBadgeText}>{exercise.muscleGroup}</Text>
                  </View>
                  {exercise.targetRepsLabel && (
                    <Text style={styles.targetText}>
                      Alvo: {exercise.targetSets}x{exercise.targetRepsLabel}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable
                style={styles.demoButton}
                onPress={() => setDemoExercise(exercise)}
                hitSlop={8}
                accessibilityLabel={`Ver demonstração de ${exercise.name}`}
              >
                <Ionicons name="play-circle-outline" size={26} color={COLORS.accent} />
              </Pressable>
            </View>

            {/* Table header */}
            <View style={styles.setsHeaderRow}>
              <Text style={[styles.setsHeaderCell, { width: 40 }]}>SÉRIE</Text>
              <Text style={[styles.setsHeaderCell, { flex: 1 }]}>KG</Text>
              <Text style={[styles.setsHeaderCell, { flex: 1 }]}>REPS</Text>
              <Text style={[styles.setsHeaderCell, { width: 40, textAlign: "center" }]}>OK</Text>
            </View>

            {exercise.sets.map((set) => (
              <View
                key={set.id}
                style={[styles.setRow, set.completed && styles.setRowCompleted]}
              >
                <Text style={styles.setNumber}>{set.setNumber}</Text>

                <TextInput
                  style={styles.setInput}
                  placeholder={set.targetWeightKg != null ? String(set.targetWeightKg) : "0"}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="decimal-pad"
                  value={set.weightKg}
                  editable={!set.completed}
                  onChangeText={(v) =>
                    updateSet(exercise.workoutExerciseId, set.id, { weightKg: v })
                  }
                />

                <TextInput
                  style={styles.setInput}
                  placeholder={set.targetReps != null ? String(set.targetReps) : "0"}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  value={set.reps}
                  editable={!set.completed}
                  onChangeText={(v) => updateSet(exercise.workoutExerciseId, set.id, { reps: v })}
                />

                <Pressable
                  style={[styles.checkCircle, set.completed && styles.checkCircleDone]}
                  onPress={() => toggleSetCompleted(exercise, set)}
                  hitSlop={8}
                >
                  {set.completed && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </Pressable>
              </View>
            ))}

            <Pressable style={styles.addSetButton} onPress={() => addSet(exercise.workoutExerciseId)}>
              <Ionicons name="add" size={16} color={COLORS.accent} />
              <Text style={styles.addSetText}>Adicionar série</Text>
            </Pressable>
          </View>
        ))}
        </View>
      </ScrollView>

      <ExerciseDemoModal
        visible={!!demoExercise}
        exerciseName={demoExercise?.name ?? ""}
        demoMediaUrl={demoExercise?.demoMediaUrl}
        onClose={() => setDemoExercise(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerTimer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  finishButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  finishButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceAlt,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginHorizontal: 20,
    marginTop: 6,
  },
  scroll: {
    flex: 1,
    marginTop: 12,
  },
  scrollContentOuter: {
    alignItems: "center",
  },
  scrollContent: {
    width: "100%",
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  demoButton: {
    padding: 2,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  exerciseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  muscleBadge: {
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  muscleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  targetText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  setsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 10,
  },
  setsHeaderCell: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textTertiary,
    letterSpacing: 0.4,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  setRowCompleted: {
    backgroundColor: "rgba(46, 204, 113, 0.06)",
  },
  setNumber: {
    width: 40,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  setInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16, // >=16px evita o zoom automático do Safari/Chrome no celular ao focar
    textAlign: "center",
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.accent,
  },
});
