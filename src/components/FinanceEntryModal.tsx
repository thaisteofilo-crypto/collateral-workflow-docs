import { useEffect, useRef, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceEntry,
  type FinanceEntryType,
  formatBRL,
  newEntryId,
  parseBRLInput,
} from "../finance";

type Mode = "add" | "edit";

export function FinanceEntryModal({
  initialType,
  initialDate,
  existing,
  onClose,
  onSave,
  onDelete,
}: {
  initialType: FinanceEntryType;
  initialDate: string; // YYYY-MM-DD
  existing?: FinanceEntry;
  onClose: () => void;
  onSave: (entry: FinanceEntry) => void;
  onDelete?: () => void;
}) {
  const mode: Mode = existing ? "edit" : "add";
  const [type, setType] = useState<FinanceEntryType>(
    existing?.type ?? initialType
  );
  const [date, setDate] = useState(existing?.date ?? initialDate);
  const [description, setDescription] = useState(existing?.description ?? "");
  const categories =
    type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const defaultCategory =
    type === "income" ? "outros-income" : "outros-expense";
  const [category, setCategory] = useState(
    existing?.category ?? defaultCategory
  );
  const [amountStr, setAmountStr] = useState(
    existing ? (existing.amount / 100).toFixed(2).replace(".", ",") : ""
  );
  const [received, setReceived] = useState<boolean>(
    existing ? !!existing.receivedAt : false
  );
  const descRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  // Quando trocar o tipo, ajusta categoria default se a atual não pertence
  useEffect(() => {
    const valid = (
      type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    ).some((c) => c.id === category);
    if (!valid) setCategory(defaultCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    const amount = parseBRLInput(amountStr);
    if (amount === 0) return;
    const desc = description.trim() || (type === "income" ? "Entrada" : "Saída");
    const entry: FinanceEntry = {
      id: existing?.id ?? newEntryId(),
      type,
      date,
      description: desc,
      amount,
      category,
      receivedAt: type === "income" && received ? date : undefined,
    };
    onSave(entry);
  }

  return (
    <div className="day-modal-overlay" onClick={onClose}>
      <div
        className="day-modal finance-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="day-modal-header">
          <span className="day-modal-eyebrow">
            {mode === "add" ? "Novo lançamento" : "Editar lançamento"}
          </span>
          <span className="day-modal-title">
            {type === "income" ? "Entrada" : "Saída"}
          </span>
        </header>

        <div className="finance-type-toggle">
          <button
            type="button"
            className={`finance-type-button${type === "income" ? " is-active is-income" : ""}`}
            onClick={() => setType("income")}
          >
            Entrada
          </button>
          <button
            type="button"
            className={`finance-type-button${type === "expense" ? " is-active is-expense" : ""}`}
            onClick={() => setType("expense")}
          >
            Saída
          </button>
        </div>

        <div className="finance-field">
          <label className="finance-field-label">Descrição</label>
          <input
            ref={descRef}
            type="text"
            className="finance-input"
            placeholder={type === "income" ? "Ex: Freela design" : "Ex: Mercado"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="finance-row">
          <div className="finance-field">
            <label className="finance-field-label">Valor</label>
            <div className="finance-amount-wrap">
              <span className="finance-amount-prefix">R$</span>
              <input
                type="text"
                inputMode="decimal"
                className="finance-input finance-amount"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </div>
          </div>
          <div className="finance-field">
            <label className="finance-field-label">Data</label>
            <input
              type="date"
              className="finance-input finance-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="finance-field">
          <label className="finance-field-label">Categoria</label>
          <div className="finance-category-grid">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`finance-category-chip${
                  category === c.id ? " is-active" : ""
                }`}
                onClick={() => setCategory(c.id)}
                style={
                  category === c.id
                    ? {
                        borderColor: c.color,
                        color: c.color,
                        background: `${c.color}1a`,
                      }
                    : undefined
                }
              >
                <span
                  className="finance-category-dot"
                  style={{ background: c.color }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {type === "income" && (
          <label className="finance-checkbox">
            <input
              type="checkbox"
              checked={received}
              onChange={(e) => setReceived(e.target.checked)}
            />
            <span>Já recebida</span>
          </label>
        )}

        <div className="day-modal-actions">
          {mode === "edit" && onDelete && (
            <button
              type="button"
              className="day-modal-action day-modal-action--secondary"
              onClick={onDelete}
            >
              Excluir
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
            onClick={handleSave}
            disabled={parseBRLInput(amountStr) === 0}
            title={
              parseBRLInput(amountStr) === 0
                ? "Informe um valor maior que zero"
                : undefined
            }
          >
            {mode === "add" ? "Adicionar" : "Salvar"}
          </button>
        </div>

        {parseBRLInput(amountStr) > 0 && (
          <div className="finance-modal-preview">
            {formatBRL(parseBRLInput(amountStr))}
          </div>
        )}
      </div>
    </div>
  );
}
