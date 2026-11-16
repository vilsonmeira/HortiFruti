import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const enc = new TextEncoder();
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
async function encryptToken(token: string, secret: string) {
  const keyBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
  if (keyBytes.length !== 32) throw new Error("IG_TOKEN_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token));
  return b64(new Uint8Array([...iv, ...new Uint8Array(cipher)]));
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appId = Deno.env.get("META_INSTAGRAM_APP_ID");
  const appSecret = Deno.env.get("META_INSTAGRAM_APP_SECRET");
  const redirectUri = Deno.env.get("META_INSTAGRAM_REDIRECT_URI");
  const encryptionKey = Deno.env.get("IG_TOKEN_ENCRYPTION_KEY");
  const admin = createClient(supabaseUrl, serviceKey);
  try {
    if (req.method === "POST" && url.searchParams.get("action") === "start") {
      const auth = req.headers.get("Authorization") || "";
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) return json({ error: "Faça login como gerente para conectar o Instagram." }, 401);
      if (!appId || !redirectUri) return json({ error: "Configure META_INSTAGRAM_APP_ID e META_INSTAGRAM_REDIRECT_URI nos secrets da função." }, 503);
      const state = b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
      await admin.from("instagram_oauth_states").delete().lt("expires_at", new Date().toISOString());
      const { error: stateError } = await admin.from("instagram_oauth_states").insert({ state, owner_user_id: user.id, expires_at: new Date(Date.now()+10*60*1000).toISOString() });
      if (stateError) throw stateError;
      const scopes = ["instagram_business_basic","instagram_business_content_publish","instagram_business_manage_comments","instagram_business_manage_messages","instagram_business_manage_insights"].join(",");
      const authUrl = new URL("https://www.instagram.com/oauth/authorize");
      authUrl.search = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: scopes, state, enable_fb_login: "0", force_authentication: "1" }).toString();
      return json({ url: authUrl.toString() });
    }
    if (req.method === "GET" && url.searchParams.has("code")) {
      if (!appId || !appSecret || !redirectUri || !encryptionKey) return new Response("Integração ainda não configurada no servidor.", { status: 503 });
      const code = url.searchParams.get("code")!;
      const state = url.searchParams.get("state") || "";
      const { data: saved, error: stateError } = await admin.from("instagram_oauth_states").select("*").eq("state", state).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (stateError || !saved) return new Response("Autorização expirada ou inválida. Volte ao painel e tente novamente.", { status: 400 });
      await admin.from("instagram_oauth_states").delete().eq("state", state);
      const form = new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code });
      const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_message || "Falha ao trocar o código de autorização.");
      const longUrl = new URL("https://graph.instagram.com/access_token");
      longUrl.search = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret, access_token: tokenData.access_token }).toString();
      const longResponse = await fetch(longUrl);
      const longData = await longResponse.json();
      if (!longResponse.ok || !longData.access_token) throw new Error("Não foi possível obter token de longa duração.");
      const profileResponse = await fetch("https://graph.instagram.com/v27.0/me?fields=user_id,username&access_token="+encodeURIComponent(longData.access_token));
      const profile = await profileResponse.json();
      if (!profileResponse.ok || !profile.user_id) throw new Error("Não foi possível identificar a conta Instagram.");
      const ciphertext = await encryptToken(longData.access_token, encryptionKey);
      const { error: saveError } = await admin.from("instagram_integrations").upsert({ owner_user_id: saved.owner_user_id, instagram_user_id: String(profile.user_id), username: profile.username || null, access_token_ciphertext: ciphertext, token_expires_at: new Date(Date.now()+(Number(longData.expires_in)||5184000)*1000).toISOString(), scopes: ["instagram_business_basic","instagram_business_content_publish","instagram_business_manage_comments","instagram_business_manage_messages","instagram_business_manage_insights"], updated_at: new Date().toISOString() }, { onConflict: "owner_user_id" });
      if (saveError) throw saveError;
      const siteUrl = Deno.env.get("APP_SITE_URL");\n      if (!siteUrl) throw new Error("Configure APP_SITE_URL com a URL pública do PDV.");\n      return Response.redirect(new URL("/instagram.html?connected=1", siteUrl).toString(), 302);
    }
    return json({ error: "Rota não reconhecida." }, 404);
  } catch (e) {
    console.error("instagram-oauth:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});