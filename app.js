// ===== FUNÇÕES DE SEGURANÇA =====
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}
function numeroValido(value, minimo = 0) {
    const n = Number(value);
    return Number.isFinite(n) && n >= minimo ? n : null;
}

// ===== FUNÇÕES DE SEGURANÇA PARA SALVAR/CARREGAR DADOS =====
function salvarDados(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
        return true;
    } catch (e) {
        alert('⚠️ Não foi possível salvar! Desative o modo privado do navegador.');
        return false;
    }
}

function carregarDados(chave, padrao) {
    try {
        const dados = localStorage.getItem(chave);
        return dados ? JSON.parse(dados) : padrao;
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
        return padrao;
    }
}

function mesmaData(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// ===== DADOS INICIAIS =====
const produtosPadrao = window.CATALOGO_PRODUTOS || [];
let produtos = window.mesclarCatalogoProdutos(carregarDados('produtos', produtosPadrao));
salvarDados('produtos', produtos);
let historicoVendas = carregarDados('historicoVendas', []);
let cfg = carregarDados('configuracoes', {nome:'Hortifruti',cnpj:'',tel:'',cidade:''});

let carrinho = [];
let formaPagamento = null;
let produtoParaPesar = null;
window.obterCarrinhoPDV = () => carrinho;

// ===== SALVAR =====
function salvarTudo() {
    let produtosAntigos, vendasAntigas;
    try {
        produtosAntigos = localStorage.getItem('produtos');
        vendasAntigas = localStorage.getItem('historicoVendas');
        localStorage.setItem('produtos', JSON.stringify(produtos));
        localStorage.setItem('historicoVendas', JSON.stringify(historicoVendas));
        return true;
    } catch (e) {
        try {
            if (produtosAntigos == null) localStorage.removeItem('produtos');
            else localStorage.setItem('produtos', produtosAntigos);
            if (vendasAntigas == null) localStorage.removeItem('historicoVendas');
            else localStorage.setItem('historicoVendas', vendasAntigas);
        } catch (rollbackError) {
            console.error('Falha ao reverter gravação local:', rollbackError);
        }
        console.error('Não foi possível salvar os dados do PDV:', e);
        return false;
    }
}

// ===== RENDERIZAR PRODUTOS =====
function renderProdutos(filtro='', categoria='todos') {
    const grade = document.getElementById('grade-produtos');
    let lista = [...produtos];
    
    if(categoria !== 'todos') {
        lista = lista.filter(p => p.categoria === categoria);
    }
    if(filtro) {
        lista = lista.filter(p => 
            p.nome.toLowerCase().includes(filtro.toLowerCase()) ||
            p.codigo.includes(filtro)
        );
    }

    grade.innerHTML = lista.map(p => `
        <div class="cartao-produto" data-id="${Number(p.id)}">
            <div class="emoji">${escapeHTML(p.emoji)}</div>
            <div class="nome">${escapeHTML(p.nome)}</div>
            <div class="preco">${p.preco > 0 ? `R$ ${p.preco.toFixed(2)}` : "Definir preço"}</div>
            <div class="unid">/${escapeHTML(p.unidade)}</div>
        </div>
    `).join('');

    document.querySelectorAll('.cartao-produto').forEach(card => {
        card.addEventListener('click', () => adicionarAoCarrinho(Number(card.dataset.id)));
    });
}

// ===== ADICIONAR AO CARRINHO =====
function adicionarAoCarrinho(id) {
    const produto = produtos.find(p => Number(p.id) === Number(id));
    if(!produto) return alert('Produto não encontrado!');
    if (!Number.isFinite(Number(produto.preco)) || Number(produto.preco) <= 0) return alert('Defina o preço deste produto na Gestão antes de vender.');

    if(produto.unidade === 'kg') {
        produtoParaPesar = produto;
        document.getElementById('area-peso').style.display = 'flex';
        document.getElementById('peso-input').value = '';
        document.getElementById('peso-input').focus();
    } else {
        carrinho.push({
            id: Date.now(),
            produtoId: produto.id,
            nome: produto.nome,
            emoji: produto.emoji,
            preco: produto.preco,
            quantidade: 1,
            unidade: produto.unidade
        });
        atualizarCarrinho();
    }
}

// ===== APLICAR PESO =====
document.getElementById('btn-aplicar-peso').addEventListener('click', () => {
    const peso = parseFloat(document.getElementById('peso-input').value);
    if(!produtoParaPesar) return;
    if(isNaN(peso) || peso <= 0) return alert('Digite um peso válido!');

    carrinho.push({
        id: Date.now(),
        produtoId: produtoParaPesar.id,
        nome: produtoParaPesar.nome,
        emoji: produtoParaPesar.emoji,
        preco: produtoParaPesar.preco,
        quantidade: peso,
        unidade: 'kg'
    });

    produtoParaPesar = null;
    document.getElementById('area-peso').style.display = 'none';
    document.getElementById('peso-input').value = '';
    atualizarCarrinho();
});

// ===== ATUALIZAR CARRINHO =====
function calcularResumoCarrinho() {
    const subtotal = carrinho.reduce((s,i) => s + (Number(i.preco) * Number(i.quantidade)), 0);
    const quantidades = new Map();
    carrinho.forEach(item => quantidades.set(String(item.produtoId), (quantidades.get(String(item.produtoId)) || 0) + Number(item.quantidade)));
    let desconto = 0;
    const descontosPorItem = carrinho.map(item => {
        const produto = produtos.find(p => String(p.id) === String(item.produtoId));
        const limite = Number(produto?.quantidadeMinimaDesconto) || 0;
        const percentual = Number(produto?.descontoPercentual) || 0;
        const atingiu = limite > 0 && percentual > 0 && (quantidades.get(String(item.produtoId)) || 0) >= limite;
        const valor = atingiu ? Number(item.preco) * Number(item.quantidade) * percentual / 100 : 0;
        desconto += valor;
        return valor;
    });
    return {subtotal, desconto, total: Math.max(0, subtotal - desconto), descontosPorItem, quantidades};
}

function atualizarCarrinho() {
    const lista = document.getElementById('lista-itens');
    document.getElementById('qtd-itens').textContent = `(${carrinho.length})`;
    if(carrinho.length === 0) {
        lista.innerHTML = '<p class="vazio">Nenhum produto adicionado</p>';
        document.getElementById('subtotal').textContent = 'R$ 0,00';
        document.getElementById('desconto-valor').textContent = 'R$ 0,00';
        document.getElementById('total').textContent = 'R$ 0,00';
        formaPagamento = null;
        atualizarSugestoes();
        window.atualizarComprovanteAoVivo?.();
        return;
    }
    const resumo = calcularResumoCarrinho();
    lista.innerHTML = carrinho.map((item, index) => {
        const bruto = Number(item.preco) * Number(item.quantidade);
        const desc = resumo.descontosPorItem[index];
        const liquido = bruto - desc;
        return `<div class="item-carrinho">
          <div><span>${escapeHTML(item.emoji)}</span><div>
            <div>${escapeHTML(item.nome)}</div>
            <div style="font-size:0.8rem;color:#666;">${Number(item.quantidade).toFixed(3)} ${escapeHTML(item.unidade)} × R$ ${Number(item.preco).toFixed(2)}</div>
            ${desc > 0 ? `<div style="font-size:0.78rem;color:#2e7d32;">Desconto por quantidade: -R$ ${desc.toFixed(2)}</div>` : ''}
          </div></div>
          <div style="text-align:right;"><div style="font-weight:bold;">R$ ${liquido.toFixed(2)}</div>
            ${desc > 0 ? `<small style="color:#777;text-decoration:line-through;">R$ ${bruto.toFixed(2)}</small>` : ''}
            <button type="button" class="remover-item" data-id="${Number(item.id)}" aria-label="Remover ${escapeHTML(item.nome)}" style="background:none;border:none;color:red;cursor:pointer;padding:2px;">✕</button>
          </div>
        </div>`;
    }).join('');
    lista.querySelectorAll('.remover-item').forEach(btn => btn.addEventListener('click', () => removerItem(Number(btn.dataset.id))));
    document.getElementById('subtotal').textContent = `R$ ${resumo.subtotal.toFixed(2)}`;
    document.getElementById('desconto-valor').textContent = `-R$ ${resumo.desconto.toFixed(2)}`;
    document.getElementById('total').textContent = `R$ ${resumo.total.toFixed(2)}`;
    atualizarSugestoes();
    window.atualizarComprovanteAoVivo?.();
}

function atualizarSugestoes() {
    const painel = document.getElementById('painel-sugestoes');
    if (!painel) return;
    const idsNoCarrinho = new Set(carrinho.map(item => String(item.produtoId)));
    const classes = new Set(carrinho.map(item => produtos.find(p => String(p.id) === String(item.produtoId))?.vitaminaClasse).filter(Boolean));
    const buscaDiabetes = carrinho.some(item => Boolean(produtos.find(p => String(p.id) === String(item.produtoId))?.opcaoDiabetes));
    const recomendacoes = produtos.map(produto => {
        if (idsNoCarrinho.has(String(produto.id))) return null;
        const motivos = [];
        if (produto.vitaminaClasse && classes.has(produto.vitaminaClasse)) motivos.push('Mesma classe: vitamina ' + (produto.vitaminaClasse === 'folato' ? 'B9 (folato)' : produto.vitaminaClasse));
        if (buscaDiabetes && produto.opcaoDiabetes) motivos.push('Opção cadastrada para pessoas com diabetes');
        return motivos.length ? {produto, motivo: motivos.join(' • ')} : null;
    }).filter(Boolean).slice(0, 4);
    if (!carrinho.length || !recomendacoes.length) { painel.hidden = true; painel.innerHTML = ''; return; }
    painel.hidden = false;
    painel.innerHTML = '<h4>💡 Sugestões para oferecer</h4><p class="sugestoes-aviso">Sugestões baseadas nas classificações cadastradas. Confira rótulos e necessidades individuais.</p>' +
      recomendacoes.map(({produto, motivo}) => `<div class="sugestao-produto"><div><strong>${escapeHTML(produto.emoji)} ${escapeHTML(produto.nome)}</strong><small>${escapeHTML(motivo)}</small><span>R$ ${Number(produto.preco).toFixed(2)} / ${escapeHTML(produto.unidade)}</span></div><button type="button" class="btn-sugestao" data-produto-id="${Number(produto.id)}">Adicionar</button></div>`).join('');
    painel.querySelectorAll('.btn-sugestao').forEach(btn => btn.addEventListener('click', () => adicionarAoCarrinho(Number(btn.dataset.produtoId))));
}

function removerItem(id) {
    carrinho = carrinho.filter(i => i.id !== id);
    atualizarCarrinho();
}

// ===== PAGAMENTO =====
document.querySelectorAll('.btn-pag').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-pag').forEach(b => b.style.borderColor = '#e0e0e0');
        btn.style.borderColor = '#2e7d32';
        formaPagamento = btn.dataset.pag;
    });
});

// ===== FINALIZAR VENDA =====
document.getElementById('btn-finalizar').addEventListener('click', async () => {
    if (carrinho.length === 0) return alert('Carrinho vazio!');
    if (!formaPagamento) return alert('Selecione a forma de pagamento!');

    // Modo de operação sem estoque obrigatório:
    // a venda registra as quantidades, mas não consulta nem altera o saldo de estoque.
    for (const item of carrinho) {
        const p = produtos.find(x => Number(x.id) === Number(item.produtoId));
        const quantidade = numeroValido(item.quantidade, Number.MIN_VALUE);
        const preco = numeroValido(item.preco, 0);
        if (!p || quantidade === null || preco === null) {
            return alert('Venda não finalizada: produto, preço ou quantidade inválido.');
        }
    }

    const resumo = calcularResumoCarrinho();
    const subtotal = resumo.subtotal;
    if (!Number.isFinite(subtotal) || subtotal <= 0 || !Number.isFinite(resumo.total)) return alert('Total da venda inválido.');

    try { await window.prepararComprovanteAntesFinalizar?.(); } catch (e) { return alert(e.message || 'Não foi possível preparar o comprovante online.'); }

    const vendasAntes = JSON.stringify(historicoVendas);

    const venda = {
        id: Date.now(),
        data: new Date().toISOString(),
        itens: carrinho.map((item, index) => ({ ...item, descontoValor: resumo.descontosPorItem[index] })),
        subtotal,
        desconto: resumo.desconto,
        total: resumo.total,
        formaPagamento,
        cupomTexto: gerarCupom(resumo.total, resumo)
    };
    historicoVendas.push(venda);

    if (!salvarTudo()) {
        historicoVendas = JSON.parse(vendasAntes);
        return alert('Venda não registrada: falha ao salvar os dados. O carrinho foi mantido. Verifique o armazenamento e tente novamente.');
    }

    try { await window.finalizarComprovanteAoVivo?.(); } catch (e) { console.warn('Não foi possível encerrar o comprovante online:', e); }

    if (typeof window.printarCupom === 'function') {
        window.printarCupom(venda.cupomTexto);
    } else {
        alert('Venda salva, mas o módulo de impressão não carregou. Atualize a página e reimprima pelo histórico.');
    }

    carrinho = [];
    formaPagamento = null;
    atualizarCarrinho();
    renderProdutos();
});
// ===== GERAR CUPOM =====
function gerarCupom(total, resumo = calcularResumoCarrinho()) {
    const data = new Date().toLocaleString('pt-BR');
    return `
${cfg.nome.toUpperCase()}
${cfg.cnpj ? 'CNPJ: ' + cfg.cnpj : ''}
${cfg.cidade ? cfg.cidade : ''}
--------------------------------
DATA: ${data}
VENDA Nº: ${historicoVendas.length + 1}
--------------------------------
ITENS:
${carrinho.map((i,index) => {
  const bruto = Number(i.preco) * Number(i.quantidade);
  const desc = resumo.descontosPorItem[index] || 0;
  return `${i.emoji} ${i.nome}
  ${i.quantidade.toFixed(3)} ${i.unidade} x ${Number(i.preco).toFixed(2)}
  ${desc > 0 ? 'Desconto: -R$ ' + desc.toFixed(2) + '\\n  ' : ''}R$ ${(bruto-desc).toFixed(2)}`;
}).join('\n')}
--------------------------------
SUBTOTAL.......: R$ ${resumo.subtotal.toFixed(2)}
DESCONTO.......: R$ ${resumo.desconto.toFixed(2)}
TOTAL..........: R$ ${total.toFixed(2)}
--------------------------------
PAGAMENTO: ${formaPagamento.toUpperCase()}
--------------------------------
OBRIGADO! VOLTE SEMPRE!
    `.trim();
}
// ===== CANCELAR =====
document.getElementById('btn-cancelar').addEventListener('click', () => {
    if(carrinho.length > 0 && !confirm('Limpar carrinho?')) return;
    carrinho = [];
    formaPagamento = null;
    produtoParaPesar = null;
    document.getElementById('area-peso').style.display = 'none';
    document.querySelectorAll('.btn-pag').forEach(b => b.style.borderColor = '#e0e0e0');
    atualizarCarrinho();
});

// ===== BUSCA E CATEGORIAS =====
document.getElementById('campo-busca').addEventListener('input', e => {
    const cat = document.querySelector('.cat-ativo')?.dataset.cat || 'todos';
    renderProdutos(e.target.value, cat);
});

document.querySelectorAll('#categorias button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#categorias button').forEach(b => b.classList.remove('cat-ativo'));
        btn.classList.add('cat-ativo');
        renderProdutos(document.getElementById('campo-busca').value, btn.dataset.cat);
    });
});

// ===== ATALHOS =====
document.addEventListener('keydown', e => {
    if(e.key === 'F2') { e.preventDefault(); document.getElementById('campo-busca').focus(); }
    if(e.key === 'F9') { e.preventDefault(); window.location.href = 'gestao.html'; }
    if(e.key === 'Escape') { 
        if(produtoParaPesar) { produtoParaPesar = null; document.getElementById('area-peso').style.display = 'none'; }
        else { document.getElementById('btn-cancelar').click(); }
    }
    if(e.key === 'Enter' && document.activeElement.id === 'peso-input') {
        document.getElementById('btn-aplicar-peso').click();
    }
});

// ===== INICIALIZAR =====
renderProdutos();