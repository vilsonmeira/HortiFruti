import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://vilsonmeira.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://vilsonmeira.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (const char of base) sum += Number(char) * factor--;
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

async function cpfEmail(cpf: string) {
  const bytes = new TextEncoder().encode("hortifruti-pdv-cpf:" + cpf);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `cpf-${hex}@login.hortifruti.com`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "Método não permitido." }, { status: 405, headers });
  if (origin && !allowedOrigins.has(origin)) return Response.json({ error: "Origem não autorizada." }, { status: 403, headers });

  try {
    const body = await req.json();
    const nome = String(body?.nome ?? "").trim();
    const cpf = String(body?.cpf ?? "").replace(/\D/g, "");
    const senha = String(body?.senha ?? "");
    if (nome.length < 5 || nome.length > 100) return Response.json({ error: "Informe o nome completo." }, { status: 400, headers });
    if (!validCpf(cpf)) return Response.json({ error: "CPF inválido. Confira os números digitados." }, { status: 400, headers });
    if (senha.length < 10 || senha.length > 72) return Response.json({ error: "A senha deve ter entre 10 e 72 caracteres." }, { status: 400, headers });

    const url = Deno.env.get("SUPABASE_URL");
    const secretJson = Deno.env.get("SUPABASE_SECRET_KEYS");
    const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secret = secretJson ? JSON.parse(secretJson).default : legacySecret;
    if (!url || !secret) throw new Error("Configuração segura do servidor indisponível.");

    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: claimed, error: claimError } = await admin.rpc("pdv_claim_first_manager");
    if (claimError) throw new Error("Não foi possível validar o primeiro acesso.");
    if (claimed !== true) return Response.json({ error: "O primeiro gerente já foi configurado. Solicite acesso ao administrador." }, { status: 409, headers });

    const email = await cpfEmail(cpf);
    let createdUserId: string | null = null;
    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        app_metadata: { papel: "gerente", perfil: "gerente" },
        user_metadata: { nome },
      });
      if (createError || !created.user) throw new Error("Não foi possível criar a conta de gerente.");
      createdUserId = created.user.id;

      const { error: profileError } = await admin.from("perfis").insert({
        id: createdUserId,
        nome,
        email,
        papel: "gerente",
        perfil: "gerente",
        ativo: true,
      });
      if (profileError) throw new Error("Não foi possível concluir o perfil do gerente.");

      const { error: finishError } = await admin.rpc("pdv_finish_first_manager");
      if (finishError) throw new Error("Não foi possível concluir a ativação do gerente.");
      return Response.json({ ok: true }, { status: 201, headers });
    } catch (error) {
      if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
      await admin.rpc("pdv_release_first_manager");
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao configurar o primeiro acesso.";
    return Response.json({ error: message }, { status: 400, headers });
  }
});