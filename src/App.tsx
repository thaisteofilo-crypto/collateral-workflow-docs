import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { HomePage } from "./components/HomePage";
import { PageHeader } from "./components/PageHeader";
import { Introduction } from "./components/Introduction";
import { Process1, Process2 } from "./components/WorkflowSteps";
import { Checklist } from "./components/Checklist";
import { Specifications } from "./components/Specifications";
import { Templates, Fonts } from "./components/Assets";
import { ReferenceGallery } from "./components/ReferenceGallery";
import { Pipeline } from "./components/Pipeline";
import { WorkCalendar } from "./components/WorkCalendar";
import { Finance } from "./components/Finance";
import { PasswordGate } from "./components/PasswordGate";
import { ProfileGate, type Profile } from "./components/ProfileGate";
import { CATEGORIES, findRoute } from "./routes";

function getPageFromHash(): string {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h || "home";
}

function navigate(id: string) {
  if (id === "home") {
    window.location.hash = "";
  } else {
    window.location.hash = `/${id}`;
  }
}

function Page({ id, profile }: { id: string; profile: Profile }) {
  const route = findRoute(id);
  if (!route) return null;
  if (route.visibleFor && !route.visibleFor.includes(profile)) return null;
  const cat = CATEGORIES.find((c) => c.id === route.category)?.label;

  let body: React.ReactNode = null;
  switch (id) {
    case "introducao":
      body = <Introduction />;
      break;
    case "processo-1":
      body = <Process1 />;
      break;
    case "processo-2":
      body = <Process2 />;
      break;
    case "checklist":
      body = <Checklist />;
      break;
    case "especificacoes":
      body = <Specifications />;
      break;
    case "templates":
      body = <Templates />;
      break;
    case "fontes":
      body = <Fonts />;
      break;
    case "galeria":
      body = <ReferenceGallery />;
      break;
    case "pipeline":
      body = <Pipeline />;
      break;
    case "calendario":
      body = (
        <WorkCalendar
          personId="ane"
          mode="salary"
          readOnly={profile !== "ane"}
        />
      );
      break;
    case "calendario-thais":
      body = (
        <WorkCalendar
          personId="thais"
          mode="tasks"
          readOnly={profile !== "thais"}
        />
      );
      break;
    case "financas":
      body = <Finance readOnly={profile !== "ane"} />;
      break;
  }

  // Finanças renderiza seu próprio header pra acomodar o botão "+ Adicionar"
  // alinhado à direita.
  const skipAutoHeader = id === "financas";

  return (
    <>
      {!skipAutoHeader && (
        <PageHeader
          title={route.title}
          subtitle={route.subtitle}
          category={cat}
        />
      )}
      <div className="page-body">{body}</div>
    </>
  );
}

function App() {
  const [page, setPage] = useState<string>(() => getPageFromHash());

  useEffect(() => {
    const onHash = () => {
      setPage(getPageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <PasswordGate>
      <ProfileGate>
        {(profile, switchProfile) => (
          <div className="app-shell notranslate" translate="no">
            <Sidebar
              current={page}
              onNavigate={navigate}
              profile={profile}
              onSwitchProfile={switchProfile}
            />
            <main className="content-area">
              <div
                className={`content-inner${page === "financas" ? " is-wide" : ""}`}
              >
                {page === "home" ? (
                  <HomePage onNavigate={navigate} />
                ) : (
                  <Page id={page} profile={profile} />
                )}
              </div>
            </main>
          </div>
        )}
      </ProfileGate>
    </PasswordGate>
  );
}

export default App;
