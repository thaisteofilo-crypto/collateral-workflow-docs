import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PaymentMethodId,
  PAYMENT_METHODS,
  formatBRL,
  formatMonthLabel,
  newEntryId,
  parseBRLInput,
  paymentMethodLabel,
} from "../finance";

// Valor total da dívida, em centavos.
export const DEBT_TOTAL_CENTS = 1_180_000;

const POLL_INTERVAL_MS = 60_000;
const CACHE_KEY = "collateral.debt.payments.ane";

export type DebtPayment = {
  id: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  amount: number; // centavos
  method: PaymentMethodId;
  note?: string;
  paid: boolean;
  paidAt?: string;
};

function normalizePayment(raw: unknown): DebtPayment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.month !== "string" || !/^\d{4}-\d{2}$/.test(r.month)) return null;
  if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  const amount = Math.round(Number(r.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const method = PAYMENT_METHODS.find((p) => p.id === r.method)?.id;
  if (!method) return null;
  return {
    id: r.id,
    month: r.month,
    date: r.date,
    amount,
    method,
    note: typeof r.note === "string" && r.note ? r.note : undefined,
    paid: r.paid === true,
    paidAt: typeof r.paidAt === "string" ? r.paidAt : undefined,
  };
}

export type DebtActivity = {
  id: string;
  at: string;
  type: "criado" | "editado" | "apagado" | "pago";
  by?: "ane" | "thais";
  paymentId: string;
  amount: number;
  month: string;
  date: string;
  method: PaymentMethodId;
  prev?: { amount: number; month: string; date: string; method: PaymentMethodId };
};

async function fetchActivity(signal?: AbortSignal): Promise<DebtActivity[]> {
  const res = await fetch("/api/debt?activity=1", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar histórico");
  const raw = (await res.json()) as unknown;
  return Array.isArray(raw) ? (raw as DebtActivity[]) : [];
}

function parseList(raw: unknown): DebtPayment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => normalizePayment(r))
    .filter((p): p is DebtPayment => p !== null);
}

async function fetchPayments(signal?: AbortSignal): Promise<DebtPayment[]> {
  const res = await fetch("/api/debt", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar pagamentos");
  return parseList(await res.json());
}

class LockedError extends Error {}

async function postAction(body: Record<string, unknown>): Promise<DebtPayment[]> {
  const res = await fetch("/api/debt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) throw new LockedError("Pagamento já confirmado");
  if (!res.ok) throw new Error("Falha ao salvar");
  return parseList(await res.json());
}

function loadCache(): DebtPayment[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseList(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveCache(payments: DebtPayment[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payments));
  } catch {
    // ignore
  }
}

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function formatPaidAt(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

type Draft = {
  id?: string;
  month: string;
  date: string;
  amount: string;
  method: PaymentMethodId;
  note: string;
};

function emptyDraft(): Draft {
  const date = todayISO();
  return { month: date.slice(0, 7), date, amount: "", method: "pix", note: "" };
}

export function DebtPayoff({
  readOnly = false,
  canMarkPaid = false,
  actor,
}: {
  readOnly?: boolean;
  canMarkPaid?: boolean;
  actor?: "ane" | "thais";
}) {
  const [payments, setPayments] = useState<DebtPayment[]>(() => loadCache());
  const [activity, setActivity] = useState<DebtActivity[]>([]);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "online" | "offline"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const pendingWrites = useRef(0);

  useEffect(() => {
    saveCache(payments);
  }, [payments]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function sync(initial: boolean) {
      if (pendingWrites.current > 0) return;
      try {
        if (initial) setSyncStatus("syncing");
        const [fresh, log] = await Promise.all([
          fetchPayments(controller.signal),
          fetchActivity(controller.signal),
        ]);
        if (cancelled || pendingWrites.current > 0) return;
        setPayments(fresh);
        setActivity(log);
        setSyncStatus("online");
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setSyncStatus("offline");
      }
    }

    sync(true);
    const id = window.setInterval(() => sync(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  async function run(body: Record<string, unknown>) {
    pendingWrites.current += 1;
    setSyncStatus("syncing");
    setError(null);
    try {
      setPayments(await postAction({ ...body, by: actor }));
      setSyncStatus("online");
      fetchActivity().then(setActivity).catch(() => {});
      return true;
    } catch (err) {
      if (err instanceof LockedError) {
        setError("Esse pagamento já foi confirmado como pago e está bloqueado.");
        setSyncStatus("online");
        try {
          setPayments(await fetchPayments());
        } catch {
          // ignore
        }
      } else {
        setError("Não foi possível salvar. Verifique a conexão e tente de novo.");
        setSyncStatus("offline");
      }
      return false;
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  const stats = useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const p of payments) {
      if (p.paid) paid += p.amount;
      else pending += p.amount;
    }
    const remaining = Math.max(0, DEBT_TOTAL_CENTS - paid);
    const projected = Math.max(0, DEBT_TOTAL_CENTS - paid - pending);
    return {
      paid,
      pending,
      remaining,
      projected,
      paidPct: Math.min(100, (paid / DEBT_TOTAL_CENTS) * 100),
      pendingPct: Math.min(
        100 - Math.min(100, (paid / DEBT_TOTAL_CENTS) * 100),
        (pending / DEBT_TOTAL_CENTS) * 100
      ),
    };
  }, [payments]);

  // Ordem cronológica, com o saldo restante após cada pagamento confirmado.
  const months = useMemo(() => {
    const sorted = [...payments].sort(
      (a, b) =>
        a.month.localeCompare(b.month) ||
        a.date.localeCompare(b.date) ||
        a.id.localeCompare(b.id)
    );
    let running = DEBT_TOTAL_CENTS;
    const groups = new Map<
      string,
      { month: string; total: number; paid: number; rows: { p: DebtPayment; after: number | null }[] }
    >();
    for (const p of sorted) {
      let after: number | null = null;
      if (p.paid) {
        running = Math.max(0, running - p.amount);
        after = running;
      }
      const g =
        groups.get(p.month) ??
        { month: p.month, total: 0, paid: 0, rows: [] };
      g.total += p.amount;
      if (p.paid) g.paid += p.amount;
      g.rows.push({ p, after });
      groups.set(p.month, g);
    }
    return [...groups.values()].reverse();
  }, [payments]);

  const draftAmount = parseBRLInput(draft.amount);
  const canSubmit =
    !readOnly &&
    draftAmount > 0 &&
    /^\d{4}-\d{2}$/.test(draft.month) &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!canSubmit) return;
    const payment: DebtPayment = {
      id: draft.id ?? newEntryId(),
      month: draft.month,
      date: draft.date,
      amount: draftAmount,
      method: draft.method,
      note: draft.note.trim() || undefined,
      paid: false,
    };
    const ok = await run({ action: "upsert", payment });
    if (ok) setDraft(emptyDraft());
  }

  function startEdit(p: DebtPayment) {
    if (p.paid || readOnly) return;
    setDraft({
      id: p.id,
      month: p.month,
      date: p.date,
      amount: centsToInput(p.amount),
      method: p.method,
      note: p.note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(p: DebtPayment) {
    if (p.paid) return;
    if (
      !window.confirm(
        `Apagar o registro de ${formatBRL(p.amount)} (${formatDate(p.date)})?`
      )
    )
      return;
    if (draft.id === p.id) setDraft(emptyDraft());
    await run({ action: "delete", id: p.id });
  }

  async function markPaid(p: DebtPayment) {
    if (p.paid) return;
    const ok = window.confirm(
      `Confirmar pagamento de ${formatBRL(p.amount)} em ${formatDate(p.date)} (${paymentMethodLabel(p.method)})?\n\nDepois de confirmado, esse lançamento fica BLOQUEADO e não poderá mais ser alterado nem excluído.`
    );
    if (!ok) return;
    if (draft.id === p.id) setDraft(emptyDraft());
    await run({ action: "markPaid", id: p.id });
  }

  const isEditing = Boolean(draft.id);
  const settled = stats.remaining === 0;

  return (
    <>
      <header className="page-header">
        <div className="page-header-text">
          <span className="page-header-cat">Financeiro</span>
          <h1 className="page-header-title">Quitação de Dívida</h1>
          <p className="page-header-sub">
            Dívida de {formatBRL(DEBT_TOTAL_CENTS)}. Cada pagamento confirmado
            abate o saldo e fica bloqueado.
          </p>
        </div>
      </header>

      {readOnly && (
        <div className="readonly-banner">
          <span className="readonly-banner-icon" aria-hidden>
            ◐
          </span>
          <span>Somente leitura no seu perfil.</span>
        </div>
      )}

      {/* Resumo + progresso */}
      <div className="step-card" style={{ gap: 18 }}>
        <div className="debt-hero">
          <span className="debt-hero-label">
            {settled ? "Dívida quitada" : "Falta para quitar"}
          </span>
          <span className={`debt-hero-value${settled ? " is-settled" : ""}`}>
            {formatBRL(stats.remaining)}
          </span>
          <span className="debt-hero-sub">
            {stats.paidPct.toFixed(1).replace(".", ",")}% pago de{" "}
            {formatBRL(DEBT_TOTAL_CENTS)}
          </span>
        </div>

        <div
          className="debt-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(stats.paidPct)}
        >
          <div className="debt-progress-paid" style={{ width: `${stats.paidPct}%` }} />
          <div
            className="debt-progress-pending"
            style={{ width: `${stats.pendingPct}%` }}
          />
        </div>

        <div className="finance-summary debt-summary">
          <div className="finance-summary-item is-divida">
            <span className="finance-summary-label">Total da dívida</span>
            <span className="finance-summary-value">{formatBRL(DEBT_TOTAL_CENTS)}</span>
          </div>
          <div className="finance-summary-item is-ganho">
            <span className="finance-summary-label">Pago (confirmado)</span>
            <span className="finance-summary-value">{formatBRL(stats.paid)}</span>
          </div>
          <div className="finance-summary-item is-pending">
            <span className="finance-summary-label">A confirmar</span>
            <span className="finance-summary-value">{formatBRL(stats.pending)}</span>
          </div>
          <div className="finance-summary-item is-positive">
            <span className="finance-summary-label">Restante se confirmar</span>
            <span className="finance-summary-value">{formatBRL(stats.projected)}</span>
          </div>
        </div>

        {(syncStatus === "syncing" || syncStatus === "offline") && (
          <span
            className={`debt-sync${syncStatus === "offline" ? " is-offline" : ""}`}
            aria-live="polite"
          >
            {syncStatus === "syncing" ? "sincronizando…" : "offline"}
          </span>
        )}
      </div>

      {/* Formulário */}
      {!readOnly && (
        <form className="step-card debt-form" onSubmit={submit}>
          <div className="debt-form-title">
            {isEditing ? "Editar pagamento" : "Registrar pagamento"}
          </div>
          <div className="debt-form-grid">
            <label className="debt-field">
              <span>Mês de referência</span>
              <input
                type="month"
                className="finance-input"
                value={draft.month}
                onChange={(e) => setDraft({ ...draft, month: e.target.value })}
                required
              />
            </label>
            <label className="debt-field">
              <span>Data do pagamento</span>
              <input
                type="date"
                className="finance-input"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                required
              />
            </label>
            <label className="debt-field">
              <span>Valor pago (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                className="finance-input"
                placeholder="0,00"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                required
              />
            </label>
            <label className="debt-field">
              <span>Meio de pagamento</span>
              <select
                className="finance-input"
                value={draft.method}
                onChange={(e) =>
                  setDraft({ ...draft, method: e.target.value as PaymentMethodId })
                }
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="debt-field debt-field-wide">
              <span>Observação (opcional)</span>
              <input
                type="text"
                className="finance-input"
                maxLength={200}
                placeholder="Ex: comprovante enviado no WhatsApp"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
          </div>
          <div className="debt-form-actions">
            {draftAmount > 0 && (
              <span className="debt-form-hint">
                Depois deste: faltará{" "}
                {formatBRL(
                  Math.max(
                    0,
                    stats.projected -
                      draftAmount +
                      (isEditing
                        ? payments.find((p) => p.id === draft.id)?.amount ?? 0
                        : 0)
                  )
                )}
              </span>
            )}
            {isEditing && (
              <>
                <button
                  type="button"
                  className="debt-delete-button"
                  onClick={() => {
                    const p = payments.find((x) => x.id === draft.id);
                    if (p) remove(p);
                  }}
                >
                  Apagar registro
                </button>
                <button
                  type="button"
                  className="finance-add-button"
                  onClick={() => setDraft(emptyDraft())}
                >
                  Cancelar
                </button>
              </>
            )}
            <button
              type="submit"
              className="finance-global-add-button"
              disabled={!canSubmit}
            >
              {isEditing ? "Salvar alteração" : "+ Registrar pagamento"}
            </button>
          </div>
          {error && <div className="debt-error">{error}</div>}
        </form>
      )}

      {/* Lista por mês */}
      {months.length === 0 ? (
        <div className="finance-empty-state">
          <span className="finance-empty-state-icon" aria-hidden>
            ◔
          </span>
          <span className="finance-empty-state-text">
            Nenhum pagamento registrado ainda.
          </span>
        </div>
      ) : (
        months.map((g) => (
          <div key={g.month} className="step-card" style={{ gap: 12 }}>
            <div className="finance-section-header">
              <div className="finance-section-title-wrap">
                <span className="finance-section-title">
                  {formatMonthLabel(g.month)}
                </span>
                <span className="finance-section-total">{formatBRL(g.total)}</span>
              </div>
              {g.paid !== g.total && (
                <span className="debt-month-pending">
                  {formatBRL(g.total - g.paid)} a confirmar
                </span>
              )}
            </div>
            <div className="debt-list">
              {g.rows.map(({ p, after }) => (
                <div
                  key={p.id}
                  className={`debt-row${p.paid ? " is-paid" : ""}${
                    draft.id === p.id ? " is-editing" : ""
                  }`}
                >
                  <div className="debt-row-main">
                    <span className="debt-row-amount">{formatBRL(p.amount)}</span>
                    <span className="debt-row-meta">
                      {formatDate(p.date)} · {paymentMethodLabel(p.method)}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </div>
                  <div className="debt-row-side">
                    {p.paid ? (
                      <>
                        <span
                          className="finance-row-status-badge is-pago"
                          title={
                            p.paidAt
                              ? `Confirmado em ${formatPaidAt(p.paidAt)}`
                              : undefined
                          }
                        >
                          🔒 Pago
                        </span>
                        {after !== null && (
                          <span className="debt-row-after">
                            restante {formatBRL(after)}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="finance-row-status-badge is-a-pagar">
                          A confirmar
                        </span>
                        <div className="debt-row-actions">
                          {canMarkPaid && (
                            <button
                              type="button"
                              className="debt-pay-button"
                              onClick={() => markPaid(p)}
                            >
                              Marcar como pago
                            </button>
                          )}
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                className="finance-add-button"
                                onClick={() => startEdit(p)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="debt-delete-button"
                                onClick={() => remove(p)}
                              >
                                Apagar
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <ActivityLog activity={activity} />
    </>
  );
}

const ACTIVITY_LABELS: Record<DebtActivity["type"], string> = {
  criado: "Registrou",
  editado: "Editou",
  apagado: "Apagou",
  pago: "Confirmou como pago",
};

const ACTOR_LABELS = { ane: "Ane", thais: "Thais" } as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeChanges(a: DebtActivity): string {
  if (a.type !== "editado" || !a.prev) return "";
  const parts: string[] = [];
  if (a.prev.amount !== a.amount)
    parts.push(`valor ${formatBRL(a.prev.amount)} → ${formatBRL(a.amount)}`);
  if (a.prev.date !== a.date)
    parts.push(`data ${formatDate(a.prev.date)} → ${formatDate(a.date)}`);
  if (a.prev.month !== a.month)
    parts.push(`mês ${formatMonthLabel(a.prev.month)} → ${formatMonthLabel(a.month)}`);
  if (a.prev.method !== a.method)
    parts.push(
      `meio ${paymentMethodLabel(a.prev.method)} → ${paymentMethodLabel(a.method)}`
    );
  return parts.join(" · ");
}

function ActivityLog({ activity }: { activity: DebtActivity[] }) {
  return (
    <div className="step-card" style={{ gap: 12 }}>
      <div className="finance-section-header">
        <div className="finance-section-title-wrap">
          <span className="finance-section-title">Histórico de atividade</span>
          <span className="finance-section-total">{activity.length}</span>
        </div>
      </div>
      {activity.length === 0 ? (
        <span className="finance-empty">Nenhuma atividade ainda.</span>
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
                    {a.by && <strong>{ACTOR_LABELS[a.by]} </strong>}
                    {a.by ? verb.toLowerCase() : verb} {formatBRL(a.amount)} ·{" "}
                    {formatDate(a.date)} · {paymentMethodLabel(a.method)}
                  </span>
                  {changes && (
                    <span className="debt-activity-changes">{changes}</span>
                  )}
                </div>
                <time className="debt-activity-time" dateTime={a.at}>
                  {formatDateTime(a.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
