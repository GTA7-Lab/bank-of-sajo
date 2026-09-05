import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    id: "bank",
    name: "Bank of Sajo",
    description:
      "Banco da cidade GTA7 Lab: abertura de contas, saldos, transacoes (PIX, cartao, maquininha, cambio, acoes), financiamento de imovel e veiculo, e investimentos.",
    version: "0.4.0",
    entityType: "bank",
    mcp: { transport: "http", endpoint: "/api/mcp" },
    tools: [
      "get_account_balance",
      "search_transactions",
      "open_account",
      "send_pix",
      "pay_bill",
      "charge_customer",
      "issue_card",
      "list_services",
      "list_products",
      "simulate_loan",
      "request_loan",
      "invest",
      "create_customer",
      "get_customer",
      "list_customers",
      "update_customer",
      "delete_customer",
      "create_product",
      "update_product",
      "delete_product",
      "create_service",
      "update_service",
      "delete_service",
    ],
    endpoints: ["/api/accounts", "/api/transactions", "/api/manifest"],
  });
}
