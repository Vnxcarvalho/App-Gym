import { useRouter } from "expo-router";
import DashboardScreen from "../../screens/DashboardScreen";

export default function Home() {
  const router = useRouter();

  return (
    <DashboardScreen
      onStartWorkout={(workoutId) => router.push({ pathname: "/treino-ativo", params: { workoutId } })}
      onProfilePress={() => router.push("/perfil")}
    />
  );
}
