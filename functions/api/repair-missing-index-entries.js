// 1회성 정합성 점검: KV에 case:{slug} 본문 레코드는 있는데 cases:index 목록에는 빠져 있는 케이스를 찾아 복구한다.
// 원인: create-case.js 등 여러 생성 엔드포인트가 "cases:index를 읽고 → 메모리에서 새 항목을 push → 통째로 다시 쓰기"
// 방식으로 갱신하는데, 두 생성 요청이 거의 동시에 들어오면 나중에 쓴 쪽이 먼저 쓴 쪽의 추가분을 덮어써서
// 본문은 살아있지만 검색/목록/사이트맵에서는 사라지는 증상이 생긴다.
// POST /api/repair-missing-index-entries        → 실제 반영
// POST /api/repair-missing-index-entries?dry=1  → 미리보기(쓰기 없음)
import { buildIndexEntry } from "../_caseIndexRepair.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    if (!env.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const indexedSlugs = new Set(idx.filter((e) => e?.slug).map((e) => e.slug));

    const allCaseKeys = [];
    let cursor;
    do {
      const page = await env.CASES.list({ prefix: "case:", cursor, limit: 1000 });
      allCaseKeys.push(...page.keys);
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    const missingSlugs = allCaseKeys
      .map((k) => k.name.slice("case:".length))
      .filter((slug) => slug && !indexedSlugs.has(slug));

    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        totalCaseRecords: allCaseKeys.length,
        totalIndexed: idx.length,
        missingCount: missingSlugs.length,
        sample: missingSlugs.slice(0, 30),
      });
    }

    let repaired = 0;
    const errors = [];

    for (const slug of missingSlugs) {
      try {
        const raw = await env.CASES.get(`case:${slug}`);
        if (!raw) continue;
        const fullCase = JSON.parse(raw);
        const entry = buildIndexEntry(fullCase, slug);
        if (entry.slug) {
          idx.push(entry);
          repaired++;
        }
      } catch (e) {
        errors.push({ slug, error: e.message });
      }
    }

    if (repaired > 0) {
      await env.CASES.put("cases:index", JSON.stringify(idx));
    }

    let githubUpdated = 0;
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    if (owner && repo && token && repaired > 0) {
      try {
        const filePath = "data/cases.json";
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(apiUrl, { headers: githubHeaders(token) });
        if (res.ok) {
          const file = await res.json();
          const raw = await readFileContent(file, token);
          const cases = raw ? JSON.parse(raw) : [];
          const casesSlugs = new Set(cases.filter((c) => c?.slug).map((c) => c.slug));
          for (const slug of missingSlugs) {
            if (casesSlugs.has(slug)) continue;
            const fullRaw = await env.CASES.get(`case:${slug}`);
            if (!fullRaw) continue;
            cases.push(JSON.parse(fullRaw));
            githubUpdated++;
          }
          if (githubUpdated > 0) {
            const newContent = JSON.stringify(cases, null, 2);
            await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
              method: "PUT",
              headers: githubHeaders(token),
              body: JSON.stringify({
                message: `Repair ${githubUpdated} cases missing from index`,
                content: encodeBase64(newContent),
                sha: file.sha,
                branch,
              }),
            });
          }
        }
      } catch (e) {
        errors.push({ slug: "github", error: e.message });
      }
    }

    return json({
      ok: true,
      totalCaseRecords: allCaseKeys.length,
      totalIndexed: idx.length,
      missingCount: missingSlugs.length,
      repaired,
      githubUpdated,
      errors,
    });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin" };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") return decodeBase64(file.content).trim();
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
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
