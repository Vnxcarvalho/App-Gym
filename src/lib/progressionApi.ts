import { supabase } from "./supabase";

// ---------------------------------------------------------
// Progressão de carga (workout_sessions + session_sets)
//
// Para cada exercício, agrega as séries realmente executadas em janelas de
// 7 dias (segunda a domingo). O ponto de cada semana é o "top set" — a maior
// carga levantada naquela semana; empate é desfeito pela maior repetição.
// Assim o gráfico mostra a evolução semana a semana: se na segunda o usuário
// fez supino com 40kg e na semana seguinte com 45kg, aparecem dois pontos,
// 40 -> 45. Só entram sessões finalizadas (o usuário apertou "Finalizar").
// ---------------------------------------------------------

export type WeeklyLoadPoint = {
  weekStart: string; // YYYY-MM-DD da segunda-feira da semana
  topWeightKg: number; // maior carga usada na semana
  bestReps: number; // reps da série de maior carga
  sessions: number; // dias distintos em que o exercício foi treinado na semana
};

export type ExerciseProgression = {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  weeks: WeeklyLoadPoint[]; // da semana mais antiga para a mais recente
};

// Segunda-feira 00:00 (horário local) da semana que contém `d`.
function isoWeekStart(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayFromMonday = (date.getDay() + 6) % 7; // 0 = segunda ... 6 = domingo
  date.setDate(date.getDate() - dayFromMonday);
  return date;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

type SessionRow = {
  started_at: string;
  session_sets:
    | {
        weight_kg: number | string;
        reps: number;
        workout_exercises: {
          exercise_id: string;
          exercises: { id: string; name: string; muscle_group: string } | null;
        } | null;
      }[]
    | null;
};

export async function fetchLoadProgression(userId: string): Promise<ExerciseProgression[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      started_at,
      session_sets (
        weight_kg, reps,
        workout_exercises ( exercise_id, exercises ( id, name, muscle_group ) )
      )
    `
    )
    .eq("user_id", userId) // explícito: RLS deixa o admin ver todos, o filtro escolhe QUAL usuário
    .not("finished_at", "is", null)
    .order("started_at", { ascending: true });

  if (error) throw error;

  type Accum = {
    name: string;
    muscleGroup: string;
    weeks: Map<
      number,
      {
        weekStart: string;
        topWeightKg: number;
        bestReps: number;
        sessionDays: Set<string>;
      }
    >;
  };

  const byExercise = new Map<string, Accum>();

  for (const session of (data ?? []) as unknown as SessionRow[]) {
    const weekStart = isoWeekStart(new Date(session.started_at));
    const weekKey = weekStart.getTime();
    const weekIso = toIsoDate(weekStart);
    const sessionDay = session.started_at.slice(0, 10);

    for (const set of session.session_sets ?? []) {
      const exercise = set.workout_exercises?.exercises;
      if (!exercise) continue;

      const weightKg = Number(set.weight_kg);
      if (!Number.isFinite(weightKg) || weightKg <= 0) continue;

      let entry = byExercise.get(exercise.id);
      if (!entry) {
        entry = { name: exercise.name, muscleGroup: exercise.muscle_group, weeks: new Map() };
        byExercise.set(exercise.id, entry);
      }

      let point = entry.weeks.get(weekKey);
      if (!point) {
        point = { weekStart: weekIso, topWeightKg: 0, bestReps: 0, sessionDays: new Set() };
        entry.weeks.set(weekKey, point);
      }

      point.sessionDays.add(sessionDay);
      if (
        weightKg > point.topWeightKg ||
        (weightKg === point.topWeightKg && set.reps > point.bestReps)
      ) {
        point.topWeightKg = weightKg;
        point.bestReps = set.reps;
      }
    }
  }

  const result: ExerciseProgression[] = [];
  for (const [exerciseId, entry] of byExercise) {
    const weeks = [...entry.weeks.values()]
      .map((w) => ({
        weekStart: w.weekStart,
        topWeightKg: w.topWeightKg,
        bestReps: w.bestReps,
        sessions: w.sessionDays.size,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    result.push({ exerciseId, name: entry.name, muscleGroup: entry.muscleGroup, weeks });
  }

  // Mais semanas registradas primeiro — é o exercício com histórico mais útil.
  result.sort((a, b) => b.weeks.length - a.weeks.length || a.name.localeCompare(b.name));
  return result;
}
