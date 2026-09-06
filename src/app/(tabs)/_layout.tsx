import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { WorkoutsProvider } from "../../context/WorkoutsContext";
import { ExerciseLibraryProvider } from "../../context/ExerciseLibraryContext";
import { useAdmin } from "../../context/AdminContext";

export default function TabsLayout() {
  return (
    <ExerciseLibraryProvider>
      <WorkoutsProvider>
        <TabsNavigator />
      </WorkoutsProvider>
    </ExerciseLibraryProvider>
  );
}

// Aviso fixo, visível em qualquer aba, enquanto o super admin está editando
// os dados de outro usuário — evita que ele confunda "eu" com "o usuário X".
function ViewingAsBanner() {
  const { viewingUser, stopViewingUser } = useAdmin();
  const insets = useSafeAreaInsets();

  if (!viewingUser) return null;

  return (
    <View style={[bannerStyles.banner, { paddingTop: insets.top + 8 }]}>
      <Ionicons name="eye-outline" size={14} color="#FFF" />
      <Text style={bannerStyles.text} numberOfLines={1}>
        Visualizando como <Text style={bannerStyles.textBold}>{viewingUser.name}</Text>
      </Text>
      <Pressable style={bannerStyles.exitButton} onPress={stopViewingUser} hitSlop={8}>
        <Text style={bannerStyles.exitText}>Sair</Text>
      </Pressable>
    </View>
  );
}

function TabsNavigator() {
  return (
    <>
      <ViewingAsBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textTertiary,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Início",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="treinos"
          options={{
            title: "Treinos",
            tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="evolucao"
          options={{
            title: "Evolução",
            tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.accent,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: "#FFF",
  },
  textBold: {
    fontWeight: "700",
  },
  exitButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  exitText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
});
