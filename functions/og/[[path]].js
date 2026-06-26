import { OG_IMAGE_VERSION, caseOgImageUrl, powerlinkOgImageUrl } from "../_seo.js";

const REDIRECT_CACHE_SECONDS = 60 * 60 * 24 * 7;

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

  const destination = `${url.origin}/assets/og-template.png`;
  return new Response(null, {
    status: 301,
    headers: {
      "Location": destination,
      "Cache-Control": `public, max-age=${REDIRECT_CACHE_SECONDS}, s-maxage=${REDIRECT_CACHE_SECONDS}`,
      "CDN-Cache-Control": `public, max-age=${REDIRECT_CACHE_SECONDS}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
