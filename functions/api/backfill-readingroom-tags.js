// 1회성 마이그레이션: KV(cases:index + case:{slug})와 GitHub cases.json 양쪽에 hasReadingroomLanding 태깅
// KV→GitHub 자동 동기화(syncAllCasesToGitHub)는 KV를 기준으로 GitHub 파일을 통째로 덮어쓰기 때문에,
// 로컬에서 GitHub 파일만 태깅해도 다음 동기화 때 사라진다 — 반드시 KV 쪽에도 반영해야 유지된다.
// POST /api/backfill-readingroom-tags        → 실제 반영
// POST /api/backfill-readingroom-tags?dry=1  → 미리보기(쓰기 없음)
import { hasReadingroomSignal } from "../_readingroomTemplate.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    if (!env.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    if (idx.length === 0) return json({ ok: false, message: "등록된 사건이 없습니다." });

    const matchedSlugs = [];
    let alreadyTagged = 0;

    for (const entry of idx) {
      const isMatch = hasReadingroomSignal({ caseName: entry.caseName, tags: entry.tags, memo: entry.memo });
      if (!isMatch) continue;
      if (entry.hasReadingroomLanding === true) {
        alreadyTagged++;
        continue;
      }
      matchedSlugs.push(entry.slug);
    }

    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        total: idx.length,
        alreadyTagged,
        newlyMatched: matchedSlugs.length,
        sample: matchedSlugs.slice(0, 20),
      });
    }

    let updatedKV = 0;
    const errors = [];

    for (const slug of matchedSlugs) {
      try {
        const entry = idx.find((e) => e.slug === slug);
        if (entry) entry.hasReadingroomLanding = true;

        const raw = await env.CASES.get(`case:${slug}`);
        if (raw) {
          const caseData = JSON.parse(raw);
          caseData.hasReadingroomLanding = true;
          await env.CASES.put(`case:${slug}`, JSON.stringify(caseData));
        }
        updatedKV++;
      } catch (e) {
        errors.push({ slug, error: e.message });
      }
    }

    if (updatedKV > 0) {
      await env.CASES.put("cases:index", JSON.stringify(idx));
    }

    // GitHub cases.json도 동일하게 반영 (다음 KV→GitHub 자동 동기화가 오기 전에 즉시 일치시킴)
    let githubUpdated = 0;
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    const matchedSet = new Set(matchedSlugs);

    if (owner && repo && token && matchedSet.size > 0) {
      try {
        const filePath = "data/cases.json";
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(apiUrl, { headers: githubHeaders(token) });
        if (res.ok) {
          const file = await res.json();
          const raw = await readFileContent(file, token);
          const cases = raw ? JSON.parse(raw) : [];
          for (const c of cases) {
            if (matchedSet.has(c.slug)) {
              c.hasReadingroomLanding = true;
              githubUpdated++;
            }
          }
          const newContent = JSON.stringify(cases, null, 2);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: "PUT",
            headers: githubHeaders(token),
            body: JSON.stringify({
              message: `Backfill hasReadingroomLanding for ${githubUpdated} cases`,
              content: encodeBase64(newContent),
              sha: file.sha,
              branch,
            }),
          });
        }
      } catch (e) {
        errors.push({ slug: "github", error: e.message });
      }
    }

    return json({
      ok: true,
      total: idx.length,
      alreadyTagged,
      updatedKV,
      githubUpdated,
      errors,
    });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
  };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    return decodeBase64(file.content).trim();
  }
  if (file.download_url) {
    const r = await fetch(file.download_url, { headers: githubHeaders(token) });
    return r.ok ? (await r.text()).trim() : null;
  }
  return null;
}

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64(str) {
  const binary = atob(String(str).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
