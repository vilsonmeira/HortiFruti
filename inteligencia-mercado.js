(() => {
'use strict';
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const seasonal={
1:[['🍉','Melancia','alta oferta no verão'],['🥭','Manga','boa oferta'],['🍍','Abacaxi','boa oferta'],['🍈','Melão','boa oferta']],
2:[['🍉','Melancia','alta oferta'],['🥭','Manga','boa oferta'],['🍍','Abacaxi','boa oferta'],['🍈','Melão','boa oferta']],
3:[['🥑','Abacate','início de boa oferta'],['🍊','Laranja','safra de cítricos'],['🍈','Mamão','boa oferta'],['🍌','Banana','oferta regular']],
4:[['🥑','Abacate','boa oferta'],['🍊','Laranja','safra de cítricos'],['🍓','Morango','início da temporada'],['🍌','Banana','oferta regular']],
5:[['🍓','Morango','temporada de outono/inverno'],['🍊','Laranja','boa oferta'],['🍋','Limão','boa oferta'],['🥑','Abacate','boa oferta']],
6:[['🍓','Morango','temporada de inverno'],['🍊','Laranja','boa oferta'],['🍋','Mexerica','boa oferta'],['🥑','Abacate','boa oferta']],
7:[['🍓','Morango','temporada de inverno'],['🍊','Laranja','boa oferta'],['🍋','Mexerica','boa oferta'],['🍌','Banana','oferta regular']],
8:[['🍓','Morango','temporada de inverno'],['🍊','Laranja','boa oferta'],['🍋','Limão','boa oferta'],['🍇','Uva','início de oferta']],
9:[['🍇','Uva','boa oferta'],['🍊','Laranja','oferta regular'],['🍍','Abacaxi','oferta regular'],['🥭','Manga','início de oferta']],
10:[['🍇','Uva','boa oferta'],['🥭','Manga','início de safra'],['🍉','Melancia','início de oferta'],['🍈','Mamão','oferta regular']],
11:[['🥭','Manga','safra de primavera/verão'],['🍉','Melancia','boa oferta'],['🍍','Abacaxi','boa oferta'],['🍈','Melão','boa oferta']],
12:[['🍉','Melancia','alta oferta no verão'],['🥭','Manga','boa oferta'],['🍍','Abacaxi','boa oferta'],['🍇','Uva','boa oferta']]
};
function style(){
 if(document.getElementById('intel-style'))return;
 const s=document.createElement('style');s.id='intel-style';
 s.textContent='.intel-wrap{display:grid;gap:12px;margin:0 0 16px}.intel-card{background:#fff;border:1px solid #dce8d8;border-radius:13px;padding:14px;box-shadow:0 2px 8px #00000008}.intel-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.intel-head h3{color:#256029;font-size:1.02rem;margin:0 0 5px}.intel-muted{color:#667064;font-size:.78rem;line-height:1.45}.intel-frutas{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}.intel-fruta{background:#f5faf2;border:1px solid #e1eddd;border-radius:10px;padding:10px;display:flex;gap:9px;align-items:center}.intel-fruta .em{font-size:1.7rem}.intel-fruta strong{font-size:.85rem;display:block}.intel-fruta small{font-size:.72rem;color:#63715f}.intel-sources{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.intel-sources a{font-size:.76rem;color:#256029;text-decoration:underline}.intel-table-wrap{overflow:auto;margin-top:10px}.intel-table{border-collapse:collapse;width:100%;font-size:.8rem;min-width:530px}.intel-table th,.intel-table td{padding:9px 7px;border-bottom:1px solid #edf0eb;text-align:left}.intel-table th{color:#596657;background:#f7faf5}.intel-tag{display:inline-block;padding:3px 7px;border-radius:20px;background:#f1f3ef;font-size:.7rem}.intel-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin-top:12px}.intel-form label{font-size:.73rem;color:#596657;display:grid;gap:4px}.intel-form input,.intel-form select{min-width:0;width:100%;padding:9px;border:1px solid #cbd8c7;border-radius:7px;background:#fff}.intel-btn{border:0;border-radius:8px;background:#2e7d32;color:#fff;font-weight:700;padding:10px 13px;cursor:pointer}.intel-status{font-size:.76rem;color:#667064;margin-top:8px}@media(max-width:560px){.intel-card{padding:11px}.intel-frutas{grid-template-columns:repeat(2,minmax(0,1fr))}}';
 document.head.appendChild(s);
}
function mount(){
 const grid=document.getElementById('grade-produtos');if(!grid||document.getElementById('intel-mercado'))return;
 const w=document.createElement('section');w.id='intel-mercado';w.className='intel-wrap';
 w.innerHTML='<section class="intel-card"><div class="intel-head"><div><h3 id="intel-title">🍉 Frutas da época</h3><div class="intel-muted">Calendário orientativo para o Sudeste. Safra e disponibilidade variam com clima e região.</div></div><span class="intel-tag">Atualizado ao abrir</span></div><div class="intel-frutas" id="intel-frutas"></div></section><section class="intel-card"><div class="intel-head"><div><h3>📊 Comparação com o mercado</h3><div class="intel-muted">Médias de atacado e varejo com cotações registradas para o mesmo produto e unidade. Sem dados, não exibimos estimativas.</div></div><span class="intel-tag">São Paulo / RMSP</span></div><div id="intel-results" class="intel-muted">Consultando cotações…</div><div class="intel-sources"><a href="https://ceagesp.gov.br/cotacoes/" target="_blank" rel="noopener">CEAGESP · atacado</a><a href="https://infoiea.agricultura.sp.gov.br/BancoDeDados/PrecosDiarios/Atacado" target="_blank" rel="noopener">IEA · atacado diário</a><a href="https://infoiea.agricultura.sp.gov.br/nia1/precos_medios.aspx?cod_sis=2" target="_blank" rel="noopener">IEA · médias de atacado e varejo</a></div><div id="intel-manager" hidden><details style="margin-top:12px"><summary style="cursor:pointer;color:#256029;font-weight:700">＋ Registrar cotação de mercado (gerente)</summary><form id="intel-form" class="intel-form"><label>Produto<input name="produto" required placeholder="Ex.: Banana prata"></label><label>Mercado<select name="tipo"><option value="atacado">Atacado</option><option value="varejo">Varejo</option></select></label><label>Preço (R$)<input name="preco" type="number" min="0.01" step="0.01" required></label><label>Unidade<select name="unidade"><option value="kg">kg</option><option value="un">unidade</option><option value="cx">caixa</option><option value="bandeja">bandeja</option><option value="sc">saco</option></select></label><label>Fonte<select name="fonte"><option>CEAGESP</option><option>IEA</option><option>Pesquisa varejo local</option><option>Outra fonte</option></select></label><label>Data da cotação<input name="data" type="date" required></label><label style="grid-column:1/-1">Observação<input name="obs" placeholder="Variedade, classificação, região ou condições"></label><button class="intel-btn" type="submit">Salvar cotação</button></form><div id="intel-form-status" class="intel-status" role="status"></div></details></div><div id="intel-data-status" class="intel-status">Nenhuma cotação cadastrada. Consulte as fontes oficiais e registre os valores para iniciar a comparação.</div></section>';
 grid.parentNode.insertBefore(w,grid);
 const month=new Date().getMonth()+1;
 document.getElementById('intel-title').textContent='🍉 Frutas da época — '+months[month-1];
 document.getElementById('intel-frutas').innerHTML=(seasonal[month]||[]).map(f=>'<div class="intel-fruta"><span class="em">'+f[0]+'</span><div><strong>'+f[1]+'</strong><small>'+f[2]+'</small></div></div>').join('');
}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const datePt=s=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'—';
async function load(){
 const out=document.getElementById('intel-results'),sb=window.pdvAuth?.supabase;if(!out)return;
 if(!sb){out.textContent='Aguardando autenticação.';return;}
 const {data,error}=await sb.from('pdv_precos_referencia').select('produto_nome,tipo_mercado,preco,unidade,fonte,data_referencia').order('data_referencia',{ascending:false}).limit(500);
 if(error){out.textContent='Não foi possível consultar as cotações. Confira a migração e as permissões do banco.';return;}
 const refs=data||[],status=document.getElementById('intel-data-status');
 if(status)status.textContent=refs.length?'Cotação mais recente: '+datePt(refs[0].data_referencia)+'. Confira sempre variedade, qualidade, unidade e região.':'Nenhuma cotação cadastrada. Consulte as fontes oficiais e registre os valores para iniciar a comparação.';
 const products=Array.isArray(window.produtos)?window.produtos:[];
 const rows=[];
 products.forEach(p=>{
  const matching=refs.filter(r=>norm(r.produto_nome)===norm(p.nome)&&String(r.unidade).toLowerCase()===String(p.unidade||'kg').toLowerCase());
  const wholesale=matching.filter(r=>r.tipo_mercado==='atacado'),retail=matching.filter(r=>r.tipo_mercado==='varejo');
  const avg=a=>a.length?a.reduce((sum,r)=>sum+Number(r.preco),0)/a.length:null;
  const a=avg(wholesale),v=avg(retail),price=Number(p.preco);if(a===null&&v===null)return;
  const pct=x=>x===null||!price?'—':((price/x-1)*100).toFixed(1).replace('.',',')+'%';
  rows.push('<tr><td><strong>'+esc(p.nome)+'</strong><br><span class="intel-muted">Seu preço: '+money(price)+'/'+esc(p.unidade||'kg')+'</span></td><td>'+(a===null?'—':money(a))+'<br><span class="intel-muted">'+(wholesale[0]?datePt(wholesale[0].data_referencia)+' · '+esc(wholesale[0].fonte):'')+'</span></td><td>'+(v===null?'—':money(v))+'<br><span class="intel-muted">'+(retail[0]?datePt(retail[0].data_referencia)+' · '+esc(retail[0].fonte):'')+'</span></td><td>'+pct(a)+' / '+pct(v)+'</td></tr>');
 });
 out.innerHTML=rows.length?'<div class="intel-table-wrap"><table class="intel-table"><thead><tr><th>Produto / preço atual</th><th>Atacado médio</th><th>Varejo médio</th><th>Diferença vs. seu preço<br><span class="intel-muted">atacado / varejo</span></th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div><p class="intel-muted" style="margin-top:8px">Médias calculadas com as cotações registradas para o mesmo produto e unidade. Não misture variedades ou embalagens diferentes.</p>':'<p style="margin-top:10px">Ainda não há cotações correspondentes aos produtos e unidades cadastrados. Registre uma cotação para começar.</p>';
 const manager=document.getElementById('intel-manager');if(manager&&window.pdvAuth?.papel==='gerente')manager.hidden=false;
 const form=document.getElementById('intel-form');
 if(form&&!form.dataset.bound){
  form.dataset.bound='1';form.elements.data.value=new Date().toISOString().slice(0,10);
  form.addEventListener('submit',async e=>{
   e.preventDefault();const f=e.currentTarget,b=f.querySelector('button'),msg=document.getElementById('intel-form-status'),price=Number(f.elements.preco.value);
   if(!f.elements.produto.value.trim()||!Number.isFinite(price)||price<=0){msg.textContent='Informe produto e preço válido.';return;}
   b.disabled=true;msg.textContent='Salvando…';
   const {error:saveError}=await sb.from('pdv_precos_referencia').insert({produto_nome:f.elements.produto.value.trim(),tipo_mercado:f.elements.tipo.value,preco:price,unidade:f.elements.unidade.value,fonte:f.elements.fonte.value,data_referencia:f.elements.data.value,observacao:f.elements.obs.value.trim()||null,criado_por:window.pdvAuth?.user?.id||null});
   b.disabled=false;if(saveError){msg.textContent='Falha ao salvar. Somente gerente pode cadastrar cotações.';return;}
   f.reset();f.elements.data.value=new Date().toISOString().slice(0,10);msg.textContent='Cotação registrada.';await load();
  });
 }
}
function start(){style();mount();if(window.pdvAuth?.supabase)load();}
document.addEventListener('pdv-auth-ready',start);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();