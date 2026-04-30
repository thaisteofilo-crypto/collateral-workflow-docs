import { useEffect, useMemo, useState } from "react";
import {
  ArrowBackIosNewLineIcon,
  ArrowForwardIosLineIcon,
} from "@overlens/legacy-icons";

const STORAGE_KEY = "collateral.workdays.v1";
const PAID_KEY = "collateral.paidmonths.v1";

const MONTHLY_SALARY = 2100;
const DAYS_PER_MONTH = 20;
const COVERS_PER_DAY = 2;
const DAILY_RATE = MONTHLY_SALARY / DAYS_PER_MONTH;

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

function loadWorkdays(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveWorkdays(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function loadPaidMonths(): Set<string> {
  try {
    const raw = localStorage.getItem(PAID_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function savePaidMonths(set: Set<string>) {
  try {
    localStorage.setItem(PAID_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function WorkCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [workdays, setWorkdays] = useState<Set<string>>(() => loadWorkdays());
  const [paidMonths, setPaidMonths] = useState<Set<string>>(() =>
    loadPaidMonths()
  );

  useEffect(() => {
    saveWorkdays(workdays);
  }, [workdays]);

  useEffect(() => {
    savePaidMonths(paidMonths);
  }, [paidMonths]);

  function togglePaid(monthKey: string) {
    setPaidMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

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

  function toggle(day: number) {
    const key = toKey(viewYear, viewMonth, day);
    setWorkdays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(d)}
                className={`cal-cell${isWorked ? " cal-cell--worked" : ""}${
                  isToday ? " cal-cell--today" : ""
                }`}
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
          }}
        >
          Clique em um dia para marcar como trabalhado. Os dias ficam salvos
          no navegador.
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
          <span className="salary-value">{BRL.format(totalEarnings)}</span>
          <span className="salary-meta">
            {BRL.format(DAILY_RATE)} por dia
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
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
                marginBottom: 4,
              }}
            >
              Por mês
            </span>
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
                  <button
                    type="button"
                    className={`payment-toggle${
                      m.paid ? " is-paid" : ""
                    }`}
                    onClick={() => togglePaid(m.key)}
                    title={m.paid ? "Marcar como pendente" : "Marcar como pago"}
                  >
                    {m.paid ? "✓ Pago" : "Pendente"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
