import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const cases = await fs.readJson(path.join(root, "data", "cases.json"));
const latest = cases.at(-1);

const groups = [
  { siteUrl: "https://new-project-9o2.pages.dev", pathPrefix: "prosecute" },
  { siteUrl: "https://new-project-b.pages.dev", pathPrefix: "civil" },
  { siteUrl: "https://new-project-c.pages.dev", pathPrefix: "success" },
  { siteUrl: "https://new-project-d.pages.dev", pathPrefix: "briefing" },
  { siteUrl: "https://new-project-e.pages.dev", pathPrefix: "case" },
];

if (!latest?.slug) {
  console.log("[warmup] no case found");
  process.exit(0);
}

const targets = groups.flatMap((group) => [
  `${group.siteUrl}/`,
  `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(latest.slug)}/`,
  `${group.siteUrl}/og/${encodeURIComponent(latest.slug)}.webp`,
  `${group.siteUrl}/assets/og-template.png`,
  `${group.siteUrl}/sitemap-index.xml`,
  `${group.siteUrl}/sitemap.xml`,
]);

const uniqueTargets = [...new Set(targets)];
const results = await Promise.allSettled(uniqueTargets.map((url) => warm(url)));

for (const result of results) {
  if (result.status === "fulfilled") {
    console.log(`[warmup] ${result.value.status} ${result.value.url}`);
  } else {
    console.log(`[warmup] skipped ${result.reason.message}`);
  }
}

async function warm(url) {
  let lastStatus = "request failed";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "static-landing-generator-warmup/1.0",
        },
      });

      lastStatus = response.status;

      if (response.ok) {
        return { url, status: response.status };
      }
    } catch (error) {
      lastStatus = error.message;
    }
  }

  throw new Error(`${lastStatus} ${url}`);
}
