import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const json = (v: unknown, status=200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type":"application/json" } });
Deno.serve(async (req) => {
  const verifyToken = Deno.env.get("META_INSTAGRAM_VERIFY_TOKEN");
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.get("hub.mode")==="subscribe" && u.searchParams.get("hub.verify_token")===verifyToken) return new Response(u.searchParams.get("hub.challenge") || "", { status:200 });
    return new Response("Verificação inválida", { status:403 });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed",{status:405});
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const secret = Deno.env.get("META_INSTAGRAM_APP_SECRET");
  if (!secret || !signature.startsWith("sha256=")) return new Response("Assinatura ausente", {status:401});
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const expected = "sha256="+Array.from(digest).map(b=>b.toString(16).padStart(2,"0")).join("");
  if (expected.length !== signature.length || ![...expected].every((c,i)=>c===signature[i])) return new Response("Assinatura inválida",{status:401});
  try {
    const payload = JSON.parse(raw);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    for (const entry of payload.entry || []) {
      for (const messaging of entry.messaging || []) {
        const msg = messaging.message;
        if (!msg || msg.is_echo) continue;
        const sender = messaging.sender || {};
        await supabase.from("instagram_inbox").upsert({
          instagram_user_id: String(entry.id || ""),
          sender_id: String(sender.id || ""),
          message_id: msg.mid || null,
          message_text: msg.text || null,
          payload: messaging
        }, { onConflict: "message_id", ignoreDuplicates: true });
      }
    }
    return json({ received:true });
  } catch (e) {
    console.error("instagram-webhook:",e);
    return json({error:"Falha ao processar webhook."},500);
  }
});