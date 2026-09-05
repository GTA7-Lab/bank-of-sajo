# Bank of Sajo

Entidade **banco** da cidade GTA7 Lab. Guarda as contas e o histórico de transações da
cidade — PIX, cartão, maquininha de comerciante, empréstimo, câmbio e ações — e expõe
consulta de saldo, busca de transações, PIX e simulação de crédito como **MCP tools**.

Pasta: `entities/bank`. Projeto Next.js independente, sem banco de dados.

## Rodar localmente

```bash
cd entities/bank
npm install
npm run dev
```

| | |
|---|---|
| UI | http://localhost:3000 |
| Manifesto | `GET /api/manifest` |
| Contas | `GET /api/accounts` · `?account=ACC-1001` (ou chave PIX) |
| Transações | `GET /api/transactions` · `?type=pix_out&limit=5` |
| MCP | `POST /api/mcp` (streamable HTTP) |

## MCP tools

| tool | parâmetros | retorno |
|---|---|---|
| `get_account_balance` | `account` — ID da conta ou chave PIX | conta, titular, saldo e as 5 últimas transações |
| `search_transactions` | `account?`, `type?`, `direction?`, `minAmount?`, `from?`, `to?`, `search?`, `limit?` | `{count, currency, transactions[]}` |
| `send_pix` | `from`, `to`, `amount`, `description?` | `{ok, transactionId, balanceAfter}` ou `{ok:false, error}` |
| `simulate_loan` | `product`, `amount`, `months` | parcela, total e juros pela tabela Price |

Testar as quatro contra um servidor rodando:

```bash
npm run test:mcp                                          # localhost:3000
MCP_URL=https://<dominio>/api/mcp npm run test:mcp         # deploy
```

Conectar no Claude Code (a pasta já traz `.mcp.json` apontando para localhost):

```bash
claude mcp add --transport http bank-of-sajo http://localhost:3000/api/mcp
```

## Dados

Tudo em [`data/bank.json`](data/bank.json): clientes, contas, transações, cartões,
produtos de crédito e investimento, ações e parceiros da cidade.

O JSON **não guarda saldo**. Ele é derivado — `openingBalance` + créditos − débitos — em
`getBalance()`, então saldo e extrato nunca divergem, inclusive depois de um `send_pix`.

Transações escritas por `send_pix` ficam **em memória**: o disco é somente leitura em
serverless, então elas se perdem quando a instância recicla. Suficiente para a demo, e é o
primeiro ponto a trocar quando a cidade precisar de persistência real.

## Integração com o Core

A entidade se descreve em [`manifest.json`](manifest.json) (id, nome, transporte, tools) e
serve o mesmo conteúdo em `GET /api/manifest`.

Vale um aviso para quem for registrar no Core: as tags do léxico hoje são de passeio
(`food`, `music`, `movie`, `event`, `lodging`, `transport`, `activity`) e nenhuma cobre
serviço bancário. Registrar o banco pede uma tag nova — `finance`, por exemplo — com as
palavras-chave dela em `core/src/lexicon.ts`. As tools daqui também não são de busca por
lugar: respondem sobre uma conta ou simulam um valor, então entram no Core como consulta
direta, não nas combinações entre entidades.

## Deploy

Projeto Next.js padrão, sem variáveis de ambiente. Na Vercel, **Root Directory =
`entities/bank`**. O MCP fica em `https://<dominio>/api/mcp`.

## Arquivos

```
data/bank.json           dados da entidade
lib/bank.ts              consultas, saldo derivado, PIX e simulação de crédito
app/api/mcp/route.ts     servidor MCP (mcp-handler)
app/api/*/route.ts       REST: accounts, transactions, manifest
app/page.tsx             UI: contas e extrato filtrável
scripts/test-mcp.mjs     cliente de teste das tools
```
