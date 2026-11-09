import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Configuração do servidor incompleta." }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Faça login para continuar." }, 401);
  }

  try {
    // Confirma a identidade de quem está chamando usando o token da sessão.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    // A autorização é consultada no banco; não confiamos em papel enviado pelo navegador.
    const { data: profile, error: profileError } = await callerClient
      .from("perfis")
      .select("papel")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (profileError) return json({ error: "Não foi possível validar a permissão do gerente." }, 403);
    if (profile?.papel !== "gerente") return json({ error: "Somente o gerente pode redefinir senhas." }, 403);

    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Informe um e-mail válido." }, 400);
    }
    if (password.length < 10 || password.length > 72) {
      return json({ error: "A senha deve ter entre 10 e 72 caracteres." }, 400);
    }

    // A chave service_role existe somente nesta função, nunca no navegador.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: users, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) return json({ error: "Não foi possível localizar o usuário." }, 500);

    const target = users.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!target) return json({ error: "Não existe usuário com esse e-mail no Authentication." }, 404);

    const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { password });
    if (updateError) return json({ error: "O Supabase não aceitou a nova senha. Verifique os requisitos de senha." }, 400);

    return json({ success: true, message: "Senha atualizada com sucesso." });
  } catch (_error) {
    return json({ error: "Não foi possível concluir a redefinição. Tente novamente." }, 500);
  }
});
https://vcyneajmmwvvnefqompe.supabase.co/functions/v1/quick-function
