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

// O Core manda a frase inteira do pedido como termo de busca ("ver o extrato de
// pix da cidade"), entao alem da expressao completa aceitamos qualquer palavra
// relevante dela. As palavras de ligacao ficam de fora para nao casar tudo.
const STOPWORDS = new Set([
  "para", "por", "com", "sem", "meu", "meus", "minha", "minhas", "quero", "ver",
  "mostre", "mostrar", "todas", "todos", "ultimas", "ultimos", "últimas", "últimos",
  "the", "my", "show", "list",
]);

function matchesTerm(haystack: string, term: string): boolean {
  if (haystack.includes(term)) return true;
  return term
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .some((w) => haystack.includes(w));
}

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
        if (!matchesTerm(haystack, term)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, f.limit ?? 20);
}

export function accountStatement(idOrPixKey: string) {
  const account = resolveAccount(idOrPixKey);
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
  const from = resolveAccount(fromKey);
  const to = resolveAccount(toKey);
  if (!from) return { ok: false, error: `Não encontrei a conta de origem "${fromKey}".` };
  if (!to) return { ok: false, error: `Não encontrei ninguém com a chave "${toKey}".` };
  if (from.id === to.id) return { ok: false, error: "A conta de origem e a de destino são a mesma." };
  if (!(amount > 0)) return { ok: false, error: "O valor precisa ser maior que zero." };
  if (getBalance(from.id) < amount) return { ok: false, error: "O saldo disponível não cobre esse valor." };

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
  if (!product) return { ok: false, error: `Não temos um produto chamado "${productId}".` };
  if (amount <= 0 || amount > product.maxAmount) return { ok: false, error: `Para o ${product.name} o valor vai de R$ 1 até R$ ${product.maxAmount.toLocaleString("pt-BR")}.` };
  if (months < product.minMonths || months > product.maxMonths) {
    return { ok: false, error: `O prazo do ${product.name} vai de ${product.minMonths} a ${product.maxMonths} meses.` };
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

export type OpenAccountInput = {
  name: string;
  type?: string;
  pixKey?: string;
  initialDeposit?: number;
  district?: string;
};

export type OpenAccountResult =
  | {
      ok: true;
      accountId: string;
      customerId: string;
      name: string;
      accountType: string;
      pixKey: string;
      manager: string;
      balance: number;
      openedAt: string;
    }
  | { ok: false; error: string };

const ACCOUNT_TYPES = ["corrente", "poupanca", "empresarial", "investimento"];

function nextId(prefix: string, existing: string[], width: number): string {
  const max = existing.reduce((m, id) => {
    const n = Number(id.split("-")[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

function pixKeyFrom(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  const base = `${slug || "cliente"}@gta7.city`;
  if (!findAccount(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${slug}.${i}@gta7.city`;
    if (!findAccount(candidate)) return candidate;
  }
}

export function openAccount(input: OpenAccountInput): OpenAccountResult {
  const name = input.name?.trim();
  if (!name || name.length < 2) return { ok: false, error: "Preciso do nome do titular para abrir a conta." };

  const type = (input.type ?? "corrente").trim().toLowerCase();
  if (!ACCOUNT_TYPES.includes(type)) {
    return { ok: false, error: `Não trabalhamos com conta "${input.type}". Temos corrente, poupança, empresarial e investimento.` };
  }

  const deposit = input.initialDeposit ?? 0;
  if (deposit < 0) return { ok: false, error: "O depósito inicial não pode ser negativo." };

  const pixKey = input.pixKey?.trim() || pixKeyFrom(name);
  if (input.pixKey && findAccount(pixKey)) {
    return { ok: false, error: `A chave PIX ${pixKey} já pertence a outra conta.` };
  }

  const isCompany = type === "empresarial";
  const customerId = nextId("CUS", db.customers.map((c) => c.id), 3);
  const accountId = nextId("ACC", db.accounts.map((a) => a.id), 4);
  const today = new Date().toISOString().slice(0, 10);
  const manager = isCompany ? "Rita Souza" : "Marcos Lemes";

  db.customers.push({
    id: customerId,
    name,
    type: isCompany ? "empresa" : "pessoa",
    segment: isCompany ? "comerciante" : "classico",
    district: input.district?.trim() || "Centro",
    manager,
    since: today,
  });

  db.accounts.push({
    id: accountId,
    customerId,
    type,
    pixKey,
    openingBalance: 0,
    status: "ativa",
    openedAt: today,
  });

  if (deposit > 0) {
    db.transactions.push({
      id: `TRX-${String(db.transactions.length + 1).padStart(4, "0")}`,
      accountId,
      date: new Date().toISOString(),
      direction: "credit",
      amount: round(deposit),
      type: "deposito",
      channel: "abertura_de_conta",
      description: "Deposito inicial de abertura",
      counterparty: name,
    });
  }

  return {
    ok: true,
    accountId,
    customerId,
    name,
    accountType: type,
    pixKey,
    manager,
    balance: getBalance(accountId),
    openedAt: today,
  };
}

export function listProducts() {
  return {
    loans: loanProducts.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyRate: p.monthlyRate,
      minMonths: p.minMonths,
      maxMonths: p.maxMonths,
      maxAmount: p.maxAmount,
    })),
    investments: investmentProducts.map((p) => ({
      id: p.id,
      name: p.name,
      annualRate: p.annualRate,
      risk: p.risk,
      minAmount: p.minAmount,
    })),
  };
}

function findLoanProduct(idOrName: string) {
  const key = idOrName.trim().toLowerCase();
  return loanProducts.find((p) => p.id.toLowerCase() === key || p.name.toLowerCase() === key);
}

function findInvestmentProduct(idOrName: string) {
  const key = idOrName.trim().toLowerCase();
  return investmentProducts.find((p) => p.id.toLowerCase() === key || p.name.toLowerCase() === key);
}

export type InvestResult =
  | {
      ok: true;
      accountId: string;
      product: string;
      amount: number;
      annualRate: number;
      risk: string;
      estimatedYearGain: number;
      balanceAfter: number;
    }
  | { ok: false; error: string };

export function invest(accountKey: string, productId: string, amount: number): InvestResult {
  const account = resolveAccount(accountKey);
  if (!account) return { ok: false, error: `Não encontrei a conta "${accountKey}".` };

  const product = findInvestmentProduct(productId);
  if (!product) return { ok: false, error: `Não temos um investimento chamado "${productId}".` };
  if (!(amount > 0)) return { ok: false, error: "O valor da aplicação precisa ser maior que zero." };
  if (amount < product.minAmount) {
    return { ok: false, error: `O ${product.name} começa em R$ ${product.minAmount.toLocaleString("pt-BR")}.` };
  }
  if (getBalance(account.id) < amount) return { ok: false, error: "O saldo disponível não cobre essa aplicação." };

  const value = round(amount);
  db.transactions.push({
    id: `TRX-${String(db.transactions.length + 1).padStart(4, "0")}`,
    accountId: account.id,
    date: new Date().toISOString(),
    direction: "debit",
    amount: value,
    type: "investimento",
    channel: "mcp",
    description: `Aplicacao em ${product.name}`,
    counterparty: "Bank of Sajo Investimentos",
  });

  return {
    ok: true,
    accountId: account.id,
    product: product.name,
    amount: value,
    annualRate: product.annualRate,
    risk: product.risk,
    estimatedYearGain: round(value * product.annualRate),
    balanceAfter: getBalance(account.id),
  };
}

export type LoanContract =
  | {
      ok: true;
      accountId: string;
      product: string;
      amount: number;
      months: number;
      installment: number;
      total: number;
      interest: number;
      balanceAfter: number;
    }
  | { ok: false; error: string };

export function requestLoan(
  accountKey: string,
  productId: string,
  amount: number,
  months: number
): LoanContract {
  const account = resolveAccount(accountKey);
  if (!account) return { ok: false, error: `Não encontrei a conta "${accountKey}".` };

  const quote = simulateLoan(productId, amount, months);
  if (!quote.ok) return quote;

  const product = findLoanProduct(productId)!;
  db.transactions.push({
    id: `TRX-${String(db.transactions.length + 1).padStart(4, "0")}`,
    accountId: account.id,
    date: new Date().toISOString(),
    direction: "credit",
    amount: quote.amount,
    type: "emprestimo",
    channel: "mcp",
    description: `Liberacao de ${product.name}`,
    counterparty: "Bank of Sajo Credito",
  });

  return {
    ok: true,
    accountId: account.id,
    product: quote.product,
    amount: quote.amount,
    months: quote.months,
    installment: quote.installment,
    total: quote.total,
    interest: quote.interest,
    balanceAfter: getBalance(account.id),
  };
}

export type Customer = (typeof db.customers)[number];

export function findCustomer(idOrNameOrPix: string): Customer | undefined {
  const key = idOrNameOrPix.trim().toLowerCase();
  const byId = db.customers.find(
    (c) => c.id.toLowerCase() === key || c.name.toLowerCase() === key
  );
  if (byId) return byId;
  const conta = findAccount(idOrNameOrPix);
  if (conta) return db.customers.find((c) => c.id === conta.customerId);
  return db.customers.find((c) => c.name.toLowerCase().includes(key));
}

export function customerDetails(c: Customer) {
  const contas = db.accounts
    .filter((a) => a.customerId === c.id)
    .map((a) => ({ id: a.id, type: a.type, pixKey: a.pixKey, status: a.status, balance: getBalance(a.id) }));
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    segment: c.segment,
    district: c.district,
    manager: c.manager,
    since: c.since,
    accounts: contas,
    totalBalance: round(contas.reduce((s, a) => s + a.balance, 0)),
  };
}

export function listCustomers(search?: string, limit = 20) {
  const term = search?.trim().toLowerCase();
  return db.customers
    .filter((c) =>
      !term ? true : `${c.name} ${c.district} ${c.segment} ${c.type}`.toLowerCase().includes(term)
    )
    .slice(0, limit)
    .map(customerDetails);
}

export type CustomerChanges = {
  name?: string;
  district?: string;
  segment?: string;
  manager?: string;
};

export type CustomerResult =
  | { ok: true; customer: ReturnType<typeof customerDetails>; changed: string[] }
  | { ok: false; error: string };

export function updateCustomer(key: string, changes: CustomerChanges): CustomerResult {
  const c = findCustomer(key);
  if (!c) return { ok: false, error: `Não encontrei nenhum cliente com "${key}".` };

  const changed: string[] = [];
  for (const campo of ["name", "district", "segment", "manager"] as const) {
    const valor = changes[campo]?.trim();
    if (valor && valor !== c[campo]) {
      c[campo] = valor;
      changed.push(campo);
    }
  }
  if (changed.length === 0) {
    return { ok: false, error: "Não veio nenhum dado novo para atualizar." };
  }
  return { ok: true, customer: customerDetails(c), changed };
}

export type DeleteCustomerResult =
  | { ok: true; id: string; name: string; closedAccounts: string[] }
  | { ok: false; error: string };

export function deleteCustomer(key: string): DeleteCustomerResult {
  const c = findCustomer(key);
  if (!c) return { ok: false, error: `Não encontrei nenhum cliente com "${key}".` };

  const contas = db.accounts.filter((a) => a.customerId === c.id);
  const comSaldo = contas.filter((a) => Math.abs(getBalance(a.id)) > 0.005);
  if (comSaldo.length > 0) {
    const detalhe = comSaldo.map((a) => `${a.id} (${getBalance(a.id).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`).join(", ");
    return {
      ok: false,
      error: `Ainda há dinheiro em ${detalhe}. Zere o saldo antes de encerrar o cadastro.`,
    };
  }

  const ids = contas.map((a) => a.id);
  db.transactions.splice(0, db.transactions.length, ...db.transactions.filter((t) => !ids.includes(t.accountId)));
  db.accounts.splice(0, db.accounts.length, ...db.accounts.filter((a) => a.customerId !== c.id));
  db.customers.splice(0, db.customers.length, ...db.customers.filter((x) => x.id !== c.id));

  return { ok: true, id: c.id, name: c.name, closedAccounts: ids };
}

export type CreateCustomerInput = {
  name: string;
  type?: string;
  district?: string;
  segment?: string;
};

export function createCustomer(input: CreateCustomerInput): CustomerResult {
  const name = input.name?.trim();
  if (!name || name.length < 2) return { ok: false, error: "Preciso do nome do cliente." };
  if (db.customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `${name} já tem cadastro no banco.` };
  }

  const tipo = (input.type ?? "pessoa").trim().toLowerCase();
  if (!["pessoa", "empresa"].includes(tipo)) {
    return { ok: false, error: `Cliente pode ser "pessoa" ou "empresa" — não "${input.type}".` };
  }

  const isCompany = tipo === "empresa";
  const c = {
    id: nextId("CUS", db.customers.map((x) => x.id), 3),
    name,
    type: tipo,
    segment: input.segment?.trim() || (isCompany ? "comerciante" : "classico"),
    district: input.district?.trim() || "Centro",
    manager: isCompany ? "Rita Souza" : "Marcos Lemes",
    since: new Date().toISOString().slice(0, 10),
  };
  db.customers.push(c);
  return { ok: true, customer: customerDetails(c), changed: [] };
}

export const services = db.services;

export function listServices(category?: string) {
  const key = category?.trim().toLowerCase();
  return key ? services.filter((s) => s.category.toLowerCase() === key) : services;
}

export type CardResult =
  | { ok: true; cardId: string; accountId: string; holder: string; kind: string; brand: string; last4: string; limit: number }
  | { ok: false; error: string };

export function issueCard(accountKey: string, kind: string): CardResult {
  const account = resolveAccount(accountKey);
  if (!account) return { ok: false, error: `Não encontrei a conta "${accountKey}".` };

  const tipo = kind.trim().toLowerCase();
  if (!["debito", "credito"].includes(tipo)) {
    return { ok: false, error: `O cartão pode ser de débito ou de crédito — não "${kind}".` };
  }
  if (db.cards.some((c) => c.accountId === account.id && c.kind === tipo && c.status === "ativo")) {
    return { ok: false, error: `Essa conta já tem um cartão de ${tipo} ativo.` };
  }

  const empresa = account.type === "empresarial";
  const saldo = getBalance(account.id);
  const limite = tipo === "credito" ? Math.min(60000, Math.max(1000, Math.round((saldo * 3) / 100) * 100)) : 0;
  const card = {
    id: `CARD-${String(db.cards.length + 1).padStart(2, "0")}`,
    accountId: account.id,
    brand: empresa ? "Sajo Empresas" : tipo === "credito" ? "Sajo Black" : "Sajo Digital",
    kind: tipo,
    limit: limite,
    last4: String(Math.floor(1000 + Math.random() * 9000)),
    status: "ativo",
  };
  db.cards.push(card);

  return {
    ok: true,
    cardId: card.id,
    accountId: account.id,
    holder: customerOf(account)?.name ?? account.id,
    kind: tipo,
    brand: card.brand,
    last4: card.last4,
    limit: limite,
  };
}

export type BillResult =
  | {
      ok: true;
      transactionId: string;
      accountId: string;
      payee: string;
      payeeAccount: string | null;
      amount: number;
      balanceAfter: number;
      date: string;
    }
  | { ok: false; error: string };

export function payBill(accountKey: string, payee: string, amount: number, description?: string): BillResult {
  const account = resolveAccount(accountKey);
  if (!account) return { ok: false, error: `Não encontrei a conta "${accountKey}".` };
  if (!payee?.trim()) return { ok: false, error: "Preciso saber para quem é o pagamento." };
  if (!(amount > 0)) return { ok: false, error: "O valor precisa ser maior que zero." };
  if (getBalance(account.id) < amount) return { ok: false, error: "O saldo disponível não cobre esse pagamento." };

  const value = round(amount);
  const date = new Date().toISOString();
  const nome = payee.trim();
  const id = `TRX-${String(db.transactions.length + 1).padStart(4, "0")}`;
  const texto = description?.trim() || `Pagamento para ${nome}`;

  db.transactions.push({
    id,
    accountId: account.id,
    date,
    direction: "debit",
    amount: value,
    type: "pagamento",
    channel: "app",
    description: texto,
    counterparty: nome,
  });

  // Se quem recebe tambem e da cidade, o dinheiro entra na conta dele de verdade;
  // fornecedor de fora do banco fica so como saida.
  const destino = resolveAccount(nome);
  if (destino && destino.id !== account.id) {
    db.transactions.push({
      id: `TRX-${String(db.transactions.length + 1).padStart(4, "0")}`,
      accountId: destino.id,
      date,
      direction: "credit",
      amount: value,
      type: "pagamento",
      channel: "app",
      description: texto,
      counterparty: customerOf(account)?.name ?? account.id,
    });
  }

  return {
    ok: true,
    transactionId: id,
    accountId: account.id,
    payee: destino ? customerOf(destino)?.name ?? nome : nome,
    payeeAccount: destino?.id ?? null,
    amount: value,
    balanceAfter: getBalance(account.id),
    date,
  };
}

// --- CRUD de produtos e servicos (restrito pela palavra magica) ---

export const MAGIC_WORD = process.env.BANK_MAGIC_WORD ?? "abre-te-sajo";

export function checkMagicWord(word?: string): string | null {
  if (!word || word.trim().toLowerCase() !== MAGIC_WORD.toLowerCase()) {
    return "Essa operação é restrita à equipe do Bank of Sajo. Me diga a palavra mágica para continuar.";
  }
  return null;
}

export type ProductKind = "loan" | "investment";

const catalogOf = (kind: ProductKind) => (kind === "loan" ? db.loanProducts : db.investmentProducts);

function findProduct(kind: ProductKind, key: string) {
  const k = key.trim().toLowerCase();
  return (catalogOf(kind) as { id: string; name: string }[]).find(
    (p) => p.id.toLowerCase() === k || p.name.toLowerCase() === k
  );
}

export type CatalogResult<T> = { ok: true; item: T; changed?: string[] } | { ok: false; error: string };

export type LoanProductInput = {
  name: string;
  monthlyRate: number;
  minMonths: number;
  maxMonths: number;
  maxAmount: number;
};

export type InvestmentProductInput = {
  name: string;
  annualRate: number;
  risk?: string;
  minAmount?: number;
};

export function createProduct(
  kind: ProductKind,
  input: LoanProductInput | InvestmentProductInput
): CatalogResult<Record<string, unknown>> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Preciso do nome do produto." };
  if (findProduct(kind, name)) return { ok: false, error: `Já existe um produto chamado "${name}".` };

  if (kind === "loan") {
    const i = input as LoanProductInput;
    if (!(i.monthlyRate > 0)) return { ok: false, error: "A taxa mensal precisa ser maior que zero." };
    if (!(i.minMonths > 0) || i.maxMonths < i.minMonths) {
      return { ok: false, error: "O prazo mínimo precisa ser positivo e menor que o máximo." };
    }
    if (!(i.maxAmount > 0)) return { ok: false, error: "O valor máximo precisa ser maior que zero." };
    const item = {
      id: nextId("LP", db.loanProducts.map((p) => p.id), 2),
      name,
      monthlyRate: i.monthlyRate,
      minMonths: i.minMonths,
      maxMonths: i.maxMonths,
      maxAmount: i.maxAmount,
    };
    db.loanProducts.push(item);
    return { ok: true, item };
  }

  const i = input as InvestmentProductInput;
  if (!(i.annualRate > 0)) return { ok: false, error: "O rendimento anual precisa ser maior que zero." };
  const item = {
    id: nextId("INV", db.investmentProducts.map((p) => p.id), 2),
    name,
    annualRate: i.annualRate,
    risk: i.risk?.trim() || "baixo",
    minAmount: i.minAmount ?? 0,
  };
  db.investmentProducts.push(item);
  return { ok: true, item };
}

export function updateProduct(
  kind: ProductKind,
  key: string,
  changes: Record<string, string | number | undefined>
): CatalogResult<Record<string, unknown>> {
  const item = findProduct(kind, key) as Record<string, string | number> | undefined;
  if (!item) return { ok: false, error: `Não encontrei o produto "${key}".` };

  const campos =
    kind === "loan"
      ? ["name", "monthlyRate", "minMonths", "maxMonths", "maxAmount"]
      : ["name", "annualRate", "risk", "minAmount"];

  const changed: string[] = [];
  for (const campo of campos) {
    const valor = changes[campo];
    if (valor !== undefined && valor !== "" && valor !== item[campo]) {
      item[campo] = valor;
      changed.push(campo);
    }
  }
  if (changed.length === 0) return { ok: false, error: "Não veio nenhum dado novo para mudar." };
  return { ok: true, item, changed };
}

export function deleteProduct(kind: ProductKind, key: string): CatalogResult<Record<string, unknown>> {
  const item = findProduct(kind, key);
  if (!item) return { ok: false, error: `Não encontrei o produto "${key}".` };
  const lista = catalogOf(kind) as { id: string }[];
  lista.splice(lista.findIndex((p) => p.id === item.id), 1);
  return { ok: true, item: item as Record<string, unknown> };
}

function findService(key: string) {
  const k = key.trim().toLowerCase();
  return db.services.find((s) => s.id.toLowerCase() === k || s.name.toLowerCase() === k);
}

export function createService(input: {
  name: string;
  category: string;
  description: string;
}): CatalogResult<Record<string, unknown>> {
  const name = input.name?.trim();
  const category = input.category?.trim().toLowerCase();
  const description = input.description?.trim();
  if (!name) return { ok: false, error: "Preciso do nome do serviço." };
  if (!category) return { ok: false, error: "Preciso da categoria do serviço." };
  if (!description) return { ok: false, error: "Preciso de uma descrição do serviço." };
  if (findService(name)) return { ok: false, error: `Já existe um serviço chamado "${name}".` };

  const item = { id: nextId("SVC", db.services.map((s) => s.id), 2), name, category, description };
  db.services.push(item);
  return { ok: true, item };
}

export function updateService(
  key: string,
  changes: { name?: string; category?: string; description?: string }
): CatalogResult<Record<string, unknown>> {
  const item = findService(key) as Record<string, string> | undefined;
  if (!item) return { ok: false, error: `Não encontrei o serviço "${key}".` };

  const changed: string[] = [];
  for (const campo of ["name", "category", "description"] as const) {
    const valor = changes[campo]?.trim();
    if (valor && valor !== item[campo]) {
      item[campo] = campo === "category" ? valor.toLowerCase() : valor;
      changed.push(campo);
    }
  }
  if (changed.length === 0) return { ok: false, error: "Não veio nenhum dado novo para mudar." };
  return { ok: true, item, changed };
}

export function deleteService(key: string): CatalogResult<Record<string, unknown>> {
  const item = findService(key);
  if (!item) return { ok: false, error: `Não encontrei o serviço "${key}".` };
  db.services.splice(db.services.findIndex((s) => s.id === item.id), 1);
  return { ok: true, item: item as Record<string, unknown> };
}

// --- Adquirencia: o comercio da cidade recebendo e pagando pelo banco ---

export const merchantFees = db.merchantFees;

// Aceita numero da conta, chave PIX, codigo do cliente ou nome dele.
export function resolveAccount(key: string) {
  const direta = findAccount(key);
  if (direta) return direta;
  const cliente = findCustomer(key);
  return cliente ? db.accounts.find((a) => a.customerId === cliente.id) : undefined;
}

export type ChargeResult =
  | {
      ok: true;
      transactionId: string;
      business: string;
      businessAccount: string;
      customer: string;
      customerAccount: string;
      method: string;
      gross: number;
      fee: number;
      feeRate: number;
      net: number;
      businessBalance: number;
      customerBalance: number;
    }
  | { ok: false; error: string };

export function chargeCustomer(
  businessKey: string,
  customerKey: string,
  amount: number,
  method: string,
  description?: string
): ChargeResult {
  const business = resolveAccount(businessKey);
  if (!business) return { ok: false, error: `Não encontrei a conta do negócio "${businessKey}".` };

  const payer = resolveAccount(customerKey);
  if (!payer) return { ok: false, error: `Não encontrei a conta de quem está pagando ("${customerKey}").` };
  if (payer.id === business.id) return { ok: false, error: "O negócio não pode cobrar de si mesmo." };
  if (!(amount > 0)) return { ok: false, error: "O valor da cobrança precisa ser maior que zero." };

  const forma = method.trim().toLowerCase();
  const taxas = merchantFees as Record<string, number>;
  if (!(forma in taxas)) {
    return { ok: false, error: `Aceitamos PIX, débito e crédito — não "${method}".` };
  }
  if (forma === "credito" && !db.cards.some((c) => c.accountId === payer.id && c.kind === "credito" && c.status === "ativo")) {
    return { ok: false, error: "Quem está pagando não tem cartão de crédito ativo. Dá para pagar por PIX ou débito." };
  }
  if (getBalance(payer.id) < amount) {
    return { ok: false, error: "O saldo de quem está pagando não cobre esse valor." };
  }

  const bruto = round(amount);
  const taxa = round(bruto * taxas[forma]);
  const liquido = round(bruto - taxa);
  const date = new Date().toISOString();
  const nomeNegocio = customerOf(business)?.name ?? business.id;
  const nomePagador = customerOf(payer)?.name ?? payer.id;
  const seq = db.transactions.length + 1;
  const idSaida = `TRX-${String(seq).padStart(4, "0")}`;

  db.transactions.push(
    {
      id: idSaida,
      accountId: payer.id,
      date,
      direction: "debit",
      amount: bruto,
      type: forma === "pix" ? "pix_out" : "compra_cartao",
      channel: forma === "pix" ? "pix" : `cartao_${forma}`,
      description: description?.trim() || `Compra em ${nomeNegocio}`,
      counterparty: nomeNegocio,
    },
    {
      id: `TRX-${String(seq + 1).padStart(4, "0")}`,
      accountId: business.id,
      date,
      direction: "credit",
      amount: liquido,
      type: forma === "pix" ? "pix_in" : "recebimento_maquininha",
      channel: forma === "pix" ? "pix" : "maquininha",
      description:
        (description?.trim() || `Venda para ${nomePagador}`) +
        (taxa > 0 ? ` (taxa de ${(taxas[forma] * 100).toFixed(1)}%)` : ""),
      counterparty: nomePagador,
    }
  );

  return {
    ok: true,
    transactionId: idSaida,
    business: nomeNegocio,
    businessAccount: business.id,
    customer: nomePagador,
    customerAccount: payer.id,
    method: forma,
    gross: bruto,
    fee: taxa,
    feeRate: taxas[forma],
    net: liquido,
    businessBalance: getBalance(business.id),
    customerBalance: getBalance(payer.id),
  };
}
