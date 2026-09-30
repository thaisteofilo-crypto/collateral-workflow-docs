import { useEffect, useMemo, useState } from "react";

// Valores em centavos.
export const DEBT_TOTAL = 1_180_000; // R$ 11.800,00

type Method =
  | "pix"
  | "debito"
  | "credito"
  | "dinheiro"
  | "boleto"
  | "transferencia";

type Payment = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  method: Method;
  note?: string;
  status: "pendente" | "pago";
  paidAt?: string;
};

const METHODS: { id: Method; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "transferencia", label: "Transferência" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "boleto", label: "Boleto" },
  { id: "dinheiro", label: "Dinheiro" },
];
const methodLabel = (m: Method) =>
  METHODS.find((x) => x.id === m)?.label ?? m;

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const brl = (c: number) => BRL.format(c / 100);

function parseBRL(v: string): number {
  const s = v.trim().replace(/[^\d,.]/g, "");
  if (!s) return 0;
  const n = s.includes(",")
    ? Number(s.replace(/\./g, "").replace(",", "."))
    : Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const fmtDate = (d: string) => d.split("-").reverse().join("/");
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const newId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ---- Persistência -------------------------------------------------------
// Produção: /api/debt (Vercel + Redis). Em `npm run dev` a API não existe,
// então cai num armazenamento local do navegador para teste.
const LOCAL_KEY = "collateral.debt.dev.v1";
let useLocal = false;

function readLocal(): Payment[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as Payment[];
  } catch {
    return [];
  }
}
function writeLocal(list: Payment[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

async function apiCall(init?: RequestInit): Promise<Payment[]> {
  const res = await fetch("/api/debt", { cache: "no-store", ...init });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new Error("NO_API");
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? "Falha ao salvar";
    throw new Error(msg);
  }
  return Array.isArray(data) ? (data as Payment[]) : [];
}

async function loadPayments(): Promise<Payment[]> {
  if (useLocal) return readLocal();
  try {
    return await apiCall();
  } catch (e) {
    if (import.meta.env.DEV && e instanceof Error && e.message === "NO_API") {
      useLocal = true;
      return readLocal();
    }
    throw e;
  }
}

async function upsertPayment(p: Payment): Promise<Payment[]> {
  if (useLocal) {
    const list = readLocal();
    const prev = list.find((x) => x.id === p.id);
    if (prev?.status === "pago")
      throw new Error("Pagamento já quitado — bloqueado para alterações.");
    const next = [...list.filter((x) => x.id !== p.id), p];
    writeLocal(next);
    return next;
  }
  return apiCall({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "upsert", payment: p, by: actor }),
  });
}

async function deletePayment(id: string): Promise<Payment[]> {
  if (useLocal) {
    const list = readLocal();
    if (list.find((x) => x.id === id)?.status === "pago")
      throw new Error("Pagamento já quitado — bloqueado para alterações.");
    const next = list.filter((x) => x.id !== id);
    writeLocal(next);
    return next;
  }
  return apiCall({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete", id, by: actor }),
  });
}

type Activity = {
  id: string;
  at: string;
  type: "criado" | "editado" | "apagado" | "pago";
  by?: "ane" | "thais";
  paymentId: string;
  amount: number;
  date: string;
  method: Method;
  prev?: { amount: number; date: string; method: Method };
};

async function loadActivity(): Promise<Activity[]> {
  if (useLocal) return [];
  const res = await fetch("/api/debt?activity=1", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as Activity[]) : [];
}

// Quem está agindo, enviado junto de cada escrita para o histórico.
let actor: "ane" | "thais" | undefined;

// ---- Componente ---------------------------------------------------------

type Draft = { date: string; amount: string; method: Method; note: string };
const emptyDraft = (): Draft => ({
  date: today(),
  amount: "",
  method: "pix",
  note: "",
});

export function DebtPayoff({
  canEdit,
  profile,
}: {
  canEdit: boolean;
  profile?: "ane" | "thais";
}) {
  actor = profile;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPayments()
      .then(setPayments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    loadActivity().then(setActivity).catch(() => {});
  }, []);

  const paid = useMemo(
    () =>
      payments
        .filter((p) => p.status === "pago")
        .reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const pending = useMemo(
    () =>
      payments
        .filter((p) => p.status === "pendente")
        .reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const remaining = Math.max(0, DEBT_TOTAL - paid);
  const pct = Math.min(100, (paid / DEBT_TOTAL) * 100);
  const afterPending = Math.max(0, DEBT_TOTAL - paid - pending);

  // Agrupa por mês (mais recente primeiro) e calcula o saldo restante
  // cronológico após cada pagamento quitado.
  const { months, balanceAfter } = useMemo(() => {
    const sorted = [...payments].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const bal: Record<string, number> = {};
    let acc = DEBT_TOTAL;
    for (const p of sorted) {
      if (p.status === "pago") {
        acc = Math.max(0, acc - p.amount);
        bal[p.id] = acc;
      }
    }
    const groups = new Map<string, Payment[]>();
    for (const p of [...sorted].reverse()) {
      const k = p.date.slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    return { months: [...groups.entries()], balanceAfter: bal };
  }, [payments]);

  async function run(fn: () => Promise<Payment[]>) {
    setBusy(true);
    setError(null);
    try {
      setPayments(await fn());
      loadActivity().then(setActivity).catch(() => {});
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseBRL(draft.amount);
    if (amount <= 0) return setError("Informe um valor maior que zero.");
    if (!draft.date) return setError("Informe a data.");
    const prev = payments.find((p) => p.id === editingId);
    const payment: Payment = {
      id: editingId ?? newId(),
      date: draft.date,
      amount,
      method: draft.method,
      note: draft.note.trim() || undefined,
      status: prev?.status ?? "pendente",
    };
    if (await run(() => upsertPayment(payment))) {
      setDraft(emptyDraft());
      setEditingId(null);
    }
  }

  function startEdit(p: Payment) {
    if (p.status === "pago") return;
    setEditingId(p.id);
    setDraft({
      date: p.date,
      amount: (p.amount / 100).toFixed(2).replace(".", ","),
      method: p.method,
      note: p.note ?? "",
    });
  }

  async function markPaid(p: Payment) {
    setConfirmPayId(null);
    await run(() =>
      upsertPayment({ ...p, status: "pago", paidAt: new Date().toISOString() })
    );
    if (editingId === p.id) {
      setEditingId(null);
      setDraft(emptyDraft());
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-text">
          <span className="page-header-cat">Financeiro</span>
          <h1 className="page-header-title">Quitação da Dívida</h1>
          <p className="page-header-sub">
            Total de {brl(DEBT_TOTAL)}. Registre cada pagamento, marque como
            pago — pagamentos quitados ficam bloqueados.
          </p>
        </div>
      </header>

      <div className="debt-page">
        {/* Resumo */}
        <div className="step-card debt-summary">
          <div className="debt-remaining">
            <span className="debt-label">Falta para zerar</span>
            <span className="debt-remaining-value">{brl(remaining)}</span>
            {remaining === 0 && (
              <span className="debt-done">Dívida quitada ✓</span>
            )}
          </div>
          <div className="debt-progress" aria-label={`${pct.toFixed(1)}% quitado`}>
            <div className="debt-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="debt-stats">
            <Stat label="Total" value={brl(DEBT_TOTAL)} />
            <Stat label="Pago" value={brl(paid)} tone="ok" />
            <Stat label="Quitado" value={`${pct.toFixed(1)}%`} />
            <Stat
              label="Lançado (pendente)"
              value={brl(pending)}
              hint={pending > 0 ? `restará ${brl(afterPending)}` : undefined}
              tone="warn"
            />
          </div>
        </div>

        {/* Formulário */}
        {canEdit && (
          <form className="step-card debt-form" onSubmit={submit}>
            <span className="debt-form-title">
              {editingId ? "Editar pagamento" : "Novo pagamento"}
            </span>
            <div className="debt-form-grid">
              <label className="debt-field">
                <span>Valor (R$)</span>
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  autoFocus
                />
              </label>
              <label className="debt-field">
                <span>Data</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label className="debt-field">
                <span>Meio de pagamento</span>
                <select
                  value={draft.method}
                  onChange={(e) =>
                    setDraft({ ...draft, method: e.target.value as Method })
                  }
                >
                  {METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="debt-field debt-field-wide">
                <span>Observação (opcional)</span>
                <input
                  placeholder="ex.: parcela extra, adiantamento…"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </label>
            </div>
            <div className="debt-form-actions">
              {editingId && (
                <button
                  type="button"
                  className="debt-btn is-ghost"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(emptyDraft());
                  }}
                >
                  Cancelar
                </button>
              )}
              <button type="submit" className="debt-btn is-primary" disabled={busy}>
                {editingId ? "Salvar alterações" : "Adicionar pagamento"}
              </button>
            </div>
          </form>
        )}

        {error && <div className="debt-error">{error}</div>}

        {/* Lista por mês */}
        {loading ? (
          <div className="step-card debt-empty">Carregando…</div>
        ) : months.length === 0 ? (
          <div className="step-card debt-empty">
            Nenhum pagamento registrado ainda.
          </div>
        ) : (
          months.map(([key, list]) => {
            const monthPaid = list
              .filter((p) => p.status === "pago")
              .reduce((s, p) => s + p.amount, 0);
            const monthPending = list
              .filter((p) => p.status === "pendente")
              .reduce((s, p) => s + p.amount, 0);
            return (
              <section key={key} className="step-card debt-month">
                <div className="debt-month-header">
                  <span className="debt-month-title">{monthLabel(key)}</span>
                  <span className="debt-month-total">
                    {brl(monthPaid)} pago
                    {monthPending > 0 && (
                      <em> · {brl(monthPending)} pendente</em>
                    )}
                  </span>
                </div>
                <div className="debt-table">
                  <div className="debt-row debt-row-head">
                    <span>Data</span>
                    <span>Valor</span>
                    <span>Meio</span>
                    <span>Saldo após</span>
                    <span>Status</span>
                    <span />
                  </div>
                  {list.map((p) => {
                    const locked = p.status === "pago";
                    return (
                      <div
                        key={p.id}
                        className={`debt-row${locked ? " is-locked" : ""}${
                          editingId === p.id ? " is-editing" : ""
                        }`}
                      >
                        <span data-l="Data">
                          {fmtDate(p.date)}
                          {p.note && <small className="debt-note">{p.note}</small>}
                        </span>
                        <span data-l="Valor" className="debt-amount">
                          {brl(p.amount)}
                        </span>
                        <span data-l="Meio">{methodLabel(p.method)}</span>
                        <span data-l="Saldo após" className="debt-balance">
                          {locked ? brl(balanceAfter[p.id] ?? 0) : "—"}
                        </span>
                        <span data-l="Status">
                          {locked ? (
                            <span
                              className="debt-chip is-paid"
                              title={
                                p.paidAt
                                  ? `Quitado em ${new Date(p.paidAt).toLocaleString("pt-BR")}`
                                  : undefined
                              }
                            >
                              🔒 Pago
                            </span>
                          ) : (
                            <span className="debt-chip is-pending">Pendente</span>
                          )}
                        </span>
                        <span className="debt-actions">
                          {!locked && canEdit && (
                            confirmPayId === p.id ? (
                              <>
                                <button
                                  className="debt-btn is-primary is-sm"
                                  disabled={busy}
                                  onClick={() => markPaid(p)}
                                >
                                  Confirmar
                                </button>
                                <button
                                  className="debt-btn is-ghost is-sm"
                                  onClick={() => setConfirmPayId(null)}
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="debt-btn is-primary is-sm"
                                  onClick={() => setConfirmPayId(p.id)}
                                  title="Depois de pago, o registro é bloqueado"
                                >
                                  Marcar pago
                                </button>
                                <button
                                  className="debt-btn is-ghost is-sm"
                                  onClick={() => startEdit(p)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="debt-btn is-ghost is-sm is-danger"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Excluir o pagamento de ${brl(p.amount)} (${fmtDate(p.date)})?`
                                      )
                                    )
                                      run(() => deletePayment(p.id));
                                  }}
                                >
                                  Excluir
                                </button>
                              </>
                            )
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <ActivityLog activity={activity} />
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className={`debt-stat${tone ? ` is-${tone}` : ""}`}>
      <span className="debt-label">{label}</span>
      <span className="debt-stat-value">{value}</span>
      {hint && <span className="debt-stat-hint">{hint}</span>}
    </div>
  );
}

const ACTIVITY_LABELS: Record<Activity["type"], string> = {
  criado: "registrou",
  editado: "editou",
  apagado: "excluiu",
  pago: "marcou como pago",
};
const ACTOR_LABELS = { ane: "Ane", thais: "Thais" } as const;

function describeChanges(a: Activity): string {
  if (a.type !== "editado" || !a.prev) return "";
  const parts: string[] = [];
  if (a.prev.amount !== a.amount)
    parts.push(`valor ${brl(a.prev.amount)} → ${brl(a.amount)}`);
  if (a.prev.date !== a.date)
    parts.push(`data ${fmtDate(a.prev.date)} → ${fmtDate(a.date)}`);
  if (a.prev.method !== a.method)
    parts.push(`meio ${methodLabel(a.prev.method)} → ${methodLabel(a.method)}`);
  return parts.join(" · ");
}

function ActivityLog({ activity }: { activity: Activity[] }) {
  return (
    <section className="step-card debt-month">
      <div className="debt-month-header">
        <span className="debt-month-title">Histórico de atividade</span>
        <span className="debt-month-total">
          {activity.length} {activity.length === 1 ? "registro" : "registros"}
        </span>
      </div>
      {activity.length === 0 ? (
        <span className="debt-activity-empty">Nenhuma atividade ainda.</span>
      ) : (
        <ul className="debt-activity">
          {activity.map((a) => {
            const changes = describeChanges(a);
            const verb = ACTIVITY_LABELS[a.type];
            return (
              <li key={a.id} className={`debt-activity-item is-${a.type}`}>
                <span className="debt-activity-dot" aria-hidden />
                <div className="debt-activity-main">
                  <span className="debt-activity-text">
                    <strong>{a.by ? ACTOR_LABELS[a.by] : "Alguém"}</strong> {verb}{" "}
                    {brl(a.amount)} · {fmtDate(a.date)} · {methodLabel(a.method)}
                  </span>
                  {changes && (
                    <span className="debt-activity-changes">{changes}</span>
                  )}
                </div>
                <time className="debt-activity-time" dateTime={a.at}>
                  {new Date(a.at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
