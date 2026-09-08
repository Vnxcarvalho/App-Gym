// components/WorkoutFormModal.tsx
//
// Modal full-screen de criar/editar treino. Um único FlatList vertical (exercícios)
// carrega o form inteiro via ListHeaderComponent/ListFooterComponent — evita aninhar
// uma FlatList dentro de um ScrollView (warning do RN e scroll quebrado em Android).
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import { Alert } from "../lib/alert";
import { MUSCLE_GROUP_LABELS, WEEKDAY_FULL_LABELS, WEEKDAY_LABELS } from "../constants/muscleGroups";
import { useResponsive } from "../hooks/useResponsive";
import ExercisePickerModal, { ExerciseCatalogItem } from "./ExercisePickerModal";
import { DEFAULT_REST_SECONDS } from "../constants/workout";

export type SetTarget = {
  id: string;
  reps: number;
  weightKg: number;
  done: boolean;
  restSeconds: number; // descanso após essa série, editável por série
  label?: string; // ex: "Aquecimento" — se vazio, exibe "Série {N}" por padrão
};

export type WorkoutExerciseDraft = {
  id: string; // workout_exercise.id (temporário até salvar)
  exerciseId: string;
  name: string;
  muscleGroup: string;
  demoMediaUrl?: string | null;
  sets: SetTarget[]; // uma entrada por série, cada uma com sua própria meta de reps
  collapsed: boolean; // recolhe o card pra "Feito", economiza espaço numa lista longa
  done: boolean; // marcado via "Feito" — fica verde e permanece assim mesmo recolhido
};

let setIdCounter = 0;
function newSetId() {
  setIdCounter += 1;
  return `set-${Date.now()}-${setIdCounter}`;
}

function makeDefaultSets(count: number, reps = 12, weightKg = 20): SetTarget[] {
  return Array.from({ length: count }, () => ({
    id: newSetId(),
    reps,
    weightKg,
    done: false,
    restSeconds: DEFAULT_REST_SECONDS,
  }));
}

export type WorkoutDraft = {
  id: string | null; // null = novo treino
  name: string;
  weekdays: number[]; // 0-6
  exercises: WorkoutExerciseDraft[];
};

type Props = {
  visible: boolean;
  initialWorkout: WorkoutDraft | null; // null = criar novo
  onClose: () => void;
  onSave: (workout: WorkoutDraft) => void | Promise<void>;
  onDelete?: (id: string) => void;
};

const EMPTY_DRAFT: WorkoutDraft = { id: null, name: "", weekdays: [], exercises: [] };

function formatRest(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Só um exercício começa aberto: o primeiro ainda não feito — assim reabrir o
// treino retoma de onde parou. Se já estiver tudo concluído, fica tudo recolhido.
function collapseAllButFirst(exercises: WorkoutExerciseDraft[]): WorkoutExerciseDraft[] {
  const firstPending = exercises.findIndex((e) => !e.done);
  if (firstPending === -1) return exercises.map((e) => ({ ...e, collapsed: true }));
  return exercises.map((e, i) => ({ ...e, collapsed: i !== firstPending }));
}

export default function WorkoutFormModal({ visible, initialWorkout, onClose, onSave, onDelete }: Props) {
  const { isWide, contentMaxWidth } = useResponsive();
  const [draft, setDraft] = useState<WorkoutDraft>(EMPTY_DRAFT);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingLabelSetId, setEditingLabelSetId] = useState<string | null>(null);
  const [editingWeightSetId, setEditingWeightSetId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState("");
  const [editingRestSetId, setEditingRestSetId] = useState<string | null>(null);
  const [restDraft, setRestDraft] = useState("");
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cronômetro de descanso: dispara sozinho ao marcar uma série como feita
  // (o mesmo checkbox que já serve de "diário" do treino), usando o tempo
  // configurado NAQUELA série. null = escondido; ao zerar, a barra some e dá
  // lugar ao cartão central "Descanso concluído".
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SECONDS);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restPaused, setRestPaused] = useState(false);
  const [restCompleteInfo, setRestCompleteInfo] = useState<{
    exerciseName: string;
    setLabel: string;
  } | null>(null);
  const activeRestRef = useRef<{ exerciseId: string; setId: string } | null>(null);

  function getRestCompleteInfo(exerciseId: string, setId: string) {
    const exercise = draft.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return null;
    const setIndex = exercise.sets.findIndex((s) => s.id === setId);
    return {
      exerciseName: exercise.name,
      setLabel: `Série ${setIndex + 1} de ${exercise.sets.length}`,
    };
  }

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      try {
        Vibration.vibrate([0, 250, 100, 250]);
      } catch {}
      const active = activeRestRef.current;
      setRestCompleteInfo(active ? getRestCompleteInfo(active.exerciseId, active.setId) : null);
      setRestRemaining(null);
      return;
    }
    if (restPaused) return;
    const tick = setTimeout(() => setRestRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(tick);
  }, [restRemaining, restPaused]);

  function startRestTimer(exerciseId: string, setId: string, seconds: number) {
    activeRestRef.current = { exerciseId, setId };
    setRestTotal(seconds);
    setRestRemaining(seconds);
    setRestPaused(false);
  }

  function stopRestTimer() {
    activeRestRef.current = null;
    setRestRemaining(null);
    setRestPaused(false);
  }

  function togglePauseRestTimer() {
    setRestPaused((p) => !p);
  }

  function adjustRestTimer(deltaSeconds: number) {
    setRestTotal((t) => Math.max(15, t + deltaSeconds));
    setRestRemaining((r) => (r === null ? null : Math.max(0, r + deltaSeconds)));
    const active = activeRestRef.current;
    if (active) updateSetRest(active.exerciseId, active.setId, deltaSeconds);
  }

  function dismissRestComplete() {
    activeRestRef.current = null;
    setRestCompleteInfo(null);
  }

  function extendRestFromModal() {
    const active = activeRestRef.current;
    setRestCompleteInfo(null);
    if (!active) return;
    updateSetRest(active.exerciseId, active.setId, 30);
    startRestTimer(active.exerciseId, active.setId, 30);
  }

  // Dois Animated.Value por exercício, criados sob demanda: a posição
  // (deslocamento vertical em px, com física de mola) e um "lift" leve (escala)
  // que dá a sensação de o card se soltar e pousar no lugar novo — sem cor.
  const reorderAnimsRef = useRef<Record<string, Animated.Value>>({});
  const liftAnimsRef = useRef<Record<string, Animated.Value>>({});
  const rowHeightsRef = useRef<Record<string, number>>({});
  const EXERCISE_ROW_GAP = 10; // == exerciseRow.marginBottom

  function getReorderAnim(exerciseId: string) {
    if (!reorderAnimsRef.current[exerciseId]) {
      reorderAnimsRef.current[exerciseId] = new Animated.Value(0);
    }
    return reorderAnimsRef.current[exerciseId];
  }

  function getLiftAnim(exerciseId: string) {
    if (!liftAnimsRef.current[exerciseId]) {
      liftAnimsRef.current[exerciseId] = new Animated.Value(0);
    }
    return liftAnimsRef.current[exerciseId];
  }

  function slideRowFrom(exerciseId: string, fromOffset: number) {
    const position = getReorderAnim(exerciseId);
    const lift = getLiftAnim(exerciseId);
    position.setValue(fromOffset);
    lift.setValue(1);
    Animated.spring(position, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
    Animated.timing(lift, { toValue: 0, duration: 320, useNativeDriver: true }).start();
  }

  function hoverHandlers(controlId: string) {
    return {
      onHoverIn: () => setHoveredControl(controlId),
      onHoverOut: () => setHoveredControl((prev) => (prev === controlId ? null : prev)),
    };
  }

  useEffect(() => {
    if (visible) {
      const base = initialWorkout ?? EMPTY_DRAFT;
      setDraft({ ...base, exercises: collapseAllButFirst(base.exercises) });
    } else {
      setRestRemaining(null);
      setRestCompleteInfo(null);
    }
  }, [visible, initialWorkout]);

  const isEditing = draft.id !== null;
  const canSave = draft.name.trim().length > 0 && draft.exercises.length > 0;

  function toggleWeekday(day: number) {
    setDraft((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));
  }

  function handleAddExercise(item: ExerciseCatalogItem) {
    setDraft((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises.map((e) => ({ ...e, collapsed: true })),
        {
          id: `we-${item.id}-${Date.now()}`,
          exerciseId: item.id,
          name: item.name,
          muscleGroup: item.muscleGroup,
          demoMediaUrl: item.demoMediaUrl ?? null,
          sets: makeDefaultSets(3),
          collapsed: false,
          done: false,
        },
      ],
    }));
  }

  function removeExercise(id: string) {
    setDraft((prev) => ({ ...prev, exercises: prev.exercises.filter((e) => e.id !== id) }));
  }

  function setCollapsed(exerciseId: string, collapsed: boolean) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) => (e.id === exerciseId ? { ...e, collapsed } : e)),
    }));
  }

  function markExerciseDone(exerciseId: string) {
    setDraft((prev) => {
      const doneIndex = prev.exercises.findIndex((e) => e.id === exerciseId);
      return {
        ...prev,
        exercises: prev.exercises.map((e, i) => {
          if (e.id === exerciseId) return { ...e, done: true, collapsed: true };
          if (i === doneIndex + 1) return { ...e, collapsed: false };
          return e;
        }),
      };
    });
  }

  function addSetRow(exerciseId: string) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        const lastSet = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [
            ...e.sets,
            {
              id: newSetId(),
              reps: lastSet?.reps ?? 12,
              weightKg: lastSet?.weightKg ?? 20,
              done: false,
              restSeconds: lastSet?.restSeconds ?? DEFAULT_REST_SECONDS,
            },
          ],
        };
      }),
    }));
  }

  function removeSetRow(exerciseId: string, setId: string) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id === exerciseId && e.sets.length > 1
          ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
          : e
      ),
    }));
  }

  function updateSetReps(exerciseId: string, setId: string, delta: number) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId ? { ...s, reps: Math.max(1, Math.min(50, s.reps + delta)) } : s
              ),
            }
      ),
    }));
  }

  function updateSetWeight(exerciseId: string, setId: string, delta: number) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId
                  ? { ...s, weightKg: Math.round(Math.max(0, Math.min(500, s.weightKg + delta)) * 10) / 10 }
                  : s
              ),
            }
      ),
    }));
  }

  function updateSetRest(exerciseId: string, setId: string, delta: number) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId
                  ? { ...s, restSeconds: Math.max(15, Math.min(600, s.restSeconds + delta)) }
                  : s
              ),
            }
      ),
    }));
  }

  function setWeightExact(exerciseId: string, setId: string, weightKg: number) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId
                  ? { ...s, weightKg: Math.round(Math.max(0, Math.min(500, weightKg)) * 10) / 10 }
                  : s
              ),
            }
      ),
    }));
  }

  function startEditingWeight(setId: string, currentValue: number) {
    setWeightDraft(String(currentValue));
    setEditingWeightSetId(setId);
  }

  function commitWeightEdit(exerciseId: string, setId: string) {
    const parsed = Number(weightDraft.replace(",", "."));
    if (!Number.isNaN(parsed)) {
      setWeightExact(exerciseId, setId, parsed);
    }
    setEditingWeightSetId(null);
  }

  function startEditingRest(setId: string, currentValue: number) {
    setRestDraft(String(currentValue));
    setEditingRestSetId(setId);
  }

  // Aceita vários jeitos de digitar, porque cada aluno pensa num formato
  // diferente: "90" ou "60s" = segundos; "1m"/"1min" = minutos; "1:30" =
  // mm:ss; e "1,5" (vírgula OU ponto, sem sufixo) = minutos decimais — é a
  // vírgula que converte pra quem prefere pensar em minutos (1,5 = 1min30s)
  // sem atrapalhar quem digita direto em segundos (60 continua sendo 60s).
  function parseRestInput(text: string): number | null {
    const raw = text.trim();
    if (!raw) return null;

    if (raw.includes(":")) {
      const [mStr, sStr] = raw.split(":");
      const m = Number(mStr);
      const s = Number(sStr);
      if (Number.isNaN(m) || Number.isNaN(s)) return null;
      return Math.round(m * 60 + s);
    }

    const lower = raw.toLowerCase().replace(",", ".");

    if (lower.endsWith("min")) {
      const n = Number(lower.slice(0, -3));
      return Number.isNaN(n) ? null : Math.round(n * 60);
    }
    if (lower.endsWith("m")) {
      const n = Number(lower.slice(0, -1));
      return Number.isNaN(n) ? null : Math.round(n * 60);
    }
    if (lower.endsWith("seg")) {
      const n = Number(lower.slice(0, -3));
      return Number.isNaN(n) ? null : Math.round(n);
    }
    if (lower.endsWith("s")) {
      const n = Number(lower.slice(0, -1));
      return Number.isNaN(n) ? null : Math.round(n);
    }

    const n = Number(lower);
    if (Number.isNaN(n)) return null;
    const isMinutesDecimal = raw.includes(",") || raw.includes(".");
    return Math.round(isMinutesDecimal ? n * 60 : n);
  }

  function commitRestEdit(exerciseId: string, setId: string) {
    const parsed = parseRestInput(restDraft);
    if (parsed !== null) {
      setDraft((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.id !== exerciseId
            ? e
            : {
                ...e,
                sets: e.sets.map((s) =>
                  s.id === setId ? { ...s, restSeconds: Math.max(15, Math.min(600, parsed)) } : s
                ),
              }
        ),
      }));
    }
    setEditingRestSetId(null);
  }

  function toggleSetDone(exerciseId: string, setId: string) {
    let justCompletedRestSeconds: number | null = null;
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s;
                const nextDone = !s.done;
                if (nextDone) justCompletedRestSeconds = s.restSeconds;
                return { ...s, done: nextDone };
              }),
            }
      ),
    }));
    if (justCompletedRestSeconds !== null) {
      startRestTimer(exerciseId, setId, justCompletedRestSeconds);
    }
  }

  function updateSetLabel(exerciseId: string, setId: string, label: string) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, label } : s)),
            }
      ),
    }));
  }

  function moveExercise(id: string, direction: -1 | 1) {
    setDraft((prev) => {
      const index = prev.exercises.findIndex((e) => e.id === id);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.exercises.length) return prev;

      const movedId = id;
      const otherId = prev.exercises[targetIndex].id;
      const movedHeight = (rowHeightsRef.current[movedId] ?? 0) + EXERCISE_ROW_GAP;
      const otherHeight = (rowHeightsRef.current[otherId] ?? 0) + EXERCISE_ROW_GAP;

      // Quem sobe entra vindo de baixo (offset positivo -> 0); quem desce
      // entra vindo de cima (offset negativo -> 0). A distância de cada um é
      // o tamanho do outro card, já que é o espaço que ele atravessa.
      if (direction === -1) {
        slideRowFrom(movedId, otherHeight);
        slideRowFrom(otherId, -movedHeight);
      } else {
        slideRowFrom(movedId, -otherHeight);
        slideRowFrom(otherId, movedHeight);
      }

      const next = [...prev.exercises];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...prev, exercises: next };
    });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!draft.id) return;
    Alert.alert("Excluir treino?", `"${draft.name}" será removido permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => onDelete?.(draft.id!) },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.header, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}>
            <Pressable
              style={styles.backButton}
              onPress={onClose}
              {...hoverHandlers("header-cancel")}
              hitSlop={8}
              accessibilityLabel="Voltar"
            >
              {({ pressed }: { pressed: boolean }) => {
                const active = pressed || hoveredControl === "header-cancel";
                return (
                  <Ionicons
                    name="chevron-back"
                    size={26}
                    color={active ? COLORS.accent : COLORS.textSecondary}
                  />
                );
              }}
            </Pressable>
            <Text style={styles.headerTitle}>{isEditing ? "Editar treino" : "Novo treino"}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <FlatList
            data={draft.exercises}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                <View style={isWide ? styles.topFieldsRow : undefined}>
                  <View style={isWide ? styles.topFieldCol : undefined}>
                    <Text style={styles.label}>Nome do treino</Text>
                    <TextInput
                      style={styles.nameInput}
                      placeholder="Ex: Treino A — Peito e Tríceps"
                      placeholderTextColor={COLORS.textTertiary}
                      value={draft.name}
                      onChangeText={(v) => setDraft((prev) => ({ ...prev, name: v }))}
                      returnKeyType="done"
                    />
                  </View>

                  <View style={isWide ? styles.topFieldCol : undefined}>
                    <Text style={styles.label}>Dias da semana</Text>
                    <View style={styles.weekdayRow}>
                      {WEEKDAY_LABELS.map((label, index) => {
                        const active = draft.weekdays.includes(index);
                        return (
                          <Pressable
                            key={index}
                            style={[styles.weekdayCircle, active && styles.weekdayCircleActive]}
                            onPress={() => toggleWeekday(index)}
                            hitSlop={4}
                            accessibilityLabel={WEEKDAY_FULL_LABELS[index]}
                          >
                            <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View style={styles.exercisesHeaderRow}>
                  <Text style={styles.label}>Exercícios ({draft.exercises.length})</Text>
                </View>
              </View>
            }
            renderItem={({ item, index }) => (
              <Animated.View
                onLayout={(e) => {
                  rowHeightsRef.current[item.id] = e.nativeEvent.layout.height;
                }}
                style={[
                  styles.exerciseRow,
                  {
                    transform: [
                      { translateY: getReorderAnim(item.id) },
                      {
                        scale: getLiftAnim(item.id).interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.02],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.exerciseTopRow}>
                  <View style={styles.reorderCol}>
                    <Pressable
                      style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                      onPress={() => moveExercise(item.id, -1)}
                      disabled={index === 0}
                      hitSlop={6}
                    >
                      <Ionicons name="chevron-up" size={16} color={COLORS.textSecondary} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.reorderButton,
                        index === draft.exercises.length - 1 && styles.reorderButtonDisabled,
                      ]}
                      onPress={() => moveExercise(item.id, 1)}
                      disabled={index === draft.exercises.length - 1}
                      hitSlop={6}
                    >
                      <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => item.collapsed && setCollapsed(item.id, false)}
                  >
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.exerciseMuscle}>{MUSCLE_GROUP_LABELS[item.muscleGroup]}</Text>
                    {item.collapsed && (
                      <View style={styles.collapsedSummaryRow}>
                        {item.done && (
                          <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                        )}
                        <Text style={[styles.collapsedSummary, item.done && styles.collapsedSummaryDone]}>
                          {item.sets.length} série{item.sets.length !== 1 ? "s" : ""} ·{" "}
                          {item.sets.map((s) => `${s.reps}x${s.weightKg}kg`).join(", ")}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.chevronButton}
                    onPress={() => setCollapsed(item.id, !item.collapsed)}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={item.collapsed ? "chevron-down" : "chevron-up"}
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>

                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeExercise(item.id)}
                    hitSlop={4}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
                  </Pressable>
                </View>

                {!item.collapsed && (
                  <View style={styles.setsBlock}>
                    {item.sets.map((set, setIndex) => {
                      const defaultLabel = `Série ${setIndex + 1}`;
                      const isEditingLabel = editingLabelSetId === set.id;
                      return (
                      <View key={set.id} style={[styles.setLine, set.done && styles.setLineDone]}>
                        <View style={styles.setTopRow}>
                          <View style={styles.setLabelRow}>
                            {isEditingLabel ? (
                              <>
                                <TextInput
                                  style={styles.setLabelInput}
                                  value={set.label ?? ""}
                                  onChangeText={(v) => updateSetLabel(item.id, set.id, v)}
                                  placeholder={defaultLabel}
                                  placeholderTextColor={COLORS.textTertiary}
                                  autoFocus
                                  returnKeyType="done"
                                  onSubmitEditing={() => setEditingLabelSetId(null)}
                                />
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.confirmLabelButton,
                                    (pressed || hoveredControl === `confirm-${set.id}`) &&
                                      styles.confirmLabelButtonActive,
                                  ]}
                                  onPress={() => setEditingLabelSetId(null)}
                                  {...hoverHandlers(`confirm-${set.id}`)}
                                  hitSlop={8}
                                >
                                  {({ pressed }: { pressed: boolean }) => (
                                    <Ionicons
                                      name="checkmark"
                                      size={14}
                                      color={
                                        pressed || hoveredControl === `confirm-${set.id}`
                                          ? "#FFF"
                                          : COLORS.success
                                      }
                                    />
                                  )}
                                </Pressable>
                              </>
                            ) : (
                              <>
                                <Text style={styles.setLineLabel} numberOfLines={1}>
                                  {set.label?.trim() ? set.label : defaultLabel}
                                </Text>
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.editLabelButton,
                                    (pressed || hoveredControl === `edit-${set.id}`) &&
                                      styles.editLabelButtonActive,
                                  ]}
                                  onPress={() => setEditingLabelSetId(set.id)}
                                  {...hoverHandlers(`edit-${set.id}`)}
                                  hitSlop={8}
                                >
                                  {({ pressed }: { pressed: boolean }) => (
                                    <Ionicons
                                      name="create-outline"
                                      size={14}
                                      color={
                                        pressed || hoveredControl === `edit-${set.id}`
                                          ? COLORS.accent
                                          : COLORS.textTertiary
                                      }
                                    />
                                  )}
                                </Pressable>
                              </>
                            )}
                          </View>

                        </View>

                        <View style={styles.setBottomRow}>
                          <View style={styles.stepper}>
                            <Pressable
                              style={styles.stepperButton}
                              onPress={() => updateSetReps(item.id, set.id, -1)}
                              disabled={set.done}
                              hitSlop={6}
                            >
                              <Ionicons
                                name="remove"
                                size={16}
                                color={set.done ? COLORS.textTertiary : COLORS.textPrimary}
                              />
                            </Pressable>
                            <Text style={styles.stepperValue}>{set.reps}</Text>
                            <Pressable
                              style={styles.stepperButton}
                              onPress={() => updateSetReps(item.id, set.id, 1)}
                              disabled={set.done}
                              hitSlop={6}
                            >
                              <Ionicons
                                name="add"
                                size={16}
                                color={set.done ? COLORS.textTertiary : COLORS.textPrimary}
                              />
                            </Pressable>
                          </View>
                          <Text style={styles.targetsX}>reps</Text>

                          <View style={styles.stepper}>
                            <Pressable
                              style={styles.stepperButton}
                              onPress={() => updateSetWeight(item.id, set.id, -2.5)}
                              disabled={set.done}
                              hitSlop={6}
                            >
                              <Ionicons
                                name="remove"
                                size={16}
                                color={set.done ? COLORS.textTertiary : COLORS.textPrimary}
                              />
                            </Pressable>
                            {editingWeightSetId === set.id ? (
                              <TextInput
                                style={styles.stepperInput}
                                value={weightDraft}
                                onChangeText={setWeightDraft}
                                keyboardType="decimal-pad"
                                autoFocus
                                selectTextOnFocus
                                returnKeyType="done"
                                onSubmitEditing={() => commitWeightEdit(item.id, set.id)}
                                onBlur={() => commitWeightEdit(item.id, set.id)}
                              />
                            ) : (
                              <Pressable
                                onPress={() => !set.done && startEditingWeight(set.id, set.weightKg)}
                                disabled={set.done}
                                hitSlop={4}
                              >
                                <Text style={styles.stepperValue}>{set.weightKg}</Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={styles.stepperButton}
                              onPress={() => updateSetWeight(item.id, set.id, 2.5)}
                              disabled={set.done}
                              hitSlop={6}
                            >
                              <Ionicons
                                name="add"
                                size={16}
                                color={set.done ? COLORS.textTertiary : COLORS.textPrimary}
                              />
                            </Pressable>
                          </View>
                          <Text style={styles.targetsX}>kg</Text>

                          <View style={styles.restTimeChip}>
                            <Ionicons
                              name="timer-outline"
                              size={13}
                              color={set.done ? COLORS.textTertiary : COLORS.textSecondary}
                            />
                            {editingRestSetId === set.id ? (
                              <TextInput
                                style={styles.restTimeInput}
                                value={restDraft}
                                onChangeText={setRestDraft}
                                keyboardType="decimal-pad"
                                autoFocus
                                selectTextOnFocus
                                returnKeyType="done"
                                onSubmitEditing={() => commitRestEdit(item.id, set.id)}
                                onBlur={() => commitRestEdit(item.id, set.id)}
                              />
                            ) : (
                              <Pressable
                                onPress={() => !set.done && startEditingRest(set.id, set.restSeconds)}
                                disabled={set.done}
                                hitSlop={4}
                              >
                                <Text
                                  style={[styles.restTimeText, set.done && styles.restTimeTextDone]}
                                >
                                  {formatRest(set.restSeconds)}
                                </Text>
                              </Pressable>
                            )}
                          </View>
                          <View style={styles.setActions}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.removeSetButton,
                                (pressed || hoveredControl === `remove-${set.id}`) &&
                                  styles.removeSetButtonActive,
                                item.sets.length <= 1 && styles.removeSetButtonDisabled,
                              ]}
                              onPress={() => removeSetRow(item.id, set.id)}
                              disabled={item.sets.length <= 1}
                              {...hoverHandlers(`remove-${set.id}`)}
                              hitSlop={6}
                            >
                              {({ pressed }: { pressed: boolean }) => (
                                <Ionicons
                                  name="close"
                                  size={14}
                                  color={
                                    pressed || hoveredControl === `remove-${set.id}`
                                      ? COLORS.accent
                                      : COLORS.textTertiary
                                  }
                                />
                              )}
                            </Pressable>
  
                            <Pressable
                              style={({ pressed }) => [
                                styles.setDoneButton,
                                (set.done || pressed || hoveredControl === `done-${set.id}`) &&
                                  styles.setDoneButtonActive,
                              ]}
                              onPress={() => toggleSetDone(item.id, set.id)}
                              {...hoverHandlers(`done-${set.id}`)}
                              hitSlop={6}
                            >
                              {({ pressed }: { pressed: boolean }) => (
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color={
                                    set.done || pressed || hoveredControl === `done-${set.id}`
                                      ? "#FFF"
                                      : COLORS.textTertiary
                                  }
                                />
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                      );
                    })}

                    <Pressable style={styles.addSetRowButton} onPress={() => addSetRow(item.id)}>
                      <Ionicons name="add" size={14} color={COLORS.accent} />
                      <Text style={styles.addSetRowText}>Adicionar série</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.doneExerciseButton,
                        (item.done || pressed || hoveredControl === `done-exercise-${item.id}`) &&
                          styles.doneExerciseButtonActive,
                      ]}
                      onPress={() => markExerciseDone(item.id)}
                      {...hoverHandlers(`done-exercise-${item.id}`)}
                    >
                      {({ pressed }: { pressed: boolean }) => {
                        const active =
                          item.done || pressed || hoveredControl === `done-exercise-${item.id}`;
                        return (
                          <>
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={active ? COLORS.success : COLORS.textTertiary}
                            />
                            <Text style={[styles.doneExerciseText, active && styles.doneExerciseTextActive]}>
                              Feito
                            </Text>
                          </>
                        );
                      }}
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyExercises}>
                <Text style={styles.emptyExercisesText}>
                  Nenhum exercício adicionado ainda
                </Text>
              </View>
            }
            ListFooterComponent={
              <Pressable style={styles.addExerciseButton} onPress={() => setPickerVisible(true)}>
                <Ionicons name="add" size={18} color={COLORS.accent} />
                <Text style={styles.addExerciseText}>Adicionar exercício</Text>
              </Pressable>
            }
          />

          {restRemaining !== null && restRemaining > 0 && (
            <View style={[styles.restBar, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}>
              <View style={styles.restBarTopRow}>
                <View style={styles.restBarLabelRow}>
                  <Ionicons name="timer-outline" size={16} color={COLORS.accent} />
                  <Text style={styles.restBarLabel}>{restPaused ? "Pausado" : "Descanso"}</Text>
                </View>
                <View style={styles.restBarRightRow}>
                  <Pressable style={styles.restPauseButton} onPress={togglePauseRestTimer} hitSlop={8}>
                    <Ionicons name={restPaused ? "play" : "pause"} size={13} color={COLORS.accent} />
                  </Pressable>
                  <Text style={styles.restBarTime}>{formatRest(restRemaining)}</Text>
                </View>
              </View>

              <View style={styles.restProgressTrack}>
                <View
                  style={[
                    styles.restProgressFill,
                    { width: `${Math.min(100, ((restTotal - restRemaining) / restTotal) * 100)}%` },
                  ]}
                />
              </View>

              <View style={styles.restControlsRow}>
                <Pressable style={styles.restControlButton} onPress={() => adjustRestTimer(-30)}>
                  <Text style={styles.restControlText}>-30s</Text>
                </Pressable>
                <Pressable style={styles.restControlButton} onPress={() => adjustRestTimer(30)}>
                  <Text style={styles.restControlText}>+30s</Text>
                </Pressable>
                <Pressable style={styles.restSkipButton} onPress={stopRestTimer}>
                  <Text style={styles.restSkipText}>Pular</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={[styles.footerBar, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}>
            <View style={styles.footerActions}>
              {isEditing ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.headerButton,
                    styles.headerButtonEnabled,
                    (pressed || hoveredControl === "delete-workout") && styles.headerButtonPressed,
                  ]}
                  onPress={handleDelete}
                  {...hoverHandlers("delete-workout")}
                >
                  <Text style={[styles.headerButtonText, styles.saveTextActive]}>Excluir treino</Text>
                </Pressable>
              ) : <View />}
            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                canSave ? styles.headerButtonEnabled : styles.headerButtonDisabled,
                canSave && (pressed || hoveredControl === "footer-save") && styles.headerButtonPressed,
              ]}
              onPress={handleSave}
              disabled={!canSave || saving}
              {...hoverHandlers("footer-save")}
              hitSlop={8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text
                  style={[
                    styles.headerButtonText,
                    styles.saveText,
                    canSave ? styles.saveTextActive : styles.saveTextDisabled,
                  ]}
                >
                  Salvar
                </Text>
              )}
            </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        {restCompleteInfo && (
          <View style={styles.restCompleteOverlay}>
            <View style={styles.restCompleteCard}>
              <View style={styles.restCompleteIconCircle}>
                <Ionicons name="checkmark" size={22} color={COLORS.accentLight} />
              </View>
              <Text style={styles.restCompleteTitle}>Descanso concluído!</Text>
              <Text style={styles.restCompleteSub}>
                {restCompleteInfo.setLabel} · {restCompleteInfo.exerciseName}
              </Text>
              <View style={styles.restCompleteRow}>
                <Pressable style={styles.restCompleteGhostButton} onPress={extendRestFromModal}>
                  <Text style={styles.restCompleteGhostText}>+30s</Text>
                </Pressable>
                <Pressable style={styles.restCompletePrimaryButton} onPress={dismissRestComplete}>
                  <Text style={styles.restCompletePrimaryText}>Concluir</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>

      <ExercisePickerModal
        visible={pickerVisible}
        alreadyAddedIds={draft.exercises.map((e) => e.exerciseId)}
        onClose={() => setPickerVisible(false)}
        onAdd={handleAddExercise}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerButtonEnabled: {
    backgroundColor: COLORS.accent,
  },
  headerButtonPressed: {
    backgroundColor: COLORS.accentLight,
  },
  headerButtonDisabled: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  saveText: {
    textAlign: "right",
  },
  saveTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },
  saveTextDisabled: {
    color: COLORS.textTertiary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  topFieldsRow: {
    flexDirection: "row",
    gap: 24,
  },
  topFieldCol: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 20,
  },
  nameInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16, // >=16px evita o zoom automático do Safari/Chrome no celular ao focar
    color: COLORS.textPrimary,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekdayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayCircleActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  weekdayTextActive: {
    color: "#FFF",
  },
  exercisesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exerciseRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  exerciseTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  chevronButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  collapsedSummary: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  collapsedSummaryDone: {
    color: COLORS.success,
  },
  reorderCol: {
    gap: 2,
  },
  reorderButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  exerciseMuscle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  setsBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  setLine: {
    gap: 8,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
  setLineDone: {
    backgroundColor: "rgba(46, 204, 113, 0.06)",
  },
  setTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  setBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  setActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 12,
  },
  setLabelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  setLineLabel: {
    flexShrink: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  editLabelButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  editLabelButtonActive: {
    backgroundColor: COLORS.accentMuted,
  },
  setLabelInput: {
    width: 90,
    flexGrow: 0,
    fontSize: 12,
    color: COLORS.textPrimary,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  confirmLabelButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  confirmLabelButtonActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  removeSetButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  removeSetButtonActive: {
    backgroundColor: COLORS.accentMuted,
  },
  removeSetButtonDisabled: {
    opacity: 0.25,
  },
  setDoneButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  setDoneButtonActive: {
    backgroundColor: COLORS.success,
  },
  addSetRowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 4,
  },
  addSetRowText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accent,
  },
  doneExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 8,
  },
  doneExerciseButtonActive: {
    backgroundColor: "rgba(46, 204, 113, 0.1)",
  },
  doneExerciseText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  doneExerciseTextActive: {
    color: COLORS.success,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperButton: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  stepperInput: {
    width: 34,
    height: 20,
    textAlign: "center",
    fontSize: 16, // >=16px evita o zoom automático do Safari/Chrome no celular ao focar
    fontWeight: "700",
    color: COLORS.textPrimary,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  targetsX: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  restTimeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  restTimeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  restTimeTextDone: {
    color: COLORS.textTertiary,
  },
  restTimeInput: {
    width: 34,
    height: 20,
    textAlign: "center",
    fontSize: 16, // >=16px evita o zoom automático do Safari/Chrome no celular ao focar
    fontWeight: "700",
    color: COLORS.textPrimary,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  removeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyExercises: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyExercisesText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  restBar: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accentMuted,
  },
  restBarTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  restBarLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  restBarRightRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  restPauseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentMuted,
  },
  restBarLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  restBarTime: { fontSize: 20, fontWeight: "700", color: COLORS.accent, fontVariant: ["tabular-nums"] },
  restProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surfaceAlt,
    overflow: "hidden",
    marginBottom: 10,
  },
  restProgressFill: { height: "100%", backgroundColor: COLORS.accent },
  restControlsRow: { flexDirection: "row", gap: 8 },
  restControlButton: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  restControlText: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  restSkipButton: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentMuted,
  },
  restSkipText: { fontSize: 12, fontWeight: "700", color: COLORS.accent },
  restCompleteOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(4, 4, 5, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  restCompleteCard: {
    width: "100%",
    maxWidth: 260,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  restCompleteIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  restCompleteTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  restCompleteSub: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  restCompleteRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  restCompleteGhostButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  restCompleteGhostText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  restCompletePrimaryButton: {
    flex: 1.4,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  restCompletePrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.accent,
  },
  addExerciseText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.accent,
  },
  headerSpacer: {
    width: 44,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
