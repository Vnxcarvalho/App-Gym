// components/WorkoutFormModal.tsx
//
// Modal full-screen de criar/editar treino. Um único FlatList vertical (exercícios)
// carrega o form inteiro via ListHeaderComponent/ListFooterComponent — evita aninhar
// uma FlatList dentro de um ScrollView (warning do RN e scroll quebrado em Android).
//
// Layout: cabeçalho com fechar/título/Salvar, nome do treino em destaque, e cada
// exercício como bloco "chapado" (sem card) com tabela de séries em pílulas —
// Carga, Reps e Descanso editáveis direto no campo.
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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_MONO } from "../constants/theme";
import { Alert } from "../lib/alert";
import { MUSCLE_GROUP_LABELS, WEEKDAY_FULL_LABELS, WEEKDAY_LABELS } from "../constants/muscleGroups";
import { useResponsive } from "../hooks/useResponsive";
import ExercisePickerModal, { ExerciseCatalogItem } from "./ExercisePickerModal";
import ExerciseDemoModal from "./ExerciseDemoModal";
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
  collapsed: boolean; // recolhe o bloco, economiza espaço numa lista longa
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

// Só um exercício começa aberto: sempre o primeiro da lista (o do topo).
function collapseAllButFirst(exercises: WorkoutExerciseDraft[]): WorkoutExerciseDraft[] {
  return exercises.map((e, i) => ({ ...e, collapsed: i !== 0 }));
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

function parseDecimal(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() === "" || Number.isNaN(n) ? null : n;
}

function parseInteger(text: string): number | null {
  const n = Math.round(Number(text.trim().replace(",", ".")));
  return text.trim() === "" || Number.isNaN(n) ? null : n;
}

// Pílula numérica editável direto no campo. Mantém o texto local enquanto o
// usuário digita (pra aceitar "1:30", "22,5" etc.) e só confirma no blur.
function NumberPill({
  value,
  parse,
  onCommit,
  suffix,
  disabled,
  accessibilityLabel,
  height,
  fontSize,
  flex = 1,
}: {
  value: number;
  parse: (text: string) => number | null;
  onCommit: (parsed: number) => void;
  suffix?: string;
  disabled?: boolean;
  accessibilityLabel: string;
  height: number;
  fontSize: number;
  flex?: number;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  function commit() {
    setFocused(false);
    const parsed = parse(text);
    if (parsed === null) {
      setText(String(value));
      return;
    }
    onCommit(parsed);
  }

  return (
    <View
      style={[
        pillStyles.pill,
        { flex, height, borderRadius: height / 2 },
        disabled && pillStyles.pillDisabled,
      ]}
    >
      <TextInput
        style={[pillStyles.input, { fontSize }, disabled && pillStyles.inputDisabled]}
        maxFontSizeMultiplier={1.2}
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        editable={!disabled}
        accessibilityLabel={accessibilityLabel}
      />
      {suffix ? <Text style={pillStyles.suffix}>{suffix}</Text> : null}
    </View>
  );
}

// Miniatura circular do exercício (usa a mídia de demonstração, se houver).
function ExerciseAvatar({
  uri,
  size,
  onPress,
}: {
  uri?: string | null;
  size: number;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      style={[avatarStyles.ring, { width: size, height: size, borderRadius: size / 2 }]}
      onPress={onPress}
      accessibilityLabel="Ver como fazer"
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={avatarStyles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="barbell-outline" size={22} color={COLORS.textSecondary} />
      )}
    </Pressable>
  );
}

export default function WorkoutFormModal({ visible, initialWorkout, onClose, onSave, onDelete }: Props) {
  const { contentMaxWidth, width } = useResponsive();
  // Formulário de leitura/edição: em tablet/desktop não precisa esticar além disso.
  const formWidth = Math.min(contentMaxWidth, 640);
  // Celulares estreitos (iPhone SE/mini, Android compacto): encolhe pílulas,
  // círculos e espaçamentos pra tabela de 3 colunas não apertar nem quebrar.
  const compact = width < 380;
  const m = {
    pillHeight: compact ? 42 : 48,
    pillFont: compact ? 15 : 17,
    indexSize: compact ? 38 : 44,
    menuWidth: compact ? 22 : 28,
    rowGap: compact ? 6 : 8,
    avatar: compact ? 44 : 52,
    nameFont: compact ? 16 : 18,
    sidePadding: compact ? 12 : 16,
  };
  const [draft, setDraft] = useState<WorkoutDraft>(EMPTY_DRAFT);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingLabelSetId, setEditingLabelSetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Muda a cada abertura: remonta a lista e garante que ela comece no topo,
  // em vez de herdar a posição de rolagem da última vez que o modal foi usado.
  const [openCount, setOpenCount] = useState(0);
  const listRef = useRef<FlatList<WorkoutExerciseDraft>>(null);

  function scrollListToTop() {
    // Espera o layout assentar (novo exercício / fechamento do seletor) antes de rolar.
    // Repete após a animação do modal: na web o foco volta pro botão que abriu o
    // seletor e o navegador rola até ele, desfazendo um único scroll imediato.
    [50, 350, 700].forEach((delay) =>
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), delay)
    );
  }

  function openPicker() {
    // Web: tira o foco do botão pra o navegador não rolar até ele ao fechar o seletor.
    if (Platform.OS === "web") (globalThis as any).document?.activeElement?.blur?.();
    setPickerVisible(true);
  }
  const [demoExercise, setDemoExercise] = useState<{ name: string; demoMediaUrl?: string | null } | null>(
    null
  );

  // Cronômetro de descanso: dispara sozinho ao marcar uma série como feita
  // (toque no círculo numerado), usando o tempo configurado NAQUELA série.
  // null = escondido; ao zerar, a barra some e dá lugar ao cartão central
  // "Descanso concluído".
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
  // que dá a sensação de o bloco se soltar e pousar no lugar novo — sem cor.
  const reorderAnimsRef = useRef<Record<string, Animated.Value>>({});
  const liftAnimsRef = useRef<Record<string, Animated.Value>>({});
  const rowHeightsRef = useRef<Record<string, number>>({});
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

  useEffect(() => {
    if (visible) {
      const base = initialWorkout ?? EMPTY_DRAFT;
      setDraft({ ...base, exercises: collapseAllButFirst(base.exercises) });
      setEditingLabelSetId(null);
      setOpenCount((c) => c + 1);
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
    scrollListToTop();
    setDraft((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          id: `we-${item.id}-${Date.now()}`,
          exerciseId: item.id,
          name: item.name,
          muscleGroup: item.muscleGroup,
          demoMediaUrl: item.demoMediaUrl ?? null,
          sets: makeDefaultSets(3),
          // Só o primeiro da lista fica aberto; os demais entram recolhidos.
          collapsed: prev.exercises.length > 0,
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

  function updateSet(exerciseId: string, setId: string, patch: Partial<SetTarget>) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id !== exerciseId
          ? e
          : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
      ),
    }));
  }

  function setRepsExact(exerciseId: string, setId: string, reps: number) {
    updateSet(exerciseId, setId, { reps: Math.max(1, Math.min(50, Math.round(reps))) });
  }

  function setWeightExact(exerciseId: string, setId: string, weightKg: number) {
    updateSet(exerciseId, setId, {
      weightKg: Math.round(Math.max(0, Math.min(500, weightKg)) * 10) / 10,
    });
  }

  function setRestExact(exerciseId: string, setId: string, seconds: number) {
    updateSet(exerciseId, setId, { restSeconds: Math.max(15, Math.min(600, seconds)) });
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

  function toggleSetDone(exerciseId: string, setId: string) {
    const exercise = draft.exercises.find((e) => e.id === exerciseId);
    const target = exercise?.sets.find((s) => s.id === setId);
    if (!target) return;
    const nextDone = !target.done;
    updateSet(exerciseId, setId, { done: nextDone });
    if (nextDone) startRestTimer(exerciseId, setId, target.restSeconds);
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
      // o tamanho do outro bloco, já que é o espaço que ele atravessa.
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

  function openExerciseMenu(item: WorkoutExerciseDraft, index: number) {
    const buttons = [
      {
        text: "Ver como fazer",
        onPress: () => setDemoExercise({ name: item.name, demoMediaUrl: item.demoMediaUrl }),
      },
      ...(index > 0
        ? [{ text: "Mover para cima", onPress: () => moveExercise(item.id, -1) }]
        : []),
      ...(index < draft.exercises.length - 1
        ? [{ text: "Mover para baixo", onPress: () => moveExercise(item.id, 1) }]
        : []),
      {
        text: "Remover exercício",
        style: "destructive" as const,
        onPress: () => removeExercise(item.id),
      },
      { text: "Cancelar", style: "cancel" as const },
    ];
    Alert.alert(item.name, MUSCLE_GROUP_LABELS[item.muscleGroup], buttons);
  }

  function openSetMenu(item: WorkoutExerciseDraft, set: SetTarget, setIndex: number) {
    const buttons = [
      {
        text: set.done ? "Desmarcar como feita" : "Marcar como feita",
        onPress: () => toggleSetDone(item.id, set.id),
      },
      { text: "Renomear série", onPress: () => setEditingLabelSetId(set.id) },
      ...(item.sets.length > 1
        ? [
            {
              text: "Excluir série",
              style: "destructive" as const,
              onPress: () => removeSetRow(item.id, set.id),
            },
          ]
        : []),
      { text: "Cancelar", style: "cancel" as const },
    ];
    Alert.alert(set.label?.trim() ? set.label : `Série ${setIndex + 1}`, item.name, buttons);
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
          <View style={[styles.header, { maxWidth: formWidth, alignSelf: "center", width: "100%" }]}>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="chevron-down" size={22} color={COLORS.textPrimary} />
            </Pressable>

            <Text style={styles.headerTitle}>{isEditing ? "Editar treino" : "Novo treino"}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                canSave ? styles.saveButtonEnabled : styles.saveButtonDisabled,
                canSave && pressed && styles.saveButtonPressed,
              ]}
              onPress={handleSave}
              disabled={!canSave || saving}
              hitSlop={8}
              accessibilityLabel="Salvar treino"
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.onAccent} />
              ) : (
                <Text style={[styles.saveText, canSave ? styles.saveTextActive : styles.saveTextDisabled]}>
                  Salvar
                </Text>
              )}
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            key={openCount}
            data={draft.exercises}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={{ width: "100%", maxWidth: formWidth, alignSelf: "center" }}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: m.sidePadding }]}
            ListHeaderComponent={
              <View>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Nome do treino"
                  placeholderTextColor={COLORS.textTertiary}
                  value={draft.name}
                  onChangeText={(v) => setDraft((prev) => ({ ...prev, name: v }))}
                  returnKeyType="done"
                  accessibilityLabel="Nome do treino"
                />

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

                <View style={styles.divider} />
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
                <View style={[styles.exerciseTopRow, { gap: m.rowGap + 4 }]}>
                  <ExerciseAvatar
                    size={m.avatar}
                    uri={item.demoMediaUrl}
                    onPress={() => setDemoExercise({ name: item.name, demoMediaUrl: item.demoMediaUrl })}
                  />

                  <Pressable
                    style={styles.exerciseTitleWrap}
                    onPress={() => setCollapsed(item.id, !item.collapsed)}
                  >
                    <Text
                      style={[styles.exerciseName, { fontSize: m.nameFont }]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.3}
                    >
                      {item.name}
                    </Text>
                    {item.collapsed && (
                      <View style={styles.collapsedSummaryRow}>
                        {item.done && (
                          <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                        )}
                        <Text
                          style={[styles.collapsedSummary, item.done && styles.collapsedSummaryDone]}
                          numberOfLines={1}
                        >
                          {item.sets.length} série{item.sets.length !== 1 ? "s" : ""} ·{" "}
                          {item.sets.map((s) => `${s.reps}x${s.weightKg}kg`).join(", ")}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.iconButton}
                    onPress={() => openExerciseMenu(item, index)}
                    hitSlop={6}
                    accessibilityLabel={`Opções de ${item.name}`}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color={COLORS.accent} />
                  </Pressable>

                  <Pressable
                    style={styles.iconButton}
                    onPress={() => setCollapsed(item.id, !item.collapsed)}
                    hitSlop={6}
                    accessibilityLabel={item.collapsed ? "Expandir" : "Recolher"}
                  >
                    <Ionicons
                      name={item.collapsed ? "chevron-down" : "chevron-up"}
                      size={24}
                      color={COLORS.accent}
                    />
                  </Pressable>
                </View>

                {!item.collapsed && (
                  <View style={[styles.setsBlock, { gap: m.rowGap }]}>
                    <View style={[styles.columnHeaderRow, { gap: m.rowGap }]}>
                      <View style={{ width: m.indexSize }} />
                      <Text style={[styles.columnHeader, { flex: 1.15 }]} numberOfLines={1}>
                        {compact ? "Carga" : "Carga · kg"}
                      </Text>
                      <Text style={[styles.columnHeader, { flex: 1 }]} numberOfLines={1}>
                        Reps
                      </Text>
                      <Text style={[styles.columnHeader, { flex: 1 }]} numberOfLines={1}>
                        Descanso
                      </Text>
                      <View style={{ width: m.menuWidth }} />
                    </View>

                    {item.sets.map((set, setIndex) => {
                      const defaultLabel = `Série ${setIndex + 1}`;
                      const isEditingLabel = editingLabelSetId === set.id;
                      const hasLabel = !!set.label?.trim();
                      return (
                        <View key={set.id} style={styles.setBlock}>
                          {(hasLabel || isEditingLabel) && (
                            <View style={[styles.setLabelRow, { paddingLeft: m.indexSize + m.rowGap }]}>
                              {isEditingLabel ? (
                                <>
                                  <TextInput
                                    style={styles.setLabelInput}
                                    value={set.label ?? ""}
                                    onChangeText={(v) => updateSet(item.id, set.id, { label: v })}
                                    placeholder={defaultLabel}
                                    placeholderTextColor={COLORS.textTertiary}
                                    autoFocus
                                    returnKeyType="done"
                                    onSubmitEditing={() => setEditingLabelSetId(null)}
                                    onBlur={() => setEditingLabelSetId(null)}
                                  />
                                  <Pressable
                                    style={styles.confirmLabelButton}
                                    onPress={() => setEditingLabelSetId(null)}
                                    hitSlop={8}
                                    accessibilityLabel="Confirmar nome da série"
                                  >
                                    <Ionicons name="checkmark" size={14} color={COLORS.success} />
                                  </Pressable>
                                </>
                              ) : (
                                <Text style={styles.setLabelText} numberOfLines={1}>
                                  {set.label}
                                </Text>
                              )}
                            </View>
                          )}

                          <View style={[styles.setLine, { gap: m.rowGap }]}>
                            <Pressable
                              style={[
                                styles.setIndexCircle,
                                { width: m.indexSize, height: m.indexSize, borderRadius: m.indexSize / 2 },
                                set.done && styles.setIndexCircleDone,
                              ]}
                              onPress={() => toggleSetDone(item.id, set.id)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: set.done }}
                              accessibilityLabel={`Marcar ${defaultLabel} como ${
                                set.done ? "pendente" : "concluída"
                              }`}
                              hitSlop={4}
                            >
                              <Ionicons
                                name="checkmark"
                                size={22}
                                color={set.done ? COLORS.onAccent : COLORS.textTertiary}
                              />
                            </Pressable>

                            <NumberPill
                              flex={1.15}
                              height={m.pillHeight}
                              fontSize={m.pillFont}
                              value={set.weightKg}
                              parse={parseDecimal}
                              onCommit={(v) => setWeightExact(item.id, set.id, v)}
                              disabled={set.done}
                              accessibilityLabel={`Carga da ${defaultLabel}, em quilos`}
                            />
                            <NumberPill
                              height={m.pillHeight}
                              fontSize={m.pillFont}
                              value={set.reps}
                              parse={parseInteger}
                              onCommit={(v) => setRepsExact(item.id, set.id, v)}
                              disabled={set.done}
                              accessibilityLabel={`Repetições da ${defaultLabel}`}
                            />
                            <NumberPill
                              height={m.pillHeight}
                              fontSize={m.pillFont}
                              value={set.restSeconds}
                              parse={parseRestInput}
                              onCommit={(v) => setRestExact(item.id, set.id, v)}
                              suffix="s"
                              disabled={set.done}
                              accessibilityLabel={`Descanso da ${defaultLabel}, em segundos`}
                            />

                            <Pressable
                              style={[styles.setMenuButton, { width: m.menuWidth, height: m.pillHeight }]}
                              onPress={() => openSetMenu(item, set, setIndex)}
                              hitSlop={6}
                              accessibilityLabel={`Opções da ${defaultLabel}`}
                            >
                              <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}

                    <Pressable
                      style={({ pressed }) => [styles.addSetRowButton, pressed && styles.addSetRowButtonPressed]}
                      onPress={() => addSetRow(item.id)}
                    >
                      <Ionicons name="add" size={22} color={COLORS.textPrimary} />
                      <Text style={styles.addSetRowText}>Adicionar Série</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.doneExerciseButton,
                        (item.done || pressed) && styles.doneExerciseButtonActive,
                      ]}
                      onPress={() => markExerciseDone(item.id)}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={item.done ? COLORS.success : COLORS.textTertiary}
                      />
                      <Text style={[styles.doneExerciseText, item.done && styles.doneExerciseTextActive]}>
                        Feito
                      </Text>
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyExercises}>
                <Text style={styles.emptyExercisesText}>Nenhum exercício adicionado ainda</Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.listFooter}>
                <Pressable
                  style={({ pressed }) => [styles.addExerciseButton, pressed && styles.addExerciseButtonPressed]}
                  onPress={openPicker}
                >
                  <Ionicons name="add" size={20} color={COLORS.onAccent} />
                  <Text style={styles.addExerciseText}>Adicionar exercício</Text>
                </Pressable>

                {isEditing && (
                  <Pressable
                    style={({ pressed }) => [styles.deleteWorkoutButton, pressed && styles.deleteWorkoutPressed]}
                    onPress={handleDelete}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.accent} />
                    <Text style={styles.deleteWorkoutText}>Excluir treino</Text>
                  </Pressable>
                )}
              </View>
            }
          />

          {restRemaining !== null && restRemaining > 0 && (
            <View style={[styles.restBar, { maxWidth: formWidth, alignSelf: "center", width: "100%" }]}>
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
        onClose={() => {
          setPickerVisible(false);
          scrollListToTop();
        }}
        onAdd={handleAddExercise}
      />

      <ExerciseDemoModal
        visible={!!demoExercise}
        exerciseName={demoExercise?.name ?? ""}
        demoMediaUrl={demoExercise?.demoMediaUrl}
        onClose={() => setDemoExercise(null)}
      />
    </Modal>
  );
}

const EXERCISE_ROW_GAP = 24; // == exerciseRow.marginBottom (usado também na animação de reordenar)
const PILL_HEIGHT = 48;
const SET_INDEX_SIZE = 44;
const SET_MENU_WIDTH = 28;
const ROW_GAP = 8;

const pillStyles = StyleSheet.create({
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    minWidth: 0,
  },
  pillDisabled: {
    borderColor: COLORS.border,
  },
  input: {
    flexShrink: 1,
    minWidth: 28,
    textAlign: "center",
    fontSize: 17, // >=16px evita o zoom automático do Safari/Chrome no celular ao focar
    fontWeight: "600",
    color: COLORS.textPrimary,
    padding: 0,
    margin: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  inputDisabled: {
    color: COLORS.textTertiary,
  },
  suffix: {
    marginLeft: 3,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});

const avatarStyles = StyleSheet.create({
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  saveButton: {
    minWidth: 88,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonEnabled: {
    backgroundColor: COLORS.accent,
  },
  saveButtonPressed: {
    backgroundColor: COLORS.accentLight,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "700",
  },
  saveTextActive: {
    color: COLORS.onAccent,
  },
  saveTextDisabled: {
    color: COLORS.textTertiary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 4,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  weekdayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
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
    color: COLORS.onAccent,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  exerciseRow: {
    marginBottom: EXERCISE_ROW_GAP,
  },
  exerciseTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exerciseTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.accent,
  },
  iconButton: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  collapsedSummary: {
    flexShrink: 1,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  collapsedSummaryDone: {
    color: COLORS.success,
  },
  setsBlock: {
    marginTop: 16,
    gap: ROW_GAP,
  },
  columnHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    paddingBottom: 2,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textTertiary,
    textAlign: "center",
  },
  setIndexSpacer: { width: SET_INDEX_SIZE },
  setMenuSpacer: { width: SET_MENU_WIDTH },
  setBlock: {
    gap: 6,
  },
  setLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
  },
  setIndexCircle: {
    width: SET_INDEX_SIZE,
    height: SET_INDEX_SIZE,
    borderRadius: SET_INDEX_SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  setIndexCircleDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  setMenuButton: {
    width: SET_MENU_WIDTH,
    height: PILL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  setLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: SET_INDEX_SIZE + ROW_GAP,
  },
  setLabelText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  setLabelInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  confirmLabelButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  addSetRowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
  },
  addSetRowButtonPressed: {
    backgroundColor: COLORS.border,
  },
  addSetRowText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  doneExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 12,
  },
  doneExerciseButtonActive: {
    backgroundColor: "rgba(76, 175, 122, 0.1)",
  },
  doneExerciseText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textTertiary,
  },
  doneExerciseTextActive: {
    color: COLORS.success,
  },
  emptyExercises: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyExercisesText: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  listFooter: {
    marginTop: 16,
    gap: 12,
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accent,
  },
  addExerciseButtonPressed: {
    backgroundColor: COLORS.accentLight,
  },
  addExerciseText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.onAccent,
  },
  deleteWorkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accentMuted,
  },
  deleteWorkoutPressed: {
    backgroundColor: COLORS.accentMuted,
  },
  deleteWorkoutText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.accent,
  },
  restBar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
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
  restBarTime: {
    fontSize: 20,
    fontFamily: FONT_MONO,
    fontWeight: "700",
    color: COLORS.accent,
    fontVariant: ["tabular-nums"],
  },
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
    backgroundColor: "rgba(8, 8, 10, 0.72)",
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
    color: COLORS.onAccent,
  },
});
