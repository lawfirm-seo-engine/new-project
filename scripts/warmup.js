import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const cases = await fs.readJson(path.join(root, "data", "cases.json"));
const latest = cases.at(-1);

const groups = [
  { siteUrl: "https://gnlaw-criminal.co.kr", pathPrefix: "prosecute", suffix: "litigation" },
  { siteUrl: "https://gnlaw-civil.co.kr", pathPrefix: "civil", suffix: "settlement" },
  { siteUrl: "https://gnlaw-recovery.co.kr", pathPrefix: "success", suffix: "result" },
  { siteUrl: "https://gnlaw-case.co.kr", pathPrefix: "briefing", suffix: "review" },
  { siteUrl: "https://gnlaw-center.co.kr", pathPrefix: "case", suffix: "issue" },
  { siteUrl: "https://금융사기대응센터.kr", pathPrefix: "criminal", suffix: "legal-action" },
  { siteUrl: "https://금융피해대응센터.kr", pathPrefix: "litigation", suffix: "recovery" },
  { siteUrl: "https://사기피해구제센터.kr", pathPrefix: "results", suffix: "solution" },
  { siteUrl: "https://리딩방피해회수센터.kr", pathPrefix: "insights", suffix: "report" },
  { siteUrl: "https://투자사기대응센터.kr", pathPrefix: "incidents", suffix: "incident" },
];

const noSuffixSlugs = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
const oldUrlSuffix = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };

if (!latest?.slug) {
  console.log("[warmup] no case found");
  process.exit(0);
}

const targets = groups.flatMap((group) => [
  `${group.siteUrl}/`,
  buildLandingUrl(group, latest.slug),
  `${group.siteUrl}/og/${encodeURIComponent(latest.slug)}.png`,
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

const naverPingBase = "https://searchadvisor.naver.com/xml/rss";
const pingUrls = groups.flatMap((group) => [
  `${naverPingBase}?sitemap=${encodeURIComponent(`${group.siteUrl}/sitemap-index.xml`)}`,
  `${naverPingBase}?sitemap=${encodeURIComponent(`${group.siteUrl}/sitemap.xml`)}`,
]);

const pingResults = await Promise.allSettled(pingUrls.map((url) => warm(url)));
for (const result of pingResults) {
  if (result.status === "fulfilled") {
    console.log(`[naver-ping] ${result.value.status} ${result.value.url}`);
  } else {
    console.log(`[naver-ping] failed ${result.reason.message}`);
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

function buildLandingUrl(group, slug) {
  const isOldA = group.siteUrl === "https://gnlaw-criminal.co.kr";
  const suffix = isOldA && noSuffixSlugs.includes(slug)
    ? ""
    : isOldA && oldUrlSuffix[slug]
      ? `-${oldUrlSuffix[slug]}`
      : group.suffix
        ? `-${group.suffix}`
        : "";
  return `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(slug)}${suffix}/`;
}
