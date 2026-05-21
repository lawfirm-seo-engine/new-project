const GROUP_MAP = {
  "new-project-9o2.pages.dev": { prefix: "prosecute", siteUrl: "https://new-project-9o2.pages.dev" },
  "new-project-b.pages.dev": { prefix: "civil", siteUrl: "https://new-project-b.pages.dev" },
  "new-project-c.pages.dev": { prefix: "success", siteUrl: "https://new-project-c.pages.dev" },
  "new-project-d.pages.dev": { prefix: "briefing", siteUrl: "https://new-project-d.pages.dev" },
  "new-project-e.pages.dev": { prefix: "case", siteUrl: "https://new-project-e.pages.dev" },
};

export async function onRequest(context) {
  const { request, env } = context;
  const host = new URL(request.url).host;
  const group = GROUP_MAP[host];

  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let cases = [];

  try {
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    if (owner && repo && token) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-sitemap" } }
      );
      if (res.ok) {
        const file = await res.json();
        cases = JSON.parse(decodeBase64(file.content));
      }
    }
  } catch (_) {
    // serve with empty cases on error
  }

  const { siteUrl, prefix } = group;
  const entries = [
    `  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...cases.map((item) => {
      const lastmod = item.updatedAt || item.createdAt || today;
      return `  <url><loc>${siteUrl}/${prefix}/${encodeURIComponent(item.slug)}/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}
