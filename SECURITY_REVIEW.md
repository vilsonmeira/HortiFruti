# Revisão de segurança — HortiFruti PDV

Esta revisão acompanha a branch `fix/security-pdv-2026-10`. Nenhuma implantação foi executada.

## Correções propostas nesta branch

- Escapar dados editáveis antes de renderizá-los em templates HTML.
- Remover `document.write()` da impressão de cupons e etiquetas; cupons usam `textContent`.
- Validar saldo, quantidade, preço e total antes de finalizar uma venda.
- Não limpar o carrinho quando a gravação local falha; tentar reverter alterações no armazenamento.
- Neutralizar campos de texto potencialmente interpretados como fórmulas em CSV e citar corretamente os campos.
- Validar entradas de produtos e movimentações na tela de gestão.
- Adicionar cabeçalhos HTTP básicos de segurança por `vercel.json`.

## Limitações importantes ainda abertas

1. **O `localStorage` não é um banco de dados confiável para um PDV comercial.** Usuários com acesso ao navegador podem alterar ou apagar dados; os dados não sincronizam entre dispositivos e não há backup central.
2. **Não há autenticação/autorização no código estático examinado.** Esconder ou acessar `gestao.html` não protege os dados.
3. **A baixa de estoque e a gravação de venda não são transacionais no servidor.** O cliente não consegue impedir de forma confiável vendas concorrentes nem adulteração local.
4. **CSP forte ainda depende de refatoração.** A página de gestão usa script e manipuladores de eventos inline; habilitar CSP sem removê-los pode quebrar a aplicação.
5. **Os cabeçalhos de `vercel.json` precisam ser verificados após uma implantação de teste.**

Para fechar esses riscos, é necessário migrar para API/backend com autenticação, autorização por função, banco de dados transacional, validação no servidor, backups testados e trilha de auditoria. Não armazenar credenciais ou segredos no frontend.

## Checklist de testes manuais

- Cadastrar nomes com aspas, `<`, `>` e cadeias que se pareçam com tags HTML; confirmar que são exibidos como texto.
- Reimprimir cupons com conteúdo especial e verificar que nada é executado como HTML.
- Tentar vender acima do estoque; a venda deve ser recusada sem modificar estoque/histórico.
- Simular armazenamento indisponível; confirmar que a venda não é apresentada como salva e que o carrinho permanece.
- Exportar CSV com campos começando por `=`, `+`, `-` e `@`; abrir em uma planilha e confirmar que não são executados como fórmulas.
- Conferir impressão de etiquetas, filtros, criação/edição/exclusão de produtos e movimentações de estoque.
- Validar os cabeçalhos HTTP e o funcionamento do site num deployment de preview, sem publicar em produção.

## Status de validação

As alterações foram preparadas por inspeção estática. Não foram executados testes automatizados, testes de navegador, análise dinâmica, build da Vercel nem teste de implantação nesta revisão.
