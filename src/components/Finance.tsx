import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBackIosNewLineIcon,
  ArrowForwardIosLineIcon,
} from "@overlens/legacy-icons";
import {
  type FinanceEntry,
  type FinanceEntryType,
  categoryColor,
  categoryLabel,
  entriesForMonth,
  formatBRL,
  generateCollateralAutoIncomes,
  normalizeEntry,
  summarizeMonth,
} from "../finance";
import { FinanceEntryModal } from "./FinanceEntryModal";

const POLL_INTERVAL_MS = 5000;
const STORAGE_KEY = "collateral.finance.entries.ane";

async function fetchFinanceEntries(
  signal?: AbortSignal
): Promise<FinanceEntry[]> {
  const res = await fetch("/api/finance?person=ane", {
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Falha ao carregar finanças");
  const raw = (await res.json()) as unknown[];
  if (!Array.isArray(raw)) return [];
  const out: FinanceEntry[] = [];
  for (const r of raw) {
    const n = normalizeEntry(r);
    if (n) out.push(n);
  }
  return out;
}

async function postFinanceEntry(entry: FinanceEntry): Promise<FinanceEntry[]> {
  const res = await fetch("/api/finance?person=ane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "upsert", entry }),
  });
  if (!res.ok) throw new Error("Falha ao salvar lançamento");
  const raw = (await res.json()) as unknown[];
  const out: FinanceEntry[] = [];
  for (const r of raw) {
    const n = normalizeEntry(r);
    if (n) out.push(n);
  }
  return out;
}

async function deleteFinanceEntry(id: string): Promise<FinanceEntry[]> {
  const res = await fetch("/api/finance?person=ane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  if (!res.ok) throw new Error("Falha ao excluir lançamento");
  const raw = (await res.json()) as unknown[];
  const out: FinanceEntry[] = [];
  for (const r of raw) {
    const n = normalizeEntry(r);
    if (n) out.push(n);
  }
  return out;
}

// Calendário do Collateral (Ane) pra gerar receitas automáticas
type DayEntry = {
  capas: number;
  internas: number;
  resumos: number;
  ajustes: number;
};

async function fetchAneCalendar(signal?: AbortSignal): Promise<{
  workdays: Set<string>;
  paidMonths: Set<string>;
}> {
  const [daysRes, paidRes] = await Promise.all([
    fetch("/api/workdays?person=ane", { signal, cache: "no-store" }),
    fetch("/api/paid-months?person=ane", { signal, cache: "no-store" }),
  ]);
  if (!daysRes.ok || !paidRes.ok) {
    throw new Error("Falha ao carregar calendário");
  }
  const daysData = (await daysRes.json()) as Record<string, DayEntry>;
  const paidData = (await paidRes.json()) as string[];
  return {
    workdays: new Set(Object.keys(daysData ?? {})),
    paidMonths: new Set(Array.isArray(paidData) ? paidData : []),
  };
}

function loadCache(): FinanceEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: FinanceEntry[] = [];
    for (const r of parsed) {
      const n = normalizeEntry(r);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

function saveCache(entries: FinanceEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

const MONTHS = [
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

function formatDayShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function Finance({ readOnly = false }: { readOnly?: boolean }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [storedEntries, setStoredEntries] = useState<FinanceEntry[]>(() =>
    loadCache()
  );
  const [autoEntries, setAutoEntries] = useState<FinanceEntry[]>([]);
  const [editing, setEditing] = useState<
    | { entry: FinanceEntry }
    | { newType: FinanceEntryType }
    | null
  >(null);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "online" | "offline"
  >("idle");
  const pendingWrites = useRef(0);

  useEffect(() => {
    saveCache(storedEntries);
  }, [storedEntries]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function syncFromServer(initial: boolean) {
      if (pendingWrites.current > 0) return;
      try {
        if (initial) setSyncStatus("syncing");
        const [entries, calendar] = await Promise.all([
          fetchFinanceEntries(controller.signal),
          fetchAneCalendar(controller.signal),
        ]);
        if (cancelled) return;
        if (pendingWrites.current > 0) return;
        setStoredEntries(entries);
        setAutoEntries(
          generateCollateralAutoIncomes(
            calendar.workdays,
            calendar.paidMonths
          )
        );
        setSyncStatus("online");
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setSyncStatus("offline");
      }
    }

    syncFromServer(true);
    const id = window.setInterval(
      () => syncFromServer(false),
      POLL_INTERVAL_MS
    );
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  const allEntries = useMemo(
    () => [...storedEntries, ...autoEntries],
    [storedEntries, autoEntries]
  );

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const entriesThisMonth = useMemo(
    () => entriesForMonth(allEntries, monthKey),
    [allEntries, monthKey]
  );

  const summary = useMemo(
    () => summarizeMonth(entriesThisMonth),
    [entriesThisMonth]
  );

  const incomes = entriesThisMonth
    .filter((e) => e.type === "income")
    .sort((a, b) => a.date.localeCompare(b.date));
  const expenses = entriesThisMonth
    .filter((e) => e.type === "expense")
    .sort((a, b) => a.date.localeCompare(b.date));

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  async function saveEntry(entry: FinanceEntry) {
    setEditing(null);
    if (entry.auto) return;

    const wasPresent = storedEntries.some((e) => e.id === entry.id);
    setStoredEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });

    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const fresh = await postFinanceEntry(entry);
      setStoredEntries(fresh);
      setSyncStatus("online");
    } catch {
      // revert
      setStoredEntries((prev) => {
        if (!wasPresent) return prev.filter((e) => e.id !== entry.id);
        return prev;
      });
      setSyncStatus("offline");
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  async function removeEntry(id: string) {
    setEditing(null);
    const removed = storedEntries.find((e) => e.id === id);
    setStoredEntries((prev) => prev.filter((e) => e.id !== id));

    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const fresh = await deleteFinanceEntry(id);
      setStoredEntries(fresh);
      setSyncStatus("online");
    } catch {
      if (removed) {
        setStoredEntries((prev) => [...prev, removed]);
      }
      setSyncStatus("offline");
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  function defaultDateForMonth(): string {
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    if (todayKey === monthKey) {
      return `${monthKey}-${String(today.getDate()).padStart(2, "0")}`;
    }
    return `${monthKey}-01`;
  }

  return (
    <>
      {readOnly && (
        <div className="readonly-banner">
          <span className="readonly-banner-icon" aria-hidden>
            ◐
          </span>
          <span>
            Esta página é privada da Ane. Somente leitura no seu perfil.
          </span>
        </div>
      )}

      {/* Seletor de mês + sumário */}
      <div className="step-card" style={{ gap: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={prevMonth}
            className="cal-nav"
            aria-label="Mês anterior"
          >
            <ArrowBackIosNewLineIcon style={{ width: 14, height: 14 }} />
          </button>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {entriesThisMonth.length}{" "}
              {entriesThisMonth.length === 1
                ? "lançamento"
                : "lançamentos"}
            </span>
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="cal-nav"
            aria-label="Próximo mês"
          >
            <ArrowForwardIosLineIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className="finance-summary">
          <div className="finance-summary-item is-received">
            <span className="finance-summary-label">Recebido</span>
            <span className="finance-summary-value">
              {formatBRL(summary.received)}
            </span>
          </div>
          <div className="finance-summary-item is-pending">
            <span className="finance-summary-label">A receber</span>
            <span className="finance-summary-value">
              {formatBRL(summary.pending)}
            </span>
          </div>
          <div className="finance-summary-item is-spent">
            <span className="finance-summary-label">Gasto</span>
            <span className="finance-summary-value">
              {formatBRL(summary.spent)}
            </span>
          </div>
          <div
            className={`finance-summary-item ${summary.balance >= 0 ? "is-positive" : "is-negative"}`}
          >
            <span className="finance-summary-label">Sobra</span>
            <span className="finance-summary-value">
              {formatBRL(summary.balance)}
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-tertiary)",
            opacity: syncStatus === "syncing" ? 0.6 : 1,
            alignSelf: "flex-end",
          }}
          aria-live="polite"
        >
          {syncStatus === "syncing"
            ? "sincronizando…"
            : syncStatus === "offline"
              ? "offline"
              : syncStatus === "online"
                ? "sincronizado"
                : ""}
        </span>
      </div>

      {/* Entradas */}
      <FinanceList
        title="Entradas"
        entries={incomes}
        emptyText="Nenhuma entrada neste mês."
        onAdd={
          readOnly ? undefined : () => setEditing({ newType: "income" })
        }
        onEdit={readOnly ? undefined : (entry) => setEditing({ entry })}
      />

      {/* Saídas */}
      <FinanceList
        title="Saídas"
        entries={expenses}
        emptyText="Nenhuma saída neste mês."
        onAdd={
          readOnly ? undefined : () => setEditing({ newType: "expense" })
        }
        onEdit={readOnly ? undefined : (entry) => setEditing({ entry })}
      />

      {editing && !readOnly && (
        <FinanceEntryModal
          initialType={
            "newType" in editing ? editing.newType : editing.entry.type
          }
          initialDate={
            "newType" in editing ? defaultDateForMonth() : editing.entry.date
          }
          existing={"entry" in editing ? editing.entry : undefined}
          onClose={() => setEditing(null)}
          onSave={saveEntry}
          onDelete={
            "entry" in editing
              ? () => removeEntry(editing.entry.id)
              : undefined
          }
        />
      )}
    </>
  );
}

function FinanceList({
  title,
  entries,
  emptyText,
  onAdd,
  onEdit,
}: {
  title: string;
  entries: FinanceEntry[];
  emptyText: string;
  onAdd?: () => void;
  onEdit?: (entry: FinanceEntry) => void;
}) {
  return (
    <div className="step-card" style={{ gap: 10 }}>
      <div className="finance-list-header">
        <span className="finance-list-title">{title}</span>
        {onAdd && (
          <button
            type="button"
            className="finance-add-button"
            onClick={onAdd}
          >
            + Adicionar
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <span className="finance-empty">{emptyText}</span>
      ) : (
        <div className="finance-list">
          {entries.map((e) => {
            const isReceived = !!e.receivedAt;
            const isAuto = e.auto;
            const color = categoryColor(e.category);
            return (
              <button
                type="button"
                key={e.id}
                className={`finance-row${
                  e.type === "income"
                    ? isReceived
                      ? " is-received"
                      : " is-pending"
                    : ""
                }${isAuto ? " is-auto" : ""}${onEdit ? "" : " is-readonly"}`}
                onClick={onEdit && !isAuto ? () => onEdit(e) : undefined}
                disabled={!onEdit || isAuto}
                title={
                  isAuto
                    ? "Gerado automaticamente do calendário do Collateral"
                    : onEdit
                      ? "Clique para editar"
                      : undefined
                }
              >
                <span
                  className="finance-row-dot"
                  style={{ background: color }}
                  aria-hidden
                />
                <div className="finance-row-main">
                  <span className="finance-row-desc">
                    {e.type === "income" && (
                      <span className="finance-row-status">
                        {isReceived ? "✓" : "⏳"}
                      </span>
                    )}
                    {e.description}
                    {isAuto && (
                      <span className="finance-row-auto-badge">auto</span>
                    )}
                  </span>
                  <span className="finance-row-meta">
                    {formatDayShort(e.date)} · {categoryLabel(e.category)}
                  </span>
                </div>
                <span
                  className={`finance-row-value${
                    e.type === "expense" ? " is-negative" : ""
                  }`}
                >
                  {e.type === "expense" ? "− " : ""}
                  {formatBRL(e.amount)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

