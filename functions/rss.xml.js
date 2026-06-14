import {
  RECENT_SITEMAP_DAYS,
  RSS_LIMIT,
  buildRssXml,
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
  const rssCases = getRecentCases(cases, RECENT_SITEMAP_DAYS, RSS_LIMIT);

  return new Response(buildRssXml(group, rssCases, { limit: RSS_LIMIT }), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
