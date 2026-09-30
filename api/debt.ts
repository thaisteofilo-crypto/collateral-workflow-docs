import { Redis } from "@upstash/redis";
import {
  applyAction,
  normalizeActivity,
  normalizePayment,
  type DebtActivity,
  type DebtPayment,
} from "./_debt-core";

export const config = { runtime: "edge" };

const KEY = "collateral:debt:payments:v1";
const ACTIVITY_KEY = "collateral:debt:activity:v1";
const ACTIVITY_MAX = 500;

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

async function readAll(redis: Redis): Promise<DebtPayment[]> {
  const raw = (await redis.hgetall(KEY)) as Record<string, unknown> | null;
  if (!raw) return [];
  const out: DebtPayment[] = [];
  for (const v of Object.values(raw)) {
    const n = normalizePayment(v);
    if (n) out.push(n);
  }
  return out;
}

async function readActivity(redis: Redis): Promise<DebtActivity[]> {
  const raw = (await redis.lrange(ACTIVITY_KEY, 0, ACTIVITY_MAX - 1)) as unknown[];
  return (raw ?? [])
    .map(normalizeActivity)
    .filter((a): a is DebtActivity => a !== null);
}

const noStore = { "cache-control": "no-store" };

export default async function handler(req: Request) {
  try {
    const redis = getRedis();

    if (req.method === "GET") {
      if (new URL(req.url).searchParams.has("activity")) {
        return Response.json(await readActivity(redis), { headers: noStore });
      }
      return Response.json(await readAll(redis), { headers: noStore });
    }

    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      const result = applyAction(await readAll(redis), body);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      if (result.op.type === "set") {
        await redis.hset(KEY, {
          [result.op.payment.id]: JSON.stringify(result.op.payment),
        });
      } else {
        await redis.hdel(KEY, result.op.id);
      }
      if (result.activity) {
        await redis.lpush(ACTIVITY_KEY, JSON.stringify(result.activity));
        await redis.ltrim(ACTIVITY_KEY, 0, ACTIVITY_MAX - 1);
      }
      return Response.json(await readAll(redis), { headers: noStore });
    }

    return Response.json({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
