/**
 * Submits all case landing-page URLs across all 10 domains to Naver IndexNow
 * in a single batch request per domain (up to 10,000 URLs each).
 *
 * Run once after a domain migration or whenever pages need bulk re-submission:
 *   node scripts/indexnow-bulk.js
 */

import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const cases = await fs.readJson(path.join(root, "data", "cases.json"));

const INDEXNOW_KEY = "6f71f78a3dc940b9a3e1025bf8460d3c";
const NAVER_INDEXNOW = "https://searchadvisor.naver.com/indexnow";

const NO_SUFFIX = new Set([
  "soiraeb-sagi-syopingmor",
  "grucompany-sagi-syopingmor",
  "geuruaenkeompeoni-sagi-syopingmor",
]);
const OLD_SUFFIX = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };

const groups = [
  { host: "gnlaw-criminal.co.kr",         prefix: "prosecute", suffix: "litigation" },
  { host: "gnlaw-civil.co.kr",            prefix: "civil",      suffix: "settlement" },
  { host: "gnlaw-recovery.co.kr",         prefix: "success",    suffix: "result" },
  { host: "gnlaw-case.co.kr",             prefix: "briefing",   suffix: "review" },
  { host: "gnlaw-center.co.kr",           prefix: "case",       suffix: "issue" },
  { host: "xn--jj0b0cw1o75qwua31zyfp19e.kr",       prefix: "criminal",  suffix: "legal-action" },
  { host: "xn--jj0b77gmsoyyfbet54ddvg2ma.kr",       prefix: "litigation",suffix: "recovery" },
  { host: "xn--2e0bno217bsqa58yp8nd1g2ma.kr",       prefix: "results",   suffix: "solution" },
  { host: "xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr",   prefix: "insights",  suffix: "report" },
  { host: "xn--ok0b84g7tosqai7vyka788co0b.kr",      prefix: "incidents", suffix: "incident" },
];

function buildUrl(host, prefix, suffix, slug) {
  const isA = host === "gnlaw-criminal.co.kr";
  const urlSuffix = isA && NO_SUFFIX.has(slug)
    ? ""
    : isA && OLD_SUFFIX[slug]
      ? `-${OLD_SUFFIX[slug]}`
      : suffix ? `-${suffix}` : "";
  return `https://${host}/${prefix}/${encodeURIComponent(slug)}${urlSuffix}/`;
}

const results = await Promise.allSettled(
  groups.map(async ({ host, prefix, suffix }) => {
    const urlList = cases.map((c) => buildUrl(host, prefix, suffix, c.slug));

    const res = await fetch(NAVER_INDEXNOW, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });

    const text = await res.text().catch(() => "");
    return { host, status: res.status, urls: urlList.length, body: text };
  })
);

for (const r of results) {
  if (r.status === "fulfilled") {
    const { host, status, urls, body } = r.value;
    const ok = status >= 200 && status < 300;
    console.log(`[${ok ? "OK" : "NG"}] ${host}  HTTP ${status}  ${urls} URLs  ${body.slice(0, 80)}`);
  } else {
    console.error(`[ERR] ${r.reason}`);
  }
}
