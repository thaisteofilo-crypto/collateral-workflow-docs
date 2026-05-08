import type { ReactNode } from "react";

export interface RouteDef {
  id: string;
  title: string;
  shortLabel?: string;
  subtitle?: string;
  category: string;
  icon?: ReactNode;
  iconColor?: string;
  iconBg?: string;
  external?: string;
}

export interface Category {
  id: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: "manual", label: "Manual" },
  { id: "processos", label: "Processos" },
  { id: "padroes", label: "Padrões" },
  { id: "assets", label: "Assets" },
  { id: "trabalho", label: "Trabalho" },
];

export const ROUTES: RouteDef[] = [
  {
    id: "introducao",
    title: "Introdução",
    subtitle:
      "Manual de produção das capas e imagens internas para o blog da Collateral.",
    category: "manual",
  },
  {
    id: "processo-1",
    title: "Processo 1 · Capa",
    shortLabel: "Processo 1 · Capa",
    subtitle: "Oito etapas para produzir a capa do post, do briefing à entrega.",
    category: "processos",
  },
  {
    id: "processo-2",
    title: "Processo 2 · Imagens Internas",
    shortLabel: "Processo 2 · Internas",
    subtitle:
      "Cinco etapas para gerar IMAGE A, B e C depois da capa aprovada.",
    category: "processos",
  },
  {
    id: "checklist",
    title: "Checklist",
    subtitle: "Antes de produzir e antes de entregar.",
    category: "padroes",
  },
  {
    id: "especificacoes",
    title: "Especificações",
    subtitle: "Formato, resolução, arquivos e nomenclatura.",
    category: "padroes",
  },
  {
    id: "templates",
    title: "Templates",
    subtitle: "Arquivos PSD da capa e das imagens internas.",
    category: "assets",
  },
  {
    id: "fontes",
    title: "Fontes",
    subtitle: "Tobias para títulos, Uncut Sans para corpo.",
    category: "assets",
  },
  {
    id: "galeria",
    title: "Galeria de Referências",
    shortLabel: "Galeria",
    subtitle: "Capas finais já produzidas. Referência visual para novos blogs.",
    category: "assets",
  },
  {
    id: "pipeline",
    title: "Pipeline de Posts",
    shortLabel: "Pipeline",
    subtitle:
      "Status de cada blog: a fazer, em produção, aguardando aprovação, aprovado, publicado. Notas de feedback por post.",
    category: "trabalho",
  },
  {
    id: "calendario",
    title: "Calendário · Ane",
    shortLabel: "Calendário · Ane",
    subtitle:
      "Marque os dias trabalhados e o status de pagamento por mês. Salário R$ 105/dia.",
    category: "trabalho",
  },
  {
    id: "calendario-thais",
    title: "Calendário · Thais",
    shortLabel: "Calendário · Thais",
    subtitle:
      "Registro de tarefas por dia: capas, capas internas, resumos e ajustes.",
    category: "trabalho",
  },
];

export const EXTERNAL_LINKS = [
  {
    title: "Blog Collateral",
    url: "https://collateral.com/blog",
  },
  {
    title: "Fluxo no Figma",
    url: "https://www.figma.com/design/9BbFSbF4QwNIHiB4cFA2zO/Collateral---Ane--c%C3%B3pia-?node-id=2279-2&p=f&t=GtiniPJa6svA7nxo-0",
  },
  {
    title: "Pinterest",
    url: "https://br.pinterest.com/thaisteofilo03/collateral/",
  },
  {
    title: "Google Drive",
    url: "https://drive.google.com/drive/folders/1JFTiP60w6sCJ134cmkp79BfsgfKnKsv1?usp=drive_link",
  },
  {
    title: "Assistente Gemini",
    url: "https://gemini.google.com/gem/1qC_d2IRBh8Jnp_Rb02PyI6BKZHdqtnAz?usp=sharing",
  },
];

export function findRoute(id: string): RouteDef | undefined {
  return ROUTES.find((r) => r.id === id);
}
