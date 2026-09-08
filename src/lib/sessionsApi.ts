import { supabase } from "./supabase";

// ---------------------------------------------------------
// Sessões de treino (workout_sessions + session_sets)
//
// Uma sessão fica "aberta" (finished_at null) do momento em que o usuário
// inicia o treino até apertar Finalizar ou Descartar. Cada série marcada
// como feita grava uma linha em session_sets na hora — assim, se o usuário
// sair da tela sem finalizar (ex: arrastando o modal pra fechar), o
// progresso já está salvo e a mesma sessão é retomada da próxima vez que
// esse treino for iniciado.
// ---------------------------------------------------------

export type OpenSession = {
  id: string;
  startedAt: string;
};

export type SessionSetRow = {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
};

export async function getOrCreateOpenSession(
  userId: string,
  workoutId: string
): Promise<OpenSession> {
  const { data: existing, error: findError } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return { id: existing.id, startedAt: existing.started_at };

  const { data: created, error: createError } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, workout_id: workoutId })
    .select("id, started_at")
    .single();

  if (createError) throw createError;
  return { id: created.id, startedAt: created.started_at };
}

// Séries da última sessão finalizada desse treino — usadas pra pré-preencher
// carga/reps na sessão atual, já que o "alvo" do template não acompanha a
// progressão real do usuário.
export async function fetchLastFinishedSessionSets(
  userId: string,
  workoutId: string
): Promise<SessionSetRow[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const last = data?.[0];
  if (!last) return [];
  return fetchSessionSets(last.id);
}

export async function fetchSessionSets(sessionId: string): Promise<SessionSetRow[]> {
  const { data, error } = await supabase
    .from("session_sets")
    .select("id, workout_exercise_id, set_number, weight_kg, reps")
    .eq("session_id", sessionId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    setNumber: row.set_number,
    weightKg: Number(row.weight_kg),
    reps: row.reps,
  }));
}

export async function addSessionSet(
  sessionId: string,
  workoutExerciseId: string,
  setNumber: number,
  weightKg: number,
  reps: number
): Promise<string> {
  const { data, error } = await supabase
    .from("session_sets")
    .insert({
      session_id: sessionId,
      workout_exercise_id: workoutExerciseId,
      set_number: setNumber,
      weight_kg: weightKg,
      reps,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function removeSessionSet(id: string): Promise<void> {
  const { error } = await supabase.from("session_sets").delete().eq("id", id);
  if (error) throw error;
}

export async function finishSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("workout_sessions")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function discardSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

// Segunda-feira 00:00 (horário local) da semana que contém `d`.
function weekStart(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayFromMonday = (date.getDay() + 6) % 7; // 0 = segunda ... 6 = domingo
  date.setDate(date.getDate() - dayFromMonday);
  return date;
}

// Dias distintos (YYYY-MM-DD) com sessão finalizada na semana atual (seg-dom).
export async function fetchWeeklyCompletedDays(userId: string): Promise<string[]> {
  const start = weekStart(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString());

  if (error) throw error;

  return [...new Set((data ?? []).map((row) => row.started_at.slice(0, 10)))];
}
