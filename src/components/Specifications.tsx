const items = [
  { label: "Formato", value: "Vertical e horizontal" },
  { label: "Resolução", value: "150 dpi" },
  { label: "Arquivos", value: ".psd e .png" },
  { label: "Nome dos arquivos", value: "Seguir o nome do blog original" },
  { label: "Quantidade", value: "2 por dia" },
];

export function Specifications() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} className="spec-card">
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              textAlign: "right",
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
