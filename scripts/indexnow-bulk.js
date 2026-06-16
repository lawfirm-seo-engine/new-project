/**
 * Submits home, category, case landing-page, and powerlink URLs across all 10 domains
 * to Naver IndexNow in a single batch request per domain (up to 10,000 URLs each).
 *
 * Run once after a domain migration or whenever pages need bulk re-submission:
 *   node scripts/indexnow-bulk.js
 */

import fs from "fs-extra";
import path from "path";
import { GROUPS, INDEXNOW_KEY, buildLandingUrl } from "../functions/_seo.js";

const root = process.cwd();
const cases = await fs.readJson(path.join(root, "data", "cases.json"));
const powerlinks = await fs.readJson(path.join(root, "data", "powerlinks.json")).catch(() => []);

const NAVER_INDEXNOW = "https://searchadvisor.naver.com/indexnow";
const POWERLINK_HOST = "gnlaw-criminal.co.kr";
const POWERLINK_SITE = "https://gnlaw-criminal.co.kr";

const results = await Promise.allSettled(
  GROUPS.map(async (group) => {
    const host = group.host || new URL(group.siteUrl).host;
    const category = categoryUrl(group);
    const caseUrls = cases.filter((item) => item?.slug).map((item) => buildLandingUrl(group, item.slug));
    const powerlinkUrls = host === POWERLINK_HOST
      ? powerlinks.filter((item) => item?.slug).map((item) => `${POWERLINK_SITE}/powerlink/${encodeURIComponent(item.slug)}/`)
      : [];

    const urlList = [...new Set([`${group.siteUrl}/`, category, ...caseUrls, ...powerlinkUrls])];

    const res = await fetch(NAVER_INDEXNOW, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${group.siteUrl}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });

    const text = await res.text().catch(() => "");
    return { host, status: res.status, urls: urlList.length, body: text };
  }),
);

for (const result of results) {
  if (result.status === "fulfilled") {
    const { host, status, urls, body } = result.value;
    const ok = status >= 200 && status < 300;
    console.log(`[${ok ? "OK" : "NG"}] ${host}  HTTP ${status}  ${urls} URLs  ${body.slice(0, 80)}`);
  } else {
    console.error(`[ERR] ${result.reason}`);
  }
}

function categoryUrl(group) {
  const prefix = group.pathPrefix || group.prefix;
  return `${group.siteUrl}/${prefix}/`;
}
