(function(){
'use strict';
const ENDPOINT='https://vcyneajmmwvvnefqompe.supabase.co/functions/v1/pdv-whatsapp-comprovante';
window.enviarComprovanteWhatsApp=async function(venda){
  const consent=document.getElementById('consentimento-whatsapp-comprovante');
  if(!consent?.checked)return {ignorado:true};
  const cliente=window.obterDadosClienteWhatsApp?.();
  if(!cliente?.id||!cliente.telefone)throw new Error('Cliente sem celular cadastrado. Atualize o telefone antes de finalizar.');
  const url=window.obterUrlComprovanteConcluido?.();
  if(!url)throw new Error('Link do comprovante não foi gerado.');
  const auth=window.pdvAuth;
  if(!auth?.supabase)throw new Error('Sessão do PDV não está disponível.');
  const {data,error}=await auth.supabase.auth.getSession();
  if(error||!data.session?.access_token)throw new Error('Faça login novamente no PDV.');
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':auth.supabase.supabaseKey,'Authorization':'Bearer '+data.session.access_token},body:JSON.stringify({cliente_id:cliente.id,total:Number(venda.total),comprovante_url:url})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'A API do WhatsApp recusou o envio.');
  return {enviado:true,message_id:result.message_id||null};
};
})();