import { Platform } from "react-native";

export const COLORS = {
  background: "#000000",
  surface: "#060606",
  surfaceAlt: "#0B0B0B",
  border: "#161616",
  // linha/traço que precisa ser visível mesmo sobre superfícies quase pretas
  // (contorno de botão vazio, trilho de progresso) — branco translúcido, não cinza próprio
  hairline: "rgba(255, 255, 255, 0.14)",
  textPrimary: "#F5F5F5",
  textSecondary: "rgba(245, 245, 245, 0.6)", // hierarquia por opacidade do branco, não cinza próprio
  textTertiary: "rgba(245, 245, 245, 0.36)",
  accent: "#E8102A", // vermelho vibrante (CTA) — contrast 4.54:1 on background, 4.38:1 on surface
  accentLight: "#FF4D5E", // passo mais claro da mesma matiz, usado só no estado selecionado/pressed
  accentMuted: "#3A1015", // fundo sutil do accent
  success: "#2ECC71",
  water: "#3AA0FF", // azul — reservado pra meta de água, não disputa com o vermelho do treino
  waterMuted: "#132840",
};

// Fonte tabular pros números de treino (peso, reps, cronômetro) — alinhamento
// fixo por dígito dá uma leitura mais "premium/data" que a fonte padrão do sistema.
export const FONT_MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
}) as string;
