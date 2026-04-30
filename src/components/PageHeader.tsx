interface PageHeaderProps {
  title: string;
  subtitle?: string;
  category?: string;
}

export function PageHeader({ title, subtitle, category }: PageHeaderProps) {
  return (
    <header className="page-header">
      {category && <span className="page-header-cat">{category}</span>}
      <h1 className="page-header-title">{title}</h1>
      {subtitle && <p className="page-header-sub">{subtitle}</p>}
    </header>
  );
}
