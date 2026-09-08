// supabase/functions/create-student/index.ts
//
// Cria a conta de um aluno com senha provisória definida pelo staff — chamado
// pelo Painel Admin (AdminScreen). Precisa da service role key (admin.createUser),
// que nunca pode viver no app cliente, por isso roda como Edge Function.
// A validação de "quem chama é admin" usa o JWT do próprio chamador contra a
// policy normal de RLS (não confia em nada vindo do corpo da requisição).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Sessão ausente." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente "como o chamador" — só pra confirmar que quem está pedindo é admin.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Sessão inválida." }, 401);
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || callerProfile?.role !== "admin") {
    return jsonResponse({ error: "Só administradores podem cadastrar alunos." }, 403);
  }

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!name || !email || password.length < 6) {
    return jsonResponse(
      { error: "Informe nome, e-mail e uma senha com pelo menos 6 caracteres." },
      400
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError) {
    const alreadyExists = createError.message?.toLowerCase().includes("already registered");
    return jsonResponse(
      { error: alreadyExists ? "Já existe uma conta com esse e-mail." : createError.message },
      400
    );
  }

  return jsonResponse({ id: created.user!.id, email, name });
});
