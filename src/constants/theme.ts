import { Platform } from "react-native";

// Paleta suavizada: fundo grafite (não preto puro), superfícies em degraus
// sutis, texto levemente off-white e acentos menos saturados — contraste
// confortável sem perder a identidade vermelha.
export const COLORS = {
  background: "#0E0E10",
  surface: "#161619",
  surfaceAlt: "#1D1D21",
  border: "#27272C",
  // linha/traço que precisa ser visível mesmo sobre superfícies escuras
  // (contorno de botão vazio, trilho de progresso) — branco translúcido, não cinza próprio
  hairline: "rgba(255, 255, 255, 0.12)",
  textPrimary: "#E8E8EA",
  textSecondary: "rgba(232, 232, 234, 0.62)", // hierarquia por opacidade do branco, não cinza próprio
  textTertiary: "rgba(232, 232, 234, 0.40)",
  accent: "#E32424", // vermelho vivo (G=B, sem tom rosa/laranja) — ~4.1:1 sobre o fundo, ok pra texto em negrito/grande e ícones
  accentLight: "#F04545", // passo mais claro da mesma matiz, usado só no estado selecionado/pressed
  accentMuted: "#2E1414", // fundo sutil do accent
  onAccent: "#F7F3F3", // texto/ícone sobre fundo accent — off-white, não branco puro
  success: "#4CAF7A",
  water: "#4A9BE0", // azul — reservado pra meta de água, não disputa com o vermelho do treino
  waterMuted: "#16293D",
};

// Fonte tabular pros números de treino (peso, reps, cronômetro) — alinhamento
// fixo por dígito dá uma leitura mais "premium/data" que a fonte padrão do sistema.
export const FONT_MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
}) as string;
