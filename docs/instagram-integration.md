# Instagram — Hortifruti Jardim Celeste

## Scaffold criado
- Webhook Meta com desafio GET e validação HMAC SHA-256 do POST.
- Endpoint administrativo para enviar Direct, responder comentários e publicar imagem.
- Tabelas com RLS para conversas, mensagens, eventos, comentários e publicações.
- Nenhum token fica no navegador ou no Git.

## Pré-requisitos
1. Instagram profissional (Empresa ou Criador) da loja.
2. App no Meta for Developers e autorização da conta.
3. Permissões do fluxo Instagram Login: instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments e instagram_business_content_publish, conforme produto/fluxo habilitado.
4. App Review/Advanced Access quando exigido para clientes externos.
5. Para Direct, o cliente deve iniciar a conversa; não é permitido iniciar mensagens frias.

## Configuração Supabase
Execute supabase/instagram-integration.sql no SQL Editor. Configure em Edge Functions > Secrets:
- META_APP_SECRET
- META_WEBHOOK_VERIFY_TOKEN (string aleatória forte)
- META_ACCESS_TOKEN
- META_IG_USER_ID
- META_GRAPH_API_VERSION (versão aprovada no app Meta)
- META_GRAPH_BASE_URL (base do fluxo de login selecionado)

Publique instagram-webhook com JWT desativado: a função valida desafio e assinatura HMAC.
Publique instagram-api com JWT ativado: valida sessão Supabase e perfil gerente.

Webhook URL:
https://vcyneajmmwvvnefqompe.supabase.co/functions/v1/instagram-webhook

No painel Meta, configure o Verify Token igual ao secret e assine os campos de mensagens/comentários disponíveis para o produto selecionado.

## Endpoint instagram-api
POST autenticado por usuário gerente:
- {"action":"send_message","recipient_id":"IG_SCOPED_ID","message":"Olá!"}
- {"action":"reply_comment","comment_id":"COMMENT_ID","message":"Obrigado pelo comentário!"}
- {"action":"publish_image","image_url":"https://...","caption":"Oferta do dia!"}

## Limitações desta etapa
O webhook armazena eventos brutos com deduplicação. A camada de processamento para preencher a caixa de entrada e a IA Jéssica, o painel visual, publicação de Reels/carrossel e agendamento ainda precisam ser concluídos e testados. Publicação de imagem está prevista no endpoint, mas depende de URL HTTPS pública e permissões Meta válidas. Não ative respostas automáticas para clientes reais antes de testar e definir transferência para atendente humano.

Nunca compartilhe tokens, App Secret ou códigos de login no chat.