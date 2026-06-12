export const INDEXNOW_KEY = "6f71f78a3dc940b9a3e1025bf8460d3c";

export const RECENT_SITEMAP_DAYS = 3;
export const RECENT_SITEMAP_LIMIT = 200;
export const RSS_LIMIT = 80;

export const GROUPS = [
  { host: "gnlaw-criminal.co.kr", key: "a", landingKey: "a", prefix: "prosecute", suffix: "litigation", label: "형사고소", siteUrl: "https://gnlaw-criminal.co.kr" },
  { host: "gnlaw-civil.co.kr", key: "b", landingKey: "b", prefix: "civil", suffix: "settlement", label: "민사소송", siteUrl: "https://gnlaw-civil.co.kr" },
  { host: "gnlaw-recovery.co.kr", key: "c", landingKey: "c", prefix: "success", suffix: "result", label: "회수사례", siteUrl: "https://gnlaw-recovery.co.kr" },
  { host: "gnlaw-case.co.kr", key: "d", landingKey: "d", prefix: "briefing", suffix: "review", label: "사건정보", siteUrl: "https://gnlaw-case.co.kr" },
  { host: "gnlaw-center.co.kr", key: "e", landingKey: "e", prefix: "case", suffix: "issue", label: "통합허브", siteUrl: "https://gnlaw-center.co.kr" },
  { host: "xn--jj0b0cw1o75qwua31zyfp19e.kr", key: "la", landingKey: "la", prefix: "criminal", suffix: "legal-action", label: "금융피해 형사", siteUrl: "https://xn--jj0b0cw1o75qwua31zyfp19e.kr" },
  { host: "xn--jj0b77gmsoyyfbet54ddvg2ma.kr", key: "lb", landingKey: "lb", prefix: "litigation", suffix: "recovery", label: "피해금 회수", siteUrl: "https://xn--jj0b77gmsoyyfbet54ddvg2ma.kr" },
  { host: "xn--2e0bno217bsqa58yp8nd1g2ma.kr", key: "lc", landingKey: "lc", prefix: "results", suffix: "solution", label: "회수 여부", siteUrl: "https://xn--2e0bno217bsqa58yp8nd1g2ma.kr" },
  { host: "xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr", key: "ld", landingKey: "ld", prefix: "insights", suffix: "report", label: "피해 구조", siteUrl: "https://xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr" },
  { host: "xn--ok0b84g7tosqai7vyka788co0b.kr", key: "le", landingKey: "le", prefix: "incidents", suffix: "incident", label: "투자사기 허브", siteUrl: "https://xn--ok0b84g7tosqai7vyka788co0b.kr" },
];

export const GROUP_BY_HOST = Object.fromEntries(GROUPS.map((group) => [group.host, group]));

const NO_SUFFIX_SLUGS = new Set([
  "soiraeb-sagi-syopingmor",
  "grucompany-sagi-syopingmor",
  "geuruaenkeompeoni-sagi-syopingmor",
]);

const OLD_URL_SUFFIX = {
  "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute",
};

export function groupForHost(host = "") {
  return GROUP_BY_HOST[String(host).toLowerCase()];
}

export function buildLandingUrl(group, slug = "") {
  const siteUrl = group.siteUrl || (group.host ? `https://${group.host}` : "");
  const prefix = group.pathPrefix || group.prefix;
  const suffix = group.urlSlugSuffix || group.suffix || "";
  const isPrimaryCriminal = siteUrl === "https://gnlaw-criminal.co.kr" || group.host === "gnlaw-criminal.co.kr";
  const finalSuffix = isPrimaryCriminal && NO_SUFFIX_SLUGS.has(slug)
    ? ""
    : isPrimaryCriminal && OLD_URL_SUFFIX[slug]
      ? `-${OLD_URL_SUFFIX[slug]}`
      : suffix
        ? `-${suffix}`
        : "";
  return `${siteUrl}/${prefix}/${encodeURIComponent(slug)}${finalSuffix}/`;
}

export function getLanding(item = {}, group = {}) {
  const landingKey = group.landingKey || group.key;
  return item.landings?.[landingKey] || item.landings?.[group.key] || {};
}

export function sortNewest(cases = []) {
  return [...cases].sort((a, b) => {
    const bd = b.updatedAt || b.createdAt || "";
    const ad = a.updatedAt || a.createdAt || "";
    return bd.localeCompare(ad);
  });
}

export function getRecentCases(cases = [], days = RECENT_SITEMAP_DAYS, limit = RECENT_SITEMAP_LIMIT) {
  const sorted = sortNewest(cases).filter((item) => item?.slug);
  const cutoff = dateOffset(-Math.max(0, days - 1));
  const recent = sorted.filter((item) => (item.updatedAt || item.createdAt || "") >= cutoff);
  return (recent.length ? recent : sorted.slice(0, Math.min(limit, sorted.length))).slice(0, limit);
}

export function buildSitemapXml(group, cases = [], options = {}) {
  const includeHome = options.includeHome !== false;
  const today = kstDate();
  const home = includeHome
    ? [`  <url><loc>${escapeXml(group.siteUrl || `https://${group.host}`)}/</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>0.5</priority></url>`]
    : [];
  const urls = cases
    .filter((item) => item?.slug)
    .map((item) => {
      const lastmod = item.updatedAt || item.createdAt || today;
      const priority = options.recent ? "1.0" : "0.9";
      const changefreq = options.recent ? "hourly" : "daily";
      return `  <url><loc>${escapeXml(buildLandingUrl(group, item.slug))}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...home, ...urls].join("\n")}\n</urlset>`;
}

export function buildSitemapIndexXml(group, lastmod = kstDate()) {
  const base = group.siteUrl || `https://${group.host}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${escapeXml(base)}/sitemap-recent.xml</loc><lastmod>${escapeXml(lastmod)}</lastmod></sitemap>\n  <sitemap><loc>${escapeXml(base)}/sitemap.xml</loc><lastmod>${escapeXml(lastmod)}</lastmod></sitemap>\n</sitemapindex>`;
}

export function buildRssXml(group, cases = [], options = {}) {
  const base = group.siteUrl || `https://${group.host}`;
  const items = sortNewest(cases).filter((item) => item?.slug).slice(0, options.limit || RSS_LIMIT);
  const now = new Date();
  const channelTitle = `${group.label || "신규 사건"} 최신 랜딩`;
  const channelDescription = `${group.label || "신규 사건"} 신규 랜딩페이지와 최신 업데이트`;
  const itemXml = items.map((item) => buildRssItem(group, item)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${escapeXml(channelTitle)}</title>\n    <link>${escapeXml(base)}/</link>\n    <atom:link href="${escapeXml(base)}/rss.xml" rel="self" type="application/rss+xml" />\n    <description>${escapeXml(channelDescription)}</description>\n    <language>ko-KR</language>\n    <lastBuildDate>${now.toUTCString()}</lastBuildDate>\n${itemXml}\n  </channel>\n</rss>`;
}

function buildRssItem(group, item) {
  const landing = getLanding(item, group);
  const canonical = landing.canonical || buildLandingUrl(group, item.slug);
  const title = landing.title || item.caseName || item.slug;
  const description = landing.description || item.summary || `${item.caseName || item.slug} 관련 신규 랜딩페이지입니다.`;
  const published = item.updatedAt || item.createdAt || kstDate();
  const content = buildRssContent(item, landing, group, canonical);

  return `    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${escapeXml(canonical)}</link>\n      <guid isPermaLink="true">${escapeXml(canonical)}</guid>\n      <description>${escapeXml(description)}</description>\n      <pubDate>${dateToRfc822(published)}</pubDate>\n      <category>${escapeXml(group.label || "landing")}</category>\n      <content:encoded><![CDATA[${safeCdata(content)}]]></content:encoded>\n    </item>`;
}

function buildRssContent(item, landing, group, canonical) {
  const parts = [
    `<h1>${escapeXml(landing.h1 || landing.title || item.caseName || item.slug)}</h1>`,
    `<p>${escapeXml(landing.description || item.summary || "")}</p>`,
    `<p><a href="${escapeXml(canonical)}">${escapeXml(canonical)}</a></p>`,
  ];

  appendParagraphs(parts, "핵심 내용", landing.body);
  appendParagraphs(parts, "확인 정황", landing.scamIntroItems);
  appendList(parts, "수법", landing.scamMethodItems);
  appendList(parts, "피해 사례", landing.victimCases);
  appendFaq(parts, landing.faq);

  return parts.filter(Boolean).join("\n");
}

function appendParagraphs(parts, title, values) {
  const rows = cleanTextList(values).slice(0, 8);
  if (!rows.length) return;
  parts.push(`<h2>${escapeXml(title)}</h2>`);
  rows.forEach((value) => parts.push(`<p>${escapeXml(value)}</p>`));
}

function appendList(parts, title, values) {
  const rows = cleanTextList(values).slice(0, 8);
  if (!rows.length) return;
  parts.push(`<h2>${escapeXml(title)}</h2>`);
  parts.push(`<ul>${rows.map((value) => `<li>${escapeXml(value)}</li>`).join("")}</ul>`);
}

function appendFaq(parts, values) {
  const rows = Array.isArray(values) ? values.filter((item) => item?.question && item?.answer).slice(0, 6) : [];
  if (!rows.length) return;
  parts.push("<h2>FAQ</h2>");
  rows.forEach((item) => {
    parts.push(`<h3>${escapeXml(item.question)}</h3>`);
    parts.push(`<p>${escapeXml(item.answer)}</p>`);
  });
}

function cleanTextList(values) {
  return Array.isArray(values)
    ? [...new Set(values.map((value) => stripHtml(value).trim()).filter(Boolean))]
    : [];
}

export async function loadCases(env, options = {}) {
  const full = Boolean(options.full);
  const maxDetails = options.maxDetails || RSS_LIMIT;

  if (env?.CASES) {
    const idxRaw = await env.CASES.get("cases:index");
    if (idxRaw) {
      const index = JSON.parse(idxRaw);
      if (!full) return index;
      const newest = sortNewest(index).slice(0, maxDetails);
      const details = await Promise.all(newest.map(async (item) => {
        const raw = await env.CASES.get(`case:${item.slug}`);
        return raw ? JSON.parse(raw) : item;
      }));
      return details;
    }
  }

  const branch = env?.GITHUB_BRANCH || "main";
  const owner = env?.GITHUB_REPO_OWNER || "lawfirm-seo-engine";
  const repo = env?.GITHUB_REPO_NAME || "new-project";
  const token = env?.GITHUB_TOKEN;

  const apiCases = await loadCasesFromGitHubApi({ owner, repo, branch, token });
  if (apiCases.length) return apiCases;

  const rawCases = await loadCasesFromRawGitHub({ owner, repo, branch });
  if (rawCases.length) return rawCases;

  return [];
}

async function loadCasesFromGitHubApi({ owner, repo, branch, token }) {
  if (!owner || !repo || !token) return [];
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-seo" } },
    );
    if (!res.ok) return [];
    const file = await res.json();
    return JSON.parse(decodeBase64(file.content));
  } catch {
    return [];
  }
}

async function loadCasesFromRawGitHub({ owner, repo, branch }) {
  if (!owner || !repo) return [];
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data/cases.json`,
      { headers: { "User-Agent": "static-landing-generator-seo" } },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function decodeBase64(value) {
  const clean = String(value || "").replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

export function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function safeCdata(value = "") {
  return String(value).replaceAll("]]>", "]]]]><![CDATA[>");
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function dateToRfc822(date = kstDate()) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date}T00:00:00+09:00`
    : date;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toUTCString() : parsed.toUTCString();
}

function dateOffset(offsetDays) {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function kstDate() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}
