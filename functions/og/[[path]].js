import { OG_IMAGE_HEIGHT, OG_IMAGE_VERSION, OG_IMAGE_WIDTH, caseOgImageUrl, powerlinkOgImageUrl } from "../_seo.js";

const EDGE_CACHE_SECONDS = 60 * 60 * 24 * 7;

export async function onRequest(context) {
  const { request } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");
  const rawSlug = rawName.replace(/\.(webp|png|jpe?g|svg)$/i, "").slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;

  if (!/\.webp$/i.test(rawName)) {
    const destination = isPowerlink
      ? powerlinkOgImageUrl(slug || "landing")
      : caseOgImageUrl(slug || "landing", url.origin);
    return Response.redirect(destination, 302);
  }

  const overlaySlug = isPowerlink ? `powerlink-${slug || "landing"}` : (slug || "landing");
  const overlayUrl = `${url.origin}/og-overlay/${encodeURIComponent(overlaySlug)}.svg?v=${OG_IMAGE_VERSION}`;
  const templateUrl = `${url.origin}/assets/og-template.png?og=${encodeURIComponent(overlaySlug)}&v=${OG_IMAGE_VERSION}`;

  const imageResponse = await fetch(templateUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: EDGE_CACHE_SECONDS,
      image: {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fit: "cover",
        format: "webp",
        quality: 82,
        draw: [
          {
            url: overlayUrl,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            fit: "cover",
            opacity: 1,
          },
        ],
      },
    },
  });

  if (!imageResponse.ok) {
    return new Response(method === "HEAD" ? null : "OG image transform failed", {
      status: imageResponse.status || 502,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  const headers = new Headers(imageResponse.headers);
  headers.set("Content-Type", "image/webp");
  headers.set("Cache-Control", `public, max-age=${EDGE_CACHE_SECONDS}, s-maxage=${EDGE_CACHE_SECONDS}, immutable`);
  headers.set("CDN-Cache-Control", `public, max-age=${EDGE_CACHE_SECONDS}`);
  headers.set("Cloudflare-CDN-Cache-Control", `public, max-age=${EDGE_CACHE_SECONDS}`);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(method === "HEAD" ? null : imageResponse.body, {
    status: 200,
    headers,
  });
}
