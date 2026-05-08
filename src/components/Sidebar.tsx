import { useEffect, useMemo, useState } from "react";
import {
  ArrowOutwardLineIcon,
  EditSolidIcon,
} from "@overlens/legacy-icons";
import { CATEGORIES, EXTERNAL_LINKS, ROUTES } from "../routes";
import { PROFILE_LABELS, type Profile } from "./ProfileGate";

interface SidebarProps {
  current: string;
  onNavigate: (id: string) => void;
  profile: Profile;
  onSwitchProfile: () => void;
}

export function Sidebar({
  current,
  onNavigate,
  profile,
  onSwitchProfile,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (initial[c.id] = false));
    return initial;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("sidebar-search");
        el?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredByCat = useMemo(() => {
    const q = search.trim().toLowerCase();
    const grouped: Record<string, typeof ROUTES> = {};
    for (const cat of CATEGORIES) grouped[cat.id] = [];
    for (const route of ROUTES) {
      if (route.visibleFor && !route.visibleFor.includes(profile)) continue;
      if (q && !route.title.toLowerCase().includes(q)) continue;
      grouped[route.category]?.push(route);
    }
    return grouped;
  }, [search, profile]);

  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (c) => !c.visibleFor || c.visibleFor.includes(profile)
      ),
    [profile]
  );

  function toggleCat(id: string) {
    setOpenCats((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-search-wrap">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ flexShrink: 0, color: "var(--text-tertiary)" }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="sidebar-search"
            className="sidebar-search"
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </div>

        <button
          type="button"
          className={`sidebar-header${current === "home" ? " is-active" : ""}`}
          onClick={() => onNavigate("home")}
        >
          <span className="sidebar-header-icon">
            <EditSolidIcon style={{ width: 14, height: 14 }} />
          </span>
          <span>Capas Collateral</span>
        </button>

        <nav className="sidebar-nav">
          {visibleCategories.map((cat) => {
            const items = filteredByCat[cat.id] ?? [];
            if (items.length === 0) return null;
            const open = openCats[cat.id];
            return (
              <div key={cat.id} className="sidebar-cat">
                <button
                  type="button"
                  className="sidebar-cat-header"
                  onClick={() => toggleCat(cat.id)}
                >
                  <span>{cat.label}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: open ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s",
                    }}
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                {open && (
                  <div className="sidebar-cat-items">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`sidebar-item${
                          current === item.id ? " is-active" : ""
                        }`}
                        onClick={() => onNavigate(item.id)}
                      >
                        {item.shortLabel ?? item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-divider" />

        <button
          type="button"
          className="profile-chip"
          onClick={onSwitchProfile}
          title="Trocar perfil"
        >
          <span className="profile-chip-label">Você é</span>
          <span className="profile-chip-name">{PROFILE_LABELS[profile]}</span>
          <span className="profile-chip-action">trocar</span>
        </button>

        <div className="sidebar-external">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.title}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-item sidebar-item--external"
            >
              <span>{link.title}</span>
              <ArrowOutwardLineIcon
                style={{ width: 14, height: 14, flexShrink: 0 }}
              />
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
