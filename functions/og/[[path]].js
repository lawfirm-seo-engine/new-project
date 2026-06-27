import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { OG_IMAGE_VERSION } from "../_seo.js";

// Pretendard OTF (supports Korean) — cached in Worker isolate memory
const FONT_KV_KEY = "og:font:pretendard-v1";
const FONT_CDN_URL =
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf";
const IMG_CACHE_TTL = 60 * 60 * 24 * 60; // 60 days

let wasmInitPromise = null;
let fontBuffer = null;

async function getFont(env) {
  if (fontBuffer) return fontBuffer;

  // Try KV cache first
  try {
    const kv = await env.CASES.get(FONT_KV_KEY, { type: "arrayBuffer" });
    if (kv && kv.byteLength > 100_000) {
      fontBuffer = new Uint8Array(kv);
      return fontBuffer;
    }
  } catch (_) {}

  // Download from CDN (once per environment)
  const resp = await fetch(FONT_CDN_URL);
  if (!resp.ok) throw new Error(`Font CDN ${resp.status}`);
  const buf = await resp.arrayBuffer();
  fontBuffer = new Uint8Array(buf);

  // Store in KV — fire-and-forget
  env.CASES.put(FONT_KV_KEY, buf).catch(() => {});

  return fontBuffer;
}

async function ensureWasm(env, origin) {
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    const [wasmBuf, font] = await Promise.all([
      fetch(`${origin}/assets/og-resvg.wasm`).then((r) => {
        if (!r.ok) throw new Error(`WASM fetch ${r.status}`);
        return r.arrayBuffer();
      }),
      getFont(env),
    ]);
    await initWasm(wasmBuf);
    fontBuffer = font instanceof Uint8Array ? font : new Uint8Array(font);
  })().catch((err) => {
    // Allow retry on next request if init failed
    wasmInitPromise = null;
    throw err;
  });

  return wasmInitPromise;
}

function normCaseName(raw) {
  const s = String(raw || "").trim();
  if (/사기$/.test(s)) return s;
  const c = s.replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  return /사기/.test(c) ? c : c + " 사칭 사기";
}

function escSvg(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvg(caseName) {
  const MAX = 13;
  let l1 = escSvg(caseName);
  let l2 = "";
  if (caseName.length > MAX) {
    const mid = Math.ceil(caseName.length / 2);
    l1 = escSvg(caseName.slice(0, mid));
    l2 = escSvg(caseName.slice(mid));
  }
  const fs = l2 ? 72 : 80;
  const y1 = l2 ? 510 : 570;
  const y2 = y1 + fs + 16;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
    <stop offset="0%" stop-color="#0a1744"/>
    <stop offset="100%" stop-color="#16237e"/>
  </linearGradient>
</defs>
<rect width="1254" height="1254" fill="url(#bg)"/>
<rect x="0" y="0" width="10" height="1254" fill="#3949ab"/>
<rect x="1244" y="0" width="10" height="1254" fill="#3949ab"/>
<rect x="90" y="140" width="1074" height="3" fill="#3949ab" opacity="0.5"/>
<rect x="90" y="1114" width="1074" height="3" fill="#3949ab" opacity="0.5"/>
<text x="627" y="310" font-family="Pretendard,sans-serif" font-size="46" fill="#7986cb" text-anchor="middle">법무법인 선린</text>
<text x="627" y="400" font-family="Pretendard,sans-serif" font-size="30" fill="#3d4db7" text-anchor="middle">피해금 추적 법률센터</text>
<text x="627" y="${y1}" font-family="Pretendard,sans-serif" font-size="${fs}" fill="#ffffff" text-anchor="middle" font-weight="bold">${l1}</text>
${l2 ? `<text x="627" y="${y2}" font-family="Pretendard,sans-serif" font-size="${fs}" fill="#ffffff" text-anchor="middle" font-weight="bold">${l2}</text>` : ""}
<text x="627" y="760" font-family="Pretendard,sans-serif" font-size="34" fill="#5c6bc0" text-anchor="middle">피해금 추적 · 형사고소 · 민사소송</text>
<rect x="320" y="860" width="614" height="2" fill="#3f51b5" opacity="0.4"/>
<text x="627" y="960" font-family="Pretendard,sans-serif" font-size="50" fill="#e8eaf6" text-anchor="middle">02-6348-0406</text>
<text x="627" y="1050" font-family="Pretendard,sans-serif" font-size="28" fill="#3d4db7" text-anchor="middle">gnlaw-criminal.co.kr</text>
</svg>`;
}

const CACHE_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=2592000, s-maxage=2592000, immutable",
  "CDN-Cache-Control": "public, max-age=2592000",
  "Access-Control-Allow-Origin": "*",
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");

  // Accept .png and .webp; redirect anything else
  const isPng = /\.png$/i.test(rawName);
  const isWebp = /\.webp$/i.test(rawName);
  if (!isPng && !isWebp) {
    const base = rawName.replace(/\.[^.]*$/, "");
    return Response.redirect(`${url.origin}/og/${encodeURIComponent(base)}.png?v=${OG_IMAGE_VERSION}`, 302);
  }

  // Normalise slug
  const rawSlug = rawName.replace(/\.(png|webp)$/i, "").slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;

  if (!slug || slug === "landing") {
    return Response.redirect(`${url.origin}/assets/og-template.webp`, 302);
  }

  // KV cache lookup
  const cacheKey = `og:img:v${OG_IMAGE_VERSION}:${slug}`;
  try {
    const cached = await env.CASES.get(cacheKey, { type: "arrayBuffer" });
    if (cached && cached.byteLength > 1000) {
      return new Response(cached, { status: 200, headers: { ...CACHE_HEADERS, "X-Cache": "HIT" } });
    }
  } catch (_) {}

  // Resolve case name
  let caseName = slug;
  try {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) {
      const d = JSON.parse(raw);
      caseName = normCaseName(d.caseName || d.name || slug);
    }
  } catch (_) {}

  // Generate image
  try {
    await ensureWasm(env, url.origin);

    const svg = buildSvg(caseName);
    const resvg = new Resvg(svg, {
      font: {
        fontBuffers: [fontBuffer],
        defaultFontFamily: "Pretendard",
        loadSystemFonts: false,
      },
    });
    const rendered = resvg.render();
    const png = rendered.asPng();

    // Cache in KV (fire-and-forget)
    if (context.waitUntil) {
      context.waitUntil(
        env.CASES.put(cacheKey, png.buffer, { expirationTtl: IMG_CACHE_TTL }).catch(() => {}),
      );
    }

    return new Response(png, { status: 200, headers: { ...CACHE_HEADERS, "X-Cache": "MISS" } });
  } catch (err) {
    // Graceful fallback — serve template image
    console.error("[og] generation failed:", err?.message);
    return Response.redirect(`${url.origin}/assets/og-template.webp`, 302);
  }
}
