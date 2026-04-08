import { CalendarSolidIcon, ProfileLineIcon } from "@overlens/legacy-icons";

export function WorkflowHeader() {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill">
          <ProfileLineIcon style={{ width: 16, height: 16 }} />
          Ane
        </span>
        <span className="pill pill--accent">
          <CalendarSolidIcon style={{ width: 16, height: 16 }} />
          Início 13 de Abril
        </span>
      </div>

      {/* Title hierarchy */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
          }}
        >
          Fluxo de Trabalho
        </h1>
        <h2
          style={{
            fontSize: 40,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "var(--text-tertiary)",
          }}
        >
          Capas de Blog
        </h2>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          color: "var(--text-secondary)",
          lineHeight: 1.7,
          maxWidth: 480,
        }}
      >
        Documentação do fluxo de criação de capas para o blog da Collateral.
        Direção de imagem e composição visual.
      </p>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "var(--border-subtle)",
          marginTop: 8,
        }}
      />
    </header>
  );
}
