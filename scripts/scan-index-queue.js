/**
 * gnlaw-criminal.co.kr / gnlaw-recovery.co.kr 랜딩페이지 중 아직 색인 큐에
 * 없는 것을 찾아 라이브 점검(HTTP 200 · canonical · robots index · sitemap
 * 포함) 후 통과한 것만 /api/index-queue 에 등록한다. 등록 시 네이버는 그
 * 자리에서 IndexNow로 즉시 제출되고, 구글은 로컬 PC의 Playwright 도구
 * (tools/gnlaw-google-indexer)가 대기열에서 가져가 서치콘솔로 처리한다.
 *
 * 주기 실행: .github/workflows/index-queue-scan.yml (GitHub Actions cron)
 * 수동 실행: INDEX_QUEUE_TOKEN=... node scripts/scan-index-queue.js
 */

import fs from "fs-extra";
import path from "path";
import { GROUPS, buildLandingUrl, isCaseAllowedForGroup } from "../functions/_seo.js";

const root = process.cwd();
const TARGET_SITE_URLS = new Set(["https://gnlaw-criminal.co.kr", "https://gnlaw-recovery.co.kr"]);
const API_ORIGIN = (process.env.INDEX_QUEUE_API_ORIGIN || "https://gnlaw-criminal.co.kr").replace(/\/$/, "");
const TOKEN = process.env.INDEX_QUEUE_TOKEN || "";
const CONCURRENCY = 4;

if (!TOKEN) {
  console.error("[index-queue-scan] INDEX_QUEUE_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

const targetGroups = GROUPS.filter((group) => TARGET_SITE_URLS.has(group.siteUrl));
if (!targetGroups.length) {
  console.error("[index-queue-scan] 대상 그룹(gnlaw-criminal.co.kr, gnlaw-recovery.co.kr)을 찾지 못했습니다.");
  process.exit(1);
}

const cases = await fs.readJson(path.join(root, "data", "cases.json"));

const candidates = targetGroups.flatMap((group) =>
  cases
    .filter((item) => item?.slug && isCaseAllowedForGroup(item, group))
    .map((item) => buildLandingUrl(group, item.slug)),
);
const allUniqueCandidates = [...new Set(candidates)];
// 최초 도입 시 전량을 한 번에 몰아넣지 않도록, 또는 점검용으로 범위를 제한할 때 사용.
// 기본은 무제한(전체 후보 처리) — 이미 큐에 있는 URL은 enqueue가 no-op이라 매 실행마다
// 앞쪽 N개만 반복 점검하게 되지 않도록, 뒤에서부터(N개면 가장 최근 사건부터) 자른다.
const scanLimit = Number(process.env.INDEX_QUEUE_SCAN_LIMIT || 0);
const uniqueCandidates = scanLimit > 0 ? allUniqueCandidates.slice(-scanLimit) : allUniqueCandidates;

console.log(`[index-queue-scan] 후보 URL ${uniqueCandidates.length}개/${allUniqueCandidates.length}개 (${targetGroups.map((g) => g.siteUrl).join(", ")})`);

const results = { registered: 0, alreadyQueued: 0, failedChecks: 0, errors: 0 };
await runWithConcurrency(uniqueCandidates, CONCURRENCY, async (url) => {
  try {
    await processCandidate(url, results);
  } catch (error) {
    results.errors += 1;
    console.error(`[ERR] ${url} :: ${error?.message || error}`);
  }
});

console.log(
  `[index-queue-scan] 완료 — 신규 등록 ${results.registered} · 이미 등록됨 ${results.alreadyQueued} · 점검 미통과 ${results.failedChecks} · 오류 ${results.errors}`,
);

async function processCandidate(url, results) {
  const checks = await runChecks(url);
  if (!checks.pass) {
    results.failedChecks += 1;
    console.log(`[SKIP] ${url} :: ${checks.reason}`);
    return;
  }

  const res = await fetch(`${API_ORIGIN}/api/index-queue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "enqueue", url, checks: checks.detail }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    results.errors += 1;
    console.error(`[ERR] ${url} :: 큐 등록 실패 HTTP ${res.status} ${data.message || ""}`);
    return;
  }
  if (data.created) {
    results.registered += 1;
    console.log(`[OK] ${url} :: 큐 등록 (네이버 ${data.item.naverStatus})`);
  } else {
    results.alreadyQueued += 1;
  }
}

async function runChecks(url) {
  const pageRes = await fetch(url, { redirect: "manual" }).catch((error) => ({ error }));
  if (pageRes?.error) return { pass: false, reason: `요청 실패: ${pageRes.error.message}` };
  if (pageRes.status !== 200) return { pass: false, reason: `HTTP ${pageRes.status}` };

  const html = await pageRes.text();

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonicalHref = canonicalMatch?.[1] || "";
  if (!canonicalHref || normalizeUrl(canonicalHref) !== normalizeUrl(url)) {
    return { pass: false, reason: `canonical 불일치: ${canonicalHref || "(없음)"}` };
  }

  const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robotsContent = (robotsMatch?.[1] || "").toLowerCase();
  if (robotsContent.includes("noindex")) {
    return { pass: false, reason: `robots noindex: ${robotsContent}` };
  }

  const siteUrl = new URL(url).origin;
  const inSitemap = await urlInSitemap(siteUrl, url);
  if (!inSitemap) return { pass: false, reason: "sitemap에 없음" };

  return { pass: true, detail: { http200: true, canonical: true, robotsIndex: true, sitemap: true, checkedAt: new Date().toISOString() } };
}

async function urlInSitemap(siteUrl, url) {
  for (const sitemapPath of ["/sitemap-recent.xml", "/sitemap.xml"]) {
    try {
      const res = await fetch(`${siteUrl}${sitemapPath}`);
      if (!res.ok) continue;
      const xml = await res.text();
      if (xml.includes(url)) return true;
    } catch {
      // 다음 sitemap으로 계속 시도
    }
  }
  return false;
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) return;
      await worker(next);
    }
  });
  await Promise.all(runners);
}
