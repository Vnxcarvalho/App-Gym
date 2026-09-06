import { supabase } from "./supabase";
import type { ExerciseCatalogItem } from "../components/ExercisePickerModal";
import type { WorkoutDraft } from "../components/WorkoutFormModal";
import { DEFAULT_REST_SECONDS } from "../constants/workout";

// ---------------------------------------------------------
// Biblioteca de exercícios (exercises)
// ---------------------------------------------------------

export async function fetchExerciseLibrary(): Promise<ExerciseCatalogItem[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment")
    .order("name");

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
  }));
}

export async function insertCustomExercise(
  userId: string,
  item: Omit<ExerciseCatalogItem, "id">
): Promise<ExerciseCatalogItem> {
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: item.name,
      muscle_group: item.muscleGroup,
      equipment: item.equipment,
    })
    .select("id, name, muscle_group, equipment")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    muscleGroup: data.muscle_group,
    equipment: data.equipment,
  };
}

// Exclui um exercício da biblioteca compartilhada (RLS permite o dono, um
// exercício "de sistema" sem dono, ou um admin). Se ele já estiver sendo usado
// em algum treino salvo, o banco recusa a exclusão (exercise_id é "on delete
// restrict") — nesse caso o erro é repassado pra UI avisar o usuário.
export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------
// Treinos (workouts + workout_days + workout_exercises)
// ---------------------------------------------------------

type WorkoutRow = {
  id: string;
  name: string;
  workout_days: { weekday: number }[] | null;
  workout_exercises:
    | {
        id: string;
        exercise_id: string;
        target_reps: number[] | null;
        target_weight_kg: number[] | null;
        set_labels: string[] | null;
        rest_seconds: number[] | null;
        order_index: number;
        done: boolean | null;
        exercises: { id: string; name: string; muscle_group: string } | null;
      }[]
    | null;
};

function mapWorkoutRow(row: WorkoutRow): WorkoutDraft {
  const exercises = [...(row.workout_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);

  return {
    id: row.id,
    name: row.name,
    weekdays: (row.workout_days ?? []).map((d) => d.weekday),
    exercises: exercises.map((we) => {
      const reps = we.target_reps ?? [];
      const weights = we.target_weight_kg ?? [];
      const labels = we.set_labels ?? [];
      const rests = we.rest_seconds ?? [];
      return {
        id: we.id,
        exerciseId: we.exercise_id,
        name: we.exercises?.name ?? "",
        muscleGroup: we.exercises?.muscle_group ?? "",
        collapsed: false,
        done: we.done ?? false,
        sets: reps.map((r, i) => ({
          id: `${we.id}-set-${i}`,
          reps: r,
          weightKg: weights[i] ?? 0,
          done: false,
          restSeconds: rests[i] ?? DEFAULT_REST_SECONDS,
          label: labels[i] || undefined,
        })),
      };
    }),
  };
}

export async function fetchWorkouts(userId: string): Promise<WorkoutDraft[]> {
  const { data, error } = await supabase
    .from("workouts")
    .select(
      `
      id, name,
      workout_days ( weekday ),
      workout_exercises (
        id, exercise_id, target_reps, target_weight_kg, set_labels, rest_seconds, order_index, done,
        exercises ( id, name, muscle_group )
      )
    `
    )
    .eq("user_id", userId) // explícito: RLS deixa o admin ver todos, o filtro escolhe QUAL usuário
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data as unknown as WorkoutRow[]).map(mapWorkoutRow);
}

export async function saveWorkout(userId: string, draft: WorkoutDraft): Promise<string> {
  const muscleGroups = [...new Set(draft.exercises.map((e) => e.muscleGroup))];
  let workoutId = draft.id;

  if (workoutId) {
    const { error } = await supabase
      .from("workouts")
      .update({ name: draft.name, muscle_groups: muscleGroups })
      .eq("id", workoutId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: userId, name: draft.name, muscle_groups: muscleGroups })
      .select("id")
      .single();
    if (error) throw error;
    workoutId = data.id;
  }

  // dias da semana: substitui tudo (o upsert por user_id+weekday também
  // "rouba" o dia de outro treino que porventura já o ocupasse)
  const { error: clearDaysError } = await supabase
    .from("workout_days")
    .delete()
    .eq("workout_id", workoutId);
  if (clearDaysError) throw clearDaysError;

  if (draft.weekdays.length > 0) {
    const dayRows = draft.weekdays.map((weekday) => ({
      user_id: userId,
      workout_id: workoutId,
      weekday,
      active: true,
    }));
    const { error } = await supabase
      .from("workout_days")
      .upsert(dayRows, { onConflict: "user_id,weekday" });
    if (error) throw error;
  }

  // exercícios: substitui tudo (o form é sempre um replace completo)
  const { error: clearExercisesError } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("workout_id", workoutId);
  if (clearExercisesError) throw clearExercisesError;

  if (draft.exercises.length > 0) {
    const exerciseRows = draft.exercises.map((ex, index) => ({
      workout_id: workoutId,
      exercise_id: ex.exerciseId,
      target_reps: ex.sets.map((s) => s.reps),
      target_weight_kg: ex.sets.map((s) => s.weightKg),
      set_labels: ex.sets.map((s) => s.label ?? ""),
      rest_seconds: ex.sets.map((s) => s.restSeconds),
      order_index: index,
      done: ex.done,
    }));
    const { error } = await supabase.from("workout_exercises").insert(exerciseRows);
    if (error) throw error;
  }

  return workoutId!;
}

export async function deleteWorkoutRemote(workoutId: string): Promise<void> {
  const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
  if (error) throw error;
}

// Usado pelo painel admin pra mostrar quantos treinos cada usuário tem, sem
// precisar buscar o conteúdo completo de todo mundo. RLS: admin vê todo mundo,
// usuário comum só veria a própria linha (essa função só é chamada por admin).
export async function fetchWorkoutCountsByUser(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("workouts").select("user_id");
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
  }
  return counts;
}
