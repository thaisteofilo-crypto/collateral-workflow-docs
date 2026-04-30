import {
  EditSolidIcon,
  ImageLineIcon,
  BoltSolidIcon,
  DocLineIcon,
  CalendarSolidIcon,
  ArrowOutwardLineIcon,
} from "@overlens/legacy-icons";
import { useState, type ReactNode } from "react";

interface Step {
  number: string;
  title: string;
  icon: ReactNode;
  description: string;
  details: string[];
  examples?: string[];
  examplesNote?: string;
}

const internalExampleModules = import.meta.glob<{ default: string }>(
  "../../imagens de onde colocar as imagens internas/*.{png,jpg,jpeg,PNG,JPG,JPEG}",
  { eager: true }
);

const internalExampleSrcs = Object.entries(internalExampleModules)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([, mod]) => mod.default);

const coverSteps: Step[] = [
  {
    number: "01",
    title: "Resumo do blog",
    icon: <EditSolidIcon style={{ width: 20, height: 20 }} />,
    description:
      "Use o assistente para entender o post e ver ideias de direção visual.",
    details: [
      "Ler o post original na íntegra",
      "Pedir resumo + conceito ao Gemini Collateral",
      "Identificar a tese em uma frase",
    ],
  },
  {
    number: "02",
    title: "Conceito no Figma",
    icon: <DocLineIcon style={{ width: 20, height: 20 }} />,
    description:
      "Preencha o template com nome, sobre o que fala, conceito, direção, título e subtítulo.",
    details: [
      "Nome do blog",
      "Sobre o que o post fala",
      "Conceito visual (objeto-conceito)",
      "Direção (mood, paleta, estilo)",
      "Título e subtítulo finais",
    ],
  },
  {
    number: "03",
    title: "Imagem-guia",
    icon: <ImageLineIcon style={{ width: 20, height: 20 }} />,
    description:
      "Escolha uma referência que define o clima: foto, frame de filme ou imagem editorial.",
    details: [
      "Definir luz, composição e atmosfera de partida",
      "Salvar referência na pasta do blog",
    ],
  },
  {
    number: "04",
    title: "Seleção",
    icon: <ImageLineIcon style={{ width: 20, height: 20 }} />,
    description:
      "Encontre 3 imagens próximas da guia em luz, composição e atmosfera.",
    details: [
      "Pinterest e bancos de imagem",
      "Variar dentro do mesmo mood",
      "Subir as 3 opções no Figma para validação",
    ],
  },
  {
    number: "05",
    title: "Geração",
    icon: <BoltSolidIcon style={{ width: 20, height: 20 }} />,
    description:
      "Gere variações até chegar numa boa. Se sair ruim 3 vezes seguidas, volte para refinar a referência.",
    details: [
      "Iterar a partir da imagem-guia",
      "Manter paleta Collateral (amarelo queimado e verde)",
      "Limite: 3 tentativas ruins antes de revisar a guia",
    ],
  },
  {
    number: "06",
    title: "Upscale",
    icon: <BoltSolidIcon style={{ width: 20, height: 20 }} />,
    description: "Aumente a resolução da imagem final.",
    details: [
      "Manter qualidade visual sem ruído",
      "Verificar nitidez do objeto-conceito",
    ],
  },
  {
    number: "07",
    title: "Diagramação",
    icon: <DocLineIcon style={{ width: 20, height: 20 }} />,
    description:
      "Use o template. Logo no topo, título grande, subtítulo, footer (quando tiver).",
    details: [
      "Título: Tobias 35pt, entrelinha 35",
      "Subtítulo: Uncut Sans 14pt",
      "Texto não pode passar por cima do objeto sem motivo",
      "Logo na cor e posição certas",
    ],
  },
  {
    number: "08",
    title: "Salvar e subir",
    icon: <ArrowOutwardLineIcon style={{ width: 20, height: 20 }} />,
    description:
      ".psd com camadas, .png exportado, e subir na pasta de aprovação no Figma.",
    details: [
      "Salvar .psd com todas as camadas",
      "Exportar .png na resolução final",
      "Nome do arquivo no padrão do blog",
      "Subir na pasta de aprovação no Figma",
    ],
  },
];

const internalSteps: Step[] = [
  {
    number: "01",
    title: "Mapear",
    icon: <EditSolidIcon style={{ width: 20, height: 20 }} />,
    description:
      "Leia o post e marque onde entram as imagens. Nomeie: IMAGE A, IMAGE B, IMAGE C.",
    details: [
      "Ler o post completo",
      "Marcar 3 pontos onde uma imagem agrega",
      "Nomear IMAGE A, IMAGE B, IMAGE C",
    ],
    examples: internalExampleSrcs,
    examplesNote: "Exemplos de marcação no post",
  },
  {
    number: "02",
    title: "Gerar",
    icon: <BoltSolidIcon style={{ width: 20, height: 20 }} />,
    description:
      "As internas seguem a capa: mesma paleta, mesma luz, mesmo estilo.",
    details: [
      "Manter coerência visual com a capa",
      "Variar composição, mas não atmosfera",
    ],
  },
  {
    number: "03",
    title: "Diagramar",
    icon: <DocLineIcon style={{ width: 20, height: 20 }} />,
    description: "Aplique o template das internas.",
    details: [
      "Template específico das internas",
      "Manter respiro e hierarquia",
    ],
  },
  {
    number: "04",
    title: "Salvar",
    icon: <CalendarSolidIcon style={{ width: 20, height: 20 }} />,
    description: ".psd e .png para cada uma das três imagens.",
    details: [
      ".psd com camadas",
      ".png exportado",
      "Nome no padrão IMAGE A/B/C",
    ],
  },
  {
    number: "05",
    title: "Subir",
    icon: <ArrowOutwardLineIcon style={{ width: 20, height: 20 }} />,
    description: "Mesma pasta da capa no Figma.",
    details: ["Subir junto da capa aprovada"],
  },
];

function StepList({ items }: { items: Step[] }) {
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div className="steps-container">
      {items.map((step, index) => (
        <div key={step.number} className="step-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div className={`step-number step-number--${(index % 4) + 1}`}>
              {step.number}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--text-primary)" }}>{step.icon}</span>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {step.title}
              </span>
            </div>
          </div>

          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              paddingLeft: 52,
            }}
          >
            {step.description}
          </p>

          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingLeft: 52,
            }}
          >
            {step.details.map((detail, i) => (
              <li
                key={i}
                style={{
                  fontSize: 14,
                  color: "var(--text-tertiary)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  lineHeight: 1.55,
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "var(--text-tertiary)",
                    flexShrink: 0,
                    marginTop: 7,
                  }}
                />
                {detail}
              </li>
            ))}
          </ul>

          {step.examples && step.examples.length > 0 && (
            <div
              style={{
                paddingLeft: 52,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {step.examplesNote && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {step.examplesNote}
                </span>
              )}
              <div className="step-examples">
                {step.examples.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className="step-example"
                    onClick={() => setZoom(src)}
                  >
                    <img src={src} alt="Exemplo" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {zoom && (
        <div
          className="lightbox"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={zoom} alt="Exemplo ampliado" />
            <div className="lightbox-caption">
              <span>Exemplo</span>
              <button
                type="button"
                className="pill-button"
                onClick={() => setZoom(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Process1() {
  return <StepList items={coverSteps} />;
}

export function Process2() {
  return <StepList items={internalSteps} />;
}
