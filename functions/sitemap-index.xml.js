import { buildSitemapIndexXml, groupForHost } from "./_seo.js";

export async function onRequest(context) {
  const { request } = context;
  const group = groupForHost(new URL(request.url).host);

  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(buildSitemapIndexXml(group), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
