// POST /api/batch-add-regular-memo
// KV cases:index를 소스로 모든 일반랜딩에 운영자 메모를 추가합니다.
// Body: { offset?: number, limit?: number }

import { GROUPS, INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY, buildLandingUrl } from "../_seo.js";

const MAIN_GROUP = GROUPS.find((g) => (g.landingKey || g.key) === "a");

// caseName에서 "사칭 사기" 접미사를 제거해 브랜드명만 추출
function extractBrand(caseName) {
  return (caseName || "").replace(/\s+사칭\s+사기\s*$/i, "").trim() || caseName;
}

function correctMemoText(caseName) {
  return extractBrand(caseName) + " 사칭 사기 사건 현재 접수중 입니다.";
}

// 기존에 잘못 들어간 중복 형태 ("사칭 사기 사칭 사기") 메모 텍스트
function wrongMemoText(caseName) {
  return caseName + " 사칭 사기 사건 현재 접수중 입니다.";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.CASES) return json({ ok: false, message: "KV 바인딩 없음" }, 500);

  const body = await request.json().catch(() => ({}));
  const offset = Number(body.offset) || 0;
  const limit = Math.min(Number(body.limit) || 200, 300);

  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return json({ ok: false, message: "cases:index 없음" }, 404);

  const allIndex = JSON.parse(idxRaw);
  const regularIndex = allIndex.filter((c) => !c.createdBy);
  const total = regularIndex.length;
  const slice = regularIndex.slice(offset, offset + limit);

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);

  let updated = 0;
  let fixed = 0;   // 잘못된 메모를 올바른 형식으로 교체한 건수
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
      const correct = correctMemoText(caseName);
      const wrong = wrongMemoText(caseName);

      if (!Array.isArray(caseData.memos)) caseData.memos = [];

      const hasCorrect = caseData.memos.some((m) => {
        const t = typeof m === "string" ? m : m?.text;
        return String(t || "").trim() === correct;
      });
      const hasWrong = caseData.memos.some((m) => {
        const t = typeof m === "string" ? m : m?.text;
        return String(t || "").trim() === wrong && wrong !== correct;
      });

      // 이미 올바른 메모가 있고 잘못된 메모가 없으면 건너뜀
      if (hasCorrect && !hasWrong) { skipped++; continue; }

      // 잘못된 메모(중복 "사칭 사기") 제거
      if (hasWrong && wrong !== correct) {
        caseData.memos = caseData.memos.filter((m) => {
          const t = typeof m === "string" ? m : m?.text;
          return String(t || "").trim() !== wrong;
        });
        fixed++;
      }

      // 올바른 메모가 없으면 추가
      if (!hasCorrect) {
        caseData.memos.push({ id: Date.now() + updated + fixed, text: correct, createdAt: now });
        updated++;
      }

      caseData.updatedAt = today;
      await env.CASES.put(`case:${slug}`, JSON.stringify(caseData));
      indexNowSlugs.push(slug);
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
    fixed,
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
