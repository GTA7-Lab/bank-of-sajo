import { NextResponse } from "next/server";
import { accountStatement, getBalance, listAccounts, customerOf, openAccount } from "@/lib/bank";

export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("account");
  if (id) {
    const statement = accountStatement(id);
    if (!statement) return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 });
    return NextResponse.json(statement);
  }
  const accounts = listAccounts().map((a) => ({
    ...a,
    customer: customerOf(a)?.name ?? null,
    balance: getBalance(a.id),
  }));
  return NextResponse.json({ count: accounts.length, accounts });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Envie os dados da conta em JSON." }, { status: 400 });
  }
  const { name, type, initialDeposit, district, pixKey } = (body ?? {}) as Record<string, never>;
  const result = openAccount({ name, type, initialDeposit, district, pixKey });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
