// OG image edge function
// GET /og/[slug].webp → serves og-template.png (PNG bytes) with immutable edge cache
// - Same template for all slugs (no text overlay)
// - Each slug URL is independently cached at Cloudflare CDN
// - Worker executes only once per slug (first hit); subsequent hits served from CDN

export async function onRequestGet(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;

  // Fetch template from static assets binding
  let asset;
  try {
    asset = await env.ASSETS.fetch(new Request(`${origin}/assets/og-template.png`));
  } catch {
    asset = null;
  }

  if (!asset || !asset.ok) {
    return new Response("Not found", { status: 404 });
  }

  const body = await asset.arrayBuffer();

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000",
      "Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
