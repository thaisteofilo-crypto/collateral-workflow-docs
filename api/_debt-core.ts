// Pure logic for the debt payoff API. Shared by api/debt.ts (edge) and the
// vite dev mock in vite.config.ts. No Node-only imports allowed here.

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
  month: string; // "YYYY-MM"
  date: string; // "YYYY-MM-DD"
  amount: number; // cents, integer > 0
  method: DebtMethod;
  note?: string; // trimmed, max 200 chars
  paid: boolean;
  paidAt?: string; // ISO timestamp, set by server
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const NOTE_MAX = 200;
const ID_MAX = 128;

/**
 * Validates and normalizes a payment (object or JSON string, as stored in
 * Redis). Returns null when invalid. Preserves paid/paidAt as given; callers
 * handling client input must force them (see applyAction).
 */
export function normalizePayment(raw: unknown): DebtPayment | null {
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;

  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  if (!id || id.length > ID_MAX) return null;
  const month = typeof obj.month === "string" ? obj.month : "";
  if (!MONTH_RE.test(month)) return null;
  const date = typeof obj.date === "string" ? obj.date : "";
  if (!DATE_RE.test(date)) return null;
  const amount = obj.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0)
    return null;
  const method = obj.method;
  if (typeof method !== "string" || !(DEBT_METHODS as readonly string[]).includes(method))
    return null;

  const out: DebtPayment = {
    id,
    month,
    date,
    amount,
    method: method as DebtMethod,
    paid: obj.paid === true,
  };
  if (typeof obj.note === "string") {
    const note = obj.note.trim().slice(0, NOTE_MAX);
    if (note) out.note = note;
  }
  if (out.paid && typeof obj.paidAt === "string" && obj.paidAt) {
    out.paidAt = obj.paidAt;
  }
  return out;
}

export type DebtActor = "ane" | "thais";

export type DebtActivity = {
  id: string;
  at: string; // ISO timestamp
  type: "criado" | "editado" | "apagado" | "pago";
  by?: DebtActor;
  paymentId: string;
  amount: number;
  month: string;
  date: string;
  method: DebtMethod;
  // Em "editado": como o pagamento estava antes.
  prev?: { amount: number; month: string; date: string; method: DebtMethod };
};

export function normalizeActivity(raw: unknown): DebtActivity | null {
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const types = ["criado", "editado", "apagado", "pago"];
  if (typeof obj.id !== "string" || typeof obj.at !== "string") return null;
  if (typeof obj.type !== "string" || !types.includes(obj.type)) return null;
  if (typeof obj.paymentId !== "string") return null;
  if (typeof obj.amount !== "number") return null;
  return obj as unknown as DebtActivity;
}

export type DebtWriteOp =
  | { type: "set"; payment: DebtPayment }
  | { type: "del"; id: string }
  | { type: "none" };

export type DebtActionResult =
  | { ok: true; op: DebtWriteOp; next: DebtPayment[]; activity?: DebtActivity }
  | { ok: false; status: number; error: string };

/**
 * Applies a POST body to the current list. Pure: returns the write to perform
 * and the resulting list, or an error with its HTTP status.
 * Paid payments are permanently locked (no update, no delete, no un-pay).
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
  const activity = (
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
      month: p.month,
      date: p.date,
      method: p.method,
    };
    if (by) a.by = by;
    if (prev) {
      a.prev = { amount: prev.amount, month: prev.month, date: prev.date, method: prev.method };
    }
    return a;
  };
  const byId = new Map(current.map((p) => [p.id, p]));
  const bad = { ok: false as const, status: 400, error: "bad request" };
  const locked = { ok: false as const, status: 409, error: "locked" };

  if (b.action === "upsert") {
    const payment = normalizePayment(b.payment);
    if (!payment) return bad;
    payment.paid = false;
    delete payment.paidAt;
    const prev = byId.get(payment.id);
    if (prev?.paid) return locked;
    byId.set(payment.id, payment);
    return {
      ok: true,
      op: { type: "set", payment },
      next: [...byId.values()],
      activity: prev ? activity("editado", payment, prev) : activity("criado", payment),
    };
  }

  if (b.action === "delete" || b.action === "markPaid") {
    if (typeof b.id !== "string" || !b.id) return bad;
    const existing = byId.get(b.id);

    if (b.action === "delete") {
      if (existing?.paid) return locked;
      byId.delete(b.id);
      return {
        ok: true,
        op: { type: "del", id: b.id },
        next: [...byId.values()],
        activity: existing ? activity("apagado", existing) : undefined,
      };
    }

    if (!existing) return { ok: false, status: 404, error: "not found" };
    if (existing.paid) return { ok: true, op: { type: "none" }, next: current };
    const payment: DebtPayment = { ...existing, paid: true, paidAt: at };
    byId.set(payment.id, payment);
    return {
      ok: true,
      op: { type: "set", payment },
      next: [...byId.values()],
      activity: activity("pago", payment),
    };
  }

  return bad;
}
