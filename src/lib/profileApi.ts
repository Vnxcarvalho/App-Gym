import { supabase } from "./supabase";

export type Profile = {
  id: string;
  name: string;
  role: "user" | "admin";
  createdAt: string;
};

const SELECT_FIELDS = "id, name, role, created_at";

function mapRow(data: any): Profile {
  return {
    id: data.id,
    name: data.name,
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
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;

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

// Cadastra a conta do aluno com uma senha provisória definida pelo staff —
// roda numa Edge Function porque criar usuário direto exige a service role
// key, que nunca pode ficar no app cliente.
export async function createStudent(
  name: string,
  email: string,
  password: string
): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke("create-student", {
    body: { name, email, password },
  });

  if (error) {
    let message = error.message;
    const context: Response | undefined = (error as any).context;
    if (context) {
      try {
        const body = await context.clone().json();
        if (body?.error) message = body.error;
      } catch {
        // resposta sem corpo JSON — mantém a mensagem padrão do erro
      }
    }
    throw new Error(message);
  }

  return data;
}

// Apaga o perfil (só admin, via RLS) — cascade apaga os treinos e o histórico
// do usuário junto. NÃO apaga a credencial de login no Supabase Auth
// (isso exigiria a service role key, que nunca deve rodar no cliente).
export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw error;
}
