# Bank of Sajo — entidade GTA7 Lab

**Entidade:** `bank` — o banco da cidade GTA7 Lab.
**Objetivo:** expor contas, saldos, transacoes bancarias, credito e investimentos da cidade, via web e via MCP.

## Stack
Next.js 15 (App Router) + TypeScript. Sem banco de dados: dados em `data/bank.json`.
A entidade vive em `entities/bank/` no repo da cidade (github.com/ericmgomes/gta7-lab).
Na Vercel, Root Directory = `entities/bank`.

## Estrutura do JSON (`data/bank.json`)
- `bank` — dados institucionais (nome, moeda, agencia, tarifas).
- `customers[]` — `id, name, type (pessoa|empresa), segment, district, manager, since`.
- `accounts[]` — `id, customerId, type (corrente|poupanca|empresarial), pixKey, openingBalance, status, openedAt`.
- `transactions[]` — `id, accountId, date (ISO), direction (credit|debit), amount, type, channel, description, counterparty`.
- `cards[]`, `loanProducts[]`, `investmentProducts[]`, `stocks[]`, `partners[]`.

**Regra de saldo:** saldo = `openingBalance` + creditos − debitos das transacoes. O JSON nao guarda saldo; ele e sempre derivado (`getBalance`).

## MCP tools (`app/api/mcp/route.ts`, endpoint `/api/mcp`, transporte HTTP)
| tool | parametros | retorno |
|---|---|---|
| `get_account_balance` | `account` (ID ou chave PIX) | conta, titular, saldo, 5 ultimas transacoes |
| `search_transactions` | `account?, type?, direction?, minAmount?, from?, to?, search?, limit?` | `{count, currency, transactions[]}` |
| `send_pix` | `from, to, amount, description?` | `{ok, transactionId, balanceAfter}` ou `{ok:false, error}` |
| `simulate_loan` | `product, amount, months` | parcela, total e juros (tabela Price) |

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
- Sem auth, sem banco, sem Docker (limitacoes acordadas da v1).

## Status
v1 completa: build ok, REST ok, 4 MCP tools testadas via HTTP (local). Merged no monorepo.
Publicada na Vercel: projeto `gta7-lab-bank`, producao em
https://gta7-lab-bank-tbone3.vercel.app — pendencias: Vercel Authentication ainda ativa
(302 -> SSO) e deploy continuo por Git parado na falta de Login Connection do GitHub na
conta Vercel.

## Proxima tarefa
1. Desativar Vercel Authentication em Settings > Deployment Protection (senao o Core nao acessa).
2. Registrar a entidade no Core: precisa de uma tag nova (`finance`) em
   `core/src/lexicon.ts`, pois as tags atuais sao de passeio e nenhuma cobre banco.
