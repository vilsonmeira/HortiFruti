# Configuração do comprovante automático por WhatsApp

O PDV chama a Edge Function `pdv-whatsapp-comprovante` depois que a venda é gravada. O envio só é tentado quando o operador marca a autorização do cliente na tela e existe um cliente aprovado com celular salvo.

## Credenciais no Supabase

No projeto HortiFruti, abra **Edge Functions → Secrets** e cadastre:

- `WHATSAPP_ACCESS_TOKEN`: token permanente/long-lived da Meta para o WhatsApp Business.
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número remetente no WhatsApp Manager.
- `WHATSAPP_GRAPH_VERSION`: versão Graph API ativa da sua aplicação Meta, no formato `vNN.N`.
- `WHATSAPP_TEMPLATE_NAME`: nome exato do modelo aprovado.
- `WHATSAPP_TEMPLATE_LANGUAGE`: idioma do modelo, normalmente `pt_BR`.

Nunca coloque o token no JavaScript, no GitHub ou em mensagens. Ele deve existir somente como secret no servidor.

## Modelo aprovado na Meta

Crie e envie para aprovação um modelo de mensagem de utilidade com nome, por exemplo, `comprovante_venda`, idioma `Português (Brasil)`, categoria **Utility**, e corpo com exatamente três variáveis:

```text
Olá {{1}}! Sua compra no HortiFruti foi finalizada.
Total: {{2}}.
Consulte seu comprovante: {{3}}
Obrigado pela preferência!
```

O código envia os parâmetros nesta ordem: nome do cliente, total formatado em reais e link HTTPS do comprovante online. Configure `WHATSAPP_TEMPLATE_NAME=comprovante_venda` se esse for o nome aprovado.

A Meta precisa aprovar o modelo antes do envio funcionar. O código usa template para permitir mensagens iniciadas pela loja fora da janela de atendimento de 24 horas.

## Comportamento

- O envio ocorre depois que a venda foi salva e o comprovante online foi concluído.
- O telefone é lido do cadastro aprovado do cliente, não de um número arbitrário enviado pelo navegador.
- O operador precisa marcar a autorização do cliente para aquela compra.
- Falha no WhatsApp não desfaz a venda nem bloqueia a impressão.
- O WhatsApp recebe um link HTTPS para o comprovante online; esta primeira versão não anexa um PDF.

## Teste recomendado

1. Configure os cinco secrets e confirme que o modelo está aprovado.
2. Atualize o PDV com a branch desta implementação.
3. Faça uma venda de teste com um cliente aprovado, celular com DDD e autorização marcada.
4. Confirme o recebimento no celular e verifique se o link abre o comprovante.
5. Faça outra venda sem marcar a autorização e confirme que nenhuma mensagem é enviada.
