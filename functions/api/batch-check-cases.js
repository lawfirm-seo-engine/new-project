// POST /api/batch-check-cases
// 여러 사건명을 한 번에 중복 검수합니다 (cases:index를 한 번만 로드).
// Body: { items: [{caseName, fraudType}] }
// Response: { ok, results: [{caseName, slug, fraudType, status, score, matches}] }

import { compareCaseIdentity, hangulToRoman } from "../_searchNormalize.js";
import { mergeIndexRepairCases } from "../_caseIndexRepair.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return json({ ok: false, message: "items 배열이 필요합니다." }, 400);
    if (items.length > 30) return json({ ok: false, message: "최대 30개까지 처리 가능합니다." }, 400);

    const cases = await loadCases(env);
    // 일반랜딩만 비교 대상
    const regularCases = cases.filter((c) => !c.createdBy);

    const results = items.map(({ caseName: rawName, fraudType }) => {
      const caseName = normalizeSpace(rawName);
      if (!caseName) return { caseName: rawName, slug: "", fraudType, status: "empty", score: 0, matches: [] };

      const slug = createSlug(slugBase(caseName));
      const incoming = { caseName, slug };

      const matches = regularCases
        .map((item) => {
          const identity = compareCaseIdentity(incoming, item);
          return {
            slug: item.slug || "",
            caseName: item.caseName || "",
            score: Number(identity.score.toFixed(2)),
            exactSlug: identity.exactSlug,
            exactAlias: identity.exactAlias,
            containsAlias: identity.containsAlias,
            brandOverlap: identity.brandOverlap,
          };
        })
        .filter((m) => m.exactSlug || m.exactAlias || m.containsAlias || m.brandOverlap || m.score >= 0.7)
        .sort((a, b) =>
          Number(b.exactSlug) - Number(a.exactSlug) ||
          Number(b.exactAlias) - Number(a.exactAlias) ||
          b.score - a.score
        )
        .slice(0, 3);

      const blocked = matches.some((m) => m.exactSlug || m.exactAlias);
      const warn = !blocked && matches.some((m) => m.containsAlias || m.brandOverlap || m.score >= 0.7);
      const status = blocked ? "blocked" : warn ? "warning" : "pass";
      const topScore = matches.length ? matches[0].score : 0;

      return { caseName, slug, fraudType: fraudType || "", status, score: topScore, matches };
    });

    return json({ ok: true, results });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

async function loadCases(env) {
  if (env.CASES) {
    const raw = await env.CASES.get("cases:index");
    if (raw) return mergeIndexRepairCases(env, JSON.parse(raw));
  }
  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return [];
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "batch-check" } },
  );
  if (!res.ok) return [];
  const file = await res.json();
  const content = file.content ? new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) => c.charCodeAt(0))) : "";
  return mergeIndexRepairCases(env, content ? JSON.parse(content) : []);
}

function slugBase(name) {
  const s = String(name || "").trim();
  const idx = s.search(/\s*사기/);
  return idx > 0 ? s.slice(0, idx).trim() : s;
}

function createSlug(value) {
  return hangulToRoman(normalizeSpace(value))
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
}

function normalizeSpace(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
