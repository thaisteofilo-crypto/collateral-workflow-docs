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
import { PasswordGate } from "./components/PasswordGate";
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

function Page({ id }: { id: string }) {
  const route = findRoute(id);
  if (!route) return null;
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
      body = <WorkCalendar />;
      break;
  }

  return (
    <>
      <PageHeader title={route.title} subtitle={route.subtitle} category={cat} />
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
      <div className="app-shell notranslate" translate="no">
        <Sidebar current={page} onNavigate={navigate} />
        <main className="content-area">
          <div className="content-inner">
            {page === "home" ? (
              <HomePage onNavigate={navigate} />
            ) : (
              <Page id={page} />
            )}
          </div>
        </main>
      </div>
    </PasswordGate>
  );
}

export default App;
