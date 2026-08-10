// 레거시 리딩방(ld) 케이스 신선도 갱신 — hasReadingroomLanding 케이스 중 updatedAt이 가장 오래된
// 순으로 일부를 today로 갱신한다. 폴백 렌더링 본문은 caseName 기반으로 매 요청 시 계산되므로
// 별도로 저장된 본문 텍스트를 바꿀 필요는 없고, updatedAt만 갱신해도 허브 "오늘 갱신" 섹션과
// sitemap-recent.xml/RSS 최신성 신호에 반영된다.
// POST /api/refresh-readingroom-freshness?count=20        → 실제 반영 (기본 20건)
// POST /api/refresh-readingroom-freshness?count=20&dry=1  → 미리보기
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const count = Math.min(Math.max(parseInt(url.searchParams.get("count") || "20", 10) || 20, 1), 200);

  try {
    if (!env.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const eligible = idx
      .filter((e) => e.hasReadingroomLanding === true)
      .sort((a, b) => String(a.updatedAt || a.createdAt || "").localeCompare(String(b.updatedAt || b.createdAt || "")));

    const targets = eligible.slice(0, count);

    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        eligibleTotal: eligible.length,
        willUpdate: targets.length,
        oldestUpdatedAt: eligible[0]?.updatedAt || eligible[0]?.createdAt || null,
        sample: targets.slice(0, 10).map((e) => ({ slug: e.slug, updatedAt: e.updatedAt })),
      });
    }

    const now = today();
    let updatedKV = 0;
    const errors = [];

    for (const entry of targets) {
      try {
        entry.updatedAt = now;
        const raw = await env.CASES.get(`case:${entry.slug}`);
        if (raw) {
          const caseData = JSON.parse(raw);
          caseData.updatedAt = now;
          await env.CASES.put(`case:${entry.slug}`, JSON.stringify(caseData));
        }
        updatedKV++;
      } catch (e) {
        errors.push({ slug: entry.slug, error: e.message });
      }
    }

    if (updatedKV > 0) {
      await env.CASES.put("cases:index", JSON.stringify(idx));
    }

    let githubUpdated = 0;
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    const targetSlugs = new Set(targets.map((e) => e.slug));

    if (owner && repo && token && updatedKV > 0) {
      try {
        const filePath = "data/cases.json";
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(apiUrl, { headers: githubHeaders(token) });
        if (res.ok) {
          const file = await res.json();
          const raw = await readFileContent(file, token);
          const cases = raw ? JSON.parse(raw) : [];
          for (const c of cases) {
            if (targetSlugs.has(c.slug)) {
              c.updatedAt = now;
              githubUpdated++;
            }
          }
          const newContent = JSON.stringify(cases, null, 2);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: "PUT",
            headers: githubHeaders(token),
            body: JSON.stringify({
              message: `Refresh freshness for ${githubUpdated} readingroom cases`,
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

    return json({ ok: true, eligibleTotal: eligible.length, updatedKV, githubUpdated, errors });
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

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
