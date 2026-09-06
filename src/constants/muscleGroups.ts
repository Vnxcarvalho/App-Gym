export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  legs: "Quadríceps",
  hamstrings: "Posterior de Coxa",
  glutes: "Glúteos",
  calves: "Panturrilha",
  abs: "Abdômen",
  cardio: "Cardio",
  full_body: "Corpo Inteiro",
};

export const MUSCLE_GROUP_OPTIONS = Object.entries(MUSCLE_GROUP_LABELS)
  .filter(([value]) => value !== "cardio" && value !== "full_body")
  .map(([value, label]) => ({
    value,
    label,
  }));

// Ordem de exibição na biblioteca de exercícios: peito, costas, ombros,
// braços (bíceps/tríceps), pernas — depois os grupos secundários.
export const MUSCLE_GROUP_ORDER = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "cardio",
  "full_body",
];

export const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"]; // Dom..Sáb, index 0-6
export const WEEKDAY_FULL_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
