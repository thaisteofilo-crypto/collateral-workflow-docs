import { ArrowOutwardLineIcon } from "@overlens/legacy-icons";
import { EXTERNAL_LINKS } from "../routes";

export function Introduction() {
  return (
    <>
      <div className="step-card" style={{ gap: 16 }}>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
          }}
        >
          Este documento é um guia de produção para as capas e imagens
          internas do blog da Collateral. Serve como referência para manter
          consistência visual entre as entregas, alinhar o ritmo de trabalho
          e garantir que cada peça siga o padrão da marca.
        </p>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
          }}
        >
          Aqui você encontra o passo a passo da produção, o checklist de
          qualidade e as especificações técnicas. Use como consulta rápida no
          dia a dia ou como onboarding para novas pessoas que entrarem no
          fluxo.
        </p>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
          }}
        >
          A ideia visual é direta: cada capa transforma o tema do post em um{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            objeto fotografado
          </strong>
          . O objeto carrega a ideia, não é decoração. O título sempre tem
          uma tensão, um paradoxo ou contradição que faz parar pra pensar.
          Tudo é centralizado no Figma: briefing, referências, produção e
          arquivos finais.
        </p>
      </div>

      <div className="link-grid">
        {EXTERNAL_LINKS.map((link) => (
          <a
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-card"
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {link.title}
            </span>
            <ArrowOutwardLineIcon
              style={{
                width: 16,
                height: 16,
                color: "var(--text-tertiary)",
              }}
            />
          </a>
        ))}
      </div>
    </>
  );
}
