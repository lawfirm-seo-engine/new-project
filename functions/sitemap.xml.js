const GROUP_MAP = {
  "new-project-9o2.pages.dev": { prefix: "prosecute", suffix: "litigation", siteUrl: "https://new-project-9o2.pages.dev" },
  "new-project-b.pages.dev": { prefix: "civil", suffix: "settlement", siteUrl: "https://new-project-b.pages.dev" },
  "new-project-c.pages.dev": { prefix: "success", suffix: "result", siteUrl: "https://new-project-c.pages.dev" },
  "new-project-d.pages.dev": { prefix: "briefing", suffix: "review", siteUrl: "https://new-project-d.pages.dev" },
  "new-project-e.pages.dev": { prefix: "case", suffix: "issue", siteUrl: "https://new-project-e.pages.dev" },
  "law-a.pages.dev": { prefix: "prosecute", suffix: "legal-action", siteUrl: "https://law-a.pages.dev" },
  "law-b.pages.dev": { prefix: "civil", suffix: "recovery", siteUrl: "https://law-b.pages.dev" },
  "law-c.pages.dev": { prefix: "success", suffix: "solution", siteUrl: "https://law-c.pages.dev" },
  "law-d.pages.dev": { prefix: "briefing", suffix: "report", siteUrl: "https://law-d.pages.dev" },
  "law-e.pages.dev": { prefix: "case", suffix: "incident", siteUrl: "https://law-e.pages.dev" },
};

const NO_SUFFIX_SLUGS = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
const OLD_URL_SUFFIX = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };

export async function onRequest(context) {
  const { request, env } = context;
  const host = new URL(request.url).host;
  const group = GROUP_MAP[host];

  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const cases = await loadCases(env);

  const entries = [
    `  <url><loc>${group.siteUrl}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.3</priority></url>`,
    ...cases.map((item) => {
      const lastmod = item.updatedAt || item.createdAt || today;
      return `  <url><loc>${buildLandingUrl(group, item.slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function buildLandingUrl(group, slug = "") {
  const isOldA = group.siteUrl === "https://new-project-9o2.pages.dev";
  const noSuffix = isOldA && NO_SUFFIX_SLUGS.includes(slug);
  const oldSuffix = isOldA && OLD_URL_SUFFIX[slug];
  const suffix = noSuffix ? "" : oldSuffix ? `-${oldSuffix}` : group.suffix ? `-${group.suffix}` : "";
  return `${group.siteUrl}/${group.prefix}/${encodeURIComponent(slug)}${suffix}/`;
}

async function loadCases(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const owner = env.GITHUB_REPO_OWNER || "lawfirm-seo-engine";
  const repo = env.GITHUB_REPO_NAME || "new-project";
  const token = env.GITHUB_TOKEN;

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
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-sitemap" } }
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
      { headers: { "User-Agent": "static-landing-generator-sitemap" } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}
