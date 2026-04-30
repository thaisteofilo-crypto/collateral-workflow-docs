import {
  EditSolidIcon,
  ImageLineIcon,
  DocLineIcon,
  BoltSolidIcon,
  CalendarSolidIcon,
} from "@overlens/legacy-icons";
import type { ReactNode } from "react";
import { CATEGORIES, ROUTES } from "../routes";
import { PageHeader } from "./PageHeader";

interface CardSpec {
  catId: string;
  icon: ReactNode;
  color: string;
  bg: string;
  border: string;
}

const cardSpecs: CardSpec[] = [
  {
    catId: "manual",
    icon: <DocLineIcon style={{ width: 20, height: 20 }} />,
    color: "#77C5D5",
    bg: "rgba(119, 197, 213, 0.12)",
    border: "rgba(119, 197, 213, 0.3)",
  },
  {
    catId: "processos",
    icon: <EditSolidIcon style={{ width: 20, height: 20 }} />,
    color: "#D6A461",
    bg: "rgba(214, 164, 97, 0.12)",
    border: "rgba(214, 164, 97, 0.3)",
  },
  {
    catId: "padroes",
    icon: <BoltSolidIcon style={{ width: 20, height: 20 }} />,
    color: "#E2E99C",
    bg: "rgba(226, 233, 156, 0.12)",
    border: "rgba(226, 233, 156, 0.3)",
  },
  {
    catId: "assets",
    icon: <ImageLineIcon style={{ width: 20, height: 20 }} />,
    color: "#F87C56",
    bg: "rgba(248, 124, 86, 0.12)",
    border: "rgba(248, 124, 86, 0.3)",
  },
  {
    catId: "trabalho",
    icon: <CalendarSolidIcon style={{ width: 20, height: 20 }} />,
    color: "#B596E5",
    bg: "rgba(181, 150, 229, 0.12)",
    border: "rgba(181, 150, 229, 0.3)",
  },
];

interface HomePageProps {
  onNavigate: (id: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <>
      <PageHeader
        title="Capas de Blog"
        subtitle="Manual, processos e assets para a produção das capas e imagens internas do blog da Collateral."
      />

      <div className="home-grid">
        {cardSpecs.map((spec) => {
          const cat = CATEGORIES.find((c) => c.id === spec.catId);
          if (!cat) return null;
          const items = ROUTES.filter((r) => r.category === spec.catId);
          if (items.length === 0) return null;
          const first = items[0];
          return (
            <button
              key={spec.catId}
              type="button"
              className="home-card"
              onClick={() => onNavigate(first.id)}
            >
              <span
                className="home-card-icon"
                style={{
                  background: spec.bg,
                  borderColor: spec.border,
                  color: spec.color,
                }}
              >
                {spec.icon}
              </span>
              <span className="home-card-text">
                <span className="home-card-title">{cat.label}</span>
                <span className="home-card-meta">
                  {items.length} {items.length === 1 ? "página" : "páginas"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
