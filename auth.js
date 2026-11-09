// Autenticação e controle de acesso do PDV HortiFruti
// Somente a chave publishable pode ficar no navegador.
(() => {
  'use strict';
  const SUPABASE_URL = 'https://vcyneajmmwvvnefqompe.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fOe9mU2A_48YLPKq1NB6ZQ_Hg_GZaym';
  const pagina = location.pathname.split('/').pop() || 'index.html';
  const exigeGerente = ['usuarios.html', 'admin-senhas.html'].includes(pagina);
  const permissoesGestao = ['produtos','estoque','fechamento','relatorios','configuracoes'];
  let cliente;
  let recoveryFormShown = false;

  const style = document.createElement('style');
  style.textContent = `
    #pdv-auth-screen{position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#102c18ee,#1d5128ee);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Arial,sans-serif}
    #pdv-auth-card{box-sizing:border-box;background:#fff;width:min(430px,100%);padding:30px;border-radius:18px;box-shadow:0 18px 55px #0005}
    #pdv-auth-card h2{margin:0 0 8px;color:#205c28;font-size:25px}
    #pdv-auth-card p{color:#526052;line-height:1.5}
    #pdv-auth-card .pdv-auth-tag{display:inline-block;background:#e8f5e9;color:#205c28;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:15px}
    #pdv-auth-card label{display:block;font-weight:700;margin:15px 0 6px;color:#263326}
    #pdv-auth-card input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #ccd5cc;border-radius:9px;font-size:17px}
    #pdv-auth-card input:focus{outline:2px solid #81c784;border-color:#2e7d32}
    #pdv-auth-card button{width:100%;padding:13px;margin-top:16px;border:0;border-radius:9px;background:#2e7d32;color:#fff;font-weight:700;font-size:16px;cursor:pointer}
    #pdv-auth-card button:disabled{opacity:.65;cursor:wait}
    #pdv-auth-error{color:#b3261e;min-height:22px;font-size:14px;margin-top:8px}
    #pdv-auth-card a{color:#246b2b;font-weight:600}
    #pdv-auth-user{position:fixed;right:12px;top:12px;z-index:9998;background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 2px 8px #0002;font:12px Arial;display:flex;gap:8px;align-items:center}
    #pdv-auth-user button,#pdv-auth-user a{border:0;background:#e8f5e9;color:#205c25;border-radius:6px;padding:6px 9px;cursor:pointer;text-decoration:none}
  `;
  document.head.appendChild(style);

  const tela = document.createElement('div');
  tela.id = 'pdv-auth-screen';
  const titulo = exigeGerente ? 'Acesso do Gerente Master' : 'Acesso ao HortiFruti PDV';
  const descricao = exigeGerente
    ? 'Entre com o CPF e a senha da conta de gerente autorizada para administrar o sistema.'
    : 'Entre com seu CPF e senha cadastrados no sistema.';
  tela.innerHTML = `<section id="pdv-auth-card" role="dialog" aria-modal="true" aria-labelledby="pdv-auth-title">
    <div class="pdv-auth-tag">${exigeGerente ? '🔐 ÁREA ADMINISTRATIVA' : '🍉 PONTO DE VENDA'}</div>
    <h2 id="pdv-auth-title">${titulo}</h2>
    <p>${descricao}</p>
    <form id="pdv-auth-form">
      <label for="pdv-auth-cpf">CPF do usuário</label>
      <input id="pdv-auth-cpf" type="text" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="000.000.000-00" required>
      <label for="pdv-auth-password">Senha</label>
      <input id="pdv-auth-password" type="password" autocomplete="current-password" required>
      <div id="pdv-auth-error" role="alert" aria-live="polite"></div>
      <button id="pdv-auth-submit" type="submit">${exigeGerente ? 'Entrar como gerente' : 'Entrar no PDV'}</button>
      <p style="text-align:center;margin:16px 0 0"><a href="primeiro-acesso.html">Primeiro acesso: configurar o gerente master</a></p>
    </form>
  </section>`;
  document.body.appendChild(tela);

  const erro = document.getElementById('pdv-auth-error');
  const submit = document.getElementById('pdv-auth-submit');
  const mostrarErro = (mensagem) => { const alvo = document.getElementById('pdv-auth-error'); if (alvo) alvo.textContent = mensagem || ''; };

  function cpfValido(valor) {
    const cpf = String(valor).replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const calc = (base, peso) => {
      let soma = 0;
      for (const digito of base) soma += Number(digito) * peso--;
      const resto = (soma * 10) % 11;
      return (resto === 10 ? 0 : resto);
    };
    return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
      calc(cpf.slice(0, 10), 11) === Number(cpf[10]);
  }

  async function cpfParaEmail(valor) {
    const cpf = String(valor).replace(/\D/g, '');
    const bytes = new TextEncoder().encode('hortifruti-pdv-cpf:' + cpf);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    return 'cpf-' + hex + '@login.hortifruti.com';
  }

  function mostrarFormularioNovaSenha() {
    if (recoveryFormShown) return;
    recoveryFormShown = true;
    const card = document.getElementById('pdv-auth-card');
    card.innerHTML = `
      <div class="pdv-auth-tag">🔐 SEGURANÇA DA CONTA</div>
      <h2>Definir nova senha</h2>
      <p>Crie uma senha nova para acessar o HortiFruti PDV.</p>
      <form id="pdv-auth-reset-form">
        <label for="pdv-auth-new-password">Nova senha</label>
        <input id="pdv-auth-new-password" type="password" autocomplete="new-password" minlength="10" required>
        <label for="pdv-auth-confirm-password">Confirmar nova senha</label>
        <input id="pdv-auth-confirm-password" type="password" autocomplete="new-password" minlength="10" required>
        <div id="pdv-auth-error" role="alert"></div>
        <button id="pdv-auth-reset-submit" type="submit">Salvar nova senha</button>
      </form>`;
    document.getElementById('pdv-auth-reset-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const senha = document.getElementById('pdv-auth-new-password').value;
      const confirmacao = document.getElementById('pdv-auth-confirm-password').value;
      const msg = document.getElementById('pdv-auth-error');
      const botao = document.getElementById('pdv-auth-reset-submit');
      if (senha.length < 10) { msg.textContent = 'A senha deve ter pelo menos 10 caracteres.'; return; }
      if (senha !== confirmacao) { msg.textContent = 'As senhas não coincidem.'; return; }
      botao.disabled = true;
      botao.textContent = 'Salvando...';
      const { error } = await cliente.auth.updateUser({ password: senha });
      if (error) {
        msg.textContent = 'Não foi possível atualizar a senha. Tente novamente.';
        botao.disabled = false;
        botao.textContent = 'Salvar nova senha';
        return;
      }
      await cliente.auth.signOut();
      history.replaceState(null, document.title, location.pathname + location.search);
      card.innerHTML = '<h2>Senha atualizada</h2><p>Sua senha foi alterada. Entre novamente com CPF e senha.</p><button id="pdv-auth-back-login" type="button">Voltar ao login</button>';
      document.getElementById('pdv-auth-back-login').addEventListener('click', () => location.reload());
    });
  }

  function liberar(user, papel, nomePerfil, permissoes = {}) {
    tela.remove();
    const faixa = document.createElement('div');
    faixa.id = 'pdv-auth-user';
    const nome = document.createElement('span');
    nome.textContent = (nomePerfil || user.user_metadata?.nome || 'Usuário') + ' · ' + (papel === 'gerente' ? 'Gerente Master' : 'Operador');
    if (papel === 'gerente') {
      const senhas = document.createElement('a');
      senhas.href = 'admin-senhas.html';
      senhas.textContent = 'Senhas';
      faixa.appendChild(senhas);
    }
    const sair = document.createElement('button');
    sair.type = 'button';
    sair.textContent = 'Sair';
    sair.addEventListener('click', async () => {
      sair.disabled = true;
      const { error } = await cliente.auth.signOut();
      if (error) { alert('Não foi possível sair. Tente novamente.'); sair.disabled = false; }
      else location.reload();
    });
    if (papel === 'gerente' && pagina === 'gestao.html') {
      const usuarios = document.createElement('a'); usuarios.href = 'usuarios.html'; usuarios.textContent = 'Usuários'; faixa.appendChild(usuarios);
    }
    faixa.append(nome, sair);
    document.body.appendChild(faixa);
    window.pdvAuth = { user, papel, permissoes: papel === 'gerente' ? Object.fromEntries(['vendas','produtos','estoque','fechamento','relatorios','configuracoes','usuarios'].map(k => [k,true])) : permissoes, supabase: cliente };
    window.dispatchEvent(new CustomEvent('pdv-auth-ready', { detail: window.pdvAuth }));
    document.querySelectorAll('a[href="usuarios.html"]').forEach(link => { if (papel !== 'gerente') link.style.display = 'none'; });
    document.querySelectorAll('a[href="index.html"]').forEach(link => { if (papel !== 'gerente' && permissoes.vendas !== true) link.style.display = 'none'; });
    document.querySelectorAll('a[href="vendas.html"]').forEach(link => { if (papel !== 'gerente' && permissoes.relatorios !== true) link.style.display = 'none'; });
    if (pagina === 'gestao.html' && papel !== 'gerente') {
      document.querySelectorAll('.aba-btn[data-aba]').forEach(btn => {
        const aba = btn.dataset.aba;
        const chave = ({'visao-geral':'relatorios','produtos':'produtos','estoque':'estoque','calendario':'fechamento','configuracoes':'configuracoes','etiquetas':'produtos'})[aba];
        if (chave && !permissoes[chave]) btn.style.display = 'none';
      });
      document.querySelectorAll('.aba').forEach(section => {
        const chave = ({'visao-geral':'relatorios','produtos':'produtos','estoque':'estoque','calendario':'fechamento','configuracoes':'configuracoes','etiquetas':'produtos'})[section.id];
        if (chave && !permissoes[chave]) section.remove();
      });
      const primeiro = document.querySelector('.aba-btn[data-aba]:not([style*="display: none"])');
      if (primeiro) { document.querySelectorAll('.aba').forEach(x=>x.classList.remove('ativa')); document.querySelectorAll('.aba-btn').forEach(x=>x.classList.remove('ativo')); primeiro.classList.add('ativo'); document.getElementById(primeiro.dataset.aba)?.classList.add('ativa'); }
    }
  }

  async function validarAcesso(user) {
    const { data, error } = await cliente.from('perfis')
      .select('id,nome,email,papel,perfil,ativo,permissoes')
      .eq('id', user.id).maybeSingle();
    if (error) throw new Error('Não foi possível consultar seu perfil. Verifique as permissões da tabela de perfis.');
    if (!data) throw new Error('Esta conta ainda não possui perfil cadastrado. Configure o gerente master ou peça ao gerente para vinculá-la.');
    if (data.email && user.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error('O e-mail interno do perfil não corresponde à conta autenticada. Solicite a correção ao administrador.');
    }
    if (data.papel && data.perfil && data.papel !== data.perfil) {
      throw new Error('O cadastro possui divergência entre papel e perfil. Solicite a correção ao administrador.');
    }
    const papel = data.papel || data.perfil;
    if (!['gerente', 'operador'].includes(papel)) throw new Error('Seu usuário não possui um perfil válido.');
    if (data.ativo !== true) throw new Error('Este usuário está inativo. Solicite ao gerente a reativação do acesso.');
    const permissoes = data.permissoes || {vendas:true};
    if (exigeGerente && papel !== 'gerente') throw new Error('Esta área é exclusiva do Gerente Master.');
    if (pagina === 'gestao.html' && papel !== 'gerente' && !permissoesGestao.some(k => permissoes[k] === true)) throw new Error('Seu usuário não possui permissões para acessar a Gestão.');
    if (pagina === 'index.html' && papel !== 'gerente' && permissoes.vendas !== true) throw new Error('Seu usuário não possui permissão para realizar vendas.');
    if (pagina === 'vendas.html' && papel !== 'gerente' && permissoes.relatorios !== true) throw new Error('Seu usuário não possui permissão para consultar vendas e relatórios.');
    liberar(user, papel, data.nome, permissoes);
    return true;
  }

  async function iniciar() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      mostrarErro('O serviço de autenticação não carregou. Confira a conexão e atualize a página.');
      return;
    }
    cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    cliente.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setTimeout(mostrarFormularioNovaSenha, 0);
    });
    const { data, error } = await cliente.auth.getSession();
    if (error) { mostrarErro('Erro ao verificar a sessão. Atualize a página e tente novamente.'); return; }

    const retorno = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (retorno.get('type') === 'recovery') { mostrarFormularioNovaSenha(); return; }
    if (retorno.get('error') || retorno.get('error_code')) {
      mostrarErro(retorno.get('error_code') === 'otp_expired'
        ? 'O link de recuperação expirou. Entre com CPF e senha ou solicite um novo link.'
        : 'Não foi possível validar o link. Entre com CPF e senha.');
      history.replaceState(null, document.title, location.pathname + location.search);
    }

    if (data.session) {
      try { await validarAcesso(data.session.user); }
      catch (e) { await cliente.auth.signOut(); mostrarErro(e.message || 'Não foi possível validar seu perfil.'); }
    } else {
      document.getElementById('pdv-auth-cpf').focus();
    }

    document.getElementById('pdv-auth-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Verificando...';
      mostrarErro('');
      try {
        const cpf = document.getElementById('pdv-auth-cpf').value;
        const password = document.getElementById('pdv-auth-password').value;
        if (!cpfValido(cpf)) throw new Error('Digite um CPF válido com 11 números.');
        if (!password) throw new Error('Digite sua senha.');
        const email = await cpfParaEmail(cpf);
        const { data: login, error: loginError } = await cliente.auth.signInWithPassword({ email, password });
        if (loginError) {
          const detalhe = String(loginError.message || '').toLowerCase();
          if (detalhe.includes('too many requests') || detalhe.includes('rate limit')) {
            throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
          }
          throw new Error('CPF ou senha incorretos. Confira os dados e tente novamente.');
        }
        await validarAcesso(login.user);
      } catch (e) {
        mostrarErro(e.message || 'Não foi possível entrar. Tente novamente.');
      } finally {
        submit.disabled = false;
        submit.textContent = exigeGerente ? 'Entrar como gerente' : 'Entrar no PDV';
      }
    });
  }

  iniciar().catch(() => mostrarErro('Falha ao iniciar a autenticação. Atualize a página e tente novamente.'));
})();
