// POST /api/batch-add-regular-memo
// KV cases:index를 소스로 모든 일반랜딩에 운영자 메모를 추가합니다.
// Body: { offset?: number, limit?: number }  ← 페이지네이션 (기본 limit=200)

import { GROUPS, INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY, buildLandingUrl } from "../_seo.js";

const MAIN_GROUP = GROUPS.find((g) => (g.landingKey || g.key) === "a");
const MEMO_SUFFIX = " 사칭 사기 사건 현재 접수중 입니다.";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.CASES) return json({ ok: false, message: "KV 바인딩 없음" }, 500);

  const body = await request.json().catch(() => ({}));
  const offset = Number(body.offset) || 0;
  const limit = Math.min(Number(body.limit) || 200, 300);

  // KV cases:index에서 전체 목록 로드
  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return json({ ok: false, message: "cases:index 없음" }, 404);

  const allIndex = JSON.parse(idxRaw);
  const regularIndex = allIndex.filter((c) => !c.createdBy);
  const total = regularIndex.length;
  const slice = regularIndex.slice(offset, offset + limit);

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);

  let updated = 0;
  let skipped = 0;
  const errors = [];
  const indexNowSlugs = [];

  for (const entry of slice) {
    const slug = entry.slug;
    if (!slug) { skipped++; continue; }

    try {
      const raw = await env.CASES.get(`case:${slug}`);
      if (!raw) { skipped++; continue; }

      const caseData = JSON.parse(raw);
      if (caseData.createdBy) { skipped++; continue; }

      const caseName = caseData.caseName || entry.caseName || slug;
      const memoText = caseName + MEMO_SUFFIX;

      if (!Array.isArray(caseData.memos)) caseData.memos = [];

      const alreadyHas = caseData.memos.some((m) => {
        const t = typeof m === "string" ? m : m?.text;
        return String(t || "").trim() === memoText;
      });
      if (alreadyHas) { skipped++; continue; }

      caseData.memos.push({ id: Date.now() + updated, text: memoText, createdAt: now });
      caseData.updatedAt = today;

      await env.CASES.put(`case:${slug}`, JSON.stringify(caseData));
      indexNowSlugs.push(slug);
      updated++;
    } catch (e) {
      errors.push({ slug, error: e.message });
    }
  }

  const nextOffset = offset + limit;
  const isLast = nextOffset >= total;
  const indexNowResults = [];

  if (isLast && indexNowSlugs.length > 0 && MAIN_GROUP) {
    const host = MAIN_GROUP.host || new URL(MAIN_GROUP.siteUrl).host;
    const urlList = indexNowSlugs.map((s) => buildLandingUrl(MAIN_GROUP, s));
    const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
    for (const [engine, url] of [
      ["naver", "https://searchadvisor.naver.com/indexnow"],
      ["google", "https://api.indexnow.org/indexnow"],
    ]) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ host, key: indexNowKey, keyLocation: `${MAIN_GROUP.siteUrl}/${indexNowKey}.txt`, urlList }),
        });
        indexNowResults.push({ engine, status: r.status, ok: r.ok, count: urlList.length });
      } catch (e) {
        indexNowResults.push({ engine, ok: false, error: e.message });
      }
    }
  }

  return json({
    ok: true,
    total,
    offset,
    limit,
    processed: slice.length,
    updated,
    skipped,
    errors: errors.length ? errors : undefined,
    nextOffset: isLast ? null : nextOffset,
    done: isLast,
    indexNow: indexNowResults.length ? indexNowResults : undefined,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
