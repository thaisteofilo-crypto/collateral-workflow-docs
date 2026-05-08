import { useEffect, useRef, useState } from "react";
import {
  BROKERS,
  CATEGORIES,
  INCOME_CATEGORIES,
  INVESTMENT_TYPES,
  PAYMENT_METHODS,
  SUBTYPES,
  type FinanceEntry,
  type FinanceStatus,
  type FinanceSubtype,
  type PaymentMethodId,
  type Tag,
  formatBRL,
  newEntryId,
  parseBRLInput,
} from "../finance";

export function FinanceEntryModal({
  subtype: initialSubtype,
  initialDate,
  existing,
  tags,
  onClose,
  onSave,
  onDelete,
}: {
  subtype: FinanceSubtype;
  initialDate: string;
  existing?: FinanceEntry;
  tags: Tag[];
  onClose: () => void;
  onSave: (entry: FinanceEntry) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!existing;
  const [subtype, setSubtype] = useState<FinanceSubtype>(
    existing?.subtype ?? initialSubtype
  );
  const [date, setDate] = useState(existing?.date ?? initialDate);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [amountStr, setAmountStr] = useState(
    existing ? (existing.amount / 100).toFixed(2).replace(".", ",") : ""
  );
  const [tag, setTag] = useState<string | undefined>(existing?.tag);
  const [status, setStatus] = useState<FinanceStatus>(
    existing?.status ?? (subtype === "ganho" ? "a_pagar" : "a_pagar")
  );
  const [category, setCategory] = useState<string | undefined>(
    existing?.category
  );
  const [paymentMethod, setPaymentMethod] = useState<
    PaymentMethodId | undefined
  >(existing?.paymentMethod);
  const [receiptUrl, setReceiptUrl] = useState(existing?.receiptUrl ?? "");
  const [card, setCard] = useState(existing?.card ?? "");
  const [installments, setInstallments] = useState(
    existing?.installments ?? ""
  );
  const [debtor, setDebtor] = useState(existing?.debtor ?? "");
  const [totalAmountStr, setTotalAmountStr] = useState(
    existing?.totalAmount && existing.totalAmount > 0
      ? (existing.totalAmount / 100).toFixed(2).replace(".", ",")
      : ""
  );
  const [broker, setBroker] = useState(existing?.broker ?? "");
  const [investmentType, setInvestmentType] = useState(
    existing?.investmentType ?? ""
  );

  const descRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const showCategory =
    subtype === "fixa" || subtype === "variavel" || subtype === "ganho";
  const showStatus =
    subtype === "fixa" || subtype === "variavel" || subtype === "ganho";
  const showPayment = subtype === "fixa";
  const showReceipt = subtype === "fixa";
  const showCard = subtype === "variavel";
  const showInstallments = subtype === "variavel" || subtype === "divida";
  const showDebtor = subtype === "divida";
  const showTotalAmount = subtype === "divida";
  const showBroker = subtype === "investimento";
  const showInvestmentType = subtype === "investimento";

  const categoryList =
    subtype === "ganho" ? INCOME_CATEGORIES : CATEGORIES;
  const isIncome = subtype === "ganho";

  const amountLabel =
    subtype === "variavel" || subtype === "divida"
      ? "Valor da parcela"
      : subtype === "investimento"
        ? "Valor investido"
        : "Valor";

  function handleSave() {
    const amount = parseBRLInput(amountStr);
    if (amount === 0) return;
    const desc = description.trim();
    const totalAmount = parseBRLInput(totalAmountStr);
    const entry: FinanceEntry = {
      id: existing?.id ?? newEntryId(),
      subtype,
      date,
      description: desc,
      amount,
      tag: tag || undefined,
    };
    if (showStatus) entry.status = status;
    if (showCategory && category) entry.category = category;
    if (showPayment && paymentMethod) entry.paymentMethod = paymentMethod;
    if (showReceipt && receiptUrl.trim())
      entry.receiptUrl = receiptUrl.trim();
    if (showCard && card.trim()) entry.card = card.trim();
    if (showInstallments && installments.trim())
      entry.installments = installments.trim();
    if (showDebtor && debtor.trim()) entry.debtor = debtor.trim();
    if (showTotalAmount && totalAmount > 0) entry.totalAmount = totalAmount;
    if (showBroker && broker) entry.broker = broker;
    if (showInvestmentType && investmentType)
      entry.investmentType = investmentType;
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
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </span>
          <span
            className="day-modal-title"
            style={{
              color: SUBTYPES.find((s) => s.id === subtype)?.color,
            }}
          >
            {SUBTYPES.find((s) => s.id === subtype)?.label}
          </span>
        </header>

        <div className="finance-subtype-grid">
          {SUBTYPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`finance-subtype-button${
                subtype === s.id ? " is-active" : ""
              }`}
              onClick={() => setSubtype(s.id)}
              style={
                subtype === s.id
                  ? {
                      borderColor: s.color,
                      color: s.color,
                      background: `${s.color}1a`,
                    }
                  : undefined
              }
              disabled={isEdit}
              title={isEdit ? "O tipo não pode ser alterado depois" : undefined}
            >
              {s.shortLabel}
            </button>
          ))}
        </div>

        <div className="finance-field">
          <label className="finance-field-label">
            {subtype === "investimento" ? "Produto financeiro" : "Descrição"}
          </label>
          <input
            ref={descRef}
            type="text"
            className="finance-input"
            placeholder={
              subtype === "investimento"
                ? "Ex: Tesouro Selic 2029"
                : subtype === "divida"
                  ? "Ex: Empréstimo banco"
                  : subtype === "ganho"
                    ? "Ex: Freela Joana"
                    : "Ex: Aluguel"
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="finance-row">
          <div className="finance-field">
            <label className="finance-field-label">{amountLabel}</label>
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
            <label className="finance-field-label">
              {subtype === "investimento" ? "Mês do aporte" : "Data"}
            </label>
            <input
              type="date"
              className="finance-input finance-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {showTotalAmount && (
          <div className="finance-field">
            <label className="finance-field-label">
              Valor total da dívida
            </label>
            <div className="finance-amount-wrap">
              <span className="finance-amount-prefix">R$</span>
              <input
                type="text"
                inputMode="decimal"
                className="finance-input finance-amount"
                placeholder="0,00"
                value={totalAmountStr}
                onChange={(e) => setTotalAmountStr(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Origem (Tag) */}
        <div className="finance-field">
          <label className="finance-field-label">Origem (tag)</label>
          <div className="finance-category-grid">
            <button
              type="button"
              className={`finance-category-chip${!tag ? " is-active" : ""}`}
              onClick={() => setTag(undefined)}
            >
              <span
                className="finance-category-dot"
                style={{ background: "#5C5C5C" }}
              />
              Sem origem
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`finance-category-chip${tag === t.id ? " is-active" : ""}`}
                onClick={() => setTag(t.id)}
                style={
                  tag === t.id
                    ? {
                        borderColor: t.color,
                        color: t.color,
                        background: `${t.color}1a`,
                      }
                    : undefined
                }
              >
                <span
                  className="finance-category-dot"
                  style={{ background: t.color }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categoria */}
        {showCategory && (
          <div className="finance-field">
            <label className="finance-field-label">Categoria</label>
            <div className="finance-category-grid">
              {categoryList.map((c) => (
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
        )}

        {/* Status */}
        {showStatus && (
          <div className="finance-field">
            <label className="finance-field-label">Status</label>
            <div className="finance-status-toggle">
              <button
                type="button"
                className={`finance-status-button${status === "a_pagar" ? " is-active is-pending" : ""}`}
                onClick={() => setStatus("a_pagar")}
              >
                {isIncome ? "A receber" : "A pagar"}
              </button>
              <button
                type="button"
                className={`finance-status-button${status === "pago" ? " is-active is-paid" : ""}`}
                onClick={() => setStatus("pago")}
              >
                {isIncome ? "Recebido" : "Pago"}
              </button>
            </div>
          </div>
        )}

        {/* Forma de pagamento */}
        {showPayment && (
          <div className="finance-field">
            <label className="finance-field-label">Forma de pagamento</label>
            <div className="finance-category-grid">
              {PAYMENT_METHODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`finance-category-chip${
                    paymentMethod === p.id ? " is-active" : ""
                  }`}
                  onClick={() => setPaymentMethod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recibo URL */}
        {showReceipt && (
          <div className="finance-field">
            <label className="finance-field-label">Recibo (link)</label>
            <input
              type="url"
              className="finance-input"
              placeholder="https://..."
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
            />
          </div>
        )}

        {/* Cartão */}
        {showCard && (
          <div className="finance-row">
            <div className="finance-field">
              <label className="finance-field-label">Qual cartão?</label>
              <input
                type="text"
                className="finance-input"
                placeholder="Ex: Nubank, Itaú…"
                value={card}
                onChange={(e) => setCard(e.target.value)}
              />
            </div>
            <div className="finance-field">
              <label className="finance-field-label">Nº de parcelas</label>
              <input
                type="text"
                className="finance-input"
                placeholder="Ex: 3/12 ou única"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Dívida */}
        {showDebtor && (
          <div className="finance-row">
            <div className="finance-field">
              <label className="finance-field-label">
                Para quem está devendo?
              </label>
              <input
                type="text"
                className="finance-input"
                placeholder="Ex: Banco X"
                value={debtor}
                onChange={(e) => setDebtor(e.target.value)}
              />
            </div>
            <div className="finance-field">
              <label className="finance-field-label">Nº de parcelas</label>
              <input
                type="text"
                className="finance-input"
                placeholder="Ex: 5/24"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Investimento */}
        {showBroker && (
          <div className="finance-field">
            <label className="finance-field-label">Corretora</label>
            <div className="finance-category-grid">
              {BROKERS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`finance-category-chip${broker === b.id ? " is-active" : ""}`}
                  onClick={() => setBroker(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showInvestmentType && (
          <div className="finance-field">
            <label className="finance-field-label">Tipo de investimento</label>
            <div className="finance-category-grid">
              {INVESTMENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`finance-category-chip${investmentType === t.id ? " is-active" : ""}`}
                  onClick={() => setInvestmentType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="day-modal-actions">
          {isEdit && onDelete && (
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
          >
            {isEdit ? "Salvar" : "Adicionar"}
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
