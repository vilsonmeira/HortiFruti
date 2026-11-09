// Autenticação e controle de acesso do PDV HortiFruti
// A chave publishable é própria para uso no navegador. Nunca colocar service_role aqui.
(() => {
  const SUPABASE_URL = 'https://vcyneajmmwvvnefqompe.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fOe9mU2A_48YLPKq1NB6ZQ_Hg_GZaym';
  const pagina = location.pathname.split('/').pop() || 'index.html';
  const exigeGerente = ['gestao.html', 'vendas.html', 'admin-senhas.html'].includes(pagina);

  const estilo = document.createElement('style');
  estilo.textContent = `
    #pdv-auth-screen{position:fixed;inset:0;z-index:99999;background:rgba(12,25,14,.88);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Arial,sans-serif}
    #pdv-auth-card{background:#fff;width:min(420px,100%);padding:28px;border-radius:16px;box-shadow:0 15px 50px #0005}
    #pdv-auth-card h2{margin:0 0 8px;color:#246b2b}#pdv-auth-card p{color:#526052;line-height:1.45}
    #pdv-auth-card label{display:block;font-weight:600;margin:14px 0 6px}
    #pdv-auth-card input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ccd5cc;border-radius:8px;font-size:16px}
    #pdv-auth-card button{width:100%;padding:12px;margin-top:16px;border:0;border-radius:8px;background:#2e7d32;color:#fff;font-weight:700;font-size:16px;cursor:pointer}
    #pdv-auth-error{color:#b3261e;min-height:20px;font-size:14px}
    #pdv-auth-user{position:fixed;right:12px;top:12px;z-index:9998;background:#fff;padding:7px 10px;border-radius:8px;box-shadow:0 2px 8px #0002;font:12px Arial;display:flex;gap:8px;align-items:center}
    #pdv-auth-user button,#pdv-auth-user a{border:0;background:#e8f5e9;color:#205c25;border-radius:6px;padding:6px 9px;cursor:pointer;text-decoration:none}
  `;
  document.head.appendChild(estilo);

  const tela = document.createElement('div');
  tela.id = 'pdv-auth-screen';
  tela.innerHTML = `<section id="pdv-auth-card" role="dialog" aria-modal="true" aria-labelledby="pdv-auth-title">
    <h2 id="pdv-auth-title">🍉 HortiFruti PDV</h2>
    <p>Entre com seu e-mail e senha cadastrados no sistema.</p>
    <form id="pdv-auth-form">
      <label for="pdv-auth-email">E-mail</label>
      <input id="pdv-auth-email" type="email" autocomplete="username" required>
      <label for="pdv-auth-password">Senha</label>
      <input id="pdv-auth-password" type="password" autocomplete="current-password" required>
      <div id="pdv-auth-error" role="alert"></div>
      <button id="pdv-auth-submit" type="submit">Entrar no PDV</button>
    </form>
  </section>`;
  document.body.appendChild(tela);

  const erro = document.getElementById('pdv-auth-error');
  const submit = document.getElementById('pdv-auth-submit');
  let cliente;

  function mostrarErro(msg) { erro.textContent = msg; }
  function bloquear(msg) {
    tela.style.display = 'flex';
    mostrarErro(msg || 'Acesso não autorizado. Confira seu cadastro com o gerente.');
  }
  function liberar(user, papel) {
    tela.remove();
    const faixa = document.createElement('div');
    faixa.id = 'pdv-auth-user';
    const nome = document.createElement('span');
    nome.textContent = (user.email || 'Usuário') + ' · ' + papel;
    if (papel === 'gerente') {
      const senhas = document.createElement('a');
      senhas.href = 'admin-senhas.html';
      senhas.textContent = 'Senhas';
      faixa.appendChild(senhas);
    }
    const sair = document.createElement('button');
    sair.type = 'button'; sair.textContent = 'Sair';
    sair.addEventListener('click', async () => {
      sair.disabled = true;
      const { error } = await cliente.auth.signOut();
      if (error) { alert('Não foi possível sair: ' + error.message); sair.disabled = false; }
      else location.reload();
    });
    faixa.append(nome, sair);
    document.body.appendChild(faixa);
    window.pdvAuth = { user, papel, supabase: cliente };
  }
  async function validarAcesso(user) {
    const { data, error } = await cliente.from('perfis').select('papel').eq('id', user.id).maybeSingle();
    if (error) throw new Error('Não foi possível consultar seu perfil: ' + error.message);
    if (!data || !['gerente','operador'].includes(data.papel)) throw new Error('Seu usuário não possui um perfil válido. Peça ao gerente para cadastrá-lo.');
    if (exigeGerente && data.papel !== 'gerente') {
      location.replace('index.html');
      return false;
    }
    liberar(user, data.papel);
    return true;
  }

  async function iniciar() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      bloquear('Não foi possível carregar o serviço de autenticação. Verifique sua conexão e atualize a página.');
      return;
    }
    cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await cliente.auth.getSession();
    if (error) { mostrarErro('Erro ao verificar sessão: ' + error.message); return; }
    if (data.session) {
      try { await validarAcesso(data.session.user); }
      catch (e) { bloquear(e.message); }
    } else {
      document.getElementById('pdv-auth-email').focus();
    }
    document.getElementById('pdv-auth-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true; submit.textContent = 'Verificando...'; mostrarErro('');
      const email = document.getElementById('pdv-auth-email').value.trim();
      const password = document.getElementById('pdv-auth-password').value;
      const { data: login, error: loginError } = await cliente.auth.signInWithPassword({ email, password });
      if (loginError) {
        mostrarErro('E-mail ou senha inválidos. ' + loginError.message);
      } else {
        try { await validarAcesso(login.user); }
        catch (e) {
          await cliente.auth.signOut();
          mostrarErro(e.message);
        }
      }
      submit.disabled = false; submit.textContent = 'Entrar no PDV';
    });
  }
  iniciar().catch(e => bloquear(e.message || 'Falha ao iniciar autenticação.'));
})();
