import { ArrowOutwardLineIcon } from "@overlens/legacy-icons";

const resources = [
  {
    title: "Blog Collateral",
    description: "Ver artigos publicados",
    url: "https://collateral.com/blog",
  },
  {
    title: "Fluxo no Figma",
    description: "Arquivo de design",
    url: "https://www.figma.com/design/fo5kZcQj576gZIYYPz3dVJ/Collateral---Blog?node-id=2279-2&t=QDUVAd3wZjRdusf3-1",
  },
  {
    title: "Pinterest",
    description: "Referências visuais",
    url: "https://br.pinterest.com/thaisteofilo03/collateral/",
  },
  {
    title: "Google Drive",
    description: "Arquivos e assets",
    url: "https://drive.google.com/drive/folders/1JFTiP60w6sCJ134cmkp79BfsgfKnKsv1?usp=drive_link",
  },
];

export function ResourceLinks() {
  return (
    <div className="section">
      <span className="section-label">Links & Recursos</span>

      <div className="resources-grid">
        {resources.map((resource) => (
          <a
            key={resource.title}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="resource-card"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                {resource.title}
              </span>
              <ArrowOutwardLineIcon
                style={{
                  width: 18,
                  height: 18,
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              {resource.description}
            </span>
          </a>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
        <a
          href="https://collateral.com/blog"
          target="_blank"
          rel="noopener noreferrer"
          className="pill-button pill-button--primary"
        >
          Abrir Blog
          <ArrowOutwardLineIcon style={{ width: 16, height: 16 }} />
        </a>
        <a
          href="https://www.figma.com/design/fo5kZcQj576gZIYYPz3dVJ/Collateral---Blog?node-id=2279-2&t=QDUVAd3wZjRdusf3-1"
          target="_blank"
          rel="noopener noreferrer"
          className="pill-button"
        >
          Abrir Figma
          <ArrowOutwardLineIcon style={{ width: 16, height: 16 }} />
        </a>
      </div>
    </div>
  );
}
