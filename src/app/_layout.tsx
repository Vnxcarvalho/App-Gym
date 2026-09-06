import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AdminProvider } from "../context/AdminContext";
import AlertHost from "../components/AlertHost";

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="treino-ativo"
          options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="admin"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <AdminProvider>
            <RootNavigator />
          </AdminProvider>
        </AuthProvider>
        <AlertHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = {
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
