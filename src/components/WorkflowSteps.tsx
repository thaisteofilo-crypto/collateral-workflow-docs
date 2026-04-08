import {
  EditSolidIcon,
  ImageLineIcon,
  BoltSolidIcon,
  DocLineIcon,
} from "@overlens/legacy-icons";
import type { ReactNode } from "react";

interface Step {
  number: string;
  title: string;
  icon: ReactNode;
  description: string;
  details: string[];
}

const steps: Step[] = [
  {
    number: "01",
    title: "Criação da direção de imagem",
    icon: <EditSolidIcon style={{ width: 20, height: 20 }} />,
    description:
      "Ler o resumo e o conceito do blog para definir a direção visual da capa.",
    details: [
      "Analisar o tema e tom do artigo",
      "Definir paleta de cores e mood",
      "Podemos usar cores da paleta Collateral (amarelo queimado e verde, nos tons do site)",
      "Escolher estilo visual (minimalista, editorial, etc.)",
    ],
  },
  {
    number: "02",
    title: "Buscar imagens de referência",
    icon: <ImageLineIcon style={{ width: 20, height: 20 }} />,
    description:
      "Buscar imagens semi-prontas para adicionar texturas e novas cores.",
    details: [
      "Pesquisar no Pinterest e bancos de imagem",
      "Selecionar imagens que se alinham com a direção",
      "Considerar texturas, padrões e elementos visuais",
    ],
  },
  {
    number: "03",
    title: "Upscale da imagem",
    icon: <BoltSolidIcon style={{ width: 20, height: 20 }} />,
    description:
      "A partir da imagem criada, fazer upscale para garantir qualidade.",
    details: [
      "Aplicar upscale mantendo qualidade visual",
      "Verificar resolução adequada para web",
      "Ajustar cores e contraste se necessário",
    ],
  },
  {
    number: "04",
    title: "Adicionar título e subtítulo",
    icon: <DocLineIcon style={{ width: 20, height: 20 }} />,
    description:
      "Inserir título e subtítulo como parte da composição visual da imagem.",
    details: [
      "Título: fonte Tobias — 35pt, entrelinha 35",
      "Subtítulo: fonte Uncut Sans — 14pt",
      "Posicionar texto integrado à composição",
    ],
  },
];

export function WorkflowSteps() {
  return (
    <div className="section">
      <span className="section-label">Fluxo de Trabalho</span>

      <div className="steps-container">
        {steps.map((step, index) => (
          <div key={step.number} className="step-card">
            {/* Step header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                className={`step-number step-number--${index + 1}`}
              >
                {step.number}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--text-primary)" }}>
                  {step.icon}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {step.title}
                </span>
              </div>
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                paddingLeft: 46,
              }}
            >
              {step.description}
            </p>

            {/* Details */}
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingLeft: 46,
              }}
            >
              {step.details.map((detail, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    lineHeight: 1.5,
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
          </div>
        ))}
      </div>
    </div>
  );
}
