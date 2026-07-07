export const INDEXNOW_KEY = "6f71f78a3dc940b9a3e1025bf8460d3c";

export const RECENT_SITEMAP_DAYS = 14;
export const RECENT_SITEMAP_LIMIT = 300;
export const RSS_LIMIT = 120;
export const SEO_STABILIZED_AT = "2026-06-14";
export const OG_IMAGE_VERSION = "20260707a1";
export const OG_IMAGE_WIDTH = 1254;
export const OG_IMAGE_HEIGHT = 1254;

export function caseOgImageUrl(slug = "landing", siteUrl = "https://gnlaw-criminal.co.kr") {
  return `${trimSiteUrl(siteUrl)}/og/${encodeURIComponent(slug || "landing")}.png?v=${OG_IMAGE_VERSION}`;
}

export function powerlinkOgImageUrl(slug = "landing") {
  return `https://gnlaw-criminal.co.kr/og/powerlink-${encodeURIComponent(slug || "landing")}.png?v=${OG_IMAGE_VERSION}`;
}

export const GROUPS = [
  { host: "gnlaw-criminal.co.kr", key: "a", landingKey: "a", prefix: "prosecute", suffix: "litigation", label: "형사고소", siteUrl: "https://gnlaw-criminal.co.kr" },
  { host: "gnlaw-civil.co.kr", key: "b", landingKey: "b", prefix: "civil", suffix: "settlement", label: "민사소송", siteUrl: "https://gnlaw-civil.co.kr" },
  { host: "gnlaw-recovery.co.kr", key: "c", landingKey: "c", prefix: "success", suffix: "result", label: "성공사례", siteUrl: "https://gnlaw-recovery.co.kr", naverVerification: ["c6bcb9fcd45bfd0c4306d625e2484f60f7f96099", "96d9e412da6e059fd252f0e877270b0f457bd0f7"] },
  { host: "gnlaw-case.co.kr", key: "d", landingKey: "d", prefix: "briefing", suffix: "review", label: "사건브리핑", siteUrl: "https://gnlaw-case.co.kr" },
  { host: "gnlaw-center.co.kr", key: "e", landingKey: "e", prefix: "case", suffix: "issue", label: "사건현황", siteUrl: "https://gnlaw-center.co.kr" },
  { host: "xn--jj0b0cw1o75qwua31zyfp19e.kr", key: "la", landingKey: "la", prefix: "criminal", suffix: "legal-action", label: "법적조치", siteUrl: "https://금융사기대응센터.kr" },
  { host: "xn--jj0b77gmsoyyfbet54ddvg2ma.kr", key: "lb", landingKey: "lb", prefix: "litigation", suffix: "recovery", label: "피해회복", siteUrl: "https://금융피해대응센터.kr" },
  { host: "xn--2e0bno217bsqa58yp8nd1g2ma.kr", key: "lc", landingKey: "lc", prefix: "results", suffix: "solution", label: "해결사례", siteUrl: "https://사기피해구제센터.kr" },
  { host: "xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr", key: "ld", landingKey: "ld", prefix: "insights", suffix: "report", label: "피해정보", siteUrl: "https://리딩방피해회수센터.kr" },
  { host: "xn--ok0b84g7tosqai7vyka788co0b.kr", key: "le", landingKey: "le", prefix: "incidents", suffix: "incident", label: "진행현황", siteUrl: "https://투자사기대응센터.kr" },
];

export const GROUP_BY_HOST = Object.fromEntries(GROUPS.map((group) => [group.host, group]));

const NO_SUFFIX_SLUGS = new Set([
  "soiraeb-sagi-syopingmor",
  "grucompany-sagi-syopingmor",
  "geuruaenkeompeoni-sagi-syopingmor",
]);

const ALL_DOMAINS_NO_SUFFIX = new Set([
  "baidogseu-georaeso-litigation-noindex",
  "bydoxe-litigation-noidex",
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
  const finalSuffix = ALL_DOMAINS_NO_SUFFIX.has(slug)
    ? ""
    : isPrimaryCriminal && NO_SUFFIX_SLUGS.has(slug)
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

export function isCaseAllowedForGroup(item = {}, group = {}) {
  const lk = group.landingKey || group.key;
  // gnlaw-recovery.co.kr(lk="c")는 recovery-manual / jipjeong-manual 전용
  if (lk === "c" &&
      item.createdBy !== "recovery-manual" &&
      item.createdBy !== "jipjeong-manual") {
    return false;
  }
  // 금융사기대응센터.kr(lk="la")는 voicephishing-manual 전용
  if (lk === "la" && item.createdBy !== "voicephishing-manual") {
    return false;
  }
  // 사기피해구제센터.kr(lk="lc")는 tujasagi-manual 전용
  if (lk === "lc" && item.createdBy !== "tujasagi-manual") {
    return false;
  }
  // 투자사기대응센터.kr(lk="le")는 chaemubu-manual 전용
  if (lk === "le" && item.createdBy !== "chaemubu-manual") {
    return false;
  }
  const targets = Array.isArray(item.targetGroups) ? item.targetGroups.filter(Boolean) : [];
  if (!targets.length) return true;
  return targets.includes(lk);
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
  const base = group.siteUrl || `https://${group.host}`;
  const prefix = group.pathPrefix || group.prefix;
  const home = includeHome
    ? [`  <url><loc>${escapeXml(base)}/</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>0.5</priority></url>`]
    : [];
  const category = prefix
    ? [`  <url><loc>${escapeXml(base)}/${escapeXml(prefix)}/</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>${options.recent ? "1.0" : "0.8"}</priority></url>`]
    : [];
  const urls = cases
    .filter((item) => item?.slug && isCaseAllowedForGroup(item, group))
    .map((item) => {
      const sourceLastmod = item.updatedAt || item.createdAt || today;
      const lastmod = options.recent ? maxDate(sourceLastmod, SEO_STABILIZED_AT) : sourceLastmod;
      const priority = options.recent ? "1.0" : "0.9";
      const changefreq = options.recent ? "hourly" : "daily";
      const loc = escapeXml(buildLandingUrl(group, item.slug));
      const imgLoc = escapeXml(caseOgImageUrl(item.slug, base));
      const imgTitle = escapeXml(item.caseName || item.slug);
      return `  <url><loc>${loc}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority><image:image><image:loc>${imgLoc}</image:loc><image:title>${imgTitle}</image:title></image:image></url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[...home, ...category, ...urls].join("\n")}\n</urlset>`;
}

export function buildSitemapIndexXml(group, lastmod = kstDate()) {
  const base = group.siteUrl || `https://${group.host}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${escapeXml(base)}/sitemap-recent.xml</loc><lastmod>${escapeXml(lastmod)}</lastmod></sitemap>\n  <sitemap><loc>${escapeXml(base)}/sitemap.xml</loc><lastmod>${escapeXml(lastmod)}</lastmod></sitemap>\n</sitemapindex>`;
}

export function buildRssXml(group, cases = [], options = {}) {
  const base = group.siteUrl || `https://${group.host}`;
  const items = sortNewest(cases).filter((item) => item?.slug && isCaseAllowedForGroup(item, group)).slice(0, options.limit || RSS_LIMIT);
  const now = new Date();
  const channelTitle = `${group.label || "신규 사건"} 최신 목록`;
  const channelDescription = `${group.label || "신규 사건"} 신규 페이지와 최신 업데이트`;
  const itemXml = items.map((item) => buildRssItem(group, item)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${escapeXml(channelTitle)}</title>\n    <link>${escapeXml(base)}/</link>\n    <atom:link href="${escapeXml(base)}/rss.xml" rel="self" type="application/rss+xml" />\n    <description>${escapeXml(channelDescription)}</description>\n    <language>ko-KR</language>\n    <lastBuildDate>${now.toUTCString()}</lastBuildDate>\n${itemXml}\n  </channel>\n</rss>`;
}

const RSS_TITLE_SUFFIXES = {
  a: "형사고소",
  b: "민사소송",
  c: "성공사례",
  d: "사건브리핑",
  e: "사건현황",
  la: "법적조치",
  lb: "피해회복",
  lc: "해결사례",
  ld: "피해정보",
  le: "진행현황",
};

function rssFallbackTitle(item = {}, group = {}) {
  const primary = primaryCaseKeyword(item.caseName || item.name || item.slug);
  const suffix = RSS_TITLE_SUFFIXES[group.landingKey || group.key] || group.label || "";
  return `${primary} ${suffix}`.replace(/\s+/g, " ").trim();
}

function primaryCaseKeyword(name = "") {
  const clean = baseCaseName(name);
  const match = clean.match(/^(.+?사기)(?:\s+.+)?$/i);
  if (match) return match[1].trim();
  const suffix = /사칭/.test(String(name || "")) ? "사칭 사기" : "사기";
  return clean ? `${clean} ${suffix}` : "";
}

function baseCaseName(name = "") {
  return String(name || "")
    .trim()
    .replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)$/i, "")
    .trim();
}

function normalizeRssText(value = "", item = {}) {
  const text = String(value || "").trim();
  if (!text) return "";
  const primary = primaryCaseKeyword(item.caseName || item.name || item.slug);
  const base = baseCaseName(item.caseName || item.name);
  const variants = [item.caseName, item.name, primary]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (base && base !== primary && !primary.startsWith(`${base} `)) {
    variants.push(base);
  }
  let normalized = text;
  variants.forEach((variant) => {
    normalized = normalized.split(variant).join(primary);
  });
  return normalized
    .replace(/관련 사기 피해 의심 사건으로,\s*입금 경위와 대화 내용, 계좌 정보, 사이트 주소를 정리해 피해 구조와 대응 가능성을 검토해야 합니다\./g, "관련 상담 기록으로, 송금 경위와 대화 자료, 계좌 단서, 접속 주소를 정리해 대응 가능성을 검토해야 합니다.")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRssItem(group, item) {
  const landing = getLanding(item, group);
  const canonical = landing.canonical || buildLandingUrl(group, item.slug);
  const fallbackTitle = rssFallbackTitle(item, group);
  const title = landing.title || fallbackTitle;
  const description = landing.description || normalizeRssText(item.summary, item) || `${primaryCaseKeyword(item.caseName || item.name || item.slug)} 관련 신규 페이지입니다.`;
  const published = item.updatedAt || item.createdAt || kstDate();
  const content = buildRssContent(item, landing, group, canonical, title, description);

  return `    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${escapeXml(canonical)}</link>\n      <guid isPermaLink="true">${escapeXml(canonical)}</guid>\n      <description>${escapeXml(description)}</description>\n      <pubDate>${dateToRfc822(published)}</pubDate>\n      <category>${escapeXml(group.label || "landing")}</category>\n      <content:encoded><![CDATA[${safeCdata(content)}]]></content:encoded>\n    </item>`;
}

function buildRssContent(item, landing, group, canonical, title, description) {
  const parts = [
    `<h1>${escapeXml(landing.h1 || landing.title || title || item.slug)}</h1>`,
    `<p>${escapeXml(landing.description || description || "")}</p>`,
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

export async function loadPowerlinks(env) {
  const branch = env?.GITHUB_BRANCH || "main";
  const owner = env?.GITHUB_REPO_OWNER || "lawfirm-seo-engine";
  const repo = env?.GITHUB_REPO_NAME || "new-project";

  if (env?.CASES) {
    const raw = await env.CASES.get("powerlink:index");
    if (raw) {
      try { return JSON.parse(raw); } catch { /* fall through */ }
    }
  }

  return loadPowerlinksFromRawGitHub({ owner, repo, branch });
}

async function loadPowerlinksFromRawGitHub({ owner, repo, branch }) {
  if (!owner || !repo) return [];
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data/powerlinks.json`,
      { headers: { "User-Agent": "static-landing-generator-seo" } },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function loadCases(env, options = {}) {
  const full = Boolean(options.full);
  const maxDetails = options.maxDetails || RSS_LIMIT;
  const branch = env?.GITHUB_BRANCH || "main";
  const owner = env?.GITHUB_REPO_OWNER || "lawfirm-seo-engine";
  const repo = env?.GITHUB_REPO_NAME || "new-project";
  const token = env?.GITHUB_TOKEN;

  if (env?.CASES) {
    const idxRaw = await env.CASES.get("cases:index");
    if (idxRaw) {
      const index = JSON.parse(idxRaw);
      if (!full) {
        const githubCases = await loadCasesFromGitHub({ owner, repo, branch, token });
        return githubCases.length > index.length ? githubCases : index;
      }
      const newest = sortNewest(index).slice(0, maxDetails);
      const details = await Promise.all(newest.map(async (item) => {
        const raw = await env.CASES.get(`case:${item.slug}`);
        return raw ? JSON.parse(raw) : item;
      }));
      return details;
    }
  }

  return loadCasesFromGitHub({ owner, repo, branch, token });
}

async function loadCasesFromGitHub({ owner, repo, branch, token }) {
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

function maxDate(...values) {
  const dates = values
    .map((value) => String(value || "").trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
  return dates[dates.length - 1] || kstDate();
}

function kstDate() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function trimSiteUrl(siteUrl = "") {
  return String(siteUrl || "https://gnlaw-criminal.co.kr").replace(/\/+$/, "");
}
