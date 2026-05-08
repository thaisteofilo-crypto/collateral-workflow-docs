// Valores monetários sempre em centavos (inteiros).

export type FinanceSubtype =
  | "ganho"
  | "fixa"
  | "variavel"
  | "divida"
  | "investimento";

export type FinanceStatus = "pago" | "a_pagar";

export type PaymentMethodId =
  | "pix"
  | "debito"
  | "credito"
  | "dinheiro"
  | "boleto"
  | "transferencia";

export type FinanceEntry = {
  id: string;
  subtype: FinanceSubtype;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // centavos, >= 0
  tag?: string;

  // Comum a fixa, variavel, ganho
  status?: FinanceStatus;

  // Comum a fixa, variavel
  category?: string;

  // Fixa
  paymentMethod?: PaymentMethodId;
  receiptUrl?: string;

  // Variável
  card?: string;
  installments?: string;

  // Dívida
  debtor?: string;
  totalAmount?: number;

  // Investimento
  broker?: string;
  investmentType?: string;

  // Auto (gerado do calendário)
  auto?: boolean;
  autoSource?: string;
};

export type Tag = {
  id: string;
  label: string;
  color: string;
};

export type SubtypeMeta = {
  id: FinanceSubtype;
  label: string;
  shortLabel: string;
  pluralLabel: string;
  color: string;
  expense: boolean;
  income: boolean;
};

export const SUBTYPES: SubtypeMeta[] = [
  {
    id: "ganho",
    label: "Ganho",
    shortLabel: "Ganho",
    pluralLabel: "Ganhos",
    color: "#10B981",
    expense: false,
    income: true,
  },
  {
    id: "fixa",
    label: "Despesa Fixa",
    shortLabel: "Fixa",
    pluralLabel: "Despesas Fixas",
    color: "#F87C56",
    expense: true,
    income: false,
  },
  {
    id: "variavel",
    label: "Despesa Variável",
    shortLabel: "Variável",
    pluralLabel: "Despesas Variáveis",
    color: "#D6A461",
    expense: true,
    income: false,
  },
  {
    id: "divida",
    label: "Dívida",
    shortLabel: "Dívida",
    pluralLabel: "Dívidas",
    color: "#EC4899",
    expense: true,
    income: false,
  },
  {
    id: "investimento",
    label: "Investimento",
    shortLabel: "Aporte",
    pluralLabel: "Investimentos",
    color: "#A78BFA",
    expense: false,
    income: false,
  },
];

export function subtypeMeta(id: FinanceSubtype): SubtypeMeta {
  return SUBTYPES.find((s) => s.id === id) ?? SUBTYPES[0];
}

export type CategoryDef = {
  id: string;
  label: string;
  color: string;
};

export const CATEGORIES: CategoryDef[] = [
  { id: "mercado", label: "Mercado", color: "#77C5D5" },
  { id: "alimentacao", label: "Alimentação", color: "#FB923C" },
  { id: "transporte", label: "Transporte", color: "#D6A461" },
  { id: "casa", label: "Casa", color: "#F87C56" },
  { id: "lazer", label: "Lazer", color: "#E2E99C" },
  { id: "contas", label: "Contas", color: "#A78BFA" },
  { id: "saude", label: "Saúde", color: "#EC4899" },
  { id: "educacao", label: "Educação", color: "#60A5FA" },
  { id: "vestuario", label: "Vestuário", color: "#34D399" },
  { id: "pet", label: "Pet", color: "#FBBF24" },
  { id: "assinaturas", label: "Assinaturas", color: "#818CF8" },
  { id: "trabalho", label: "Trabalho", color: "#06B6D4" },
  { id: "outros", label: "Outros", color: "#9CA3AF" },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: "salario", label: "Salário", color: "#10B981" },
  { id: "freelance", label: "Freelance", color: "#06B6D4" },
  { id: "bonus", label: "Bônus", color: "#34D399" },
  { id: "reembolso", label: "Reembolso", color: "#A78BFA" },
  { id: "venda", label: "Venda", color: "#FBBF24" },
  { id: "rendimento", label: "Rendimento", color: "#818CF8" },
  { id: "outros-income", label: "Outros", color: "#9CA3AF" },
];

export function getCategory(id: string | undefined): CategoryDef | undefined {
  if (!id) return undefined;
  return (
    CATEGORIES.find((c) => c.id === id) ??
    INCOME_CATEGORIES.find((c) => c.id === id)
  );
}

export function categoryColor(id: string | undefined): string {
  return getCategory(id)?.color ?? "#5C5C5C";
}

export function categoryLabel(id: string | undefined): string {
  return getCategory(id)?.label ?? "Sem categoria";
}

export const PAYMENT_METHODS: { id: PaymentMethodId; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "boleto", label: "Boleto" },
  { id: "transferencia", label: "Transferência" },
];

export function paymentMethodLabel(id: PaymentMethodId | undefined): string {
  return PAYMENT_METHODS.find((p) => p.id === id)?.label ?? "—";
}

export const BROKERS: { id: string; label: string }[] = [
  { id: "xp", label: "XP" },
  { id: "rico", label: "Rico" },
  { id: "nuinvest", label: "NuInvest" },
  { id: "inter", label: "Inter" },
  { id: "btg", label: "BTG" },
  { id: "itau", label: "Itaú" },
  { id: "outra", label: "Outra" },
];

export const INVESTMENT_TYPES: { id: string; label: string }[] = [
  { id: "renda_fixa", label: "Renda Fixa" },
  { id: "tesouro", label: "Tesouro Direto" },
  { id: "acoes", label: "Ações" },
  { id: "fii", label: "FIIs" },
  { id: "fundos", label: "Fundos" },
  { id: "cripto", label: "Cripto" },
  { id: "poupanca", label: "Poupança" },
  { id: "outros", label: "Outros" },
];

export function brokerLabel(id: string | undefined): string {
  return BROKERS.find((b) => b.id === id)?.label ?? id ?? "—";
}

export function investmentTypeLabel(id: string | undefined): string {
  return INVESTMENT_TYPES.find((t) => t.id === id)?.label ?? id ?? "—";
}

export const DEFAULT_TAGS: Tag[] = [
  { id: "collateral", label: "Collateral", color: "#77C5D5" },
  { id: "pessoal", label: "Pessoal", color: "#A78BFA" },
];

export const TAG_COLOR_PALETTE = [
  "#77C5D5",
  "#A78BFA",
  "#10B981",
  "#F87C56",
  "#D6A461",
  "#EC4899",
  "#60A5FA",
  "#FBBF24",
  "#34D399",
  "#06B6D4",
  "#818CF8",
  "#E2E99C",
  "#FB923C",
  "#9CA3AF",
];

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return BRL_FORMATTER.format(cents / 100);
}

export function parseBRLInput(value: string): number {
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function newEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const m = Number(month) - 1;
  return `${MONTH_LABELS[m] ?? ""} ${year}`;
}

export function formatMonthShort(month: number): string {
  return MONTH_LABELS_SHORT[month] ?? "";
}

export function monthKeyOf(dateOrKey: string): string {
  return dateOrKey.slice(0, 7);
}

// ---- Migração de entradas legadas (formato v1: type income/expense) ----

export function normalizeEntry(raw: unknown): FinanceEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const date =
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      ? r.date
      : "";
  if (!date) return null;
  const amount = Math.max(0, Math.round(Number(r.amount ?? 0)));
  if (!Number.isFinite(amount)) return null;
  const description =
    typeof r.description === "string" ? r.description.trim() : "";

  // Subtype: aceita formato novo ou converte do antigo (type: income/expense)
  let subtype: FinanceSubtype;
  if (
    r.subtype === "ganho" ||
    r.subtype === "fixa" ||
    r.subtype === "variavel" ||
    r.subtype === "divida" ||
    r.subtype === "investimento"
  ) {
    subtype = r.subtype;
  } else if (r.type === "income") {
    subtype = "ganho";
  } else if (r.type === "expense") {
    subtype = "variavel";
  } else {
    return null;
  }

  // Status: aceita formato novo ou deriva do antigo receivedAt
  let status: FinanceStatus | undefined;
  if (r.status === "pago" || r.status === "a_pagar") {
    status = r.status;
  } else if (typeof r.receivedAt === "string") {
    status = "pago";
  }

  const tag = typeof r.tag === "string" && r.tag ? r.tag : undefined;
  const category =
    typeof r.category === "string" && r.category ? r.category : undefined;
  const paymentMethod =
    r.paymentMethod === "pix" ||
    r.paymentMethod === "debito" ||
    r.paymentMethod === "credito" ||
    r.paymentMethod === "dinheiro" ||
    r.paymentMethod === "boleto" ||
    r.paymentMethod === "transferencia"
      ? r.paymentMethod
      : undefined;
  const receiptUrl =
    typeof r.receiptUrl === "string" && r.receiptUrl ? r.receiptUrl : undefined;
  const card = typeof r.card === "string" ? r.card : undefined;
  const installments =
    typeof r.installments === "string" ? r.installments : undefined;
  const debtor = typeof r.debtor === "string" ? r.debtor : undefined;
  const totalAmount =
    typeof r.totalAmount === "number" && Number.isFinite(r.totalAmount)
      ? Math.max(0, Math.round(r.totalAmount))
      : undefined;
  const broker = typeof r.broker === "string" ? r.broker : undefined;
  const investmentType =
    typeof r.investmentType === "string" ? r.investmentType : undefined;
  const auto = r.auto === true;
  const autoSource =
    typeof r.autoSource === "string" ? r.autoSource : undefined;

  return {
    id: r.id,
    subtype,
    date,
    description,
    amount,
    tag,
    status,
    category,
    paymentMethod,
    receiptUrl,
    card,
    installments,
    debtor,
    totalAmount,
    broker,
    investmentType,
    auto,
    autoSource,
  };
}

export function normalizeTag(raw: unknown): Tag | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.label !== "string" || !r.label) return null;
  const color =
    typeof r.color === "string" && r.color.startsWith("#") ? r.color : "#9CA3AF";
  return { id: r.id, label: r.label.trim(), color };
}

// ---- Filtros e somas ----

export function entriesForMonth(
  entries: FinanceEntry[],
  monthKey: string
): FinanceEntry[] {
  return entries.filter((e) => monthKeyOf(e.date) === monthKey);
}

export function entriesForYear(
  entries: FinanceEntry[],
  year: number
): FinanceEntry[] {
  const prefix = `${year}-`;
  return entries.filter((e) => e.date.startsWith(prefix));
}

export function entriesBySubtype(
  entries: FinanceEntry[],
  subtype: FinanceSubtype
): FinanceEntry[] {
  return entries.filter((e) => e.subtype === subtype);
}

export function sumAmount(entries: FinanceEntry[]): number {
  let total = 0;
  for (const e of entries) total += e.amount;
  return total;
}

export type MonthSummary = {
  ganhos: number;
  fixos: number;
  variaveis: number;
  dividas: number;
  investimentos: number;
  ganhosRecebidos: number;
  ganhosAReceber: number;
  fixasPagas: number;
  fixasAPagar: number;
  variaveisPagas: number;
  variaveisAPagar: number;
  balanco: number; // ganhos - fixos - variaveis - dividas
};

export function summarizeMonthByType(
  entries: FinanceEntry[]
): MonthSummary {
  const sum: MonthSummary = {
    ganhos: 0,
    fixos: 0,
    variaveis: 0,
    dividas: 0,
    investimentos: 0,
    ganhosRecebidos: 0,
    ganhosAReceber: 0,
    fixasPagas: 0,
    fixasAPagar: 0,
    variaveisPagas: 0,
    variaveisAPagar: 0,
    balanco: 0,
  };
  for (const e of entries) {
    switch (e.subtype) {
      case "ganho":
        sum.ganhos += e.amount;
        if (e.status === "pago") sum.ganhosRecebidos += e.amount;
        else sum.ganhosAReceber += e.amount;
        break;
      case "fixa":
        sum.fixos += e.amount;
        if (e.status === "pago") sum.fixasPagas += e.amount;
        else sum.fixasAPagar += e.amount;
        break;
      case "variavel":
        sum.variaveis += e.amount;
        if (e.status === "pago") sum.variaveisPagas += e.amount;
        else sum.variaveisAPagar += e.amount;
        break;
      case "divida":
        sum.dividas += e.amount;
        break;
      case "investimento":
        sum.investimentos += e.amount;
        break;
    }
  }
  sum.balanco = sum.ganhos - sum.fixos - sum.variaveis - sum.dividas;
  return sum;
}

export function summarizeByTag(
  entries: FinanceEntry[],
  tags: Tag[]
): { tag?: Tag; tagId?: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const key = e.tag ?? "__none__";
    totals.set(key, (totals.get(key) ?? 0) + e.amount);
  }
  const result: { tag?: Tag; tagId?: string; total: number }[] = [];
  for (const [tagId, total] of totals) {
    if (tagId === "__none__") {
      result.push({ total });
    } else {
      const tag = tags.find((t) => t.id === tagId);
      result.push({ tag, tagId, total });
    }
  }
  return result.sort((a, b) => b.total - a.total);
}

// ---- Receitas automáticas vindas do calendário do Collateral ----

const COLLATERAL_DAILY_RATE_CENTS = 10500;

export function generateCollateralAutoIncomes(
  workdays: Set<string>,
  paidMonths: Set<string>
): FinanceEntry[] {
  const dayCountByMonth = new Map<string, number>();
  for (const day of workdays) {
    const m = monthKeyOf(day);
    dayCountByMonth.set(m, (dayCountByMonth.get(m) ?? 0) + 1);
  }
  const out: FinanceEntry[] = [];
  for (const [monthKey, days] of dayCountByMonth) {
    if (days === 0) continue;
    const amount = days * COLLATERAL_DAILY_RATE_CENTS;
    const isPaid = paidMonths.has(monthKey);
    out.push({
      id: `auto:collateral:${monthKey}`,
      subtype: "ganho",
      date: `${monthKey}-01`,
      description: `Salário Collateral · ${formatMonthLabel(monthKey)} (${days} ${days === 1 ? "dia" : "dias"})`,
      amount,
      tag: "collateral",
      status: isPaid ? "pago" : "a_pagar",
      auto: true,
      autoSource: "calendar:collateral",
    });
  }
  return out;
}
