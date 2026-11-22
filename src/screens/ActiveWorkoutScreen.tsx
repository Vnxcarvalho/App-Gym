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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONT_MONO } from "../constants/theme";
import { MUSCLE_GROUP_LABELS } from "../constants/muscleGroups";
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
  const { contentMaxWidth, width } = useResponsive();
  const insets = useSafeAreaInsets();
  // formulário de uso rápido: em tela larga não precisa esticar além disso
  const formWidth = Math.min(contentMaxWidth, 640);
  // celulares estreitos (iPhone SE/mini, Android compacto): menos padding e campos mais enxutos
  const compact = width < 380;
  const sidePadding = compact ? 14 : 20;
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


  const progress = totalSets ? completedSets / totalSets : 0;
  const centered = { maxWidth: formWidth, alignSelf: "center" as const, width: "100%" as const };
  const inputPad = compact ? 10 : 12;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header — respeita notch/Dynamic Island (a tela é fullScreenModal, sem header nativo) */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, paddingHorizontal: sidePadding },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          onPress={handleDiscard}
          hitSlop={8}
          accessibilityLabel="Descartar treino"
        >
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {workout.name}
          </Text>
          <Text style={styles.headerTimer}>{formatElapsed(elapsed)}</Text>
        </View>

        {/* Espelha o botão de fechar pra manter o título realmente centralizado */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, centered]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContentOuter}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
      >
        <View
          style={[
            styles.scrollContent,
            { maxWidth: formWidth, paddingHorizontal: sidePadding },
          ]}
        >
          {exercises.map((exercise) => {
            const doneCount = exercise.sets.filter((s) => s.completed).length;
            const allDone = exercise.sets.length > 0 && doneCount === exercise.sets.length;
            return (
              <View
                key={exercise.workoutExerciseId}
                style={[
                  styles.exerciseCard,
                  compact && styles.exerciseCardCompact,
                  allDone && styles.exerciseCardDone,
                ]}
              >
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseTitleWrap}>
                    <Text style={styles.exerciseName} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                      {exercise.name}
                    </Text>
                    <View style={styles.exerciseMetaRow}>
                      <View style={styles.muscleBadge}>
                        <Text style={styles.muscleBadgeText} numberOfLines={1}>
                          {MUSCLE_GROUP_LABELS[exercise.muscleGroup] ?? exercise.muscleGroup}
                        </Text>
                      </View>
                      {!!exercise.targetRepsLabel && (
                        <Text style={styles.targetText}>
                          Alvo: {exercise.targetSets}x{exercise.targetRepsLabel}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View
                    style={[styles.progressChip, allDone && styles.progressChipDone]}
                    accessibilityLabel={`${doneCount} de ${exercise.sets.length} séries concluídas`}
                  >
                    {allDone ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.onAccent} />
                    ) : (
                      <Text style={styles.progressChipText}>
                        {doneCount}/{exercise.sets.length}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.demoButton, pressed && styles.demoButtonPressed]}
                    onPress={() => setDemoExercise(exercise)}
                    hitSlop={6}
                    accessibilityLabel={`Ver como fazer ${exercise.name}`}
                  >
                    <Ionicons name="play" size={16} color={COLORS.accent} />
                  </Pressable>
                </View>

                {/* Table header */}
                <View style={styles.setsHeaderRow}>
                  <Text style={[styles.setsHeaderCell, styles.setNumberCol]}>SÉRIE</Text>
                  <Text style={[styles.setsHeaderCell, styles.inputCol]}>KG</Text>
                  <Text style={[styles.setsHeaderCell, styles.inputCol]}>REPS</Text>
                  <Text style={[styles.setsHeaderCell, styles.checkCol]}>OK</Text>
                </View>

                {exercise.sets.map((set) => (
                  <View key={set.id} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
                    <Text style={[styles.setNumber, styles.setNumberCol]}>{set.setNumber}</Text>

                    <TextInput
                      style={[
                        styles.setInput,
                        { paddingVertical: inputPad },
                        set.completed && styles.setInputCompleted,
                      ]}
                      placeholder={set.targetWeightKg != null ? String(set.targetWeightKg) : "0"}
                      placeholderTextColor={COLORS.textTertiary}
                      keyboardType="decimal-pad"
                      value={set.weightKg}
                      editable={!set.completed}
                      selectTextOnFocus
                      maxFontSizeMultiplier={1.2}
                      accessibilityLabel={`Carga da série ${set.setNumber}, em quilos`}
                      onChangeText={(v) =>
                        updateSet(exercise.workoutExerciseId, set.id, { weightKg: v })
                      }
                    />

                    <TextInput
                      style={[
                        styles.setInput,
                        { paddingVertical: inputPad },
                        set.completed && styles.setInputCompleted,
                      ]}
                      placeholder={set.targetReps != null ? String(set.targetReps) : "0"}
                      placeholderTextColor={COLORS.textTertiary}
                      keyboardType="number-pad"
                      value={set.reps}
                      editable={!set.completed}
                      selectTextOnFocus
                      maxFontSizeMultiplier={1.2}
                      accessibilityLabel={`Repetições da série ${set.setNumber}`}
                      onChangeText={(v) => updateSet(exercise.workoutExerciseId, set.id, { reps: v })}
                    />

                    <Pressable
                      style={[styles.checkCircle, set.completed && styles.checkCircleDone]}
                      onPress={() => toggleSetCompleted(exercise, set)}
                      hitSlop={6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: set.completed }}
                      accessibilityLabel={`Marcar série ${set.setNumber} como ${
                        set.completed ? "pendente" : "concluída"
                      }`}
                    >
                      <Ionicons
                        name="checkmark"
                        size={22}
                        color={set.completed ? COLORS.onAccent : COLORS.textTertiary}
                      />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  style={({ pressed }) => [styles.addSetButton, pressed && styles.addSetButtonPressed]}
                  onPress={() => addSet(exercise.workoutExerciseId)}
                >
                  <Ionicons name="add" size={20} color={COLORS.textPrimary} />
                  <Text style={styles.addSetText}>Adicionar série</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Barra inferior — "Finalizar" na zona de alcance do polegar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[styles.bottomBarInner, centered, { paddingHorizontal: sidePadding }]}>
          <View style={styles.bottomProgress}>
            <Text style={styles.bottomProgressValue}>
              {completedSets}/{totalSets}
            </Text>
            <Text style={styles.bottomProgressLabel}>séries concluídas</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.finishButton, pressed && styles.finishButtonPressed]}
            onPress={handleFinish}
            accessibilityLabel="Finalizar treino"
          >
            <Ionicons name="flag" size={16} color={COLORS.onAccent} />
            <Text style={styles.finishButtonText}>Finalizar</Text>
          </Pressable>
        </View>
      </View>

      <ExerciseDemoModal
        visible={!!demoExercise}
        exerciseName={demoExercise?.name ?? ""}
        demoMediaUrl={demoExercise?.demoMediaUrl}
        onClose={() => setDemoExercise(null)}
      />
    </KeyboardAvoidingView>
  );
}

const CHECK_SIZE = 40;
const NUMBER_COL = 40;

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
    paddingBottom: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    backgroundColor: COLORS.border,
  },
  headerSpacer: {
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerTimer: {
    fontSize: 13,
    fontFamily: FONT_MONO,
    fontVariant: ["tabular-nums"],
    color: COLORS.accent,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.hairline,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
  },
  scroll: {
    flex: 1,
  },
  scrollContentOuter: {
    alignItems: "center",
  },
  scrollContent: {
    width: "100%",
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  exerciseCardCompact: {
    padding: 12,
    borderRadius: 16,
  },
  exerciseCardDone: {
    borderColor: "rgba(76, 175, 122, 0.35)",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  exerciseTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  exerciseMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  progressChip: {
    minWidth: 40,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressChipDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  progressChipText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: FONT_MONO,
    color: COLORS.textSecondary,
  },
  demoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  demoButtonPressed: {
    opacity: 0.75,
  },
  setsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  setsHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textTertiary,
    letterSpacing: 0.4,
  },
  setNumberCol: { width: NUMBER_COL },
  inputCol: { flex: 1, textAlign: "center" },
  checkCol: { width: CHECK_SIZE, textAlign: "center" },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  setRowCompleted: {
    backgroundColor: "rgba(76, 175, 122, 0.06)",
  },
  setNumber: {
    fontSize: 14,
    fontFamily: FONT_MONO,
    fontWeight: "600",
    color: COLORS.textSecondary,
    paddingLeft: 4,
  },
  setInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    paddingHorizontal: 10,
    fontSize: 17, // >=16px evita o zoom automático do Safari/Chrome no celular ao focar
    fontFamily: FONT_MONO,
    textAlign: "center",
  },
  setInputCompleted: {
    color: COLORS.textSecondary,
  },
  checkCircle: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.hairline,
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
    justifyContent: "center",
    gap: 6,
    height: 48,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
  },
  addSetButtonPressed: {
    backgroundColor: COLORS.border,
  },
  addSetText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  bottomBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  bottomBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  bottomProgress: {
    minWidth: 0,
  },
  bottomProgressValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: FONT_MONO,
    color: COLORS.textPrimary,
  },
  bottomProgressLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  finishButton: {
    flex: 1,
    maxWidth: 220,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
  },
  finishButtonPressed: {
    backgroundColor: COLORS.accentLight,
  },
  finishButtonText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "700",
  },
});
