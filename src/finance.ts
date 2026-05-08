// Valores monetários sempre em centavos (inteiros) pra evitar arredondamento.

export type FinanceEntryType = "income" | "expense";

export type FinanceEntry = {
  id: string;
  type: FinanceEntryType;
  date: string; // YYYY-MM-DD (data da despesa ou da competência da receita)
  description: string;
  amount: number; // centavos, sempre positivo
  category: string;
  receivedAt?: string; // YYYY-MM-DD — se recebida (income); ausente = pendente
  auto?: boolean; // gerada do calendário, não editável
  autoSource?: string; // "calendar:collateral", etc.
};

export type CategoryDef = {
  id: string;
  label: string;
  color: string;
  type: FinanceEntryType;
};

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: "mercado", label: "Mercado", color: "#77C5D5", type: "expense" },
  { id: "transporte", label: "Transporte", color: "#D6A461", type: "expense" },
  { id: "casa", label: "Casa", color: "#F87C56", type: "expense" },
  { id: "lazer", label: "Lazer", color: "#E2E99C", type: "expense" },
  { id: "contas", label: "Contas", color: "#A78BFA", type: "expense" },
  { id: "saude", label: "Saúde", color: "#EC4899", type: "expense" },
  { id: "outros-expense", label: "Outros", color: "#9CA3AF", type: "expense" },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: "salario", label: "Salário", color: "#10B981", type: "income" },
  { id: "freelance", label: "Freelance", color: "#06B6D4", type: "income" },
  { id: "outros-income", label: "Outros", color: "#9CA3AF", type: "income" },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategory(id: string): CategoryDef | undefined {
  return ALL_CATEGORIES.find((c) => c.id === id);
}

export function categoryColor(id: string): string {
  return getCategory(id)?.color ?? "#5C5C5C";
}

export function categoryLabel(id: string): string {
  return getCategory(id)?.label ?? "Sem categoria";
}

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return BRL_FORMATTER.format(cents / 100);
}

export function parseBRLInput(value: string): number {
  // Aceita "1.234,56" ou "1234.56" ou "1234,56" ou "1234"
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  // Se tem vírgula como separador decimal pt-BR, troca por ponto
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

export function normalizeEntry(raw: unknown): FinanceEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const type = r.type === "income" ? "income" : "expense";
  const date =
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      ? r.date
      : "";
  if (!date) return null;
  const amount = Math.max(0, Math.round(Number(r.amount ?? 0)));
  if (!Number.isFinite(amount)) return null;
  const description =
    typeof r.description === "string" ? r.description.trim() : "";
  const category =
    typeof r.category === "string" ? r.category : type === "income" ? "outros-income" : "outros-expense";
  const receivedAt =
    typeof r.receivedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.receivedAt)
      ? r.receivedAt
      : undefined;
  return {
    id: r.id,
    type,
    date,
    description,
    amount,
    category,
    receivedAt,
  };
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

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const m = Number(month) - 1;
  return `${MONTH_LABELS[m] ?? ""} ${year}`;
}

export function monthKeyOf(dateOrKey: string): string {
  // Aceita YYYY-MM-DD ou YYYY-MM
  return dateOrKey.slice(0, 7);
}

export function entriesForMonth(
  entries: FinanceEntry[],
  monthKey: string
): FinanceEntry[] {
  return entries.filter((e) => monthKeyOf(e.date) === monthKey);
}

export type MonthSummary = {
  received: number;
  pending: number;
  spent: number;
  balance: number; // received - spent
};

export function summarizeMonth(entries: FinanceEntry[]): MonthSummary {
  let received = 0;
  let pending = 0;
  let spent = 0;
  for (const e of entries) {
    if (e.type === "income") {
      if (e.receivedAt) received += e.amount;
      else pending += e.amount;
    } else {
      spent += e.amount;
    }
  }
  return { received, pending, spent, balance: received - spent };
}

// ---- Receitas automáticas vindas do calendário do Collateral ----

const COLLATERAL_DAILY_RATE_CENTS = 10500; // R$ 105,00

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
      type: "income",
      date: `${monthKey}-01`,
      description: `Salário Collateral · ${formatMonthLabel(monthKey)} (${days} ${days === 1 ? "dia" : "dias"})`,
      amount,
      category: "salario",
      receivedAt: isPaid ? `${monthKey}-01` : undefined,
      auto: true,
      autoSource: "calendar:collateral",
    });
  }
  return out;
}
