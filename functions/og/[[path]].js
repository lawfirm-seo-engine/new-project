// OG image edge function
// GET|HEAD /og/[slug].png → serves og-template.png with immutable edge cache
// - Same 1200x630 template for all slugs (no text overlay)
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

  return new Response(method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000",
      "Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
