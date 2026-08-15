// GET /api/debug-memo-status  — 일시적 디버그 엔드포인트 (사용 후 삭제)
export async function onRequestGet(context) {
  const { env } = context;
  if (!env.CASES) return json({ error: "KV 없음" });

  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return json({ error: "cases:index 없음" });

  const allIndex = JSON.parse(idxRaw);
  const regularIndex = allIndex.filter((c) => !c.createdBy);

  // 처음 5개 케이스 상세 조회
  const samples = [];
  for (const entry of regularIndex.slice(0, 5)) {
    const slug = entry.slug;
    const raw = await env.CASES.get(`case:${slug}`);
    if (!raw) {
      samples.push({ slug, indexCreatedBy: entry.createdBy, kvExists: false });
      continue;
    }
    const caseData = JSON.parse(raw);
    const memoText = (caseData.caseName || slug) + " 사칭 사기 사건 현재 접수중 입니다.";
    const hasMemo = (caseData.memos || []).some((m) => {
      const t = typeof m === "string" ? m : m?.text;
      return String(t || "").trim() === memoText;
    });
    samples.push({
      slug,
      indexCreatedBy: entry.createdBy,
      kvCreatedBy: caseData.createdBy,
      kvExists: true,
      memoCount: (caseData.memos || []).length,
      hasMemo,
      caseName: caseData.caseName,
      memos: (caseData.memos || []).map(m => typeof m === "string" ? m : m?.text),
    });
  }

  return json({
    totalIndex: allIndex.length,
    regularCount: regularIndex.length,
    samples,
  });
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
