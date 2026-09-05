import { bank, customerOf, getBalance, listAccounts, searchTransactions } from "@/lib/bank";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const card = { background: "#131c2e", border: "1px solid #22304a", borderRadius: 10, padding: "0.9rem 1rem" };
const cell = { padding: "0.45rem 0.6rem", borderBottom: "1px solid #22304a", textAlign: "left" as const };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; search?: string }>;
}) {
  const { account, search } = await searchParams;
  const accounts = listAccounts();
  const transactions = searchTransactions({ account, search, limit: 15 });

  return (
    <>
      <h1 style={{ marginBottom: 0 }}>{bank.name}</h1>
      <p style={{ color: "#8fa3c4", marginTop: 4 }}>
        {bank.slogan} · {bank.branch} · {bank.fees} · suporte {bank.support}
      </p>

      <h2 style={{ fontSize: "1.05rem" }}>Contas</h2>
      <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {accounts.map((a) => (
          <div key={a.id} style={card}>
            <strong>{customerOf(a)?.name}</strong>
            <div style={{ color: "#8fa3c4", fontSize: "0.85rem" }}>
              {a.id} · {a.type} · {a.pixKey}
            </div>
            <div style={{ fontSize: "1.2rem", marginTop: 6 }}>{brl(getBalance(a.id))}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>Transacoes</h2>
      <form style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <input name="account" defaultValue={account ?? ""} placeholder="Conta ou chave PIX" style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #22304a", background: "#0b1220", color: "#e6edf7" }} />
        <input name="search" defaultValue={search ?? ""} placeholder="Buscar descricao" style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #22304a", background: "#0b1220", color: "#e6edf7" }} />
        <button type="submit" style={{ padding: "0.45rem 1rem", borderRadius: 6, border: 0, background: "#3b82f6", color: "#fff", cursor: "pointer" }}>
          Filtrar
        </button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ color: "#8fa3c4" }}>
            <th style={cell}>Data</th>
            <th style={cell}>Conta</th>
            <th style={cell}>Descricao</th>
            <th style={cell}>Tipo</th>
            <th style={{ ...cell, textAlign: "right" }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td style={cell}>{t.date.slice(0, 10)}</td>
              <td style={cell}>{t.accountId}</td>
              <td style={cell}>
                {t.description}
                <div style={{ color: "#8fa3c4", fontSize: "0.78rem" }}>{t.counterparty}</div>
              </td>
              <td style={cell}>{t.type}</td>
              <td style={{ ...cell, textAlign: "right", color: t.direction === "credit" ? "#4ade80" : "#f87171" }}>
                {t.direction === "credit" ? "+" : "-"}
                {brl(t.amount)}
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td style={cell} colSpan={5}>
                Nenhuma transacao encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p style={{ color: "#8fa3c4", fontSize: "0.85rem", marginTop: "1.5rem" }}>
        MCP: <code>/api/mcp</code> · Manifesto: <code>/api/manifest</code> · API:{" "}
        <code>/api/accounts</code>, <code>/api/transactions</code>
      </p>
    </>
  );
}
