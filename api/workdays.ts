import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

type PersonConfig = {
  workdaysKey: string;
  legacyKey: string | null;
  migratedFlag: string;
};

const PERSONS: Record<string, PersonConfig> = {
  ane: {
    workdaysKey: "collateral:workdays:v2",
    legacyKey: "collateral:workdays:v1",
    migratedFlag: "collateral:workdays:migrated:v2",
  },
  thais: {
    workdaysKey: "collateral:workdays:v2:thais",
    legacyKey: null,
    migratedFlag: "collateral:workdays:migrated:v2:thais",
  },
};

function resolvePerson(req: Request): PersonConfig {
  const url = new URL(req.url);
  const id = url.searchParams.get("person") ?? "ane";
  return PERSONS[id] ?? PERSONS.ane;
}

type DayEntry = {
  capas: number;
  internas: number;
  resumos: number;
  ajustes: number;
};

const ZERO: DayEntry = { capas: 0, internas: 0, resumos: 0, ajustes: 0 };
// Dias antigos não tinham tipo — assume 2 capas/dia (regra original).
const LEGACY_DEFAULT: DayEntry = {
  capas: 2,
  internas: 0,
  resumos: 0,
  ajustes: 0,
};

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

function normalize(raw: unknown): DayEntry {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return ZERO;
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return ZERO;
  }
  const num = (v: unknown) => {
    const n = Math.floor(Number(v ?? 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    capas: num(obj.capas),
    internas: num(obj.internas),
    resumos: num(obj.resumos),
    ajustes: num(obj.ajustes),
  };
}

function isEmpty(e: DayEntry): boolean {
  return (
    e.capas === 0 && e.internas === 0 && e.resumos === 0 && e.ajustes === 0
  );
}

async function ensureMigrated(redis: Redis, p: PersonConfig) {
  const flag = await redis.get(p.migratedFlag);
  if (flag) return;
  if (p.legacyKey) {
    const oldDays = ((await redis.smembers(p.legacyKey)) as string[]) ?? [];
    if (oldDays.length > 0) {
      const payload: Record<string, string> = {};
      for (const d of oldDays) {
        payload[d] = JSON.stringify(LEGACY_DEFAULT);
      }
      await redis.hset(p.workdaysKey, payload);
    }
  }
  await redis.set(p.migratedFlag, "1");
}

async function readAll(
  redis: Redis,
  p: PersonConfig
): Promise<Record<string, DayEntry>> {
  await ensureMigrated(redis, p);
  const raw = (await redis.hgetall(p.workdaysKey)) as Record<
    string,
    unknown
  > | null;
  if (!raw) return {};
  const out: Record<string, DayEntry> = {};
  for (const [day, val] of Object.entries(raw)) {
    out[day] = normalize(val);
  }
  return out;
}

export default async function handler(req: Request) {
  try {
    const redis = getRedis();
    const person = resolvePerson(req);

    if (req.method === "GET") {
      const all = await readAll(redis, person);
      return Response.json(all, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as { day?: string; entry?: unknown };
      if (!body?.day || typeof body.day !== "string") {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      const entry = normalize(body.entry);
      if (isEmpty(entry)) {
        await redis.hdel(person.workdaysKey, body.day);
      } else {
        await redis.hset(person.workdaysKey, {
          [body.day]: JSON.stringify(entry),
        });
      }
      const all = await readAll(redis, person);
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
