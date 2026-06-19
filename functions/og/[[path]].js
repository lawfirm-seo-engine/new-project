import { OG_IMAGE_VERSION, caseOgImageUrl, powerlinkOgImageUrl } from "../_seo.js";

const EDGE_CACHE_SECONDS = 60 * 60 * 24 * 7;

export async function onRequest(context) {
  const { request } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");
  const rawSlug = rawName.replace(/\.(png|webp|jpe?g|svg)$/i, "").slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;

  if (!/\.png$/i.test(rawName)) {
    const destination = isPowerlink
      ? powerlinkOgImageUrl(slug || "landing")
      : caseOgImageUrl(slug || "landing", url.origin);
    return Response.redirect(destination, 302);
  }

  const headers = imageHeaders(rawSlug || "landing");
  if (method === "HEAD") return new Response(null, { status: 200, headers });

  const template = await fetch(`${url.origin}/assets/og-template.png?v=${OG_IMAGE_VERSION}`, {
    cf: {
      cacheEverything: true,
      cacheTtl: EDGE_CACHE_SECONDS,
    },
  });

  if (!template.ok) {
    return new Response("OG template fetch failed", {
      status: template.status || 502,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  return new Response(template.body, { status: 200, headers });
}

function imageHeaders(slug = "landing") {
  return {
    "Content-Type": "image/png",
    "Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}, s-maxage=${EDGE_CACHE_SECONDS}, immutable`,
    "CDN-Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}`,
    "Cloudflare-CDN-Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "ETag": `"og-template-${simpleHash(`${slug}-${OG_IMAGE_VERSION}`)}"`,
  };
}

function simpleHash(value = "") {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
