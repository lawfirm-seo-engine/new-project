// One-time patch: add fields to cases:index entries in KV
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();
    const patch = body.patch && typeof body.patch === "object" ? body.patch : null;

    if (!slug || !patch) {
      return json({ ok: false, message: "slug, patch 필수" }, 400);
    }
    if (!env.CASES) {
      return json({ ok: false, message: "KV 환경 없음" }, 500);
    }

    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const entry = idx.find((e) => e.slug === slug);
    if (!entry) {
      return json({ ok: false, message: `${slug} not found in cases:index` }, 404);
    }

    Object.assign(entry, patch);
    await env.CASES.put("cases:index", JSON.stringify(idx));

    return json({ ok: true, message: `${slug} patched`, entry });
  } catch (err) {
    return json({ ok: false, message: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
