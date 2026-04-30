import { useEffect, useState, type ReactNode } from "react";

const PASSWORD = "0505";
const STORAGE_KEY = "collateral.auth.v1";

export function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "ok";
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(false), 1200);
    return () => window.clearTimeout(t);
  }, [error]);

  if (authed) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() === PASSWORD) {
      try {
        localStorage.setItem(STORAGE_KEY, "ok");
      } catch {
        // ignore
      }
      setAuthed(true);
      return;
    }
    setError(true);
    setInput("");
  }

  return (
    <div className="lock-screen">
      <form className="lock-card" onSubmit={submit}>
        <span className="lock-eyebrow">Capas Collateral</span>
        <h1 className="lock-title">Acesso restrito</h1>
        <p className="lock-sub">Digite a senha para continuar.</p>
        <input
          autoFocus
          className={`lock-input${error ? " is-error" : ""}`}
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="••••"
          autoComplete="off"
          name="lock-password"
        />
        {error && <span className="lock-error">Senha incorreta</span>}
        <button type="submit" className="lock-button">
          Entrar
        </button>
      </form>
    </div>
  );
}
