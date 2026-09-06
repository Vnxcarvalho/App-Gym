export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  legs: "Quadríceps",
  glutes: "Glúteos",
  calves: "Panturrilha",
  abs: "Abdômen",
  cardio: "Cardio",
  full_body: "Corpo Inteiro",
};

export const MUSCLE_GROUP_OPTIONS = Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => ({
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
