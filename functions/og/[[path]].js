// OG image edge function
// GET|HEAD /og/[slug].png → serves og-template.png with per-slug PNG metadata
// - Each slug URL returns a distinct PNG binary so search crawlers do not see
//   every landing page as using the exact same representative image.
// - Each slug URL is independently cached at Cloudflare CDN
// - onRequest handles both GET and HEAD so crawlers (Naver Yeti etc.) get
//   correct Content-Type on HEAD probes instead of falling through to HTML

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const origin = new URL(request.url).origin;

  // Fetch template from static assets binding. Prefer PNG for crawler thumbnails
  // because some search surfaces still omit WebP-only OG images.
  let asset;
  try {
    asset = await env.ASSETS.fetch(new Request(`${origin}/assets/og-template.png`));
    if (!asset.ok) asset = await env.ASSETS.fetch(new Request(`${origin}/assets/og-template.webp`));
  } catch {
    asset = null;
  }

  if (!asset || !asset.ok) {
    return new Response(method === "HEAD" ? null : "Not found", { status: 404 });
  }

  const contentType = asset.url?.endsWith(".webp") ? "image/webp" : "image/png";
  const body = await asset.arrayBuffer();
  const slug = decodeURIComponent(new URL(request.url).pathname.split("/").pop() || "")
    .replace(/\.png$/i, "")
    .slice(0, 180);
  const responseBody = contentType === "image/png"
    ? addPngTextChunk(body, "landing", slug || "default")
    : body;

  return new Response(method === "HEAD" ? null : responseBody, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(responseBody.byteLength),
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "CDN-Cache-Control": "public, max-age=604800",
      "Cloudflare-CDN-Cache-Control": "public, max-age=604800",
      "ETag": `"og-${simpleHash(slug || "default")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function addPngTextChunk(buffer, keyword, text) {
  const bytes = new Uint8Array(buffer);
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((value, index) => bytes[index] === value)) return buffer;

  const chunkData = textBytes(`${keyword}\0${text}`);
  const type = textBytes("tEXt");
  const chunk = new Uint8Array(12 + chunkData.length);
  writeUint32(chunk, 0, chunkData.length);
  chunk.set(type, 4);
  chunk.set(chunkData, 8);
  writeUint32(chunk, 8 + chunkData.length, crc32Concat(type, chunkData));

  const insertAt = 8 + 4 + 4 + 13 + 4; // PNG signature + IHDR chunk
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.slice(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(bytes.slice(insertAt), insertAt + chunk.length);
  return out.buffer;
}

function textBytes(value) {
  return new TextEncoder().encode(String(value || ""));
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function crc32Concat(a, b) {
  let crc = -1;
  crc = crc32Update(crc, a);
  crc = crc32Update(crc, b);
  return (crc ^ -1) >>> 0;
}

function crc32Update(crc, bytes) {
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return crc;
}

function simpleHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
