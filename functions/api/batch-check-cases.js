// POST /api/batch-check-cases
// 여러 사건명을 한 번에 중복 검수합니다 (cases:index를 한 번만 로드).
// Body: { items: [{caseName, fraudType}] }
// Response: { ok, results: [{caseName, slug, fraudType, status, score, matches}] }

import { buildCaseIdentityBundle, compareIdentityBundles, hangulToRoman } from "../_searchNormalize.js";
import { mergeIndexRepairCases } from "../_caseIndexRepair.js";
import { filterDeletedCases } from "../_caseDeletion.js";

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

    const existingBundles = regularCases.map((item) => ({
      item,
      bundle: buildCaseIdentityBundle(item),
    }));
    const tokenCache = new Map();
    const timeBudgetMs = 20000;
    const startedAt = Date.now();
    let truncated = false;
    const results = [];

    console.log("[batch-check-cases] started", { items: items.length, cases: cases.length, regularCases: regularCases.length });

    for (const { caseName: rawName, fraudType } of items) {
      if (Date.now() - startedAt > timeBudgetMs) {
        truncated = true;
        break;
      }

      const caseName = normalizeSpace(rawName);
      if (!caseName) {
        results.push({ caseName: rawName, slug: "", fraudType, status: "empty", score: 0, matches: [] });
        continue;
      }

      const slug = createSlug(slugBase(caseName));
      const incomingBundle = buildCaseIdentityBundle({ caseName, slug });

      const matches = existingBundles
        .map(({ item, bundle }) => {
          const identity = compareIdentityBundles(incomingBundle, bundle, tokenCache);
          return {
            slug: item.slug || "",
            caseName: item.caseName || "",
            url: criminalLandingUrl(item),
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

      results.push({ caseName, slug, fraudType: fraudType || "", status, score: topScore, matches });
    }

    const elapsedMs = Date.now() - startedAt;
    console.log("[batch-check-cases] completed", { requested: items.length, processed: results.length, truncated, elapsedMs });
    return json({
      ok: true,
      results,
      ...(truncated ? {
        truncated: true,
        message: `${results.length}/${items.length}건까지 처리 후 시간 예산을 초과했습니다. 남은 항목은 다시 검수해주세요.`,
      } : {}),
    });
  } catch (e) {
    console.error("[batch-check-cases] failed", { message: e?.message || String(e), stack: e?.stack || "" });
    return json({ ok: false, message: e.message }, 500);
  }
}

async function loadCases(env) {
  if (env.CASES) {
    const raw = await env.CASES.get("cases:index");
    if (raw) return filterDeletedCases(env, await mergeIndexRepairCases(env, JSON.parse(raw)));
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
  return filterDeletedCases(env, await mergeIndexRepairCases(env, content ? JSON.parse(content) : []));
}

function slugBase(name) {
  const s = String(name || "").trim();
  const idx = s.search(/\s*사기/);
  return idx > 0 ? s.slice(0, idx).trim() : s;
}

function criminalLandingUrl(item = {}) {
  const canonical = String(item?.landings?.a?.canonical || "").trim();
  if (canonical) return canonical;
  const slug = String(item.slug || "").trim();
  return slug ? `https://gnlaw-criminal.co.kr/prosecute/${encodeURIComponent(slug)}-litigation/` : "";
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
