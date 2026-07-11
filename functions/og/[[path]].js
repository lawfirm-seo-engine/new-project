// Dynamic OG image renderer.
// Uses the shared PNG template and renders the landing title inside the lower plaque.
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import webpEncodeFactory from "@jsquash/webp/codec/enc/webp_enc.js";
import webpEncodeWasm from "@jsquash/webp/codec/enc/webp_enc.wasm";
import { defaultOptions as webpDefaultOptions } from "@jsquash/webp/meta.js";
import { initEmscriptenModule } from "@jsquash/webp/utils.js";
import { OG_IMAGE_VERSION } from "../_seo.js";

const FONT_KV_KEY = "og:font:pretendard-black-v1";
const FONT_CDN_URL =
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Black.otf";
const IMG_CACHE_TTL = 60 * 60 * 24 * 60; // 60 days
const TEMPLATE_PATH = "/assets/og-template.png";
const TEMPLATE_WEBP_PATH = "/assets/og-template.webp";
const TEMPLATE_WIDTH = 1254;
const TEMPLATE_HEIGHT = 1254;
const PLAQUE_TEXT_CENTER_Y = 1116;

let initPromise = null;
let webpEncoderPromise = null;
let fontBuffer = null;
let templateBuffer = null;
let templateWebpBuffer = null;
let templateDataUri = null;

async function getFont(env) {
  if (fontBuffer) return fontBuffer;
  if (env.CASES) {
    try {
      const kv = await env.CASES.get(FONT_KV_KEY, { type: "arrayBuffer" });
      if (kv && kv.byteLength > 100_000) {
        fontBuffer = new Uint8Array(kv);
        return fontBuffer;
      }
    } catch (_) {}
  }

  const response = await fetch(FONT_CDN_URL);
  if (!response.ok) throw new Error(`Font CDN ${response.status}`);
  const buffer = await response.arrayBuffer();
  fontBuffer = new Uint8Array(buffer);
  env.CASES?.put?.(FONT_KV_KEY, buffer)?.catch?.(() => {});
  return fontBuffer;
}

function ensureInit(env) {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await initWasm(resvgWasm);
    await getFont(env);
  })().catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function getTemplateBuffer(origin) {
  if (templateBuffer) return templateBuffer;
  const response = await fetch(`${origin}${TEMPLATE_PATH}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`OG template ${response.status}`);
  const buffer = await response.arrayBuffer();
  templateBuffer = buffer;
  return templateBuffer;
}

async function getTemplateWebpBuffer(origin) {
  if (templateWebpBuffer) return templateWebpBuffer;
  const response = await fetch(`${origin}${TEMPLATE_WEBP_PATH}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`OG template webp ${response.status}`);
  const buffer = await response.arrayBuffer();
  templateWebpBuffer = buffer;
  return templateWebpBuffer;
}

async function getTemplateDataUri(origin) {
  if (templateDataUri) return templateDataUri;
  const buffer = await getTemplateBuffer(origin);
  templateDataUri = `data:image/png;base64,${arrayBufferToBase64(buffer)}`;
  return templateDataUri;
}

function ensureWebpEncoder() {
  if (webpEncoderPromise) return webpEncoderPromise;
  webpEncoderPromise = initEmscriptenModule(webpEncodeFactory, webpEncodeWasm);
  return webpEncoderPromise;
}

async function encodeWebp(renderedImage) {
  const encoder = await ensureWebpEncoder();
  const result = encoder.encode(
    renderedImage.pixels,
    renderedImage.width,
    renderedImage.height,
    {
      ...webpDefaultOptions,
      quality: 86,
      method: 5,
      alpha_quality: 100,
      use_sharp_yuv: 1,
    },
  );
  if (!result?.buffer) throw new Error("WebP encoding failed");
  return new Uint8Array(result.buffer);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function cleanTitle(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function humanizeSlug(slug) {
  return cleanTitle(String(slug || "").replace(/[-_]+/g, " "));
}

function escSvg(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textUnits(value) {
  return [...String(value || "")].reduce((sum, char) => {
    if (/\s/.test(char)) return sum + 0.35;
    if (/[A-Za-z0-9]/.test(char)) return sum + 0.58;
    if (/[\uac00-\ud7a3]/.test(char)) return sum + 0.95;
    return sum + 0.8;
  }, 0);
}

function splitTitle(title) {
  const clean = cleanTitle(title);
  if (!clean) return ["법무법인 선린"];
  if (textUnits(clean) <= 22.5) return [clean];

  const chars = [...clean];
  const total = textUnits(clean);
  let best = Math.ceil(chars.length / 2);
  let bestScore = Infinity;

  for (let i = 4; i < chars.length - 3; i += 1) {
    const left = chars.slice(0, i).join("");
    const right = chars.slice(i).join("");
    const boundary = chars[i - 1] || "";
    const next = chars[i] || "";
    const boundaryPenalty = /[\s·,./-]/.test(boundary) || /[\s·,./-]/.test(next) ? 0 : 0.65;
    const score = Math.abs(textUnits(left) - total / 2) + Math.abs(textUnits(right) - total / 2) + boundaryPenalty;
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  }

  return [chars.slice(0, best).join(""), chars.slice(best).join("")];
}

function buildSvg(title, templateHref) {
  const lines = splitTitle(title);
  const maxUnits = Math.max(...lines.map(textUnits), 1);
  const fontSize = lines.length > 1
    ? Math.min(86, Math.max(58, Math.floor(920 / maxUnits)))
    : Math.min(120, Math.max(66, Math.floor(1080 / maxUnits)));
  const lineHeight = Math.round(fontSize * 1.08);
  const firstY = PLAQUE_TEXT_CENTER_Y - ((lines.length - 1) * lineHeight) / 2;
  const strokeWidth = Math.max(5, Math.round(fontSize * 0.075));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" viewBox="0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}">
<defs>
  <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ffd86f"/>
    <stop offset="52%" stop-color="#f0b430"/>
    <stop offset="100%" stop-color="#c97912"/>
  </linearGradient>
  <filter id="textShadow" x="-12%" y="-22%" width="124%" height="144%">
    <feDropShadow dx="0" dy="4" stdDeviation="1.8" flood-color="#000000" flood-opacity="0.86"/>
  </filter>
</defs>
<image href="${templateHref}" x="0" y="0" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>
${lines.map((line, index) => `<text x="627" y="${Math.round(firstY + index * lineHeight)}" font-family="Pretendard,sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="0" fill="url(#goldText)" stroke="#120800" stroke-width="${strokeWidth}" paint-order="stroke fill" text-anchor="middle" dominant-baseline="middle" text-rendering="geometricPrecision" filter="url(#textShadow)">${escSvg(line)}</text>`).join("\n")}
</svg>`;
}

const BASE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=2592000, s-maxage=2592000, immutable",
  "CDN-Cache-Control": "public, max-age=2592000",
  "Access-Control-Allow-Origin": "*",
};

function imageHeaders(format = "webp") {
  return {
    ...BASE_CACHE_HEADERS,
    "Content-Type": format === "png" ? "image/png" : "image/webp",
  };
}

async function templateImageResponse(url, method, format = "webp", reason = "TEMPLATE") {
  const buffer = format === "png"
    ? await getTemplateBuffer(url.origin)
    : await getTemplateWebpBuffer(url.origin);
  return new Response(method === "HEAD" ? null : buffer, {
    status: 200,
    headers: {
      ...imageHeaders(format),
      "Content-Length": String(buffer.byteLength),
      "X-OG-Fallback": reason,
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");
  const isDebug = url.searchParams.get("debug") === "1";

  const isPng = /\.png$/i.test(rawName);
  const isWebp = /\.webp$/i.test(rawName);
  if (!isPng && !isWebp) {
    const base = rawName.replace(/\.[^.]*$/, "");
    return Response.redirect(
      `${url.origin}/og/${encodeURIComponent(base)}.webp?v=${OG_IMAGE_VERSION}`,
      302,
    );
  }

  const format = isPng ? "png" : "webp";

  const rawSlug = rawName.replace(/\.(png|webp)$/i, "").slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;

  if (!slug || slug === "landing") {
    return templateImageResponse(url, method, format, "LANDING");
  }

  const cacheKey = `og:img:v${OG_IMAGE_VERSION}:${format}:${rawSlug}`;
  try {
    const cached = await env.CASES?.get?.(cacheKey, { type: "arrayBuffer" });
    if (cached && cached.byteLength > 1000) {
      return new Response(method === "HEAD" ? null : cached, {
        status: 200,
        headers: { ...imageHeaders(format), "Content-Length": String(cached.byteLength), "X-Cache": "HIT" },
      });
    }
  } catch (_) {}

  let title = humanizeSlug(slug);
  try {
    const raw = isPowerlink
      ? await env.CASES?.get?.(`powerlink:${slug}`)
      : await env.CASES?.get?.(`case:${slug}`);
    if (raw) {
      const data = JSON.parse(raw);
      title = cleanTitle(
        data.ogText ||
        data.title ||
        data.h1 ||
        data.caseName ||
        data.name ||
        title,
      );
    }
  } catch (_) {}

  try {
    await ensureInit(env);

    const templateHref = await getTemplateDataUri(url.origin);
    const svg = buildSvg(title, templateHref);
    const resvg = new Resvg(svg, {
      shapeRendering: 2,
      textRendering: 1,
      imageRendering: 0,
      font: {
        fontBuffers: [fontBuffer],
        defaultFontFamily: "Pretendard",
        loadSystemFonts: false,
      },
    });
    const renderedImage = resvg.render();
    const image = format === "png"
      ? renderedImage.asPng()
      : await encodeWebp(renderedImage);

    const cachePut = env.CASES?.put?.(cacheKey, image.buffer, { expirationTtl: IMG_CACHE_TTL });
    if (context.waitUntil && cachePut) {
      context.waitUntil(cachePut.catch(() => {}));
    }

    return new Response(method === "HEAD" ? null : image, {
      status: 200,
      headers: { ...imageHeaders(format), "Content-Length": String(image.byteLength), "X-Cache": "MISS" },
    });
  } catch (error) {
    const message = error?.stack || error?.message || String(error);
    console.error("[og] generation failed:", message);
    if (isDebug) {
      return new Response(`ERROR: ${message}\ntitle=${title}\nslug=${slug}`, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return templateImageResponse(url, method, format, "ERROR_TEMPLATE");
  }
}
