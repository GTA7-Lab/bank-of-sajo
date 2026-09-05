import { NextResponse } from "next/server";
import { searchTransactions, type Direction } from "@/lib/bank";

export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const num = (key: string) => (q.get(key) ? Number(q.get(key)) : undefined);
  const transactions = searchTransactions({
    account: q.get("account") ?? undefined,
    type: q.get("type") ?? undefined,
    direction: (q.get("direction") as Direction) ?? undefined,
    minAmount: num("minAmount"),
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    search: q.get("search") ?? undefined,
    limit: num("limit"),
  });
  return NextResponse.json({ count: transactions.length, transactions });
}
