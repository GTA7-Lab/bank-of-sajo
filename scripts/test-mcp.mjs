import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = process.env.MCP_URL ?? "http://localhost:3000/api/mcp";
const c = new Client({ name: "test", version: "1.0.0" });
await c.connect(new StreamableHTTPClientTransport(new URL(base)));

const { tools } = await c.listTools();
console.log("TOOLS:", tools.map((t) => t.name).join(", "));

const call = async (n, a = {}) => {
  const r = await c.callTool({ name: n, arguments: a });
  const dados = r.structuredContent ? "sim" : "NAO";
  console.log(`\n--- ${n} (dados p/ o Core: ${dados}) ---\n${r.content[0].text}`);
};

await call("get_account_balance", { account: "ana.ribeiro@gta7.city" });
await call("search_transactions", { account: "ACC-1004", type: "recebimento_maquininha" });
await call("open_account", { name: "Maria Fontes", type: "corrente", initialDeposit: 500, district: "Jardim Sul" });
await call("list_products");
await call("simulate_loan", { product: "Financiamento imobiliario", amount: 400000, months: 240 });
await call("request_loan", { account: "ACC-1001", product: "Financiamento de veiculo", amount: 60000, months: 48 });
await call("invest", { account: "ACC-1002", product: "CDB Premium 130%", amount: 100000 });
await call("send_pix", { from: "ACC-1001", to: "bruno.tavares@gta7.city", amount: 250, description: "Teste" });
await call("send_pix", { from: "ACC-1003", to: "ACC-1001", amount: 999999 });
await call("get_account_balance", { account: "conta-que-nao-existe" });
await call("list_services", { category: "cartoes" });
await call("issue_card", { account: "ACC-1001", kind: "credito" });
await call("pay_bill", { account: "ACC-1001", payee: "GTA7 Energia", amount: 132.4, description: "Conta de luz" });
await call("create_customer", { name: "Joao Pereira", type: "pessoa", district: "Vila Norte" });
await call("get_customer", { customer: "Joao Pereira" });
await call("update_customer", { customer: "Joao Pereira", district: "Centro", segment: "premium" });
await call("list_customers", { search: "Centro", limit: 5 });
await call("delete_customer", { customer: "Joao Pereira" });
await call("delete_customer", { customer: "Ana Ribeiro" });
console.log("\n=== catalogo restrito ===");
await call("create_product", { kind: "loan", name: "Credito estudantil", monthlyRate: 0.008, minMonths: 12, maxMonths: 60, maxAmount: 40000 });
await call("create_product", { magicWord: "errada", kind: "loan", name: "Credito estudantil", monthlyRate: 0.008, minMonths: 12, maxMonths: 60, maxAmount: 40000 });
await call("create_product", { magicWord: "abre-te-sajo", kind: "loan", name: "Credito estudantil", monthlyRate: 0.008, minMonths: 12, maxMonths: 60, maxAmount: 40000 });
await call("update_product", { magicWord: "abre-te-sajo", kind: "loan", product: "Credito estudantil", monthlyRate: 0.006 });
await call("delete_product", { magicWord: "abre-te-sajo", kind: "loan", product: "Credito estudantil" });
await call("create_service", { magicWord: "abre-te-sajo", name: "Seguro residencial", category: "seguranca", description: "Protege a casa do cliente contra incendio e roubo." });
await call("update_service", { magicWord: "abre-te-sajo", service: "Seguro residencial", description: "Protege a casa contra incendio, roubo e danos eletricos." });
await call("delete_service", { service: "Seguro residencial" });
await call("delete_service", { magicWord: "abre-te-sajo", service: "Seguro residencial" });
