const VIDEO_KEY_PREFIX = "cafe-reels/";

export async function onRequestGet(context) {
  return serveVideo(context, false);
}

export async function onRequestHead(context) {
  return serveVideo(context, true);
}

async function serveVideo({ request, env, params }, headOnly) {
  const id = mediaId(params?.id);
  if (!id) return new Response("Not found", { status: 404 });

  const key = `${VIDEO_KEY_PREFIX}${id}.mp4`;
  const bucket = env?.REELS_BUCKET || env?.CAFE_REELS_BUCKET;
  let bytes;
  let metadata = {};

  if (bucket) {
    const object = await bucket.get(key);
    if (object) {
      bytes = await object.arrayBuffer();
      metadata = object.customMetadata || {};
    }
  }

  if (!bytes && env?.CASES) {
    if (typeof env.CASES.getWithMetadata === "function") {
      const result = await env.CASES.getWithMetadata(key, "arrayBuffer");
      bytes = result?.value || null;
      metadata = result?.metadata || {};
    } else {
      bytes = await env.CASES.get(key, "arrayBuffer");
    }
  }

  if (!bytes) return new Response("Not found", { status: 404 });
  const full = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer || bytes);
  const range = parseRange(request.headers.get("Range"), full.byteLength);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Type": metadata.contentType || "video/mp4",
    "X-Content-Type-Options": "nosniff",
  });

  if (range) {
    const partial = full.slice(range.start, range.end + 1);
    headers.set("Content-Length", String(partial.byteLength));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${full.byteLength}`);
    return new Response(headOnly ? null : partial, { status: 206, headers });
  }

  headers.set("Content-Length", String(full.byteLength));
  return new Response(headOnly ? null : full, { status: 200, headers });
}

function mediaId(value) {
  const raw = Array.isArray(value) ? value.join("/") : String(value || "");
  const clean = raw.replace(/\.mp4$/i, "");
  return /^[a-z0-9][a-z0-9_-]{19,179}$/i.test(clean) ? clean.toLowerCase() : "";
}

function parseRange(value, size) {
  const match = String(value || "").match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) return null;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || start < 0 || start >= size) return null;
  const end = Math.min(size - 1, Number.isInteger(requestedEnd) ? requestedEnd : size - 1);
  return end >= start ? { start, end } : null;
}
