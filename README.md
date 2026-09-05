# Bank of Sajo — GTA7 Lab

Entidade **banco** da cidade digital GTA7 Lab. Consulta contas, saldos e transacoes bancarias
(PIX, cartao, maquininha, cambio, acoes), simula credito e expõe tudo via MCP.

Esta entidade vive na pasta `bank/` do repositorio da cidade.

## Rodar localmente

```bash
cd bank
npm install
npm run dev
```

- UI: http://localhost:3000
- Manifesto: http://localhost:3000/api/manifest
- Contas: http://localhost:3000/api/accounts (`?account=ACC-1001`)
- Transacoes: http://localhost:3000/api/transactions (`?type=pix_out&limit=5`)
- MCP (HTTP): http://localhost:3000/api/mcp

## MCP

Quatro tools: `get_account_balance`, `search_transactions`, `send_pix`, `simulate_loan`.
Detalhes de parametros em [CLAUDE.md](CLAUDE.md).

Testar as tools com o servidor rodando:

```bash
npm run test:mcp
```

Conectar no Claude Code (o repo ja traz `.mcp.json` apontando para localhost):

```bash
claude mcp add --transport http bank-of-sajo http://localhost:3000/api/mcp
```

## Dados

Sem banco de dados. Tudo em `data/bank.json`. O saldo e derivado do saldo de abertura mais
as transacoes. PIX enviado via MCP fica em memoria (o disco e somente leitura na Vercel).

## Deploy na Vercel

Projeto Next.js padrao — importar o repositorio na Vercel com **Root Directory = `bank`**
(sem variaveis de ambiente). O MCP fica em `https://<dominio>/api/mcp`.
