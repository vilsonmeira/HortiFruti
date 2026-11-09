(() => {
'use strict';
const API='https://vcyneajmmwvvnefqompe.supabase.co/functions/v1/pdv-clientes-recibo';
const KEY='sb_publishable_fOe9mU2A_48YLPKq1NB6ZQ_Hg_GZaym';
const LOJA='5511910592208';
const $=id=>document.getElementById(id);
const digits=v=>String(v||'').replace(/\D/g,'');
function cpfValido(c){if(c.length!==11||/^(\d)\1{10}$/.test(c))return false;const d=(b,f)=>{let s=0;for(const x of b)s+=Number(x)*f--;const r=s*10%11;return r===10?0:r;};return d(c.slice(0,9),10)===+c[9]&&d(c.slice(0,10),11)===+c[10];}
function mensagem(t,erro=false){$('status').textContent=t;$('status').classList.toggle('error',erro);}
$('cpf').addEventListener('input',e=>{const d=digits(e.target.value).slice(0,11);e.target.value=d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');});
$('telefone').addEventListener('input',e=>{const d=digits(e.target.value).slice(0,11);e.target.value=d.length>10?d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):d.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');});
$('form-cadastro').addEventListener('submit',async e=>{
 e.preventDefault();$('whatsapp').hidden=true;
 const cpf=digits($('cpf').value),nome=$('nome').value.trim(),telefone=digits($('telefone').value);
 if(!cpfValido(cpf)){mensagem('Digite um CPF válido.',true);return;}
 if(nome.length<2){mensagem('Informe seu primeiro nome.',true);return;}
 if(!/^[1-9]\d{9,10}$/.test(telefone)){mensagem('Informe um celular válido com DDD.',true);return;}
 if(!$('consentimento').checked){mensagem('É necessário autorizar o uso dos dados para continuar.',true);return;}
 const btn=$('enviar');btn.disabled=true;btn.textContent='Enviando solicitação...';
 try{
  const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({action:'customer_register_public',cpf,nome,telefone})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível enviar o cadastro.');
  mensagem(data.message||'Solicitação recebida. Envie a mensagem pelo WhatsApp.');
  const texto='Olá! Acabei de solicitar meu cadastro no HortiFruti. Meu primeiro nome é '+nome+'. Os quatro últimos números do meu celular são '+telefone.slice(-4)+'. Gostaria de confirmar minha solicitação.';
  $('whatsapp').href='https://wa.me/'+LOJA+'?text='+encodeURIComponent(texto);
  $('whatsapp').hidden=false;
  btn.textContent='Solicitação enviada'; 
 }catch(err){mensagem(err.message||'Falha ao enviar. Tente novamente.',true);btn.disabled=false;btn.textContent='Solicitar cadastro';}
});
})();