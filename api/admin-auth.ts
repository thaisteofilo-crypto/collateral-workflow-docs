export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "method not allowed" }, { status: 405 });
    }
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return Response.json(
        { error: "ADMIN_PASSWORD não configurado no servidor" },
        { status: 500 }
      );
    }
    const body = (await req.json()) as { password?: string };
    if (typeof body.password === "string" && body.password === expected) {
      return Response.json(
        { ok: true },
        { headers: { "cache-control": "no-store" } }
      );
    }
    return Response.json({ ok: false }, { status: 401 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
