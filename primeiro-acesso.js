(() => {
  const form = document.getElementById('pdv-first-setup');
  const button = document.getElementById('setup-submit');
  const msg = document.getElementById('setup-msg');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nome = document.getElementById('setup-name').value.trim();
    const cpf = document.getElementById('setup-cpf').value.replace(/\D/g, '');
    const senha = document.getElementById('setup-password').value;
    const confirmar = document.getElementById('setup-confirm').value;
    msg.textContent = '';

    if (senha !== confirmar) { msg.textContent = 'As senhas não coincidem.'; return; }
    if (senha.length < 10) { msg.textContent = 'A senha deve ter pelo menos 10 caracteres.'; return; }

    button.disabled = true;
    button.textContent = 'Configurando...';
    try {
      const response = await fetch('https://vcyneajmmwvvnefqompe.supabase.co/functions/v1/pdv-primeiro-gerente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'sb_publishable_fOe9mU2A_48YLPKq1NB6ZQ_Hg_GZaym'
        },
        body: JSON.stringify({ nome, cpf, senha })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar o gerente.');
      form.innerHTML = '<h2>Gerente master criado!</h2><p>O cadastro de Vilson Souza Meira foi concluído. Entre no PDV usando o CPF e a senha que acabou de criar.</p><a href="index.html">Ir para o login</a>';
    } catch (error) {
      msg.textContent = error.message || 'Falha ao configurar o primeiro acesso.';
      button.disabled = false;
      button.textContent = 'Criar gerente master';
    }
  });
})();