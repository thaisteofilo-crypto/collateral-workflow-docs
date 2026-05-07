import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBackIosNewLineIcon,
  ArrowForwardIosLineIcon,
} from "@overlens/legacy-icons";

const STORAGE_KEY = "collateral.workdays.v1";
const PAID_KEY = "collateral.paidmonths.v1";
const ADMIN_FLAG = "collateral.admin.v1";
const ADMIN_PWD_KEY = "collateral.admin.pwd.v1";

const MONTHLY_SALARY = 2100;
const DAYS_PER_MONTH = 20;
const COVERS_PER_DAY = 2;
const DAILY_RATE = MONTHLY_SALARY / DAYS_PER_MONTH;

const POLL_INTERVAL_MS = 5000;

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

function loadCache(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveCache(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

async function fetchWorkdays(signal?: AbortSignal): Promise<string[]> {
  const res = await fetch("/api/workdays", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar dias");
  return (await res.json()) as string[];
}

async function postWorkday(day: string, action: "add" | "remove"): Promise<string[]> {
  const res = await fetch("/api/workdays", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ day, action }),
  });
  if (!res.ok) throw new Error("Falha ao salvar dia");
  return (await res.json()) as string[];
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

export function WorkCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [workdays, setWorkdays] = useState<Set<string>>(() =>
    loadCache(STORAGE_KEY)
  );
  const [paidMonths, setPaidMonths] = useState<Set<string>>(() =>
    loadCache(PAID_KEY)
  );
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "online" | "offline"
  >("idle");
  const [isAdmin, setIsAdmin] = useState<boolean>(loadAdmin);

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
    saveCache(STORAGE_KEY, workdays);
  }, [workdays]);

  useEffect(() => {
    saveCache(PAID_KEY, paidMonths);
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

        let workdaySet = new Set(days);
        let paidSet = new Set(paid);

        if (initial) {
          // One-shot: Abril/2026 (20 dias úteis) foi sobrescrito pelo KV sync
          // vazio. Restaura os dias uma vez por browser. O flag "Pago" é
          // marcado manualmente via modo admin (não é mais auto-restaurado).
          const flag = "collateral.paidmonths.bootstrap.v3";
          if (!localStorage.getItem(flag)) {
            // Dias úteis de Abril/2026, exceto 21/04 (Tiradentes).
            const aprilWorkdays = [
              "2026-04-01", "2026-04-02", "2026-04-03",
              "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10",
              "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17",
              "2026-04-20",
              "2026-04-22", "2026-04-23", "2026-04-24",
              "2026-04-27", "2026-04-28", "2026-04-29",
            ];
            try {
              const dayPosts = aprilWorkdays
                .filter((d) => !workdaySet.has(d))
                .map((d) => postWorkday(d, "add"));
              await Promise.all(dayPosts);

              const freshDays = await fetchWorkdays(controller.signal);
              workdaySet = new Set(freshDays);
              localStorage.setItem(flag, "1");
            } catch {
              // tenta de novo no próximo mount
            }
          }
        }

        setWorkdays(workdaySet);
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
    for (const key of workdays) {
      if (
        key.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`)
      ) {
        count++;
      }
    }
    return count;
  }, [workdays, viewYear, viewMonth]);

  const totalCount = workdays.size;

  async function toggle(day: number) {
    if (isMonthClosed(viewYear, viewMonth)) return;
    const key = toKey(viewYear, viewMonth, day);
    const isWorked = workdays.has(key);
    const action: "add" | "remove" = isWorked ? "remove" : "add";

    // Optimistic update
    setWorkdays((prev) => {
      const next = new Set(prev);
      if (isWorked) next.delete(key);
      else next.add(key);
      return next;
    });

    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const days = await postWorkday(key, action);
      setWorkdays(new Set(days));
      setSyncStatus("online");
    } catch {
      // Revert on error
      setWorkdays((prev) => {
        const next = new Set(prev);
        if (isWorked) next.add(key);
        else next.delete(key);
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

  const totalCovers = totalCount * COVERS_PER_DAY;
  const totalEarnings = totalCount * DAILY_RATE;

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of workdays) {
      const monthKey = key.slice(0, 7);
      map.set(monthKey, (map.get(monthKey) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, days]) => {
        const [yearStr, monthStr] = key.split("-");
        const y = Number(yearStr);
        const m = Number(monthStr) - 1;
        return {
          key,
          year: y,
          month: m,
          label: `${MONTHS[m]} ${y}`,
          days,
          earnings: days * DAILY_RATE,
          paid: paidMonths.has(key),
        };
      });
  }, [workdays, paidMonths]);

  const paidEarnings = monthlyBreakdown
    .filter((m) => m.paid)
    .reduce((sum, m) => sum + m.earnings, 0);
  const pendingEarnings = totalEarnings - paidEarnings;

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
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(d)}
                disabled={closed}
                title={closed ? "Mês fechado — não editável" : undefined}
                className={`cal-cell${isWorked ? " cal-cell--worked" : ""}${
                  isToday ? " cal-cell--today" : ""
                }${closed ? " cal-cell--locked" : ""}`}
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
            Clique em um dia para marcar como trabalhado. Meses passados ficam
            travados.
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color:
                syncStatus === "offline"
                  ? "var(--text-tertiary)"
                  : "var(--text-tertiary)",
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
          <span className="salary-label">Capas produzidas</span>
          <span className="salary-value">{totalCovers}</span>
          <span className="salary-meta">{COVERS_PER_DAY} por dia</span>
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
                      {m.days} {m.days === 1 ? "dia" : "dias"} ·{" "}
                      {m.days * COVERS_PER_DAY} capas
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
    </>
  );
}
