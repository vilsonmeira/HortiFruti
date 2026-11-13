import { createClient } from "npm:@supabase/supabase-js@2";
const enc = new TextEncoder();
function toHex(bytes: Uint8Array) { return Array.from(bytes).map((b) => b.toString(16).padStart(2,"0")).join(""); }
async function signatureOK(body: string, header: string|null, secret: string) {
 if (!header?.startsWith("sha256=")) return false;
 const key = await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest = new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(body)));
 return toHex(digest) === header.slice(7).toLowerCase();
}
Deno.serve(async (req: Request) => {
 const verify = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
 const appSecret = Deno.env.get("META_APP_SECRET");
 if (!verify || !appSecret) return Response.json({error:"Meta integration not configured"},{status:503});
 if (req.method === "GET") {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode")==="subscribe" && u.searchParams.get("hub.verify_token")===verify && u.searchParams.get("hub.challenge")) {
   return new Response(u.searchParams.get("hub.challenge"),{headers:{"Content-Type":"text/plain"}});
  }
  return new Response("Forbidden",{status:403});
 }
 if (req.method !== "POST") return new Response("Method Not Allowed",{status:405});
 const raw = await req.text();
 if (!await signatureOK(raw,req.headers.get("x-hub-signature-256"),appSecret)) return Response.json({error:"Invalid Meta signature"},{status:401});
 let body: Record<string,unknown>;
 try { body=JSON.parse(raw); } catch { return Response.json({error:"Invalid JSON"},{status:400}); }
 const url=Deno.env.get("SUPABASE_URL");
 const secretJson=Deno.env.get("SUPABASE_SECRET_KEYS");
 const key=secretJson ? JSON.parse(secretJson).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if (!url || !key) return Response.json({error:"Database not configured"},{status:503});
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const entries=Array.isArray(body.entry)?body.entry:[];
 let stored=0;
 for (const entry of entries as Array<Record<string,unknown>>) {
  const changes=Array.isArray(entry.changes)?entry.changes:[];
  const messages=Array.isArray(entry.messaging)?entry.messaging:[];
  const events=[
   ...changes.map((v:Record<string,unknown>)=>({field:String(v.field??"change"),value:v})),
   ...messages.map((v:Record<string,unknown>)=>({field:"messaging",value:v}))
  ];
  for (const item of events) {
   const v=item.value as Record<string,unknown>;
   const msg=v.message as Record<string,unknown>|undefined;
   const eventId=String(v.id??msg?.mid??crypto.randomUUID());
   const {error}=await db.from("instagram_eventos").upsert({
    evento_id:eventId,objeto:String(body.object??"instagram"),campo:item.field,
    payload:{entry_id:entry.id??null,event:v}
   },{onConflict:"evento_id",ignoreDuplicates:true});
   if (!error) stored++; else console.error("Instagram event persistence failed",error.message);
  }
 }
 return Response.json({received:true,stored});
});
