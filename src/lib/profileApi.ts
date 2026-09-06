import { supabase } from "./supabase";

export type Profile = {
  id: string;
  name: string;
  heightCm: number | null;
  role: "user" | "admin";
  createdAt: string;
};

const SELECT_FIELDS = "id, name, height_cm, role, created_at";

function mapRow(data: any): Profile {
  return {
    id: data.id,
    name: data.name,
    heightCm: data.height_cm,
    role: data.role,
    createdAt: data.created_at,
  };
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT_FIELDS)
    .eq("id", userId)
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateProfile(
  userId: string,
  patch: {
    name?: string;
    heightCm?: number | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.heightCm !== undefined) payload.height_cm = patch.heightCm;

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

// Só retorna resultado não-vazio pra quem tem role = 'admin' (RLS) — usado
// pelo painel admin pra listar todos os usuários do app.
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT_FIELDS)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// Apaga o perfil (só admin, via RLS) — cascade apaga os treinos e o histórico
// do usuário junto. NÃO apaga a credencial de login no Supabase Auth
// (isso exigiria a service role key, que nunca deve rodar no cliente).
export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw error;
}
