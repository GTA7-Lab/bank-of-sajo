import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  accountStatement,
  bank,
  searchTransactions,
  sendPix,
  simulateLoan,
} from "@/lib/bank";

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_account_balance",
      "Consulta saldo, dados do titular e ultimas transacoes de uma conta do Bank of Sajo. Aceita o ID da conta (ACC-1001) ou a chave PIX.",
      { account: z.string().describe("ID da conta ou chave PIX") },
      async ({ account }) => {
        const statement = accountStatement(account);
        return json(statement ?? { error: `Conta nao encontrada: ${account}` });
      }
    );

    server.tool(
      "search_transactions",
      "Busca transacoes bancarias da cidade com filtros opcionais de conta, tipo, valor, periodo e texto livre.",
      {
        account: z.string().optional().describe("ID da conta ou chave PIX"),
        type: z.string().optional().describe("Tipo: pix_in, pix_out, deposito, saque, pagamento, compra_cartao, recebimento_maquininha, emprestimo, investimento, cambio, acoes_compra, acoes_venda"),
        direction: z.enum(["credit", "debit"]).optional(),
        minAmount: z.number().optional(),
        from: z.string().optional().describe("Data inicial ISO, ex 2026-08-01"),
        to: z.string().optional().describe("Data final ISO"),
        search: z.string().optional().describe("Texto na descricao ou contraparte"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      async (filters) => {
        const results = searchTransactions(filters);
        return json({ count: results.length, currency: bank.currency, transactions: results });
      }
    );

    server.tool(
      "send_pix",
      "Executa um PIX entre contas do Bank of Sajo. Valida saldo e registra as duas pernas da transacao.",
      {
        from: z.string().describe("Conta de origem (ID ou chave PIX)"),
        to: z.string().describe("Conta de destino (ID ou chave PIX)"),
        amount: z.number().positive().describe("Valor em BRL"),
        description: z.string().optional(),
      },
      async ({ from, to, amount, description }) => json(sendPix(from, to, amount, description)),
    );

    server.tool(
      "simulate_loan",
      "Simula credito ou financiamento do Bank of Sajo (tabela Price) e retorna parcela, total e juros.",
      {
        product: z.string().describe("ID ou nome do produto, ex LP-01 ou 'Credito pessoal'"),
        amount: z.number().positive().describe("Valor solicitado em BRL"),
        months: z.number().int().positive().describe("Prazo em meses"),
      },
      async ({ product, amount, months }) => json(simulateLoan(product, amount, months)),
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };

export const dynamic = "force-dynamic";
