# Integração do HortiFruti com Supabase

Esta etapa prepara o banco compartilhado para o catálogo público e os pedidos feitos pelo celular. O site continua hospedado gratuitamente no GitHub Pages; não exige Vercel.

## O que esta estrutura prepara

- Catálogo de produtos compartilhado entre PDV e celular.
- Lista de compras e envio de pedido sem obrigar o cliente a criar conta.
- Nome, telefone e observação opcionais.
- Preços calculados no banco usando o preço cadastrado, não o valor enviado pelo celular.
- Pedidos visíveis apenas para usuário administrador autenticado.
- Status do pedido: novo, em preparo, pronto, entregue ou cancelado.
- Não exige controle de estoque para aceitar pedido.

## 1. Criar o projeto

1. Acesse https://supabase.com e crie um projeto gratuito.
2. Abra **SQL Editor**.
3. Cole e execute o conteúdo de `supabase/schema.sql`.
4. Em **Project Settings → API**, copie a Project URL e a chave pública (publishable/anon).

A URL e a chave pública podem ser usadas no navegador. **Nunca coloque a chave `service_role` ou qualquer segredo administrativo em arquivos HTML/JS ou no GitHub.**

## 2. Configuração que falta

Ainda não conecte o PDV à produção: primeiro precisamos receber a URL e a chave pública do projeto Supabase e configurar autenticação administrativa. A chave pública sozinha não dá permissão para alterar o catálogo: as políticas exigem usuário autenticado com `app_metadata.role = admin`.

A função pública `create_customer_order` aceita pedidos sem login e calcula os valores no servidor com base no catálogo ativo. O público não tem permissão para consultar pedidos de outras pessoas.

## 3. Próxima etapa de desenvolvimento

1. Criar a tela `cliente.html` com busca, categorias, preços, lista de compras e envio.
2. Criar um adaptador de dados Supabase compartilhado.
3. Conectar o PDV para sincronizar cadastro e preço dos produtos com a tabela `products`.
4. Criar no PDV uma área para receber, consultar e atualizar pedidos.
5. Validar em ambiente de teste antes de publicar no GitHub Pages.

## Observação sobre o sistema atual

Hoje o PDV usa `localStorage`, que não sincroniza automaticamente entre computador e celular. Esta migration prepara as tabelas e as regras de acesso, mas não altera o fluxo atual de caixa nem afirma que a sincronização já está ativa.
