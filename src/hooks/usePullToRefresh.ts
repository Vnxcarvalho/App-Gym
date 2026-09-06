// hooks/usePullToRefresh.ts
//
// react-native-web não implementa RefreshControl de verdade — renderiza um
// <View> vazio, ignorando onRefresh/refreshing (mesma classe de problema do
// Alert.alert). Esse hook reimplementa o gesto de "puxar pra atualizar" via
// toque/mouse: só começa a rastrear quando a lista já está no topo (scroll
// offset 0) e o usuário arrasta pra baixo, com resistência progressiva.
import { useRef, useState } from "react";
import { Animated } from "react-native";

const PULL_THRESHOLD = 64;
const MAX_PULL = 100;
const REFRESH_HEIGHT = 56;
const RESISTANCE = 0.5;

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const pullAnim = useRef(new Animated.Value(0)).current;
  const pullValue = useRef(0);
  const scrollOffset = useRef(0);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  function animateTo(toValue: number) {
    Animated.spring(pullAnim, { toValue, useNativeDriver: false, bounciness: 6 }).start();
  }

  function beginPull(pageY: number) {
    if (refreshing || scrollOffset.current > 0) return;
    startY.current = pageY;
    pulling.current = true;
  }

  function movePull(pageY: number) {
    if (!pulling.current || startY.current == null || refreshing) return;
    const delta = pageY - startY.current;
    const next = delta <= 0 ? 0 : Math.min(MAX_PULL, delta * RESISTANCE);
    pullValue.current = next;
    pullAnim.setValue(next);
  }

  async function endPull() {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;

    if (pullValue.current >= PULL_THRESHOLD) {
      setRefreshing(true);
      animateTo(REFRESH_HEIGHT);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animateTo(0);
      }
    } else {
      animateTo(0);
    }
  }

  return {
    refreshing,
    pullAnim,
    handlers: {
      onScroll: (e: any) => {
        scrollOffset.current = e.nativeEvent?.contentOffset?.y ?? 0;
      },
      scrollEventThrottle: 16,
      onTouchStart: (e: any) => beginPull(e.nativeEvent.touches[0]?.pageY ?? 0),
      onTouchMove: (e: any) => movePull(e.nativeEvent.touches[0]?.pageY ?? 0),
      onTouchEnd: endPull,
      onTouchCancel: endPull,
      // mouse — pull-to-refresh não é um gesto padrão de desktop, mas dá
      // suporte a trackpad/mouse em vez de depender só de touch
      onMouseDown: (e: any) => beginPull(e.nativeEvent?.pageY ?? e.pageY ?? 0),
      onMouseMove: (e: any) => {
        if (pulling.current) movePull(e.nativeEvent?.pageY ?? e.pageY ?? 0);
      },
      onMouseUp: endPull,
      onMouseLeave: endPull,
    },
  };
}
