import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

const KEY_BY_PERSON: Record<string, string> = {
  ane: "collateral:finance:entries:ane",
  thais: "collateral:finance:entries:thais",
};

function resolveKey(req: Request): string {
  const url = new URL(req.url);
  const id = url.searchParams.get("person") ?? "ane";
  return KEY_BY_PERSON[id] ?? KEY_BY_PERSON.ane;
}

function getRedis() {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "KV não configurado. Configure Upstash Redis (Vercel KV) no painel da Vercel."
    );
  }
  return new Redis({ url, token });
}

type StoredEntry = {
  id: string;
  subtype: "ganho" | "fixa" | "variavel" | "divida" | "investimento";
  date: string;
  description: string;
  amount: number;
  tag?: string;
  status?: "pago" | "a_pagar";
  category?: string;
  paymentMethod?:
    | "pix"
    | "debito"
    | "credito"
    | "dinheiro"
    | "boleto"
    | "transferencia";
  receiptUrl?: string;
  card?: string;
  installments?: string;
  debtor?: string;
  totalAmount?: number;
  broker?: string;
  investmentType?: string;
};

function normalize(raw: unknown): StoredEntry | null {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  if (typeof obj.id !== "string" || !obj.id) return null;
  const date = typeof obj.date === "string" ? obj.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const amount = Math.max(0, Math.round(Number(obj.amount ?? 0)));
  if (!Number.isFinite(amount)) return null;
  const description =
    typeof obj.description === "string" ? obj.description : "";

  let subtype: StoredEntry["subtype"];
  if (
    obj.subtype === "ganho" ||
    obj.subtype === "fixa" ||
    obj.subtype === "variavel" ||
    obj.subtype === "divida" ||
    obj.subtype === "investimento"
  ) {
    subtype = obj.subtype;
  } else if (obj.type === "income") {
    subtype = "ganho";
  } else if (obj.type === "expense") {
    subtype = "variavel";
  } else {
    return null;
  }

  let status: StoredEntry["status"];
  if (obj.status === "pago" || obj.status === "a_pagar") {
    status = obj.status;
  } else if (typeof obj.receivedAt === "string") {
    status = "pago";
  }

  const out: StoredEntry = {
    id: obj.id,
    subtype,
    date,
    description,
    amount,
  };
  if (typeof obj.tag === "string" && obj.tag) out.tag = obj.tag;
  if (status) out.status = status;
  if (typeof obj.category === "string" && obj.category)
    out.category = obj.category;
  if (
    obj.paymentMethod === "pix" ||
    obj.paymentMethod === "debito" ||
    obj.paymentMethod === "credito" ||
    obj.paymentMethod === "dinheiro" ||
    obj.paymentMethod === "boleto" ||
    obj.paymentMethod === "transferencia"
  ) {
    out.paymentMethod = obj.paymentMethod;
  }
  if (typeof obj.receiptUrl === "string" && obj.receiptUrl)
    out.receiptUrl = obj.receiptUrl;
  if (typeof obj.card === "string") out.card = obj.card;
  if (typeof obj.installments === "string") out.installments = obj.installments;
  if (typeof obj.debtor === "string") out.debtor = obj.debtor;
  if (
    typeof obj.totalAmount === "number" &&
    Number.isFinite(obj.totalAmount) &&
    obj.totalAmount >= 0
  ) {
    out.totalAmount = Math.round(obj.totalAmount);
  }
  if (typeof obj.broker === "string") out.broker = obj.broker;
  if (typeof obj.investmentType === "string")
    out.investmentType = obj.investmentType;
  return out;
}

async function readAll(redis: Redis, key: string): Promise<StoredEntry[]> {
  const raw = (await redis.hgetall(key)) as Record<string, unknown> | null;
  if (!raw) return [];
  const out: StoredEntry[] = [];
  for (const val of Object.values(raw)) {
    const n = normalize(val);
    if (n) out.push(n);
  }
  return out;
}

export default async function handler(req: Request) {
  try {
    const redis = getRedis();
    const KEY = resolveKey(req);

    if (req.method === "GET") {
      const all = await readAll(redis, KEY);
      return Response.json(all, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as {
        action?: string;
        entry?: unknown;
        id?: string;
      };
      if (body.action === "delete") {
        if (typeof body.id !== "string" || !body.id) {
          return Response.json({ error: "bad request" }, { status: 400 });
        }
        await redis.hdel(KEY, body.id);
      } else if (body.action === "upsert" || !body.action) {
        const entry = normalize(body.entry);
        if (!entry) {
          return Response.json({ error: "bad request" }, { status: 400 });
        }
        await redis.hset(KEY, { [entry.id]: JSON.stringify(entry) });
      } else {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      const all = await readAll(redis, KEY);
      return Response.json(all, {
        headers: { "cache-control": "no-store" },
      });
    }

    return Response.json({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
