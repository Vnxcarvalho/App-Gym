import React, { createContext, useContext, useEffect, useState } from "react";
import type { ExerciseCatalogItem } from "../components/ExercisePickerModal";
import { DEFAULT_EXERCISE_CATALOG } from "../components/ExercisePickerModal";
import { fetchExerciseLibrary, insertCustomExercise, deleteExercise } from "../lib/workoutsApi";
import { useAuth } from "./AuthContext";

type ExerciseLibraryContextValue = {
  library: ExerciseCatalogItem[];
  loading: boolean;
  addCustomExercise: (item: Omit<ExerciseCatalogItem, "id">) => Promise<ExerciseCatalogItem>;
  removeExercise: (id: string) => Promise<void>;
};

const ExerciseLibraryContext = createContext<ExerciseLibraryContextValue | undefined>(undefined);

// Carrega do Supabase (exercises.user_id = null → sistema, + exercícios criados por
// qualquer usuário, visíveis a todos via a policy de biblioteca compartilhada).
// Começa com o catálogo local só pra não piscar lista vazia enquanto busca.
export function ExerciseLibraryProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [library, setLibrary] = useState<ExerciseCatalogItem[]>(DEFAULT_EXERCISE_CATALOG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    setLoading(true);
    fetchExerciseLibrary()
      .then((items) => {
        if (!cancelled) setLibrary(items);
      })
      .catch((err) => {
        console.warn("Falha ao carregar biblioteca de exercícios:", err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function addCustomExercise(item: Omit<ExerciseCatalogItem, "id">) {
    if (!session) throw new Error("Sem sessão ativa");
    const created = await insertCustomExercise(session.user.id, item);
    setLibrary((prev) => [...prev, created]);
    return created;
  }

  async function removeExercise(id: string) {
    await deleteExercise(id);
    setLibrary((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <ExerciseLibraryContext.Provider value={{ library, loading, addCustomExercise, removeExercise }}>
      {children}
    </ExerciseLibraryContext.Provider>
  );
}

export function useExerciseLibrary() {
  const ctx = useContext(ExerciseLibraryContext);
  if (!ctx) throw new Error("useExerciseLibrary deve ser usado dentro de um ExerciseLibraryProvider");
  return ctx;
}
