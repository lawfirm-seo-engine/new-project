import fs from "fs-extra";
import path from "path";
import { GROUPS, INDEXNOW_KEY, buildLandingUrl, caseOgImageUrl, sortNewest } from "../functions/_seo.js";

const root = process.cwd();
const cases = await fs.readJson(path.join(root, "data", "cases.json"));
const latest = sortNewest(cases)[0];

if (!latest?.slug) {
  console.log("[warmup] no case found");
  process.exit(0);
}

const targets = GROUPS.flatMap((group) => [
  `${group.siteUrl}/`,
  categoryUrl(group),
  buildLandingUrl(group, latest.slug),
  caseOgImageUrl(latest.slug, group.siteUrl),
  `${group.siteUrl}/assets/og-template.png`,
  `${group.siteUrl}/assets/og-template.webp`,
  `${group.siteUrl}/sitemap-index.xml`,
  `${group.siteUrl}/sitemap-recent.xml`,
  `${group.siteUrl}/sitemap.xml`,
  `${group.siteUrl}/rss.xml`,
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

const shouldPingIndexNow = process.env.INDEXNOW === "1" || process.argv.includes("--indexnow");

if (shouldPingIndexNow) {
  const indexNowResults = await Promise.allSettled(
    GROUPS.map((group) => pingIndexNow(group, latest.slug)),
  );

  for (const result of indexNowResults) {
    if (result.status === "fulfilled") {
      console.log(`[indexnow] ${result.value.status} ${result.value.host} ${result.value.urls.join(", ")}`);
    } else {
      console.log(`[indexnow] failed ${result.reason.message}`);
    }
  }
} else {
  console.log("[indexnow] skipped; set INDEXNOW=1 or pass --indexnow to submit.");
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

async function pingIndexNow(group, slug) {
  const host = group.host || new URL(group.siteUrl).host;
  const urls = [
    buildLandingUrl(group, slug),
    categoryUrl(group),
    `${group.siteUrl}/`,
  ];
  const response = await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${group.siteUrl}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status} ${host} ${detail.slice(0, 160)}`);
  }

  return { host, status: response.status, urls };
}

function categoryUrl(group) {
  const prefix = group.pathPrefix || group.prefix;
  return `${group.siteUrl}/${prefix}/`;
}
