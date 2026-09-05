import raw from "@/data/bank.json";

export type Direction = "credit" | "debit";

export type Account = {
  id: string;
  customerId: string;
  type: string;
  pixKey: string;
  openingBalance: number;
  status: string;
  openedAt: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  date: string;
  direction: Direction;
  amount: number;
  type: string;
  channel: string;
  description: string;
  counterparty: string;
};

type BankData = Omit<typeof raw, "accounts" | "transactions"> & {
  accounts: Account[];
  transactions: Transaction[];
};

// Estado em memoria, iniciado a partir do JSON. Em serverless o disco e somente
// leitura, entao novas transacoes valem por instancia (suficiente para a demo).
const db: BankData = JSON.parse(JSON.stringify(raw)) as BankData;

export const bank = db.bank;
export const customers = db.customers;
export const loanProducts = db.loanProducts;
export const investmentProducts = db.investmentProducts;
export const stocks = db.stocks;
export const partners = db.partners;

const round = (n: number) => Math.round(n * 100) / 100;

export function listAccounts(): Account[] {
  return db.accounts;
}

export function findAccount(idOrPixKey: string): Account | undefined {
  const key = idOrPixKey.trim().toLowerCase();
  return db.accounts.find(
    (a) => a.id.toLowerCase() === key || a.pixKey.toLowerCase() === key
  );
}

export function customerOf(account: Account) {
  return db.customers.find((c) => c.id === account.customerId);
}

export function getBalance(accountId: string): number {
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  const moves = db.transactions
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => sum + (t.direction === "credit" ? t.amount : -t.amount), 0);
  return round(account.openingBalance + moves);
}

export type TransactionFilters = {
  account?: string;
  type?: string;
  direction?: Direction;
  minAmount?: number;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
};

export function searchTransactions(f: TransactionFilters = {}): Transaction[] {
  const account = f.account ? findAccount(f.account) : undefined;
  const term = f.search?.trim().toLowerCase();

  return db.transactions
    .filter((t) => {
      if (f.account && t.accountId !== account?.id) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.direction && t.direction !== f.direction) return false;
      if (f.minAmount != null && t.amount < f.minAmount) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (term) {
        const haystack = `${t.description} ${t.counterparty} ${t.type} ${t.channel}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, f.limit ?? 20);
}

export function accountStatement(idOrPixKey: string) {
  const account = findAccount(idOrPixKey);
  if (!account) return null;
  const customer = customerOf(account);
  return {
    account: {
      id: account.id,
      type: account.type,
      pixKey: account.pixKey,
      status: account.status,
      openedAt: account.openedAt,
    },
    customer: customer
      ? { id: customer.id, name: customer.name, segment: customer.segment, manager: customer.manager }
      : null,
    balance: getBalance(account.id),
    currency: bank.currency,
    lastTransactions: searchTransactions({ account: account.id, limit: 5 }),
  };
}

export type PixResult =
  | { ok: true; transactionId: string; from: string; to: string; amount: number; balanceAfter: number; date: string }
  | { ok: false; error: string };

export function sendPix(fromKey: string, toKey: string, amount: number, description = "PIX"): PixResult {
  const from = findAccount(fromKey);
  const to = findAccount(toKey);
  if (!from) return { ok: false, error: `Conta de origem nao encontrada: ${fromKey}` };
  if (!to) return { ok: false, error: `Chave de destino nao encontrada: ${toKey}` };
  if (from.id === to.id) return { ok: false, error: "Origem e destino sao a mesma conta" };
  if (!(amount > 0)) return { ok: false, error: "Valor deve ser maior que zero" };
  if (getBalance(from.id) < amount) return { ok: false, error: "Saldo insuficiente" };

  const date = new Date().toISOString();
  const seq = db.transactions.length + 1;
  const outId = `TRX-${String(seq).padStart(4, "0")}`;
  const inId = `TRX-${String(seq + 1).padStart(4, "0")}`;
  const value = round(amount);

  db.transactions.push(
    { id: outId, accountId: from.id, date, direction: "debit", amount: value, type: "pix_out", channel: "mcp", description, counterparty: to.id },
    { id: inId, accountId: to.id, date, direction: "credit", amount: value, type: "pix_in", channel: "mcp", description, counterparty: from.id }
  );

  return {
    ok: true,
    transactionId: outId,
    from: from.id,
    to: to.id,
    amount: value,
    balanceAfter: getBalance(from.id),
    date,
  };
}

export type LoanQuote =
  | { ok: true; product: string; amount: number; months: number; monthlyRate: number; installment: number; total: number; interest: number }
  | { ok: false; error: string };

export function simulateLoan(productId: string, amount: number, months: number): LoanQuote {
  const product = loanProducts.find(
    (p) => p.id.toLowerCase() === productId.trim().toLowerCase() || p.name.toLowerCase() === productId.trim().toLowerCase()
  );
  if (!product) return { ok: false, error: `Produto nao encontrado: ${productId}` };
  if (amount <= 0 || amount > product.maxAmount) return { ok: false, error: `Valor deve estar entre 1 e ${product.maxAmount}` };
  if (months < product.minMonths || months > product.maxMonths) {
    return { ok: false, error: `Prazo deve estar entre ${product.minMonths} e ${product.maxMonths} meses` };
  }

  const i = product.monthlyRate;
  const installment = (amount * i) / (1 - Math.pow(1 + i, -months));
  const total = installment * months;
  return {
    ok: true,
    product: product.name,
    amount: round(amount),
    months,
    monthlyRate: i,
    installment: round(installment),
    total: round(total),
    interest: round(total - amount),
  };
}
