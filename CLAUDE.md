# Bank of Sajo — entidade GTA7 Lab

**Entidade:** `bank` — o banco da cidade GTA7 Lab.
**Objetivo:** expor contas, saldos, transacoes bancarias, credito e investimentos da cidade, via web e via MCP.

## Stack
Next.js 15 (App Router) + TypeScript. Sem banco de dados: dados em `data/bank.json`.
Repositorio proprio: github.com/GTA7-Lab/bank-of-sajo (a entidade e a raiz do repo).
Na Vercel, Root Directory = raiz. Faz parte da cidade github.com/GTA7-Lab/gta7-lab,
que a consome pelo endpoint MCP publicado — nao pelo codigo.

## Estrutura do JSON (`data/bank.json`)
- `bank` — dados institucionais (nome, moeda, agencia, tarifas).
- `customers[]` — `id, name, type (pessoa|empresa), segment, district, manager, since`.
- `accounts[]` — `id, customerId, type (corrente|poupanca|empresarial), pixKey, openingBalance, status, openedAt`.
- `transactions[]` — `id, accountId, date (ISO), direction (credit|debit), amount, type, channel, description, counterparty`.
- `cards[]`, `loanProducts[]`, `investmentProducts[]`, `stocks[]`, `partners[]`.

**Regra de saldo:** saldo = `openingBalance` + creditos − debitos das transacoes. O JSON nao guarda saldo; ele e sempre derivado (`getBalance`).

## MCP tools (`app/api/mcp/route.ts`, endpoint `/api/mcp`, transporte HTTP)
22 tools. Clientes (CRUD): `create_customer`, `get_customer`, `list_customers`,
`update_customer`, `delete_customer`. Contas e dinheiro: `open_account`,
`get_account_balance`, `search_transactions`, `send_pix`, `pay_bill`, `issue_card`.
Produtos: `list_services`, `list_products`, `simulate_loan`, `request_loan`, `invest`.
Catalogo (restrito): `create_product`, `update_product`, `delete_product`,
`create_service`, `update_service`, `delete_service` — exigem o parametro `magicWord`,
que vale `BANK_MAGIC_WORD` (padrao `abre-te-sajo`). O parametro e opcional no schema de
proposito: assim a recusa e uma frase amigavel, e nao um erro de validacao do Zod.
Nao e autenticacao — o endpoint e publico; e uma trava contra mudanca acidental.
Parametros de cada uma no proprio `route.ts` e em `manifest.json`.

**Regra de resposta:** o texto do MCP e escrito para gente — conversa, sem jargao, valores
em R$ e datas em dd/mm/aaaa. Os dados estruturados vao em `structuredContent`, que e o que
o Core le primeiro (`client.ts` so faz JSON.parse do texto se structuredContent faltar).
Helper `reply(texto, dados)` no topo do route garante os dois lados.

## Arquivos principais
- `lib/bank.ts` — carga do JSON, consultas, PIX e simulacao de credito.
- `app/api/mcp/route.ts` — MCP server (mcp-handler).
- `app/api/{accounts,transactions,manifest}/route.ts` — REST + manifesto do Core.
- `app/page.tsx` — UI: contas com saldo e busca de transacoes.
- `scripts/test-mcp.mjs` — cliente de teste das tools (`npm run test:mcp`).
- `manifest.json` — manifesto estatico da entidade para o Core (mesmo conteudo de `/api/manifest`).

## Decisoes relevantes
- Escritas (`send_pix`) ficam em memoria: o disco e somente leitura na Vercel. Reinicio da instancia volta ao JSON original — aceitavel na v1.
- Saldo derivado das transacoes evita inconsistencia entre saldo e extrato.
- `delete_customer` recusa encerrar cadastro com saldo em conta, e apaga as transacoes das
  contas encerradas para nao deixar registro orfao.
- `create_customer` cria so o cadastro; `open_account` cria cadastro + conta. Cliente sem
  conta e um estado valido.
- Datas formatadas a partir do texto ISO, sem passar por `Date`, para o fuso do servidor
  nao empurrar um registro de hoje para ontem.
- Sem auth, sem banco, sem Docker (limitacoes acordadas da v1).

## Status
v1 completa e no ar: https://gta7-lab-bank-tbone3.vercel.app (projeto Vercel
`gta7-lab-bank`, sem protecao). As 4 MCP tools foram testadas contra essa URL.
Registrada no Core sob a tag `finance`; pedido "ver o extrato de pix da cidade" percorre
Core -> bank e volta com transacoes.

## Deploy
Deploy continuo ligado: o projeto Vercel `gta7-lab-bank` (time tbone3) esta conectado a
este repo, entao todo push no `main` publica em https://gta7-lab-bank-tbone3.vercel.app.
Root Directory = raiz. O repo e publico porque o plano Hobby da Vercel nao conecta repo
privado de organizacao.
