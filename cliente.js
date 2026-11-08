(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg = window.HORTIFRUTI_SUPABASE;
  let client, products = [], cart = [];

  function message(text, error=false) {
    $('mensagem').textContent = text;
    $('mensagem').classList.toggle('cliente-erro', error);
  }
  function renderProducts() {
    const term = $('busca-produtos').value.trim().toLocaleLowerCase('pt-BR');
    const category = $('filtro-categoria').value;
    const filtered = products.filter(p =>
      (!category || p.category === category) &&
      (!term || p.name.toLocaleLowerCase('pt-BR').includes(term) || String(p.code || '').includes(term))
    );
    $('catalogo').innerHTML = filtered.length ? filtered.map(p => `
      <article class="produto-cliente">
        <div class="emoji">${esc(p.emoji || '🥬')}</div>
        <strong>${esc(p.name)}</strong>
        <span class="preco-cliente">${money(p.price)} / ${esc(p.unit || 'un')}</span>
        <button type="button" data-add="${esc(p.id)}">Adicionar à lista</button>
      </article>`).join('') : '<p>Nenhum produto encontrado.</p>';
  }
  function renderCart() {
    const count = cart.reduce((sum,item)=>sum+item.quantity,0);
    const total = cart.reduce((sum,item)=>sum+item.price*item.quantity,0);
    $('qtd-itens').textContent = String(count);
    $('total-pedido').textContent = money(total);
    $('itens-pedido').innerHTML = cart.length ? cart.map(item => `
      <div class="pedido-linha">
        <div><strong>${esc(item.name)}</strong><br><small>${money(item.price)} / ${esc(item.unit)}</small></div>
        <div><input type="number" min="0.001" max="9999" step="0.001" value="${item.quantity}" aria-label="Quantidade de ${esc(item.name)}" data-qty="${esc(item.id)}"><button type="button" data-remove="${esc(item.id)}" aria-label="Remover ${esc(item.name)}">×</button></div>
      </div>`).join('') : '<p>Nenhum produto adicionado.</p>';
  }
  async function loadProducts() {
    const {data,error} = await client.from('products').select('id,code,name,price,unit,category,emoji').eq('active',true).order('name');
    if(error) throw error;
    products = data || [];
    const categories = [...new Set(products.map(p=>p.category).filter(Boolean))].sort();
    $('filtro-categoria').innerHTML = '<option value="">Todas as categorias</option>' + categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
    renderProducts();
    $('estado-conexao').textContent = '● Conectado';
    message(products.length ? 'Catálogo atualizado. Escolha os produtos para montar sua lista.' : 'O catálogo está vazio. A loja ainda precisa publicar os produtos.');
  }
  $('catalogo').addEventListener('click',e=>{
    const button=e.target.closest('[data-add]'); if(!button)return;
    const product=products.find(p=>p.id===button.dataset.add); if(!product)return;
    const existing=cart.find(x=>x.id===product.id);
    if(existing) existing.quantity += 1; else cart.push({id:product.id,name:product.name,price:Number(product.price),unit:product.unit,quantity:1});
    renderCart();
  });
  $('itens-pedido').addEventListener('click',e=>{
    const button=e.target.closest('[data-remove]'); if(!button)return;
    cart=cart.filter(x=>x.id!==button.dataset.remove); renderCart();
  });
  $('itens-pedido').addEventListener('change',e=>{
    const input=e.target.closest('[data-qty]'); if(!input)return;
    const item=cart.find(x=>x.id===input.dataset.qty); if(!item)return;
    const qty=Number(input.value);
    if(!Number.isFinite(qty)||qty<=0||qty>9999){cart=cart.filter(x=>x.id!==item.id);}else item.quantity=qty;
    renderCart();
  });
  $('busca-produtos').addEventListener('input',renderProducts);
  $('filtro-categoria').addEventListener('change',renderProducts);
  $('form-pedido').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!cart.length){message('Adicione pelo menos um produto antes de enviar.',true);return;}
    const button=$('enviar-pedido'); button.disabled=true; button.textContent='Enviando...';
    try{
      const {data,error}=await client.rpc('create_customer_order',{
        p_items:cart.map(item=>({product_id:item.id,quantity:item.quantity})),
        p_customer_name:$('cliente-nome').value.trim()||null,
        p_customer_phone:$('cliente-telefone').value.trim()||null,
        p_note:$('cliente-observacao').value.trim()||null
      });
      if(error) throw error;
      const orderId=data;
      cart=[]; renderCart(); $('form-pedido').reset();
      message('Pedido enviado com sucesso! Número de referência: '+String(orderId).slice(0,8).toUpperCase()+'. A loja poderá entrar em contato para confirmar.');
    }catch(error){
      console.error(error); message('Não foi possível enviar. Confira se a tabela e a função do Supabase foram instaladas e tente novamente.',true);
    }finally{button.disabled=false;button.textContent='Enviar pedido';}
  });
  if(!cfg?.url||!cfg?.key||!window.supabase?.createClient){
    $('estado-conexao').textContent='● Sem conexão'; message('Configuração do Supabase não encontrada.',true); return;
  }
  client=window.supabase.createClient(cfg.url,cfg.key);
  loadProducts().catch(error=>{
    console.error(error); $('estado-conexao').textContent='● Erro de conexão';
    message('Não foi possível carregar o catálogo. Verifique se o SQL de supabase/schema.sql já foi executado no projeto.',true);
  });
})();
