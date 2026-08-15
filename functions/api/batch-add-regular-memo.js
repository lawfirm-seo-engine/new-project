// POST /api/batch-add-regular-memo
// GitHub data/cases.json을 소스로 모든 일반랜딩 KV에 운영자 메모를 추가합니다.
// Body: { offset?: number, limit?: number }  ← 페이지네이션 지원 (기본 limit=200)

import { GROUPS, INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY, buildLandingUrl } from "../_seo.js";

const MAIN_GROUP = GROUPS.find((g) => (g.landingKey || g.key) === "a");
const MEMO_SUFFIX = " 사칭 사기 사건 현재 접수중 입니다.";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.CASES) return json({ ok: false, message: "KV 바인딩 없음" }, 500);

  const body = await request.json().catch(() => ({}));
  const offset = Number(body.offset) || 0;
  const limit = Math.min(Number(body.limit) || 200, 300);

  // GitHub에서 cases.json 로드 (최신 상태, 이미 메모 포함)
  const regularCases = await loadRegularFromGithub(env);
  if (!regularCases) return json({ ok: false, message: "GitHub 케이스 로드 실패" }, 500);

  const total = regularCases.length;
  const slice = regularCases.slice(offset, offset + limit);
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);

  let updated = 0;
  let skipped = 0;
  const errors = [];
  const indexNowSlugs = [];

  for (const ghCase of slice) {
    const slug = ghCase.slug;
    if (!slug) { skipped++; continue; }

    const caseName = ghCase.caseName || slug;
    const memoText = caseName + MEMO_SUFFIX;

    try {
      const raw = await env.CASES.get(`case:${slug}`);
      if (!raw) { skipped++; continue; }

      const caseData = JSON.parse(raw);
      if (caseData.createdBy) { skipped++; continue; }

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

  // 이 배치의 마지막 페이지이면 IndexNow 전송
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

async function loadRegularFromGithub(env) {
  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "batch-add-memo" } },
    );
    if (!res.ok) return null;
    const file = await res.json();
    if (!file.content) return null;
    const content = new TextDecoder().decode(
      Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)),
    );
    const all = JSON.parse(content);
    return Array.isArray(all) ? all.filter((c) => !c.createdBy) : null;
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
