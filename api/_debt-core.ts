// Lógica pura da API de quitação. Compartilhada por api/debt.ts (edge) e pelo
// mock do vite dev em vite.config.ts. Sem imports exclusivos de Node aqui.

export const DEBT_METHODS = [
  "pix",
  "debito",
  "credito",
  "dinheiro",
  "boleto",
  "transferencia",
] as const;

export type DebtMethod = (typeof DEBT_METHODS)[number];

export type DebtPayment = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // centavos
  method: DebtMethod;
  note?: string;
  status: "pendente" | "pago";
  paidAt?: string; // ISO
};

export type DebtActor = "ane" | "thais";

export type DebtActivity = {
  id: string;
  at: string; // ISO
  type: "criado" | "editado" | "apagado" | "pago";
  by?: DebtActor;
  paymentId: string;
  amount: number;
  date: string;
  method: DebtMethod;
  // Em "editado": como o pagamento estava antes.
  prev?: { amount: number; date: string; method: DebtMethod };
};

export const LOCKED_MESSAGE = "Pagamento já quitado — bloqueado para alterações.";

function parseObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

export function normalizePayment(raw: unknown): DebtPayment | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  if (typeof obj.id !== "string" || !obj.id) return null;
  if (typeof obj.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date))
    return null;
  const amount = Math.round(Number(obj.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const method = DEBT_METHODS.includes(obj.method as DebtMethod)
    ? (obj.method as DebtMethod)
    : "pix";
  const out: DebtPayment = {
    id: obj.id,
    date: obj.date,
    amount,
    method,
    status: obj.status === "pago" ? "pago" : "pendente",
  };
  if (typeof obj.note === "string" && obj.note.trim())
    out.note = obj.note.trim().slice(0, 200);
  if (typeof obj.paidAt === "string") out.paidAt = obj.paidAt;
  return out;
}

export function normalizeActivity(raw: unknown): DebtActivity | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  if (typeof obj.id !== "string" || typeof obj.at !== "string") return null;
  if (!["criado", "editado", "apagado", "pago"].includes(obj.type as string))
    return null;
  if (typeof obj.paymentId !== "string" || typeof obj.amount !== "number")
    return null;
  return obj as unknown as DebtActivity;
}

export type DebtWriteOp =
  | { type: "set"; payment: DebtPayment }
  | { type: "del"; id: string };

export type DebtActionResult =
  | { ok: true; op: DebtWriteOp; activity?: DebtActivity }
  | { ok: false; status: number; error: string };

/**
 * Aplica um POST sobre o estado atual. Pura: devolve a escrita a fazer e o
 * evento do histórico, ou o erro com status HTTP.
 * Pagamento pago é imutável (sem editar, sem excluir, sem desfazer).
 */
export function applyAction(
  current: DebtPayment[],
  body: unknown,
  now: () => string = () => new Date().toISOString()
): DebtActionResult {
  const b = (body && typeof body === "object" ? body : {}) as {
    action?: unknown;
    payment?: unknown;
    id?: unknown;
    by?: unknown;
  };
  const by: DebtActor | undefined =
    b.by === "ane" || b.by === "thais" ? b.by : undefined;
  const at = now();
  const bad = { ok: false as const, status: 400, error: "bad request" };
  const locked = { ok: false as const, status: 423, error: LOCKED_MESSAGE };
  const find = (id: string) => current.find((p) => p.id === id);

  const event = (
    type: DebtActivity["type"],
    p: DebtPayment,
    prev?: DebtPayment
  ): DebtActivity => {
    const a: DebtActivity = {
      id: `${Date.parse(at).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at,
      type,
      paymentId: p.id,
      amount: p.amount,
      date: p.date,
      method: p.method,
    };
    if (by) a.by = by;
    if (prev) a.prev = { amount: prev.amount, date: prev.date, method: prev.method };
    return a;
  };

  if (b.action === "upsert") {
    const p = normalizePayment(b.payment);
    if (!p) return bad;
    const prev = find(p.id);
    if (prev?.status === "pago") return locked;
    if (p.status === "pago") {
      if (!p.paidAt) p.paidAt = at;
    } else {
      delete p.paidAt;
    }
    const type =
      p.status === "pago" ? "pago" : prev ? "editado" : "criado";
    return {
      ok: true,
      op: { type: "set", payment: p },
      activity: event(type, p, type === "editado" ? prev : undefined),
    };
  }

  if (b.action === "delete") {
    if (typeof b.id !== "string" || !b.id) return bad;
    const existing = find(b.id);
    if (existing?.status === "pago") return locked;
    return {
      ok: true,
      op: { type: "del", id: b.id },
      activity: existing ? event("apagado", existing) : undefined,
    };
  }

  return bad;
}
