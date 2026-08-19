import { buildSitemapXml, escapeXml, groupForHost, loadCases, loadPowerlinks, powerlinkOgImageUrl } from "./_seo.js";
import { criminalBoardLastModified, criminalBoardPostUrl, listCriminalBoardPosts } from "./_criminalBoard.js";

const POWERLINK_HOST = "gnlaw-criminal.co.kr";

export async function onRequest(context) {
  const { request, env } = context;
  const host = new URL(request.url).host;
  const group = groupForHost(host);

  if (!group) return new Response("Not found", { status: 404 });

  const cases = await loadCases(env);
  let xml = buildSitemapXml(group, cases);

  if (host === POWERLINK_HOST) {
    const powerlinks = await loadPowerlinks(env);
    const boardPosts = (await listCriminalBoardPosts(env)).filter((item) => item?.slug && item.status === "published");
    const extra = [
      powerlinks.length ? buildPowerlinkEntries(powerlinks) : "",
      buildBoardEntries(boardPosts),
    ].filter(Boolean).join("\n");
    if (extra) xml = xml.replace("</urlset>", `${extra}\n</urlset>`);
  }

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" } });
}

function buildBoardEntries(posts) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = [
    `  <url><loc>${escapeXml(`https://${POWERLINK_HOST}/board/`)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`,
  ];
  rows.push(...posts.map((item) => `  <url><loc>${escapeXml(criminalBoardPostUrl(item.slug))}</loc><lastmod>${escapeXml(criminalBoardLastModified(item))}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`));
  return rows.join("\n");
}

function buildPowerlinkEntries(powerlinks) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return powerlinks.filter((item) => item?.slug).map((item) => {
    const loc = escapeXml(`https://${POWERLINK_HOST}/powerlink/${encodeURIComponent(item.slug)}/`);
    const lastmod = escapeXml(item.updatedAt || item.createdAt || today);
    const imgLoc = escapeXml(powerlinkOgImageUrl(item.slug, "png"));
    const imgTitle = escapeXml(item.title || item.slug);
    return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority><image:image><image:loc>${imgLoc}</image:loc><image:title>${imgTitle}</image:title></image:image></url>`;
  }).join("\n");
}
