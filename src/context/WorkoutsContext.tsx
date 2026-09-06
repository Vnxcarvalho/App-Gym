import React, { createContext, useContext, useEffect, useState } from "react";
import type { WorkoutDraft } from "../components/WorkoutFormModal";
import { fetchWorkouts, saveWorkout, deleteWorkoutRemote } from "../lib/workoutsApi";
import { useAdmin } from "./AdminContext";
import { Alert } from "../lib/alert";

type WorkoutsContextValue = {
  workouts: WorkoutDraft[];
  loading: boolean;
  refetch: () => Promise<void>;
  addWorkout: (draft: WorkoutDraft) => Promise<void>;
  updateWorkout: (draft: WorkoutDraft) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
};

const WorkoutsContext = createContext<WorkoutsContextValue | undefined>(undefined);

// Carrega os treinos do usuário logado do Supabase (workouts + workout_days +
// workout_exercises). Toda escrita reconsulta a lista inteira depois — mais simples
// e robusto do que reconciliar ids localmente.
export function WorkoutsProvider({ children }: { children: React.ReactNode }) {
  const { effectiveUserId } = useAdmin();
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    let cancelled = false;

    setLoading(true);
    fetchWorkouts(effectiveUserId)
      .then((data) => {
        if (!cancelled) setWorkouts(data);
      })
      .catch((err) => {
        console.warn("Falha ao carregar treinos:", err.message);
        if (!cancelled) {
          Alert.alert("Não foi possível carregar os treinos", err.message ?? "Tente novamente.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);

  async function refetch() {
    if (!effectiveUserId) return;
    const data = await fetchWorkouts(effectiveUserId);
    setWorkouts(data);
  }

  async function addWorkout(draft: WorkoutDraft) {
    if (!effectiveUserId) throw new Error("Sem usuário selecionado");
    await saveWorkout(effectiveUserId, draft);
    await refetch();
  }

  async function updateWorkout(draft: WorkoutDraft) {
    if (!effectiveUserId) throw new Error("Sem usuário selecionado");
    await saveWorkout(effectiveUserId, draft);
    await refetch();
  }

  async function deleteWorkout(id: string) {
    await deleteWorkoutRemote(id);
    await refetch();
  }

  return (
    <WorkoutsContext.Provider value={{ workouts, loading, refetch, addWorkout, updateWorkout, deleteWorkout }}>
      {children}
    </WorkoutsContext.Provider>
  );
}

export function useWorkouts() {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) throw new Error("useWorkouts deve ser usado dentro de um WorkoutsProvider");
  return ctx;
}
