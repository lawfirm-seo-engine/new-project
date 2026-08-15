// POST /api/batch-add-regular-memo
// 모든 일반랜딩(createdBy 없음) 케이스에 운영자 메모를 추가하고 IndexNow를 실행합니다.

import { GROUPS, INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY, buildLandingUrl } from "../_seo.js";

const MAIN_GROUP = GROUPS.find((g) => (g.landingKey || g.key) === "a");

export async function onRequestPost(context) {
  const { env } = context;
  if (!env.CASES) return json({ ok: false, message: "KV 바인딩 없음" }, 500);

  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return json({ ok: false, message: "cases:index 없음" }, 404);

  const idx = JSON.parse(idxRaw);
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);

  let updated = 0;
  let skipped = 0;
  const errors = [];
  const indexNowSlugs = [];

  for (const entry of idx) {
    if (entry.createdBy) { skipped++; continue; } // 일반랜딩만 처리

    try {
      const raw = await env.CASES.get(`case:${entry.slug}`);
      if (!raw) { skipped++; continue; }

      const caseData = JSON.parse(raw);
      if (caseData.createdBy) { skipped++; continue; }

      const caseName = caseData.caseName || entry.caseName || entry.slug;
      const memoText = `${caseName} 사칭 사기 사건 현재 접수중 입니다.`;

      if (!Array.isArray(caseData.memos)) caseData.memos = [];

      // 이미 동일한 메모가 있으면 건너뜀
      const alreadyHas = caseData.memos.some((m) => {
        const t = typeof m === "string" ? m : m?.text;
        return String(t || "").trim() === memoText;
      });
      if (alreadyHas) { skipped++; continue; }

      caseData.memos.push({ id: Date.now() + updated, text: memoText, createdAt: now });
      caseData.updatedAt = today;

      await env.CASES.put(`case:${entry.slug}`, JSON.stringify(caseData));
      indexNowSlugs.push(entry.slug);
      updated++;
    } catch (e) {
      errors.push({ slug: entry.slug, error: e.message });
    }
  }

  // IndexNow 일괄 전송 (그룹별로 묶어서)
  const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
  const indexNowResults = [];
  if (indexNowSlugs.length > 0 && MAIN_GROUP) {
    const host = MAIN_GROUP.host || new URL(MAIN_GROUP.siteUrl).host;
    const urlList = indexNowSlugs.flatMap((slug) => [buildLandingUrl(MAIN_GROUP, slug)]);
    // Naver: 최대 10,000개/회, 일단 분할 없이 전송
    try {
      const r = await fetch("https://searchadvisor.naver.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key: indexNowKey, keyLocation: `${MAIN_GROUP.siteUrl}/${indexNowKey}.txt`, urlList }),
      });
      indexNowResults.push({ engine: "naver", status: r.status, ok: r.ok, count: urlList.length });
    } catch (e) {
      indexNowResults.push({ engine: "naver", ok: false, error: e.message });
    }
    // Google IndexNow
    try {
      const r = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key: indexNowKey, keyLocation: `${MAIN_GROUP.siteUrl}/${indexNowKey}.txt`, urlList }),
      });
      indexNowResults.push({ engine: "google", status: r.status, ok: r.ok, count: urlList.length });
    } catch (e) {
      indexNowResults.push({ engine: "google", ok: false, error: e.message });
    }
  }

  return json({
    ok: true,
    total: idx.length,
    updated,
    skipped,
    errors: errors.length ? errors : undefined,
    indexNow: indexNowResults,
    indexNowCount: indexNowSlugs.length,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
