import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  accountStatement,
  checkMagicWord,
  createCustomer,
  createProduct,
  createService,
  deleteProduct,
  deleteService,
  updateProduct,
  updateService,
  customerDetails,
  deleteCustomer,
  findCustomer,
  listCustomers,
  updateCustomer,
  customerOf,
  findAccount,
  invest,
  issueCard,
  listProducts,
  listServices,
  payBill,
  openAccount,
  requestLoan,
  searchTransactions,
  sendPix,
  simulateLoan,
  type Transaction,
} from "@/lib/bank";

// As respostas do MCP sao escritas para gente: o texto e conversa, sem jargao.
// Os dados vao em structuredContent, que e o que o Core Orchestrator consome.
const reply = (text: string, data: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text }],
  structuredContent: data,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Formata a partir do texto da data, sem passar por Date: o fuso do servidor
// nao pode empurrar um registro de hoje para ontem.
const dia = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const pct = (r: number) => `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const ROTULOS: Record<string, string> = {
  name: "nome",
  monthlyRate: "juros ao mês",
  minMonths: "prazo mínimo",
  maxMonths: "prazo máximo",
  maxAmount: "valor máximo",
  annualRate: "rendimento anual",
  risk: "risco",
  minAmount: "aplicação mínima",
  category: "categoria",
  description: "descrição",
  district: "bairro",
  segment: "perfil",
  manager: "gerente",
};
const rotular = (campos: string[] = []) => campos.map((c) => ROTULOS[c] ?? c).join(", ");

const nomeDaConta = (id: string) => {
  const conta = findAccount(id);
  return conta ? customerOf(conta)?.name ?? id : id;
};
const linha = (t: Transaction) =>
  `• ${dia(t.date)} — ${t.description}${t.counterparty ? ` (${t.counterparty})` : ""}: ` +
  `${t.direction === "credit" ? "entrada" : "saída"} de ${brl(t.amount)}`;

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_account_balance",
      "Mostra quanto tem numa conta do Bank of Sajo, com os dados do titular e as ultimas movimentacoes. Aceita o numero da conta (ACC-1001) ou a chave PIX.",
      { account: z.string().describe("Numero da conta ou chave PIX") },
      async ({ account }) => {
        const extrato = accountStatement(account);
        if (!extrato) {
          return reply(
            `Não encontrei nenhuma conta com "${account}". Você pode me passar o número da conta, como ACC-1001, ou a chave PIX do titular.`,
            { ok: false, error: "conta não encontrada" }
          );
        }
        const { conta, titular } = { conta: extrato.account, titular: extrato.customer };
        const movimentos = extrato.lastTransactions.map(linha).join("\n");
        return reply(
          `A conta ${conta.type} de ${titular?.name ?? "titular não identificado"} (${conta.id}) tem ${brl(extrato.balance)} disponíveis.\n` +
            `Chave PIX: ${conta.pixKey}${titular?.manager ? ` · Gerente: ${titular.manager}` : ""}\n\n` +
            (movimentos ? `Últimas movimentações:\n${movimentos}` : "Ainda não há movimentações nesta conta."),
          { ok: true, ...extrato }
        );
      }
    );

    server.tool(
      "search_transactions",
      "Procura movimentacoes do banco: por conta, tipo, valor, periodo ou por um trecho da descricao.",
      {
        account: z.string().optional().describe("Numero da conta ou chave PIX"),
        type: z.string().optional().describe("Tipo: pix_in, pix_out, deposito, saque, pagamento, compra_cartao, recebimento_maquininha, emprestimo, investimento, cambio, acoes_compra, acoes_venda"),
        direction: z.enum(["credit", "debit"]).optional().describe("credit para entradas, debit para saidas"),
        minAmount: z.number().optional(),
        from: z.string().optional().describe("Data inicial, ex 2026-08-01"),
        to: z.string().optional().describe("Data final"),
        search: z.string().optional().describe("Trecho da descricao ou nome de quem recebeu/pagou"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      async (filtros) => {
        const encontradas = searchTransactions(filtros);
        if (encontradas.length === 0) {
          return reply(
            "Não encontrei nenhuma movimentação com esses critérios. Tente ampliar o período ou tirar algum filtro.",
            { ok: true, count: 0, transactions: [] }
          );
        }
        return reply(
          `Encontrei ${encontradas.length} ${encontradas.length === 1 ? "movimentação" : "movimentações"}:\n\n` +
            encontradas.map(linha).join("\n"),
          { ok: true, count: encontradas.length, currency: "BRL", transactions: encontradas }
        );
      }
    );

    server.tool(
      "open_account",
      "Abre uma conta nova no Bank of Sajo para uma pessoa ou empresa da cidade. Tipos: corrente, poupanca, empresarial ou investimento.",
      {
        name: z.string().describe("Nome do titular"),
        type: z.enum(["corrente", "poupanca", "empresarial", "investimento"]).optional().describe("Padrao: corrente"),
        initialDeposit: z.number().min(0).optional().describe("Deposito de abertura, opcional"),
        district: z.string().optional().describe("Bairro do titular"),
        pixKey: z.string().optional().describe("Chave PIX desejada; se nao vier, o banco cria uma"),
      },
      async (dados) => {
        const r = openAccount(dados);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(
          `Conta aberta, ${r.name}! Boas-vindas ao Bank of Sajo.\n\n` +
            `• Conta ${r.accountType}: ${r.accountId}\n` +
            `• Chave PIX: ${r.pixKey}\n` +
            `• Gerente de relacionamento: ${r.manager}\n` +
            `• Saldo inicial: ${brl(r.balance)}\n\n` +
            `Sua conta é digital e sem tarifas. É só usar a chave PIX para receber dinheiro.`,
          { ...r }
        );
      }
    );

    server.tool(
      "send_pix",
      "Envia um PIX de uma conta do Bank of Sajo para outra. Confere o saldo antes.",
      {
        from: z.string().describe("Conta de origem (numero ou chave PIX)"),
        to: z.string().describe("Conta de destino (numero ou chave PIX)"),
        amount: z.number().positive().describe("Valor em reais"),
        description: z.string().optional(),
      },
      async ({ from, to, amount, description }) => {
        const r = sendPix(from, to, amount, description);
        if (!r.ok) return reply(`Não consegui enviar o PIX. ${r.error}`, { ok: false, error: r.error });
        return reply(
          `PIX enviado! ${brl(r.amount)} saíram da conta ${r.from} e chegaram para ${nomeDaConta(r.to)}.\n` +
            `O saldo agora é de ${brl(r.balanceAfter)}.`,
          { ...r }
        );
      }
    );

    server.tool(
      "list_products",
      "Lista o que o banco oferece: linhas de credito e financiamento (imovel, veiculo, energia solar, credito pessoal, capital de giro) e opcoes de investimento.",
      {},
      async () => {
        const { loans, investments } = listProducts();
        return reply(
          `Crédito e financiamento:\n` +
            loans
              .map(
                (p) =>
                  `• ${p.name} — juros de ${pct(p.monthlyRate)} ao mês, de ${p.minMonths} a ${p.maxMonths} meses, até ${brl(p.maxAmount)}`
              )
              .join("\n") +
            `\n\nInvestimentos:\n` +
            investments
              .map(
                (p) =>
                  `• ${p.name} — rende cerca de ${pct(p.annualRate)} ao ano, risco ${p.risk}` +
                  (p.minAmount > 0 ? `, a partir de ${brl(p.minAmount)}` : ", sem valor mínimo")
              )
              .join("\n") +
            `\n\nPosso simular qualquer uma dessas linhas ou aplicar um valor para você.`,
          { ok: true, loans, investments }
        );
      }
    );

    server.tool(
      "simulate_loan",
      "Simula quanto fica a parcela de um credito ou financiamento, sem contratar nada.",
      {
        product: z.string().describe("Nome ou codigo do produto, ex 'Financiamento imobiliario' ou LP-04"),
        amount: z.number().positive().describe("Valor desejado em reais"),
        months: z.number().int().positive().describe("Prazo em meses"),
      },
      async ({ product, amount, months }) => {
        const r = simulateLoan(product, amount, months);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(
          `No ${r.product}, ${brl(r.amount)} em ${r.months} meses ficam em parcelas de ${brl(r.installment)}.\n` +
            `No fim você terá pago ${brl(r.total)}, sendo ${brl(r.interest)} de juros (${pct(r.monthlyRate)} ao mês).\n\n` +
            `Isso é só uma simulação — nada foi contratado.`,
          { ...r }
        );
      }
    );

    server.tool(
      "request_loan",
      "Contrata um credito ou financiamento (imovel, veiculo, energia solar, credito pessoal, capital de giro) e deposita o valor na conta.",
      {
        account: z.string().describe("Conta que vai receber o dinheiro"),
        product: z.string().describe("Nome ou codigo do produto"),
        amount: z.number().positive().describe("Valor em reais"),
        months: z.number().int().positive().describe("Prazo em meses"),
      },
      async ({ account, product, amount, months }) => {
        const r = requestLoan(account, product, amount, months);
        if (!r.ok) return reply(`Não consegui contratar. ${r.error}`, { ok: false, error: r.error });
        return reply(
          `Crédito aprovado! ${brl(r.amount)} já estão na conta ${r.accountId}.\n\n` +
            `• Produto: ${r.product}\n` +
            `• ${r.months} parcelas de ${brl(r.installment)}\n` +
            `• Total a pagar: ${brl(r.total)} (${brl(r.interest)} de juros)\n` +
            `• Saldo da conta agora: ${brl(r.balanceAfter)}`,
          { ...r }
        );
      }
    );

    server.tool(
      "invest",
      "Aplica um valor da conta em um investimento do banco (poupanca, CDB ou fundo de acoes).",
      {
        account: z.string().describe("Conta de onde sai o dinheiro"),
        product: z.string().describe("Nome ou codigo do investimento, ex 'CDB Cidade 110%' ou INV-02"),
        amount: z.number().positive().describe("Valor a aplicar em reais"),
      },
      async ({ account, product, amount }) => {
        const r = invest(account, product, amount);
        if (!r.ok) return reply(`Não consegui aplicar. ${r.error}`, { ok: false, error: r.error });
        return reply(
          `Aplicação feita! ${brl(r.amount)} foram para o ${r.product}.\n\n` +
            `• Rendimento estimado: ${pct(r.annualRate)} ao ano, cerca de ${brl(r.estimatedYearGain)} em 12 meses\n` +
            `• Risco: ${r.risk}\n` +
            `• Saldo que sobrou na conta: ${brl(r.balanceAfter)}`,
          { ...r }
        );
      }
    );

    server.tool(
      "create_customer",
      "Cadastra um cliente novo no banco (pessoa ou empresa da cidade), sem abrir conta ainda. Para ja abrir conta, use open_account.",
      {
        name: z.string().describe("Nome do cliente"),
        type: z.enum(["pessoa", "empresa"]).optional().describe("Padrao: pessoa"),
        district: z.string().optional().describe("Bairro"),
        segment: z.string().optional().describe("Perfil, ex premium, jovem, comerciante"),
      },
      async (dados) => {
        const r = createCustomer(dados);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        const c = r.customer;
        return reply(
          `Cadastro criado! ${c.name} agora é cliente do Bank of Sajo.\n\n` +
            `• Código: ${c.id}\n` +
            `• Perfil: ${c.segment} · ${c.type}\n` +
            `• Bairro: ${c.district}\n` +
            `• Gerente: ${c.manager}\n\n` +
            `Ainda não há conta aberta. Quando quiser, é só pedir a abertura.`,
          { ...r }
        );
      }
    );

    server.tool(
      "get_customer",
      "Mostra os dados de um cliente e as contas dele. Aceita o codigo (CUS-001), o nome ou uma chave PIX.",
      { customer: z.string().describe("Codigo, nome ou chave PIX do cliente") },
      async ({ customer }) => {
        const achado = findCustomer(customer);
        if (!achado) {
          return reply(
            `Não encontrei nenhum cliente com "${customer}". Tente pelo nome completo ou pelo código, como CUS-001.`,
            { ok: false, error: "cliente não encontrado" }
          );
        }
        const c = customerDetails(achado);
        const contas = c.accounts.length
          ? c.accounts.map((a) => `• ${a.type} ${a.id} (${a.pixKey}): ${brl(a.balance)}`).join("\n")
          : "Ainda não tem conta aberta.";
        return reply(
          `${c.name} — ${c.type}, perfil ${c.segment}, do bairro ${c.district}.\n` +
            `Cliente desde ${dia(c.since)} · Gerente: ${c.manager}\n\n` +
            `Contas:\n${contas}\n\n` +
            `Total no banco: ${brl(c.totalBalance)}`,
          { ok: true, customer: c }
        );
      }
    );

    server.tool(
      "list_customers",
      "Lista os clientes do banco, com filtro opcional por nome, bairro ou perfil.",
      {
        search: z.string().optional().describe("Nome, bairro ou perfil"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      async ({ search, limit }) => {
        const clientes = listCustomers(search, limit);
        if (clientes.length === 0) {
          return reply("Não encontrei nenhum cliente com esse critério.", { ok: true, count: 0, customers: [] });
        }
        return reply(
          `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}:\n\n` +
            clientes
              .map(
                (c) =>
                  `• ${c.name} (${c.id}) — ${c.segment}, ${c.district} · ` +
                  `${c.accounts.length} ${c.accounts.length === 1 ? "conta" : "contas"}, ${brl(c.totalBalance)}`
              )
              .join("\n"),
          { ok: true, count: clientes.length, customers: clientes }
        );
      }
    );

    server.tool(
      "update_customer",
      "Atualiza os dados cadastrais de um cliente: nome, bairro, perfil ou gerente.",
      {
        customer: z.string().describe("Codigo, nome ou chave PIX do cliente"),
        name: z.string().optional(),
        district: z.string().optional().describe("Bairro"),
        segment: z.string().optional().describe("Perfil, ex premium, jovem, comerciante"),
        manager: z.string().optional().describe("Gerente de relacionamento"),
      },
      async ({ customer, ...mudancas }) => {
        const r = updateCustomer(customer, mudancas);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        const c = r.customer;
        return reply(
          `Cadastro de ${c.name} atualizado — mudou ${rotular(r.changed)}.\n\n` +
            `• Perfil: ${c.segment} · ${c.type}\n` +
            `• Bairro: ${c.district}\n` +
            `• Gerente: ${c.manager}`,
          { ...r }
        );
      }
    );

    server.tool(
      "delete_customer",
      "Encerra o cadastro de um cliente e as contas dele. So funciona se as contas estiverem zeradas.",
      { customer: z.string().describe("Codigo, nome ou chave PIX do cliente") },
      async ({ customer }) => {
        const r = deleteCustomer(customer);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        const contas = r.closedAccounts.length
          ? ` Encerramos também ${r.closedAccounts.length === 1 ? "a conta" : "as contas"} ${r.closedAccounts.join(", ")}.`
          : "";
        return reply(
          `Cadastro de ${r.name} encerrado.${contas} Foi bom ter você com a gente!`,
          { ...r }
        );
      }
    );

    server.tool(
      "list_services",
      "Lista tudo o que o Bank of Sajo oferece: contas, cartoes, canais digitais, pagamentos, credito, atendimento, seguranca e programas para a comunidade.",
      { category: z.string().optional().describe("Filtra por: contas, cartoes, canais, pagamentos, credito, investimentos, atendimento, seguranca, comunidade") },
      async ({ category }) => {
        const itens = listServices(category);
        if (itens.length === 0) {
          return reply(
            `Não temos serviços nessa categoria. As categorias são: contas, cartões, canais, pagamentos, crédito, investimentos, atendimento, segurança e comunidade.`,
            { ok: true, count: 0, services: [] }
          );
        }
        const porCategoria = itens.reduce<Record<string, typeof itens>>((acc, s) => {
          (acc[s.category] ??= []).push(s);
          return acc;
        }, {});
        const texto = Object.entries(porCategoria)
          .map(
            ([cat, lista]) =>
              `${cat.toUpperCase()}\n` +
              lista.map((s) => `• ${s.name} — ${s.description}`).join("\n")
          )
          .join("\n\n");
        return reply(
          `${texto}\n\nMe diga o que você precisa que eu resolvo por aqui mesmo.`,
          { ok: true, count: itens.length, services: itens }
        );
      }
    );

    server.tool(
      "issue_card",
      "Emite um cartao de debito ou de credito para uma conta do banco.",
      {
        account: z.string().describe("Conta que vai receber o cartao"),
        kind: z.enum(["debito", "credito"]).describe("Tipo de cartao"),
      },
      async ({ account, kind }) => {
        const r = issueCard(account, kind);
        if (!r.ok) return reply(`Não consegui emitir o cartão. ${r.error}`, { ok: false, error: r.error });
        return reply(
          `Cartão de ${r.kind} a caminho, ${r.holder}!\n\n` +
            `• ${r.brand} final ${r.last4}\n` +
            `• Vinculado à conta ${r.accountId}\n` +
            (r.limit > 0 ? `• Limite: ${brl(r.limit)}\n` : "• Sem anuidade, debita direto da conta\n") +
            `\nEle chega no endereço cadastrado em alguns dias.`,
          { ...r }
        );
      }
    );

    server.tool(
      "pay_bill",
      "Paga uma conta ou boleto debitando da conta do cliente (agua, luz, tributos, fornecedores).",
      {
        account: z.string().describe("Conta de onde sai o pagamento"),
        payee: z.string().describe("Para quem e o pagamento"),
        amount: z.number().positive().describe("Valor em reais"),
        description: z.string().optional(),
      },
      async ({ account, payee, amount, description }) => {
        const r = payBill(account, payee, amount, description);
        if (!r.ok) return reply(`Não consegui pagar. ${r.error}`, { ok: false, error: r.error });
        return reply(
          `Pagamento feito! ${brl(r.amount)} para ${r.payee}.\n` +
            `O saldo da conta ${r.accountId} agora é ${brl(r.balanceAfter)}.`,
          { ...r }
        );
      }
    );

    // As tools abaixo mexem no catalogo do banco, entao pedem a palavra magica.
    server.tool(
      "create_product",
      "Cria uma linha de credito ou um investimento no catalogo do banco. Restrito: exige a palavra magica.",
      {
        magicWord: z.string().optional().describe("Palavra magica da equipe do banco"),
        kind: z.enum(["loan", "investment"]).describe("loan para credito, investment para investimento"),
        name: z.string(),
        monthlyRate: z.number().optional().describe("Juros ao mes, para credito. Ex 0.019"),
        minMonths: z.number().int().optional().describe("Prazo minimo, para credito"),
        maxMonths: z.number().int().optional().describe("Prazo maximo, para credito"),
        maxAmount: z.number().optional().describe("Valor maximo, para credito"),
        annualRate: z.number().optional().describe("Rendimento ao ano, para investimento. Ex 0.118"),
        risk: z.string().optional().describe("baixo, medio ou alto, para investimento"),
        minAmount: z.number().optional().describe("Aplicacao minima, para investimento"),
      },
      async ({ magicWord, kind, ...dados }) => {
        const barrado = checkMagicWord(magicWord);
        if (barrado) return reply(barrado, { ok: false, error: "palavra mágica ausente ou incorreta" });
        const r = createProduct(kind, dados as never);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        const nome = r.item.name as string;
        return reply(
          `Pronto! ${nome} entrou no catálogo do banco com o código ${r.item.id}. Já aparece para os clientes.`,
          { ...r }
        );
      }
    );

    server.tool(
      "update_product",
      "Muda os dados de uma linha de credito ou investimento. Restrito: exige a palavra magica.",
      {
        magicWord: z.string().optional().describe("Palavra magica da equipe do banco"),
        kind: z.enum(["loan", "investment"]),
        product: z.string().describe("Nome ou codigo do produto"),
        name: z.string().optional(),
        monthlyRate: z.number().optional(),
        minMonths: z.number().int().optional(),
        maxMonths: z.number().int().optional(),
        maxAmount: z.number().optional(),
        annualRate: z.number().optional(),
        risk: z.string().optional(),
        minAmount: z.number().optional(),
      },
      async ({ magicWord, kind, product, ...mudancas }) => {
        const barrado = checkMagicWord(magicWord);
        if (barrado) return reply(barrado, { ok: false, error: "palavra mágica ausente ou incorreta" });
        const r = updateProduct(kind, product, mudancas as never);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(
          `${r.item.name} atualizado — mudou ${rotular(r.changed)}.`,
          { ...r }
        );
      }
    );

    server.tool(
      "delete_product",
      "Tira uma linha de credito ou investimento do catalogo. Restrito: exige a palavra magica.",
      {
        magicWord: z.string().optional().describe("Palavra magica da equipe do banco"),
        kind: z.enum(["loan", "investment"]),
        product: z.string().describe("Nome ou codigo do produto"),
      },
      async ({ magicWord, kind, product }) => {
        const barrado = checkMagicWord(magicWord);
        if (barrado) return reply(barrado, { ok: false, error: "palavra mágica ausente ou incorreta" });
        const r = deleteProduct(kind, product);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(`${r.item.name} saiu do catálogo. Não vai mais aparecer para os clientes.`, { ...r });
      }
    );

    server.tool(
      "create_service",
      "Cria um servico do banco (contas, cartoes, canais, pagamentos, credito, investimentos, atendimento, seguranca, comunidade). Restrito: exige a palavra magica.",
      {
        magicWord: z.string().optional().describe("Palavra magica da equipe do banco"),
        name: z.string(),
        category: z.string().describe("Ex: contas, cartoes, canais, pagamentos, credito, atendimento"),
        description: z.string().describe("Uma frase explicando o servico para o cliente"),
      },
      async ({ magicWord, ...dados }) => {
        const barrado = checkMagicWord(magicWord);
        if (barrado) return reply(barrado, { ok: false, error: "palavra mágica ausente ou incorreta" });
        const r = createService(dados);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(
          `Serviço criado: ${r.item.name} (${r.item.id}), na categoria ${r.item.category}.`,
          { ...r }
        );
      }
    );

    server.tool(
      "update_service",
      "Muda o nome, a categoria ou a descricao de um servico. Restrito: exige a palavra magica.",
      {
        magicWord: z.string().optional().describe("Palavra magica da equipe do banco"),
        service: z.string().describe("Nome ou codigo do servico"),
        name: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      },
      async ({ magicWord, service, ...mudancas }) => {
        const barrado = checkMagicWord(magicWord);
        if (barrado) return reply(barrado, { ok: false, error: "palavra mágica ausente ou incorreta" });
        const r = updateService(service, mudancas);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(`${r.item.name} atualizado — mudou ${rotular(r.changed)}.`, { ...r });
      }
    );

    server.tool(
      "delete_service",
      "Tira um servico da lista do banco. Restrito: exige a palavra magica.",
      {
        magicWord: z.string().optional().describe("Palavra magica da equipe do banco"),
        service: z.string().describe("Nome ou codigo do servico"),
      },
      async ({ magicWord, service }) => {
        const barrado = checkMagicWord(magicWord);
        if (barrado) return reply(barrado, { ok: false, error: "palavra mágica ausente ou incorreta" });
        const r = deleteService(service);
        if (!r.ok) return reply(r.error, { ok: false, error: r.error });
        return reply(`${r.item.name} não faz mais parte dos serviços do banco.`, { ...r });
      }
    );
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

export { handler as GET, handler as POST, handler as DELETE };

export const dynamic = "force-dynamic";
