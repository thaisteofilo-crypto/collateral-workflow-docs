import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBackIosNewLineIcon,
  ArrowForwardIosLineIcon,
} from "@overlens/legacy-icons";
import {
  type FinanceEntry,
  type FinanceSubtype,
  type Tag,
  brokerLabel,
  categoryColor,
  categoryLabel,
  entriesForMonth,
  entriesForYear,
  entriesBySubtype,
  formatBRL,
  formatMonthShort,
  generateCollateralAutoIncomes,
  investmentTypeLabel,
  monthKeyOf,
  normalizeEntry,
  normalizeTag,
  paymentMethodLabel,
  subtypeMeta,
  summarizeByTag,
  summarizeMonthByType,
  TAG_COLOR_PALETTE,
} from "../finance";
import { FinanceEntryModal } from "./FinanceEntryModal";

const POLL_INTERVAL_MS = 5000;
const ENTRIES_CACHE_KEY = "collateral.finance.entries.ane";
const TAGS_CACHE_KEY = "collateral.finance.tags.ane";

async function fetchEntries(signal?: AbortSignal): Promise<FinanceEntry[]> {
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

async function postEntry(entry: FinanceEntry): Promise<FinanceEntry[]> {
  const res = await fetch("/api/finance?person=ane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "upsert", entry }),
  });
  if (!res.ok) throw new Error("Falha ao salvar lançamento");
  const raw = (await res.json()) as unknown[];
  return Array.isArray(raw)
    ? (raw.map((r) => normalizeEntry(r)).filter(Boolean) as FinanceEntry[])
    : [];
}

async function deleteEntry(id: string): Promise<FinanceEntry[]> {
  const res = await fetch("/api/finance?person=ane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  if (!res.ok) throw new Error("Falha ao excluir lançamento");
  const raw = (await res.json()) as unknown[];
  return Array.isArray(raw)
    ? (raw.map((r) => normalizeEntry(r)).filter(Boolean) as FinanceEntry[])
    : [];
}

async function fetchTags(signal?: AbortSignal): Promise<Tag[]> {
  const res = await fetch("/api/finance-tags?person=ane", {
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Falha ao carregar tags");
  const raw = (await res.json()) as unknown[];
  if (!Array.isArray(raw)) return [];
  const out: Tag[] = [];
  for (const r of raw) {
    const n = normalizeTag(r);
    if (n) out.push(n);
  }
  return out;
}

async function postTag(tag: Tag): Promise<Tag[]> {
  const res = await fetch("/api/finance-tags?person=ane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "upsert", tag }),
  });
  if (!res.ok) throw new Error("Falha ao salvar tag");
  const raw = (await res.json()) as unknown[];
  return Array.isArray(raw)
    ? (raw.map((r) => normalizeTag(r)).filter(Boolean) as Tag[])
    : [];
}

async function deleteTag(id: string): Promise<Tag[]> {
  const res = await fetch("/api/finance-tags?person=ane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  if (!res.ok) throw new Error("Falha ao excluir tag");
  const raw = (await res.json()) as unknown[];
  return Array.isArray(raw)
    ? (raw.map((r) => normalizeTag(r)).filter(Boolean) as Tag[])
    : [];
}

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
  if (!daysRes.ok || !paidRes.ok) throw new Error("Falha ao carregar calendário");
  const daysData = (await daysRes.json()) as Record<string, DayEntry>;
  const paidData = (await paidRes.json()) as string[];
  return {
    workdays: new Set(Object.keys(daysData ?? {})),
    paidMonths: new Set(Array.isArray(paidData) ? paidData : []),
  };
}

function loadEntriesCache(): FinanceEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => normalizeEntry(r))
      .filter((e): e is FinanceEntry => e !== null);
  } catch {
    return [];
  }
}

function saveEntriesCache(entries: FinanceEntry[]) {
  try {
    localStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function loadTagsCache(): Tag[] {
  try {
    const raw = localStorage.getItem(TAGS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => normalizeTag(r)).filter((t): t is Tag => t !== null);
  } catch {
    return [];
  }
}

function saveTagsCache(tags: Tag[]) {
  try {
    localStorage.setItem(TAGS_CACHE_KEY, JSON.stringify(tags));
  } catch {
    // ignore
  }
}

function defaultDateForMonth(monthKey: string): string {
  const today = new Date();
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (todayMonth === monthKey) {
    return `${monthKey}-${String(today.getDate()).padStart(2, "0")}`;
  }
  return `${monthKey}-01`;
}

function formatDayShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

const MONTHS_FULL = [
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

export function Finance({ readOnly = false }: { readOnly?: boolean }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [storedEntries, setStoredEntries] = useState<FinanceEntry[]>(() =>
    loadEntriesCache()
  );
  const [autoEntries, setAutoEntries] = useState<FinanceEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>(() => loadTagsCache());
  const [editing, setEditing] = useState<
    | { entry: FinanceEntry }
    | { newSubtype: FinanceSubtype }
    | null
  >(null);
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "online" | "offline"
  >("idle");
  const pendingWrites = useRef(0);

  useEffect(() => {
    saveEntriesCache(storedEntries);
  }, [storedEntries]);

  useEffect(() => {
    saveTagsCache(tags);
  }, [tags]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function syncFromServer(initial: boolean) {
      if (pendingWrites.current > 0) return;
      try {
        if (initial) setSyncStatus("syncing");
        const [entries, calendar, tagsResp] = await Promise.all([
          fetchEntries(controller.signal),
          fetchAneCalendar(controller.signal),
          fetchTags(controller.signal),
        ]);
        if (cancelled) return;
        if (pendingWrites.current > 0) return;
        setStoredEntries(entries);
        setAutoEntries(
          generateCollateralAutoIncomes(calendar.workdays, calendar.paidMonths)
        );
        setTags(tagsResp);
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
    () => summarizeMonthByType(entriesThisMonth),
    [entriesThisMonth]
  );

  const ganhos = useMemo(
    () =>
      entriesBySubtype(entriesThisMonth, "ganho").sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    [entriesThisMonth]
  );
  const fixas = useMemo(
    () =>
      entriesBySubtype(entriesThisMonth, "fixa").sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    [entriesThisMonth]
  );
  const variaveis = useMemo(
    () =>
      entriesBySubtype(entriesThisMonth, "variavel").sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    [entriesThisMonth]
  );
  const dividas = useMemo(
    () =>
      entriesBySubtype(entriesThisMonth, "divida").sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    [entriesThisMonth]
  );
  const investimentos = useMemo(
    () =>
      entriesBySubtype(allEntries, "investimento").sort((a, b) =>
        b.date.localeCompare(a.date)
      ),
    [allEntries]
  );

  // Visão anual: somatório por mês do viewYear
  const annual = useMemo(() => {
    const yearEntries = entriesForYear(allEntries, viewYear);
    const months: { monthIndex: number; summary: ReturnType<typeof summarizeMonthByType> }[] = [];
    for (let m = 0; m < 12; m++) {
      const mk = `${viewYear}-${String(m + 1).padStart(2, "0")}`;
      const eOfMonth = yearEntries.filter((e) => monthKeyOf(e.date) === mk);
      months.push({ monthIndex: m, summary: summarizeMonthByType(eOfMonth) });
    }
    const total = summarizeMonthByType(yearEntries);
    return { months, total };
  }, [allEntries, viewYear]);

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
      const fresh = await postEntry(entry);
      setStoredEntries(fresh);
      setSyncStatus("online");
    } catch {
      if (!wasPresent) {
        setStoredEntries((prev) => prev.filter((e) => e.id !== entry.id));
      }
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
      const fresh = await deleteEntry(id);
      setStoredEntries(fresh);
      setSyncStatus("online");
    } catch {
      if (removed) setStoredEntries((prev) => [...prev, removed]);
      setSyncStatus("offline");
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  async function saveTag(tag: Tag) {
    const wasPresent = tags.some((t) => t.id === tag.id);
    setTags((prev) => {
      const idx = prev.findIndex((t) => t.id === tag.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tag;
        return next;
      }
      return [...prev, tag];
    });
    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const fresh = await postTag(tag);
      setTags(fresh);
      setSyncStatus("online");
    } catch {
      if (!wasPresent) setTags((prev) => prev.filter((t) => t.id !== tag.id));
      setSyncStatus("offline");
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  async function removeTag(id: string) {
    if (id === "collateral") {
      window.alert("A tag 'Collateral' não pode ser excluída (usada nas receitas automáticas).");
      return;
    }
    if (
      !window.confirm(
        "Excluir essa tag? Os lançamentos com essa tag ficarão sem origem."
      )
    ) {
      return;
    }
    const removed = tags.find((t) => t.id === id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    pendingWrites.current += 1;
    setSyncStatus("syncing");
    try {
      const fresh = await deleteTag(id);
      setTags(fresh);
      setSyncStatus("online");
    } catch {
      if (removed) setTags((prev) => [...prev, removed]);
      setSyncStatus("offline");
    } finally {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1);
    }
  }

  return (
    <>
      <header className="page-header has-actions">
        <div className="page-header-text">
          <span className="page-header-cat">Financeiro</span>
          <h1 className="page-header-title">Finanças Pessoais</h1>
          <p className="page-header-sub">
            Entradas, saídas, categorias e saldo do mês. Privado — só você vê.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="finance-global-add-button"
            onClick={() => setEditing({ newSubtype: "ganho" })}
          >
            + Adicionar lançamento
          </button>
        )}
      </header>

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

      {/* Visão Anual */}
      <AnnualView
        year={viewYear}
        months={annual.months}
        total={annual.total}
        onYearChange={setViewYear}
        onPickMonth={(m) => setViewMonth(m)}
        currentMonth={viewMonth}
      />

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
              {MONTHS_FULL[viewMonth]} {viewYear}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {entriesThisMonth.length}{" "}
              {entriesThisMonth.length === 1 ? "lançamento" : "lançamentos"}
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
          <SummaryItem label="Ganhos" value={summary.ganhos} variant="ganho" />
          <SummaryItem label="Fixos" value={summary.fixos} variant="fixa" />
          <SummaryItem
            label="Variáveis"
            value={summary.variaveis}
            variant="variavel"
          />
          <SummaryItem
            label="Dívidas"
            value={summary.dividas}
            variant="divida"
          />
          <SummaryItem
            label="Balanço"
            value={summary.balanco}
            variant={summary.balanco >= 0 ? "positive" : "negative"}
          />
        </div>
        {(syncStatus === "syncing" || syncStatus === "offline") && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color:
                syncStatus === "offline" ? "#F87C56" : "var(--text-tertiary)",
              opacity: syncStatus === "syncing" ? 0.7 : 1,
              alignSelf: "flex-end",
              fontStyle: "italic",
            }}
            aria-live="polite"
          >
            {syncStatus === "syncing" ? "sincronizando…" : "offline"}
          </span>
        )}
      </div>

      {/* Empty state quando nada no mês */}
      {ganhos.length === 0 &&
        fixas.length === 0 &&
        variaveis.length === 0 &&
        dividas.length === 0 &&
        investimentos.length === 0 && (
          <div className="finance-empty-state">
            <span className="finance-empty-state-icon" aria-hidden>
              ◔
            </span>
            <span className="finance-empty-state-text">
              Nenhum lançamento ainda. Comece adicionando o primeiro acima.
            </span>
          </div>
        )}

      {/* Listas (só aparecem se tiver entries) */}
      {ganhos.length > 0 && (
        <FinanceSection
          subtype="ganho"
          entries={ganhos}
          tags={tags}
          readOnly={readOnly}
          onEdit={(e) => setEditing({ entry: e })}
        />
      )}
      {fixas.length > 0 && (
        <FinanceSection
          subtype="fixa"
          entries={fixas}
          tags={tags}
          readOnly={readOnly}
          onEdit={(e) => setEditing({ entry: e })}
        />
      )}
      {variaveis.length > 0 && (
        <FinanceSection
          subtype="variavel"
          entries={variaveis}
          tags={tags}
          readOnly={readOnly}
          onEdit={(e) => setEditing({ entry: e })}
        />
      )}
      {dividas.length > 0 && (
        <FinanceSection
          subtype="divida"
          entries={dividas}
          tags={tags}
          readOnly={readOnly}
          onEdit={(e) => setEditing({ entry: e })}
        />
      )}
      {investimentos.length > 0 && (
        <FinanceSection
          subtype="investimento"
          entries={investimentos}
          tags={tags}
          readOnly={readOnly}
          showMonth
          onEdit={(e) => setEditing({ entry: e })}
        />
      )}

      {/* Tags */}
      {!readOnly && (
        <TagPanel
          tags={tags}
          open={tagPanelOpen}
          onToggle={() => setTagPanelOpen((o) => !o)}
          onSave={saveTag}
          onDelete={removeTag}
        />
      )}

      {editing && !readOnly && (
        <FinanceEntryModal
          subtype={
            "newSubtype" in editing ? editing.newSubtype : editing.entry.subtype
          }
          tags={tags}
          existing={"entry" in editing ? editing.entry : undefined}
          initialDate={
            "newSubtype" in editing
              ? defaultDateForMonth(monthKey)
              : editing.entry.date
          }
          onClose={() => setEditing(null)}
          onSave={saveEntry}
          onDelete={
            "entry" in editing ? () => removeEntry(editing.entry.id) : undefined
          }
        />
      )}
    </>
  );
}

// ---- Annual table ----

function AnnualView({
  year,
  months,
  total,
  onYearChange,
  onPickMonth,
  currentMonth,
}: {
  year: number;
  months: { monthIndex: number; summary: ReturnType<typeof summarizeMonthByType> }[];
  total: ReturnType<typeof summarizeMonthByType>;
  onYearChange: (y: number) => void;
  onPickMonth: (m: number) => void;
  currentMonth: number;
}) {
  return (
    <div className="step-card" style={{ gap: 12 }}>
      <div className="annual-header">
        <span className="annual-title">Controle do Ano</span>
        <div className="annual-year-nav">
          <button
            type="button"
            className="annual-year-button"
            onClick={() => onYearChange(year - 1)}
          >
            ‹
          </button>
          <span className="annual-year-label">{year}</span>
          <button
            type="button"
            className="annual-year-button"
            onClick={() => onYearChange(year + 1)}
          >
            ›
          </button>
        </div>
      </div>
      <div className="annual-table-wrap">
        <table className="annual-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Ganhos</th>
              <th>Fixos</th>
              <th>Variáveis</th>
              <th>Dívidas</th>
              <th>Balanço</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const isCurrent = m.monthIndex === currentMonth;
              return (
                <tr
                  key={m.monthIndex}
                  className={isCurrent ? "is-current" : ""}
                  onClick={() => onPickMonth(m.monthIndex)}
                  role="button"
                >
                  <td className="annual-cell-month">
                    {formatMonthShort(m.monthIndex)}
                  </td>
                  <td className={m.summary.ganhos > 0 ? "is-positive" : ""}>
                    {formatBRL(m.summary.ganhos)}
                  </td>
                  <td className={m.summary.fixos > 0 ? "is-expense" : ""}>
                    {formatBRL(m.summary.fixos)}
                  </td>
                  <td className={m.summary.variaveis > 0 ? "is-expense" : ""}>
                    {formatBRL(m.summary.variaveis)}
                  </td>
                  <td className={m.summary.dividas > 0 ? "is-expense" : ""}>
                    {formatBRL(m.summary.dividas)}
                  </td>
                  <td
                    className={
                      m.summary.balanco > 0
                        ? "is-positive"
                        : m.summary.balanco < 0
                          ? "is-negative"
                          : ""
                    }
                  >
                    {formatBRL(m.summary.balanco)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total {year}</td>
              <td>{formatBRL(total.ganhos)}</td>
              <td>{formatBRL(total.fixos)}</td>
              <td>{formatBRL(total.variaveis)}</td>
              <td>{formatBRL(total.dividas)}</td>
              <td
                className={
                  total.balanco > 0
                    ? "is-positive"
                    : total.balanco < 0
                      ? "is-negative"
                      : ""
                }
              >
                {formatBRL(total.balanco)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---- Summary card ----

function SummaryItem({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "ganho" | "fixa" | "variavel" | "divida" | "positive" | "negative";
}) {
  return (
    <div className={`finance-summary-item is-${variant}`}>
      <span className="finance-summary-label">{label}</span>
      <span className="finance-summary-value">{formatBRL(value)}</span>
    </div>
  );
}

// ---- Section per subtype ----

function FinanceSection({
  subtype,
  entries,
  tags,
  readOnly,
  showMonth,
  onEdit,
}: {
  subtype: FinanceSubtype;
  entries: FinanceEntry[];
  tags: Tag[];
  readOnly: boolean;
  showMonth?: boolean;
  onEdit: (entry: FinanceEntry) => void;
}) {
  const meta = subtypeMeta(subtype);
  const tagSummary = useMemo(
    () => summarizeByTag(entries, tags),
    [entries, tags]
  );
  const total = useMemo(
    () => entries.reduce((s, e) => s + e.amount, 0),
    [entries]
  );

  return (
    <div className="step-card" style={{ gap: 12 }}>
      <div className="finance-section-header">
        <div className="finance-section-title-wrap">
          <span
            className="finance-section-dot"
            style={{ background: meta.color }}
            aria-hidden
          />
          <span className="finance-section-title">{meta.pluralLabel}</span>
          <span className="finance-section-total">{formatBRL(total)}</span>
        </div>
      </div>

      {tagSummary.length > 0 && total > 0 && (
        <div className="finance-tag-summary">
          {tagSummary.map((s) => (
            <span
              key={s.tagId ?? "none"}
              className="finance-tag-chip"
              style={
                s.tag
                  ? {
                      borderColor: s.tag.color,
                      color: s.tag.color,
                      background: `${s.tag.color}1a`,
                    }
                  : undefined
              }
            >
              {s.tag?.label ?? "Sem origem"} · {formatBRL(s.total)}
            </span>
          ))}
        </div>
      )}

      <div className="finance-list">
        {entries.map((e) => (
          <FinanceRow
            key={e.id}
            entry={e}
            tags={tags}
            showMonth={showMonth}
            onClick={readOnly || e.auto ? undefined : () => onEdit(e)}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Row ----

function FinanceRow({
  entry,
  tags,
  showMonth,
  onClick,
}: {
  entry: FinanceEntry;
  tags: Tag[];
  showMonth?: boolean;
  onClick?: () => void;
}) {
  const tag = tags.find((t) => t.id === entry.tag);
  const meta = subtypeMeta(entry.subtype);
  const isExpense = meta.expense;
  const statusBadge = entry.status
    ? entry.status === "pago"
      ? { label: "Pago", className: "is-pago" }
      : { label: "A pagar", className: "is-a-pagar" }
    : null;
  const cat =
    entry.category && (entry.subtype === "fixa" || entry.subtype === "variavel")
      ? entry.category
      : null;

  const dateLabel = showMonth
    ? `${formatDayShort(entry.date)}/${entry.date.slice(2, 4)}`
    : formatDayShort(entry.date);

  // Detalhes específicos por subtype
  const detailParts: string[] = [];
  detailParts.push(dateLabel);
  if (cat) detailParts.push(categoryLabel(cat));
  if (entry.subtype === "fixa") {
    if (entry.paymentMethod) detailParts.push(paymentMethodLabel(entry.paymentMethod));
  }
  if (entry.subtype === "variavel") {
    if (entry.card) detailParts.push(entry.card);
    if (entry.installments) detailParts.push(entry.installments);
  }
  if (entry.subtype === "divida") {
    if (entry.debtor) detailParts.push(entry.debtor);
    if (entry.installments) detailParts.push(entry.installments);
  }
  if (entry.subtype === "investimento") {
    if (entry.broker) detailParts.push(brokerLabel(entry.broker));
    if (entry.investmentType) detailParts.push(investmentTypeLabel(entry.investmentType));
  }

  return (
    <button
      type="button"
      className={`finance-row is-${entry.subtype}${
        statusBadge?.className === "is-pago" ? " is-paid" : ""
      }${entry.auto ? " is-auto" : ""}${onClick ? "" : " is-readonly"}`}
      onClick={onClick}
      disabled={!onClick}
      title={
        entry.auto
          ? "Gerado automaticamente do calendário do Collateral"
          : onClick
            ? "Clique para editar"
            : undefined
      }
    >
      <span
        className="finance-row-dot"
        style={{ background: cat ? categoryColor(cat) : meta.color }}
        aria-hidden
      />
      <div className="finance-row-main">
        <span className="finance-row-desc">
          {entry.description || (isExpense ? "Despesa" : "Lançamento")}
          {entry.auto && (
            <span className="finance-row-auto-badge">auto</span>
          )}
          {tag && (
            <span
              className="finance-row-tag"
              style={{
                borderColor: tag.color,
                color: tag.color,
                background: `${tag.color}1a`,
              }}
            >
              {tag.label}
            </span>
          )}
          {statusBadge && (
            <span
              className={`finance-row-status-badge ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          )}
          {entry.subtype === "fixa" && entry.receiptUrl && (
            <a
              href={entry.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="finance-row-receipt"
              onClick={(ev) => ev.stopPropagation()}
              title="Abrir recibo"
            >
              recibo ↗
            </a>
          )}
        </span>
        <span className="finance-row-meta">{detailParts.join(" · ")}</span>
      </div>
      <div className="finance-row-value-wrap">
        <span
          className={`finance-row-value${isExpense ? " is-negative" : ""}`}
        >
          {isExpense ? "− " : ""}
          {formatBRL(entry.amount)}
        </span>
        {entry.subtype === "divida" && entry.totalAmount && entry.totalAmount > 0 && (
          <span className="finance-row-subvalue">
            de {formatBRL(entry.totalAmount)}
          </span>
        )}
      </div>
    </button>
  );
}

// ---- Tag panel ----

function TagPanel({
  tags,
  open,
  onToggle,
  onSave,
  onDelete,
}: {
  tags: Tag[];
  open: boolean;
  onToggle: () => void;
  onSave: (t: Tag) => void;
  onDelete: (id: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLOR_PALETTE[0]);

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    if (!id) return;
    if (tags.some((t) => t.id === id)) {
      window.alert("Já existe uma tag com esse nome.");
      return;
    }
    onSave({ id, label, color: newColor });
    setNewLabel("");
    setNewColor(TAG_COLOR_PALETTE[(tags.length + 1) % TAG_COLOR_PALETTE.length]);
  }

  return (
    <div className="step-card" style={{ gap: 12 }}>
      <button type="button" className="finance-section-header tag-panel-toggle" onClick={onToggle}>
        <div className="finance-section-title-wrap">
          <span className="finance-section-title">Origens (tags)</span>
          <span className="finance-section-total">{tags.length}</span>
        </div>
        <span className="finance-add-button" aria-hidden>
          {open ? "Fechar" : "Gerenciar"}
        </span>
      </button>

      {open && (
        <>
          <div className="tag-list">
            {tags.map((t) => (
              <div key={t.id} className="tag-row">
                <span
                  className="tag-row-swatch"
                  style={{ background: t.color }}
                />
                <span className="tag-row-label">{t.label}</span>
                <select
                  value={t.color}
                  onChange={(e) =>
                    onSave({ ...t, color: e.target.value })
                  }
                  className="tag-row-color"
                  title="Mudar cor"
                  style={{ background: t.color }}
                >
                  {TAG_COLOR_PALETTE.map((c) => (
                    <option key={c} value={c} style={{ background: c }}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="tag-row-delete"
                  onClick={() => onDelete(t.id)}
                  title="Excluir tag"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="tag-add-row">
            <input
              type="text"
              className="finance-input"
              placeholder="Nova tag (ex: Empresa X)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
            <div className="tag-color-picker">
              {TAG_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`tag-color-swatch${
                    newColor === c ? " is-active" : ""
                  }`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`Escolher cor ${c}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="finance-add-button"
              onClick={add}
              disabled={!newLabel.trim()}
            >
              Adicionar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

