import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

const KEY_BY_PERSON: Record<string, string> = {
  ane: "collateral:finance:tags:ane",
  thais: "collateral:finance:tags:thais",
};

const SEED_KEY_BY_PERSON: Record<string, string> = {
  ane: "collateral:finance:tags:seeded:ane",
  thais: "collateral:finance:tags:seeded:thais",
};

const DEFAULT_TAGS = [
  { id: "collateral", label: "Collateral", color: "#77C5D5" },
  { id: "pessoal", label: "Pessoal", color: "#A78BFA" },
];

function resolvePerson(req: Request): string {
  const url = new URL(req.url);
  return url.searchParams.get("person") ?? "ane";
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

type StoredTag = { id: string; label: string; color: string };

function normalize(raw: unknown): StoredTag | null {
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
  if (typeof obj.label !== "string" || !obj.label) return null;
  const color =
    typeof obj.color === "string" && obj.color.startsWith("#")
      ? obj.color
      : "#9CA3AF";
  return { id: obj.id, label: obj.label.trim(), color };
}

async function ensureSeeded(redis: Redis, person: string) {
  const seedKey = SEED_KEY_BY_PERSON[person] ?? SEED_KEY_BY_PERSON.ane;
  const flag = await redis.get(seedKey);
  if (flag) return;
  const key = KEY_BY_PERSON[person] ?? KEY_BY_PERSON.ane;
  const payload: Record<string, string> = {};
  for (const t of DEFAULT_TAGS) {
    payload[t.id] = JSON.stringify(t);
  }
  await redis.hset(key, payload);
  await redis.set(seedKey, "1");
}

async function readAll(redis: Redis, key: string): Promise<StoredTag[]> {
  const raw = (await redis.hgetall(key)) as Record<string, unknown> | null;
  if (!raw) return [];
  const out: StoredTag[] = [];
  for (const val of Object.values(raw)) {
    const n = normalize(val);
    if (n) out.push(n);
  }
  return out;
}

export default async function handler(req: Request) {
  try {
    const redis = getRedis();
    const person = resolvePerson(req);
    const KEY = KEY_BY_PERSON[person] ?? KEY_BY_PERSON.ane;

    await ensureSeeded(redis, person);

    if (req.method === "GET") {
      const all = await readAll(redis, KEY);
      return Response.json(all, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as {
        action?: string;
        tag?: unknown;
        id?: string;
      };
      if (body.action === "delete") {
        if (typeof body.id !== "string" || !body.id) {
          return Response.json({ error: "bad request" }, { status: 400 });
        }
        await redis.hdel(KEY, body.id);
      } else if (body.action === "upsert" || !body.action) {
        const tag = normalize(body.tag);
        if (!tag) {
          return Response.json({ error: "bad request" }, { status: 400 });
        }
        await redis.hset(KEY, { [tag.id]: JSON.stringify(tag) });
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
