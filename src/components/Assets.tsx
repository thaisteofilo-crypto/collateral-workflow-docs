import {
  ArrowOutwardLineIcon,
  ImageLineIcon,
} from "@overlens/legacy-icons";

const templates = [
  {
    name: "Main Cover",
    file: "/templates/1 - Main Cover.psd",
    description: "Capa principal do post",
    size: "20.2 MB",
  },
  {
    name: "Blog Cover",
    file: "/templates/2 - Blog Cover.psd",
    description: "Capa secundária do blog",
    size: "0.9 MB",
  },
  {
    name: "In-text 01",
    file: "/templates/3 - In-text 01.psd",
    description: "Imagem interna A",
    size: "0.9 MB",
  },
  {
    name: "In-text 02",
    file: "/templates/3 - In-text 02.psd",
    description: "Imagem interna B",
    size: "41.3 MB",
  },
  {
    name: "In-text 03",
    file: "/templates/3 - In-text 03.psd",
    description: "Imagem interna C",
    size: "13.7 MB",
  },
];

const fonts = [
  {
    name: "Tobias",
    role: "Títulos · 35pt, entrelinha 35",
    sample: "Collateral Blog",
    family: "Tobias, Georgia, serif",
    file: "/fonts/Tobias-Regular.otf",
    fileLabel: "Regular .otf",
  },
  {
    name: "Uncut Sans",
    role: "Subtítulo e corpo · 14pt",
    sample: "Subtítulo do artigo",
    family: '"Uncut Sans", system-ui, sans-serif',
    file: "/fonts/UncutSans-Regular.otf",
    fileLabel: "Regular .otf",
  },
];

export function Templates() {
  return (
    <div className="asset-grid">
      {templates.map((tpl) => (
        <a
          key={tpl.name}
          href={tpl.file}
          download
          className="asset-card"
        >
          <div className="asset-icon asset-icon--psd">
            <ImageLineIcon style={{ width: 18, height: 18 }} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {tpl.name}
            </span>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tpl.description}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <ArrowOutwardLineIcon
              style={{
                width: 16,
                height: 16,
                color: "var(--text-tertiary)",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {tpl.size}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

export function Fonts() {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fonts.map((font) => (
          <div key={font.name} className="font-card">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {font.name}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  {font.role}
                </span>
              </div>
              <a
                href={font.file}
                download
                className="pill-button"
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                Baixar {font.fileLabel}
                <ArrowOutwardLineIcon style={{ width: 14, height: 14 }} />
              </a>
            </div>
            <span
              style={{
                fontFamily: font.family,
                fontSize: 40,
                fontWeight: 400,
                color: "var(--text-primary)",
                lineHeight: 1.1,
                letterSpacing:
                  font.name === "Tobias" ? "-0.01em" : "-0.02em",
              }}
            >
              {font.sample}
            </span>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--text-tertiary)",
          lineHeight: 1.6,
          marginTop: 8,
        }}
      >
        Fontes completas (Light, Regular, Medium, Bold e itálicos) estão em{" "}
        <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
          /public/fonts/
        </code>
      </p>
    </>
  );
}
