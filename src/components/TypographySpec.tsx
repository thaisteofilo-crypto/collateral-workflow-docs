const specs = [
  {
    label: "Título",
    font: "Tobias",
    size: "35pt",
    lineHeight: "35",
    preview: "Collateral Blog",
    previewSize: 20,
  },
  {
    label: "Subtítulo",
    font: "Uncut Sans",
    size: "14pt",
    lineHeight: null,
    preview: "Subtítulo do artigo",
    previewSize: 13,
  },
];

export function TypographySpec() {
  return (
    <div className="section">
      <span className="section-label">Tipografia</span>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {specs.map((spec) => (
          <div key={spec.label} className="spec-card">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {spec.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                }}
              >
                {spec.font} &middot; {spec.size}
                {spec.lineHeight && ` · Entrelinha ${spec.lineHeight}`}
              </span>
            </div>

            <span
              className="spec-preview"
              style={{
                fontSize: spec.previewSize,
                fontWeight: spec.label === "Título" ? 500 : 400,
              }}
            >
              {spec.preview}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
