import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const c = new Client({ name: "test", version: "1.0.0" });
const base = process.env.MCP_URL ?? "http://localhost:3000/api/mcp";
await c.connect(new StreamableHTTPClientTransport(new URL(base)));

const { tools } = await c.listTools();
console.log("TOOLS:", tools.map(t => t.name).join(", "));

const call = async (n, a) => {
  const r = await c.callTool({ name: n, arguments: a });
  console.log(`\n--- ${n} ---\n${r.content[0].text.slice(0, 500)}`);
};

await call("get_account_balance", { account: "ana.ribeiro@gta7.city" });
await call("search_transactions", { account: "ACC-1004", type: "recebimento_maquininha" });
await call("simulate_loan", { product: "LP-05", amount: 30000, months: 36 });
await call("send_pix", { from: "ACC-1001", to: "bruno.tavares@gta7.city", amount: 250, description: "Teste MCP" });
await call("send_pix", { from: "ACC-1003", to: "ACC-1001", amount: 999999 });
await c.close();
