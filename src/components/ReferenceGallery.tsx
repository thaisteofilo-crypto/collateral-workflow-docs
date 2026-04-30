import { useState } from "react";

const modules = import.meta.glob<{ default: string }>(
  "../../imagens de referencia/*.{png,jpg,jpeg,webp,gif,PNG,JPG,JPEG,WEBP,GIF}",
  { eager: true }
);

interface RefImage {
  src: string;
  name: string;
}

const images: RefImage[] = Object.entries(modules)
  .map(([path, mod]) => {
    const fileName = decodeURIComponent(path.split("/").pop() || "");
    const name = fileName.replace(/\.[^.]+$/, "");
    return { src: mod.default, name };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function ReferenceGallery() {
  const [selected, setSelected] = useState<RefImage | null>(null);

  if (images.length === 0) {
    return (
      <div
        className="step-card"
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 14,
        }}
      >
        Nenhuma imagem ainda. Adicione arquivos em{" "}
        <code
          style={{
            color: "var(--text-secondary)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
          }}
        >
          workflow-docs/imagens de referencia/
        </code>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-tertiary)",
          marginTop: -16,
        }}
      >
        {images.length} {images.length === 1 ? "imagem" : "imagens"}
      </div>

      <div className="loose-gallery">
        {images.map((img) => (
          <button
            key={img.src}
            type="button"
            className="loose-item"
            onClick={() => setSelected(img)}
            title={img.name}
          >
            <img src={img.src} alt={img.name} loading="lazy" />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="lightbox"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selected.src} alt={selected.name} />
            <div className="lightbox-caption">
              <span>{selected.name}</span>
              <button
                type="button"
                className="pill-button"
                onClick={() => setSelected(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
