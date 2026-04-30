import { useEffect, useState } from "react";

const STORAGE_KEY = "collateral.checklist.v1";

const beforeProducing = [
  "Tese do post clara em uma frase",
  "Objeto-conceito escolhido",
  "Imagem-guia definida",
  "Título tem tensão (se não tiver, reescreve)",
  "Print da direção enviado para validação",
];

const beforeDelivering = [
  "Objeto principal claro na imagem",
  "Cores dentro da paleta Collateral",
  "Logo na posição e cor certas",
  "Texto legível, sem cortar o objeto",
  "Resolução correta",
  ".psd salvo com camadas",
  ".png exportado",
  "Nome do arquivo no padrão",
  "Tudo na pasta certa do Figma",
];

function loadChecks(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function ChecklistGroup({
  title,
  items,
  prefix,
  checks,
  onToggle,
}: {
  title: string;
  items: string[];
  prefix: string;
  checks: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </span>
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((item, i) => {
          const key = `${prefix}-${i}`;
          const checked = !!checks[key];
          return (
            <li key={key}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(key)}
                />
                <span
                  style={{
                    fontSize: 14,
                    color: checked
                      ? "var(--text-tertiary)"
                      : "var(--text-secondary)",
                    textDecoration: checked ? "line-through" : "none",
                    lineHeight: 1.5,
                  }}
                >
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Checklist() {
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    loadChecks()
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
    } catch {
      // ignore
    }
  }, [checks]);

  const toggle = (key: string) =>
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  function reset() {
    setChecks({});
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: -16,
        }}
      >
        <button type="button" className="link-button" onClick={reset}>
          Limpar
        </button>
      </div>
      <div className="step-card" style={{ gap: 24 }}>
        <ChecklistGroup
          title="Antes de produzir"
          items={beforeProducing}
          prefix="before"
          checks={checks}
          onToggle={toggle}
        />
        <div style={{ height: 1, background: "var(--border-subtle)" }} />
        <ChecklistGroup
          title="Antes de entregar"
          items={beforeDelivering}
          prefix="deliver"
          checks={checks}
          onToggle={toggle}
        />
      </div>
    </>
  );
}
