import { bank, listProducts, listServices } from "@/lib/bank";

// Esta pagina e institucional de proposito: nao mostra conta, saldo, cliente nem
// transacao. Os dados da entidade so saem pelas MCP tools, nunca por HTTP direto.
const card = { background: "#131c2e", border: "1px solid #22304a", borderRadius: 10, padding: "0.9rem 1rem" };

const TOOLS: [string, string][] = [
  ["create_customer", "cadastra pessoa ou empresa"],
  ["get_customer", "dados do cliente e as contas dele"],
  ["list_customers", "lista por nome, bairro ou perfil"],
  ["update_customer", "muda nome, bairro, perfil ou gerente"],
  ["delete_customer", "encerra o cadastro, se as contas estiverem zeradas"],
  ["open_account", "abre conta corrente, poupança, empresarial ou de investimento"],
  ["get_account_balance", "saldo, titular e últimas movimentações"],
  ["search_transactions", "busca por conta, tipo, valor, período ou descrição"],
  ["send_pix", "PIX entre contas, conferindo o saldo"],
  ["pay_bill", "paga contas e boletos"],
  ["charge_customer", "maquininha: o comércio cobra por PIX, débito ou crédito"],
  ["issue_card", "emite cartão de débito ou crédito"],
  ["list_services", "os serviços do banco, por categoria"],
  ["list_products", "linhas de crédito e opções de investimento"],
  ["simulate_loan", "simula a parcela, sem contratar"],
  ["request_loan", "contrata imóvel, veículo, solar, pessoal ou capital de giro"],
  ["invest", "aplica em poupança, CDB, fundo de ações ou FIDC"],
];

export default function Home() {
  const { loans, investments } = listProducts();
  const categorias = [...new Set(listServices().map((s) => s.category))];

  return (
    <>
      <h1 style={{ marginBottom: 0 }}>{bank.name}</h1>
      <p style={{ color: "#8fa3c4", marginTop: 4 }}>
        {bank.slogan} · {bank.branch} · {bank.fees} · suporte {bank.support}
      </p>

      <div style={{ ...card, borderColor: "#3b82f6" }}>
        <strong>Este banco atende por MCP.</strong>
        <p style={{ color: "#8fa3c4", margin: "0.5rem 0 0" }}>
          Contas, saldos, clientes e transações não são servidos por esta página nem por
          endpoints HTTP: saem apenas pelas tools abaixo, com as regras do banco aplicadas.
        </p>
        <pre style={{ background: "#0b1220", padding: "0.7rem", borderRadius: 6, overflowX: "auto", marginBottom: 0 }}>
          <code>claude mcp add --transport http bank-of-sajo https://gta7-lab-bank-tbone3.vercel.app/api/mcp</code>
        </pre>
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>{TOOLS.length} tools de uso público</h2>
      <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {TOOLS.map(([nome, oQueFaz]) => (
          <div key={nome} style={card}>
            <code style={{ color: "#4ade80" }}>{nome}</code>
            <div style={{ color: "#8fa3c4", fontSize: "0.85rem", marginTop: 4 }}>{oQueFaz}</div>
          </div>
        ))}
      </div>
      <p style={{ color: "#8fa3c4", fontSize: "0.85rem" }}>
        Outras seis tools administram o catálogo de produtos e serviços e exigem a palavra
        mágica da equipe do banco.
      </p>

      <h2 style={{ fontSize: "1.05rem" }}>O que o banco oferece</h2>
      <div style={card}>
        <div style={{ marginBottom: "0.6rem" }}>
          <strong>Serviços</strong>
          <div style={{ color: "#8fa3c4", fontSize: "0.9rem" }}>{categorias.join(" · ")}</div>
        </div>
        <div style={{ marginBottom: "0.6rem" }}>
          <strong>Crédito</strong>
          <div style={{ color: "#8fa3c4", fontSize: "0.9rem" }}>{loans.map((p) => p.name).join(" · ")}</div>
        </div>
        <div>
          <strong>Investimentos</strong>
          <div style={{ color: "#8fa3c4", fontSize: "0.9rem" }}>{investments.map((p) => p.name).join(" · ")}</div>
        </div>
      </div>

      <p style={{ color: "#8fa3c4", fontSize: "0.85rem", marginTop: "1.5rem" }}>
        MCP: <code>/api/mcp</code> · Manifesto da entidade: <code>/api/manifest</code>
      </p>
    </>
  );
}
