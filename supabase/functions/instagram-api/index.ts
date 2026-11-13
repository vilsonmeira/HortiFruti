import { createClient } from "npm:@supabase/supabase-js@2";
const reply=(data:unknown,status=200)=>Response.json(data,{status});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST") return reply({error:"Use POST"},405);
 const jwt=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");
 if(!jwt) return reply({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL");
 const sj=Deno.env.get("SUPABASE_SECRET_KEYS");
 const key=sj?JSON.parse(sj).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key) return reply({error:"Server not configured"},503);
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:userData,error:userError}=await db.auth.getUser(jwt);
 if(userError||!userData.user) return reply({error:"Invalid session"},401);
 const {data:profile}=await db.from("perfis").select("papel,ativo").eq("id",userData.user.id).maybeSingle();
 if(profile?.papel!=="gerente"||profile?.ativo!==true) return reply({error:"Manager access required"},403);
 const token=Deno.env.get("META_ACCESS_TOKEN");
 const igId=Deno.env.get("META_IG_USER_ID");
 const version=Deno.env.get("META_GRAPH_API_VERSION")??"v24.0";
 const base=Deno.env.get("META_GRAPH_BASE_URL")??"https://graph.instagram.com";
 if(!token||!igId) return reply({error:"Configure META_ACCESS_TOKEN and META_IG_USER_ID secrets"},503);
 let input:Record<string,unknown>;
 try{input=await req.json();}catch{return reply({error:"Invalid JSON"},400);}
 const action=String(input.action??"");
 let endpoint="",payload:Record<string,unknown>={};
 if(action==="send_message"){
  const recipient=String(input.recipient_id??""); const message=String(input.message??"").trim();
  if(!recipient||!message||message.length>1000) return reply({error:"recipient_id and message required"},400);
  endpoint=base+"/"+version+"/"+igId+"/messages"; payload={recipient:{id:recipient},message:{text:message}};
 }else if(action==="reply_comment"){
  const comment=String(input.comment_id??""); const message=String(input.message??"").trim();
  if(!comment||!message||message.length>1000) return reply({error:"comment_id and message required"},400);
  endpoint=base+"/"+version+"/"+comment+"/replies"; payload={message};
 }else if(action==="publish_image"){
  const image=String(input.image_url??""); const caption=String(input.caption??"");
  if(!/^https:\/\//i.test(image)) return reply({error:"A public HTTPS image URL is required"},400);
  endpoint=base+"/"+version+"/"+igId+"/media"; payload={image_url:image,caption};
 }else return reply({error:"Unsupported action"},400);
 const response=await fetch(endpoint,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok) return reply({error:"Meta API rejected the request",details:result},response.status);
 if(action==="publish_image"&&result.id){
  const pub=await fetch(base+"/"+version+"/"+igId+"/media_publish",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({creation_id:result.id})});
  const published=await pub.json().catch(()=>({}));
  if(!pub.ok) return reply({error:"Media container created but publishing failed",details:published},pub.status);
  return reply({ok:true,action,result:published});
 }
 return reply({ok:true,action,result});
});
