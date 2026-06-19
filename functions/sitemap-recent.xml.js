import {
  RECENT_SITEMAP_DAYS,
  RECENT_SITEMAP_LIMIT,
  buildSitemapXml,
  escapeXml,
  getRecentCases,
  groupForHost,
  loadCases,
  loadPowerlinks,
  powerlinkOgImageUrl,
} from "./_seo.js";

const POWERLINK_HOST = "gnlaw-criminal.co.kr";

export async function onRequest(context) {
  const { request, env } = context;
  const host = new URL(request.url).host;
  const group = groupForHost(host);

  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  const cases = await loadCases(env);
  const recentCases = getRecentCases(cases, RECENT_SITEMAP_DAYS, RECENT_SITEMAP_LIMIT);
  let xml = buildSitemapXml(group, recentCases, { includeHome: false, recent: true });

  if (host === POWERLINK_HOST) {
    const powerlinks = await loadPowerlinks(env);
    const cutoff = dateOffset(-(RECENT_SITEMAP_DAYS - 1));
    const recentPowerlinks = powerlinks.filter(
      (item) => item?.slug && (item.updatedAt || item.createdAt || "") >= cutoff,
    );
    if (recentPowerlinks.length) {
      xml = xml.replace("</urlset>", `${buildPowerlinkEntries(recentPowerlinks)}\n</urlset>`);
    }
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

function dateOffset(offsetDays) {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildPowerlinkEntries(powerlinks) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return powerlinks
    .filter((item) => item?.slug)
    .map((item) => {
      const loc = escapeXml(`https://${POWERLINK_HOST}/powerlink/${encodeURIComponent(item.slug)}/`);
      const lastmod = escapeXml(item.updatedAt || item.createdAt || today);
      const imgLoc = escapeXml(powerlinkOgImageUrl(item.slug));
      const imgTitle = escapeXml(item.title || item.slug);
      return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority><image:image><image:loc>${imgLoc}</image:loc><image:title>${imgTitle}</image:title></image:image></url>`;
    })
    .join("\n");
}
