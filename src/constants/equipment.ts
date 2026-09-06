// Espelha o enum equipment_type do schema (supabase/migrations) — o valor
// salvo é sempre a chave em inglês, a tradução é só de exibição.
export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  machine: "Máquina",
  cable: "Cabo",
  bodyweight: "Peso do corpo",
  other: "Outro",
};
