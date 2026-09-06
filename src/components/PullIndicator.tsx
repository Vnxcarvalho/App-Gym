// components/PullIndicator.tsx
//
// Fica logo acima do ScrollView/FlatList — cresce em altura conforme o
// usePullToRefresh anima o pullAnim, empurrando o conteúdo pra baixo (efeito
// de "puxar", sem precisar de transform/overlay). ActivityIndicator (ao
// contrário de RefreshControl) funciona normalmente no react-native-web.
import React from "react";
import { Animated, ActivityIndicator, StyleSheet } from "react-native";
import { COLORS } from "../constants/theme";

type Props = {
  pullAnim: Animated.Value;
};

export default function PullIndicator({ pullAnim }: Props) {
  return (
    <Animated.View style={[styles.container, { height: pullAnim }]}>
      <ActivityIndicator color={COLORS.accent} size="small" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
