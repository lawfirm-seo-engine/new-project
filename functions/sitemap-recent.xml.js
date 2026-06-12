import {
  RECENT_SITEMAP_DAYS,
  RECENT_SITEMAP_LIMIT,
  buildSitemapXml,
  getRecentCases,
  groupForHost,
  loadCases,
} from "./_seo.js";

export async function onRequest(context) {
  const { request, env } = context;
  const group = groupForHost(new URL(request.url).host);

  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  const cases = await loadCases(env);
  const recentCases = getRecentCases(cases, RECENT_SITEMAP_DAYS, RECENT_SITEMAP_LIMIT);

  return new Response(buildSitemapXml(group, recentCases, { includeHome: false, recent: true }), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
