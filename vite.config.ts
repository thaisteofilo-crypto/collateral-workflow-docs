import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAction,
  normalizeActivity,
  normalizePayment,
  type DebtActivity,
  type DebtPayment,
} from "./api/_debt-core";

// Dev-only mock of /api/debt (Vercel functions don't run under `vite dev`).
// Persists to .local-data/debt.json and mirrors api/debt.ts responses.
function debtDevApi(): Plugin {
  const root = dirname(fileURLToPath(import.meta.url));
  const file = resolve(root, ".local-data/debt.json");
  const activityFile = resolve(root, ".local-data/debt-activity.json");

  const loadActivity = (): DebtActivity[] => {
    try {
      const raw = JSON.parse(readFileSync(activityFile, "utf8")) as unknown;
      return Array.isArray(raw)
        ? raw.map(normalizeActivity).filter((a): a is DebtActivity => a !== null)
        : [];
    } catch {
      return [];
    }
  };

  const load = (): DebtPayment[] => {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
      return Array.isArray(raw)
        ? raw.map(normalizePayment).filter((p): p is DebtPayment => p !== null)
        : [];
    } catch {
      return [];
    }
  };
  const save = (list: DebtPayment[]) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(list, null, 2));
  };

  return {
    name: "debt-dev-api",
    apply: "serve",
    configureServer(server) {
      if (!existsSync(file)) save([]);
      server.middlewares.use((req, res, next) => {
        const [path, query = ""] = (req.url ?? "").split("?");
        if (path !== "/api/debt") return next();
        const send = (status: number, data: unknown) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          if (status === 200) res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify(data));
        };

        if (req.method === "GET") {
          return send(200, new URLSearchParams(query).has("activity") ? loadActivity() : load());
        }
        if (req.method !== "POST") return send(405, { error: "method not allowed" });

        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", () => {
          try {
            let body: unknown;
            try {
              body = JSON.parse(raw);
            } catch {
              return send(400, { error: "bad request" });
            }
            const current = load();
            const result = applyAction(current, body);
            if (!result.ok) return send(result.status, { error: result.error });
            const op = result.op;
            const next =
              op.type === "set"
                ? [...current.filter((p) => p.id !== op.payment.id), op.payment]
                : current.filter((p) => p.id !== op.id);
            save(next);
            if (result.activity) {
              const log = [result.activity, ...loadActivity()].slice(0, 500);
              writeFileSync(activityFile, JSON.stringify(log, null, 2));
            }
            send(200, next);
          } catch (err) {
            send(500, { error: err instanceof Error ? err.message : String(err) });
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), debtDevApi()],
  // 127.0.0.1 evita o HTTP 431 causado por excesso de cookies em "localhost".
  server: { host: "127.0.0.1" },
});
