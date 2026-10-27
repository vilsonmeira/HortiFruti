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
const produtosPadrao = [
    {id:1,codigo:"001",nome:"Maçã Fuji",preco:8.99,unidade:"kg",categoria:"frutas",emoji:"🍎",estoque:50,minimo:10},
    {id:2,codigo:"002",nome:"Banana Prata",preco:4.99,unidade:"kg",categoria:"frutas",emoji:"🍌",estoque:30,minimo:8},
    {id:3,codigo:"003",nome:"Laranja Pera",preco:6.50,unidade:"kg",categoria:"frutas",emoji:"🍊",estoque:40,minimo:10}
];

let produtos = carregarDados('produtos', produtosPadrao);
let historicoVendas = carregarDados('historicoVendas', []);
let cfg = carregarDados('configuracoes', {nome:'Hortifruti',cnpj:'',tel:'',cidade:''});

let carrinho = [];
let formaPagamento = null;
let produtoParaPesar = null;

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
            <div class="preco">R$ ${p.preco.toFixed(2)}</div>
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
function atualizarCarrinho() {
    const lista = document.getElementById('lista-itens');
    document.getElementById('qtd-itens').textContent = `(${carrinho.length})`;

    if(carrinho.length === 0) {
        lista.innerHTML = '<p class="vazio">Nenhum produto adicionado</p>';
        document.getElementById('subtotal').textContent = 'R$ 0,00';
        document.getElementById('desconto-valor').textContent = 'R$ 0,00';
        document.getElementById('total').textContent = 'R$ 0,00';
        formaPagamento = null;
        return;
    }

    lista.innerHTML = carrinho.map(item => `
        <div class="item-carrinho">
            <div>
                <span>${escapeHTML(item.emoji)}</span>
                <div>
                    <div>${escapeHTML(item.nome)}</div>
                    <div style="font-size:0.8rem;color:#666;">${item.quantidade.toFixed(3)} ${escapeHTML(item.unidade)} × R$ ${item.preco.toFixed(2)}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:bold;">R$ ${(item.preco * item.quantidade).toFixed(2)}</div>
                <button type="button" class="remover-item" data-id="${Number(item.id)}" aria-label="Remover ${escapeHTML(item.nome)}" style="background:none;border:none;color:red;cursor:pointer;padding:2px;">✕</button>
            </div>
        </div>
    `).join('');

    lista.querySelectorAll('.remover-item').forEach(btn => {
        btn.addEventListener('click', () => removerItem(Number(btn.dataset.id)));
    });

    const subtotal = carrinho.reduce((s,i) => s + (i.preco * i.quantidade), 0);
    document.getElementById('subtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('desconto-valor').textContent = 'R$ 0,00';
    document.getElementById('total').textContent = `R$ ${subtotal.toFixed(2)}`;
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
document.getElementById('btn-finalizar').addEventListener('click', () => {
    if (carrinho.length === 0) return alert('Carrinho vazio!');
    if (!formaPagamento) return alert('Selecione a forma de pagamento!');

    for (const item of carrinho) {
        const p = produtos.find(x => Number(x.id) === Number(item.produtoId));
        const quantidade = numeroValido(item.quantidade, Number.MIN_VALUE);
        const preco = numeroValido(item.preco, 0);
        const estoque = numeroValido(p?.estoque ?? 0, 0);
        if (!p || quantidade === null || preco === null || estoque === null) {
            return alert('Venda não finalizada: produto, preço, quantidade ou estoque inválido.');
        }
        if (estoque < quantidade) {
            return alert(`Estoque insuficiente para ${p.nome}. Disponível: ${estoque}.`);
        }
    }

    const subtotal = carrinho.reduce((s, i) => s + (Number(i.preco) * Number(i.quantidade)), 0);
    if (!Number.isFinite(subtotal) || subtotal <= 0) return alert('Total da venda inválido.');

    const produtosAntes = JSON.stringify(produtos);
    const vendasAntes = JSON.stringify(historicoVendas);
    carrinho.forEach(item => {
        const p = produtos.find(x => Number(x.id) === Number(item.produtoId));
        p.estoque = Number(p.estoque || 0) - Number(item.quantidade);
    });

    const venda = {
        id: Date.now(),
        data: new Date().toISOString(),
        itens: carrinho.map(item => ({ ...item })),
        subtotal,
        desconto: 0,
        total: subtotal,
        formaPagamento,
        cupomTexto: gerarCupom(subtotal)
    };
    historicoVendas.push(venda);

    if (!salvarTudo()) {
        produtos = JSON.parse(produtosAntes);
        historicoVendas = JSON.parse(vendasAntes);
        return alert('Venda não registrada: falha ao salvar os dados. O carrinho foi mantido. Verifique o armazenamento e tente novamente.');
    }

    const janela = window.open('', '_blank', 'width=320,height=600');
    if (janela) {
        const pre = janela.document.createElement('pre');
        pre.style.cssText = 'font-family:monospace;font-size:12px;white-space:pre-wrap;margin:0;';
        pre.textContent = venda.cupomTexto;
        janela.document.body.appendChild(pre);
        janela.document.close();
    } else {
        alert('Venda salva. O navegador bloqueou a janela de impressão; permita pop-ups para imprimir o cupom.');
    }

    carrinho = [];
    formaPagamento = null;
    atualizarCarrinho();
    renderProdutos();
});
// ===== GERAR CUPOM =====
function gerarCupom(total) {
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
${carrinho.map(i => `${i.emoji} ${i.nome}
  ${i.quantidade.toFixed(3)} ${i.unidade} x ${i.preco.toFixed(2)}
  R$ ${(i.preco*i.quantidade).toFixed(2)}`).join('\n')}
--------------------------------
SUBTOTAL.......: R$ ${total.toFixed(2)}
DESCONTO.......: R$ 0,00
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