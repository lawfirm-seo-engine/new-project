const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const KEY_PREFIX = "criminal-board:image:";
const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const ID_RE = /^[a-z0-9]+-[a-f0-9]{12}\.(jpg|png|webp|gif)$/;

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    const form = await request.formData().catch(() => null);
    const file = form?.get("image");
    if (!file || typeof file === "string") return json({ ok: false, message: "이미지 파일이 없습니다." }, 400);

    const type = String(file.type || "").toLowerCase();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return json({ ok: false, message: "지원하지 않는 이미지 형식입니다. (JPG, PNG, WEBP, GIF만 가능)" }, 400);
    if (file.size > MAX_BYTES) return json({ ok: false, message: "이미지 용량은 5MB 이하만 업로드할 수 있습니다." }, 400);

    const buffer = await file.arrayBuffer();
    const id = `${Date.now().toString(36)}-${randomHex(12)}.${ext}`;
    await env.CASES.put(`${KEY_PREFIX}${id}`, buffer, { metadata: { type } });

    return json({ ok: true, id, url: `/api/criminal-board-image?id=${encodeURIComponent(id)}` });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env?.CASES) return new Response("Not Found", { status: 404 });
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    if (!ID_RE.test(id)) return new Response("Not Found", { status: 404 });

    const { value, metadata } = await env.CASES.getWithMetadata(`${KEY_PREFIX}${id}`, "arrayBuffer");
    if (!value) return new Response("Not Found", { status: 404 });

    return new Response(value, {
      headers: {
        "Content-Type": metadata?.type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
