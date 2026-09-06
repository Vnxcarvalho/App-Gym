import { useWindowDimensions } from "react-native";

// Breakpoints simples — cobre celular (padrão, já otimizado antes), tablet
// (iPad, telas médias) e desktop (o app publicado na Vercel visto num monitor).
const TABLET_BREAKPOINT = 700;
const DESKTOP_BREAKPOINT = 1080;

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= TABLET_BREAKPOINT;
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isWide = isTablet; // tablet e desktop já contam como "largo" pra layouts em coluna dupla

  const columns = isDesktop ? 3 : isTablet ? 2 : 1;

  const contentMaxWidth = isDesktop ? 1080 : isTablet ? 760 : 480;

  return { width, height, isTablet, isDesktop, isWide, columns, contentMaxWidth };
}
