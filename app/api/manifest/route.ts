import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    id: "bank",
    name: "Bank of Sajo",
    description:
      "Banco da cidade GTA7 Lab: contas, saldos, transacoes (PIX, cartao, maquininha, cambio, acoes), credito e investimentos.",
    version: "0.1.0",
    entityType: "bank",
    mcp: { transport: "http", endpoint: "/api/mcp" },
    tools: ["get_account_balance", "search_transactions", "send_pix", "simulate_loan"],
    endpoints: ["/api/accounts", "/api/transactions", "/api/manifest"],
  });
}
