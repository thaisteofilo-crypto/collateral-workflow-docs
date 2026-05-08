import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBackIosNewLineIcon,
  ArrowForwardIosLineIcon,
} from "@overlens/legacy-icons";

const STORAGE_KEY = "collateral.workdays.v2";
const STORAGE_KEY_LEGACY = "collateral.workdays.v1";
const PAID_KEY = "collateral.paidmonths.v1";
const ADMIN_FLAG = "collateral.admin.v1";
const ADMIN_PWD_KEY = "collateral.admin.pwd.v1";

const MONTHLY_SALARY = 2100;
const DAYS_PER_MONTH = 20;
const DAILY_RATE = MONTHLY_SALARY / DAYS_PER_MONTH;

const POLL_INTERVAL_MS = 5000;

type DayEntry = {
  capas: number;
  internas: number;
  resumos: number;
  ajustes: number;
};

const ZERO_ENTRY: DayEntry = {
  capas: 0,
  internas: 0,
  resumos: 0,
  ajustes: 0,
};

const LEGACY_ENTRY: DayEntry = {
  capas: 2,
  internas: 0,
  resumos: 0,
  ajustes: 0,
};

const ENTRY_FIELDS: Array<{ key: keyof DayEntry; label: string }> = [
  { key: "capas", label: "Capas" },
  { key: "internas", label: "Capas internas" },
  { key: "resumos", label: "Resumos" },
  { key: "ajustes", label: "Ajustes" },
];

function entryTotal(e: DayEntry): number {
  return e.capas + e.internas + e.resumos + e.ajustes;
}

function isEntryEmpty(e: DayEntry): boolean {
  return entryTotal(e) === 0;
}

function isMonthClosed(year: number, month: number): boolean {
  const now = new Date();
  return (
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth())
  );
}

function loadAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_FLAG) === "ok";
  } catch {
    return false;
  }
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const FULL_WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
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

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeEntry(raw: unknown): DayEntry {
  if (!raw || typeof raw !== "object") return { ...ZERO_ENTRY };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Math.floor(Number(v ?? 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    capas: num(r.capas),
    internas: num(r.internas),
    resumos: num(r.resumos),
    ajustes: num(r.ajustes),
  };
}

function loadWorkdaysCache(): Map<string, DayEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const m = new Map<string, DayEntry>();
        for (const [k, v] of Object.entries(parsed)) {
          const e = normalizeEntry(v);
          if (!isEntryEmpty(e)) m.set(k, e);
        }
        return m;
      }
    }
    // Legado: array de strings (v1)
    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const m = new Map<string, DayEntry>();
        for (const k of parsed) {
          if (typeof k === "string") m.set(k, { ...LEGACY_ENTRY });
        }
        return m;
      }
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function saveWorkdaysCache(map: Map<string, DayEntry>) {
  try {
    const obj: Record<string, DayEntry> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function loadPaidCache(): Set<string> {
  try {
    const raw = localStorage.getItem(PAID_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function savePaidCache(set: Set<string>) {
  try {
    localStorage.setItem(PAID_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

async function fetchWorkdays(
  signal?: AbortSignal
): Promise<Record<string, DayEntry>> {
  const res = await fetch("/api/workdays", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar dias");
  const data = (await res.json()) as Record<string, unknown>;
  const out: Record<string, DayEntry> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = normalizeEntry(v);
  }
  return out;
}

async function postWorkday(
  day: string,
  entry: DayEntry
): Promise<Record<string, DayEntry>> {
  const res = await fetch("/api/workdays", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ day, entry }),
  });
  if (!res.ok) throw new Error("Falha ao salvar dia");
  const data = (await res.json()) as Record<string, unknown>;
  const out: Record<string, DayEntry> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = normalizeEntry(v);
  }
  return out;
}

async function fetchPaidMonths(signal?: AbortSignal): Promise<string[]> {
  const res = await fetch("/api/paid-months", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar meses pagos");
  return (await res.json()) as string[];
}

async function postPaidMonth(
  month: string,
  action: "add" | "remove"
): Promise<string[]> {
  let password = "";
  try {
    password = localStorage.getItem(ADMIN_PWD_KEY) ?? "";
  } catch {
    // ignore
  }
  const res = await fetch("/api/paid-months", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-password": password,
    },
    body: JSON.stringify({ month, action }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      try {
        localStorage.removeItem(ADMIN_FLAG);
        localStorage.removeItem(ADMIN_PWD_KEY);
      } catch {
        // ignore
      }
      throw new Error("unauthorized");
    }
    throw new Error("Falha ao salvar status de pagamento");
  }
  return (await res.json()) as string[];
}

async function postAdminAuth(password: string): Promise<boolean> {
  const res = await fetch("/api/admin-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

function recordToMap(rec: Record<string, DayEntry>): Map<string, DayEntry> {
  const m = new Map<string, DayEntry>();
  for (const [k, v] of Object.entries(rec)) {
    if (!isEntryEmpty(v)) m.set(k, v);
  }
  return m;
}

type EditingDay = {
  day: number;
  key: string;
  initial: DayEntry;
};

function DayEditModal({
  day,
  weekday,
  monthLabel,
  initial,
  onClose,
  onSave,
}: {
  day: number;
  weekday: string;
  monthLabel: string;
  initial: DayEntry;
  onClose: () => void;
  onSave: (entry: DayEntry) => void;
}) {
  const [entry, setEntry] = useState<DayEntry>(initial);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = entryTotal(entry);
  const wasEmpty = isEntryEmpty(initial);
  const isEmpty = isEntryEmpty(entry);

  function setField(key: keyof DayEntry, value: number) {
    const v = Math.max(0, Math.floor(value) || 0);
    setEntry((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div className="day-modal-overlay" onClick={onClose}>
      <div
        className="day-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="day-modal-header">
          <span className="day-modal-eyebrow">Dia trabalhado</span>
          <span className="day-modal-title">
            {day} de {monthLabel}{" "}
            <span className="day-modal-title-weekday">· {weekday}</span>
          </span>
        </header>

        <div className="day-modal-fields">
          {ENTRY_FIELDS.map((field, i) => (
            <div className="day-modal-row" key={field.key}>
              <span className="day-modal-label">{field.label}</span>
              <div className="day-modal-stepper">
                <button
                  type="button"
                  className="day-modal-step"
                  onClick={() => setField(field.key, entry[field.key] - 1)}
                  disabled={entry[field.key] === 0}
                  aria-label={`Diminuir ${field.label.toLowerCase()}`}
                >
                  −
                </button>
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="day-modal-input"
                  value={entry[field.key]}
                  onChange={(e) =>
                    setField(field.key, parseInt(e.target.value || "0", 10))
                  }
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="day-modal-step"
                  onClick={() => setField(field.key, entry[field.key] + 1)}
                  aria-label={`Aumentar ${field.label.toLowerCase()}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="day-modal-summary">
          <span>Total do dia</span>
          <span className="day-modal-summary-value">
            {total === 0
              ? "—"
              : `${total} ${total === 1 ? "item" : "itens"}`}
          </span>
        </div>

        <div className="day-modal-actions">
          {!wasEmpty && (
            <button
              type="button"
              className="day-modal-action day-modal-action--secondary"
              onClick={() => onSave({ ...ZERO_ENTRY })}
            >
              Limpar dia
            </button>
          )}
          <button
            type="button"
            className="day-modal-action day-modal-action--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="day-modal-action day-modal-action--primary"
            onClick={() => onSave(entry)}
            disabled={isEmpty && wasEmpty}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [workdays, setWorkdays] = useState<Map<string, DayEntry>>(() =>
    loadWorkdaysCache()
  );
  const [paidMonths, setPaidMonths] = useState<Set<string>>(() =>
    loadPaidCache()
  );
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "online" | "offline"
  >("idle");
  const [isAdmin, setIsAdmin] = useState<boolean>(loadAdmin);
  const [editing, setEditing] = useState<EditingDay | null>(null);

  async function unlockAdmin() {
    const input = window.prompt("Senha admin:");
    if (input == null) return;
    const pwd = input.trim();
    try {
      const ok = await postAdminAuth(pwd);
      if (ok) {
        try {
          localStorage.setItem(ADMIN_FLAG, "ok");
          localStorage.setItem(ADMIN_PWD_KEY, pwd);
        } catch {
          // ignore
        }
        setIsAdmin(true);
      } else {
        window.alert("Senha incorreta");
      }
    } catch {
      window.alert("Erro de conexão com o servidor");
    }
  }

  function lockAdmin() {
    try {
      localStorage.removeItem(ADMIN_FLAG);
      localStorage.removeItem(ADMIN_PWD_KEY);
    } catch {
      // ignore
    }
    setIsAdmin(false);
  }

  // Track in-flight writes so polling doesn't clobber pending changes
  const pendingWrites = useRef(0);

  // Cache locally whenever state changes
  useEffect(() => {
    saveWorkdaysCache(workdays);
  }, [workdays]);

  useEffect(() => {
    savePaidCache(paidMonths);
  }, [paidMonths]);

  // Initial load + polling
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function syncFromServer(initial: boolean) {
      if (pendingWrites.current > 0) return;
      try {
        if (initial) setSyncStatus("syncing");
        const [days, paid] = await Promise.all([
          fetchWorkdays(controller.signal),
          fetchPaidMonths(controller.signal),
        ]);
        if (cancelled) return;
        if (pendingWrites.current > 0) return;

        let workdayMap = recordToMap(days);
        const paidSet = new Set(paid);

        if (initial) {
          // One-shot: Abril/2026 (20 dias úteis) precisou ser restaurado
          // após o KV ter sido sobrescrito vazio. Faz o restore uma vez por
          // browser, com a regra histórica de 2 capas/dia.
          const flag = "collateral.paidmonths.bootstrap.v4";
          if (!localStorage.getItem(flag)) {
            const aprilWorkdays = [
              "2026-04-01",
              "2026-04-02",
              "2026-04-03",
              "2026-04-06",
              "2026-04-07",
              "2026-04-08",
              "2026-04-09",
              "2026-04-10",
              "2026-04-13",
              "2026-04-14",
              "2026-04-15",
              "2026-04-16",
              "2026-04-17",
              "2026-04-20",
              "2026-04-22",
              "2026-04-23",
              "2026-04-24",
              "2026-04-27",
              "2026-04-28",
              "2026-04-29",
            ];
            try {
              const dayPosts = aprilWorkdays
                .filter((d) => !workdayMap.has(d))
                .map((d) => postWorkday(d, { ...LEGACY_ENTRY }));
              if (dayPosts.length > 0) {
                await Promise.all(dayPosts);
                const fresh = await fetchWorkdays(controller.signal);
                workdayMap = recordToMap(fresh);
              }
              localStorage.setItem(flag, "1");
            } catch {
              // tenta de novo no próximo mount
            }
          }
        }

        setWorkdays(workdayMap);
        setPaidMonths(paidSet);
        setSyncStatus("online");
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setSyncStatus("offline");
      }
    }

    syncFromServer(true);
    const id = window.setInterval(() => syncFromServer(false), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  const { daysInMonth, firstWeekday } = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    return { daysInMonth: last.getDate(), firstWeekday: first.getDay() };
  }, [viewYear, viewMonth]);

  const monthCount = useMemo(() => {
    let count = 0;
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    for (const key of workdays.keys()) {
      if (key.startsWith(prefix)) count++;
    }
    return count;
  }, [workdays, viewYear, viewMonth]);

  const totals = useMemo(() => {
    const acc: DayEntry = { ...ZERO_ENTRY };
    for (const e of workdays.values()) {
      acc.capas += e.capas;
      acc.internas += e.internas;
      acc.resumos += e.resumos;
      acc.ajustes += e.ajustes;
    }
    return acc;
  }, [workdays]);

  const totalCount = workdays.size;
  const totalEarnings = totalCount * DAILY_RATE;

  function openDay(day: number) {
    if (isMonthClosed(viewYear, viewMonth) && !isAdmin) return;
    const key = toKey(viewYear, viewMonth, day);
    const initial = workdays.get(key) ?? { ...ZERO_ENTRY };
    setEditing({ day, key, initial });
  }

  async function saveDay(entry: DayEntry) {
    if (!editing) return;
    const { key, initial } = editing;
    const nextEntry = normalizeEntry(entry);
    const prevEntry = initial;

    setEditing(null);

    // Optimistic update
    setWorkdays((prev) => {
      const next = new Map(prev);
      if (isEntryEmpty(nextEntry)) next.delete(key);
      else next.set(key, nextEntry);
      return next;
    });

    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const days = await postWorkday(key, nextEntry);
      setWorkdays(recordToMap(days));
      setSyncStatus("online");
    } catch {
      // Revert on error
      setWorkdays((prev) => {
        const next = new Map(prev);
        if (isEntryEmpty(prevEntry)) next.delete(key);
        else next.set(key, prevEntry);
        return next;
      });
      setSyncStatus("offline");
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  async function togglePaid(monthKey: string) {
    if (!isAdmin) return;
    const isPaid = paidMonths.has(monthKey);
    const action: "add" | "remove" = isPaid ? "remove" : "add";

    setPaidMonths((prev) => {
      const next = new Set(prev);
      if (isPaid) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });

    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const months = await postPaidMonth(monthKey, action);
      setPaidMonths(new Set(months));
      setSyncStatus("online");
    } catch (err) {
      setPaidMonths((prev) => {
        const next = new Set(prev);
        if (isPaid) next.add(monthKey);
        else next.delete(monthKey);
        return next;
      });
      setSyncStatus("offline");
      if ((err as Error)?.message === "unauthorized") {
        setIsAdmin(false);
        window.alert("Sessão admin expirou. Entre novamente.");
      }
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

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

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthlyBreakdown = useMemo(() => {
    type Acc = DayEntry & { days: number };
    const map = new Map<string, Acc>();
    for (const [key, entry] of workdays) {
      const monthKey = key.slice(0, 7);
      const acc = map.get(monthKey) ?? {
        days: 0,
        capas: 0,
        internas: 0,
        resumos: 0,
        ajustes: 0,
      };
      acc.days += 1;
      acc.capas += entry.capas;
      acc.internas += entry.internas;
      acc.resumos += entry.resumos;
      acc.ajustes += entry.ajustes;
      map.set(monthKey, acc);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, acc]) => {
        const [yearStr, monthStr] = key.split("-");
        const y = Number(yearStr);
        const m = Number(monthStr) - 1;
        return {
          key,
          year: y,
          month: m,
          label: `${MONTHS[m]} ${y}`,
          days: acc.days,
          capas: acc.capas,
          internas: acc.internas,
          resumos: acc.resumos,
          ajustes: acc.ajustes,
          earnings: acc.days * DAILY_RATE,
          paid: paidMonths.has(key),
        };
      });
  }, [workdays, paidMonths]);

  const paidEarnings = monthlyBreakdown
    .filter((m) => m.paid)
    .reduce((sum, m) => sum + m.earnings, 0);
  const pendingEarnings = totalEarnings - paidEarnings;

  const hasItems = entryTotal(totals) > 0;

  return (
    <>
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
              {monthCount}{" "}
              {monthCount === 1 ? "dia trabalhado" : "dias trabalhados"}
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

        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="cal-weekday">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d === null)
              return <span key={i} className="cal-cell cal-cell--empty" />;
            const key = toKey(viewYear, viewMonth, d);
            const isWorked = workdays.has(key);
            const isToday =
              d === today.getDate() &&
              viewMonth === today.getMonth() &&
              viewYear === today.getFullYear();
            const closed = isMonthClosed(viewYear, viewMonth);
            const locked = closed && !isAdmin;
            return (
              <button
                key={i}
                type="button"
                onClick={() => openDay(d)}
                disabled={locked}
                title={
                  locked
                    ? "Mês fechado — destrave o modo admin para corrigir"
                    : "Clique para registrar o trabalho do dia"
                }
                className={`cal-cell${isWorked ? " cal-cell--worked" : ""}${
                  isToday ? " cal-cell--today" : ""
                }${locked ? " cal-cell--locked" : ""}`}
              >
                {d}
              </button>
            );
          })}
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--text-tertiary)",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>
            Clique em um dia para registrar capas, internas, resumos e ajustes.
            Meses passados ficam travados — destrave o modo admin para
            corrigir.
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-tertiary)",
              opacity: syncStatus === "syncing" ? 0.6 : 1,
              whiteSpace: "nowrap",
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
        </p>
      </div>

      <div className="salary-grid">
        <div className="salary-item">
          <span className="salary-label">Dias trabalhados</span>
          <span className="salary-value">{totalCount}</span>
          <span className="salary-meta">acumulado</span>
        </div>
        <div className="salary-item">
          <span className="salary-label">Itens entregues</span>
          <span className="salary-value">{entryTotal(totals)}</span>
          <span className="salary-meta">
            {hasItems ? "soma de todos os tipos" : "nenhum registro ainda"}
          </span>
        </div>
        <div className="salary-item salary-item--accent">
          <span className="salary-label">Salário acumulado</span>
          <span className="salary-value">{BRL.format(pendingEarnings)}</span>
          <span className="salary-meta">
            {paidEarnings > 0
              ? `${BRL.format(paidEarnings)} já pago`
              : `${BRL.format(DAILY_RATE)} por dia`}
          </span>
        </div>
      </div>

      {hasItems && (
        <div className="metrics-grid">
          {ENTRY_FIELDS.map((f) => (
            <div className="metric-item" key={f.key}>
              <span className="metric-label">{f.label}</span>
              <span className="metric-value">{totals[f.key]}</span>
            </div>
          ))}
        </div>
      )}

      {monthlyBreakdown.length > 0 && (
        <>
          <div className="payment-summary">
            <div className="payment-pill payment-pill--paid">
              <span className="payment-pill-label">Pago</span>
              <span className="payment-pill-value">
                {BRL.format(paidEarnings)}
              </span>
            </div>
            <div className="payment-pill payment-pill--pending">
              <span className="payment-pill-label">Pendente</span>
              <span className="payment-pill-value">
                {BRL.format(pendingEarnings)}
              </span>
            </div>
          </div>

          <div className="step-card" style={{ gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--text-tertiary)",
                }}
              >
                Por mês
              </span>
              <button
                type="button"
                onClick={isAdmin ? lockAdmin : unlockAdmin}
                className="admin-toggle"
                title={
                  isAdmin
                    ? "Travar (sair do modo admin)"
                    : "Destravar pagamento (modo admin)"
                }
              >
                {isAdmin ? "Travar pagamento" : "Modo admin"}
              </button>
            </div>
            {monthlyBreakdown.map((m) => {
              const isCurrent =
                m.year === viewYear && m.month === viewMonth;
              const hasItemsRow =
                m.capas + m.internas + m.resumos + m.ajustes > 0;
              return (
                <div
                  key={m.key}
                  className={`month-row${isCurrent ? " is-current" : ""}${
                    m.paid ? " is-paid" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="month-row-nav"
                    onClick={() => {
                      setViewYear(m.year);
                      setViewMonth(m.month);
                    }}
                  >
                    <span className="month-row-label">{m.label}</span>
                    <span className="month-row-days">
                      {m.days} {m.days === 1 ? "dia" : "dias"}
                      {hasItemsRow
                        ? ` · ${m.capas} cap · ${m.internas} int · ${m.resumos} res · ${m.ajustes} aj`
                        : ""}
                    </span>
                  </button>
                  <span className="month-row-value">
                    {BRL.format(m.earnings)}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`payment-toggle${
                        m.paid ? " is-paid" : ""
                      }`}
                      onClick={() => togglePaid(m.key)}
                      title={
                        m.paid ? "Marcar como pendente" : "Marcar como pago"
                      }
                    >
                      {m.paid ? "✓ Pago" : "Pendente"}
                    </button>
                  ) : (
                    <span
                      className={`payment-toggle is-readonly${
                        m.paid ? " is-paid" : ""
                      }`}
                      title="Apenas modo admin pode alterar"
                    >
                      {m.paid ? "✓ Pago" : "Pendente"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <DayEditModal
          day={editing.day}
          weekday={
            FULL_WEEKDAYS[
              new Date(viewYear, viewMonth, editing.day).getDay()
            ]
          }
          monthLabel={`${MONTHS[viewMonth]} ${viewYear}`}
          initial={editing.initial}
          onClose={() => setEditing(null)}
          onSave={saveDay}
        />
      )}
    </>
  );
}
