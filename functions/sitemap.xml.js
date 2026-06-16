import { buildSitemapXml, escapeXml, groupForHost, loadCases, loadPowerlinks } from "./_seo.js";

const POWERLINK_HOST = "gnlaw-criminal.co.kr";

export async function onRequest(context) {
  const { request, env } = context;
  const host = new URL(request.url).host;
  const group = groupForHost(host);

  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  const cases = await loadCases(env);
  let xml = buildSitemapXml(group, cases);

  if (host === POWERLINK_HOST) {
    const powerlinks = await loadPowerlinks(env);
    if (powerlinks.length) {
      xml = xml.replace("</urlset>", `${buildPowerlinkEntries(powerlinks)}\n</urlset>`);
    }
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

function buildPowerlinkEntries(powerlinks) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return powerlinks
    .filter((item) => item?.slug)
    .map((item) => {
      const loc = escapeXml(`https://${POWERLINK_HOST}/powerlink/${encodeURIComponent(item.slug)}/`);
      const lastmod = escapeXml(item.updatedAt || item.createdAt || today);
      return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    })
    .join("\n");
}
