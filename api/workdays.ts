import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

const KEY = "collateral:workdays:v1";

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

export default async function handler(req: Request) {
  try {
    const redis = getRedis();

    if (req.method === "GET") {
      const days = ((await redis.smembers(KEY)) as string[]) ?? [];
      return Response.json(days, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as {
        day?: string;
        action?: "add" | "remove";
      };
      const { day, action } = body;
      if (!day || (action !== "add" && action !== "remove")) {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      if (action === "add") {
        await redis.sadd(KEY, day);
      } else {
        await redis.srem(KEY, day);
      }
      const days = ((await redis.smembers(KEY)) as string[]) ?? [];
      return Response.json(days, {
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
