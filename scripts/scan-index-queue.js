/**
 * gnlaw-criminal.co.kr / gnlaw-recovery.co.kr 랜딩페이지 후보 URL을 찾아
 * /api/index-queue 에 등록을 요청한다. 실제 라이브 점검(HTTP 200 · canonical ·
 * robots index · sitemap 포함)과 "이미 큐에 있는지" 판단은 전부 서버(Cloudflare
 * Function) 쪽에서 하므로, 이 스크립트는 후보 목록을 만들어 그대로 던지기만
 * 한다 — 이미 등록된 URL을 매번 다시 라이브로 점검하지 않는다.
 *
 * (예전 버전은 이 스크립트가 직접 수천 건을 매번 라이브로 재점검했는데, 그
 * 대량·고속 순차 요청 패턴이 봇 트래픽으로 오인되어 사이트에서 403으로 막히는
 * 문제가 있었다. 신규 URL에 대한 점검은 이제 Cloudflare 자체 네트워크에서
 * 한 번만 실행된다.)
 *
 * 등록 시 네이버는 서버에서 IndexNow로 즉시 제출되고, 구글은 로컬 PC의
 * Playwright 도구(tools/gnlaw-google-indexer)가 대기열에서 가져가 서치콘솔로
 * 처리한다.
 *
 * 정기 실행은 Cloudflare Cron Trigger(workers/index-queue-cron, 15분 간격)가
 * /api/index-queue 의 action:"scan"을 직접 호출하는 방식으로 대체되었다 —
 * 이 스크립트는 전체 후보를 한 번에 강제로 재스캔하고 싶을 때 쓰는 수동
 * 백업 도구다.
 * 수동 실행: INDEX_QUEUE_TOKEN=... node scripts/scan-index-queue.js
 * 또는 GitHub Actions "Scan search index queue (manual backup)" 워크플로를
 * Run workflow로 직접 실행.
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
// 점검용으로 범위를 제한하고 싶을 때 사용(기본은 무제한 — 전체 후보를 서버에 던지되,
// 서버가 이미 등록된 건 즉시 no-op으로 처리하므로 매 실행 비용은 신규 건수에만 비례한다).
const scanLimit = Number(process.env.INDEX_QUEUE_SCAN_LIMIT || 0);
const uniqueCandidates = scanLimit > 0 ? allUniqueCandidates.slice(-scanLimit) : allUniqueCandidates;

console.log(`[index-queue-scan] 후보 URL ${uniqueCandidates.length}개/${allUniqueCandidates.length}개 (${targetGroups.map((g) => g.siteUrl).join(", ")})`);

const results = { registered: 0, alreadyQueued: 0, rejected: 0, errors: 0 };
await runWithConcurrency(uniqueCandidates, CONCURRENCY, async (url) => {
  try {
    await processCandidate(url, results);
  } catch (error) {
    results.errors += 1;
    console.error(`[ERR] ${url} :: ${error?.message || error}`);
  }
});

console.log(
  `[index-queue-scan] 완료 — 신규 등록 ${results.registered} · 이미 등록됨 ${results.alreadyQueued} · 점검 미통과 ${results.rejected} · 오류 ${results.errors}`,
);

async function processCandidate(url, results) {
  const res = await fetch(`${API_ORIGIN}/api/index-queue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "enqueue", url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    results.errors += 1;
    console.error(`[ERR] ${url} :: 큐 등록 실패 HTTP ${res.status} ${data.message || ""}`);
    return;
  }
  if (data.rejected) {
    results.rejected += 1;
    console.log(`[SKIP] ${url} :: ${data.reason}`);
    return;
  }
  if (data.created) {
    results.registered += 1;
    console.log(`[OK] ${url} :: 큐 등록 (네이버 ${data.item.naverStatus})`);
  } else {
    results.alreadyQueued += 1;
  }
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
