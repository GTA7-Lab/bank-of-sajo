import { NextResponse } from "next/server";
import { accountStatement, getBalance, listAccounts, customerOf } from "@/lib/bank";

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
