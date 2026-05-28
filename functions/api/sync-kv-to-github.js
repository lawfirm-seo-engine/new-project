/**
 * POST /api/sync-kv-to-github
 * KV cases:index + case:{slug} → data/cases.json (GitHub)
 *
 * 흐름:
 *  1. KV cases:index 에서 전체 slug 목록 읽기
 *  2. 각 slug 의 전체 케이스 데이터를 case:{slug} 에서 읽기
 *     (없으면 index 엔트리 그대로 사용)
 *  3. createdAt 기준 정렬
 *  4. GitHub data/cases.json 덮어쓰기 (PUT)
 *  5. 결과 반환
 */
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.CASES) {
    return json({ ok: false, message: "CASES KV 바인딩이 없습니다." }, 500);
  }

  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) {
    return json({ ok: false, message: "GitHub 환경변수가 누락되었습니다." }, 500);
  }

  try {
    // ── 1. KV cases:index 읽기 ──────────────────────────────────────────────
    const idxRaw = await env.CASES.get("cases:index");
    if (!idxRaw) return json({ ok: false, message: "KV cases:index 가 비어있습니다." }, 404);

    const index = JSON.parse(idxRaw);
    if (!Array.isArray(index) || index.length === 0) {
      return json({ ok: false, message: "KV index 가 빈 배열입니다." }, 404);
    }

    // ── 2. 각 케이스 전체 데이터 읽기 ──────────────────────────────────────
    const full = [];
    let fromIndex = 0;

    for (const entry of index) {
      const slug = entry.slug;
      if (!slug) continue;

      const raw = await env.CASES.get(`case:${slug}`);
      if (raw) {
        try {
          full.push(JSON.parse(raw));
        } catch {
          full.push(entry); // 파싱 실패 시 index 엔트리로 대체
          fromIndex++;
        }
      } else {
        // case:{slug} 없으면 index 엔트리만 사용 (landings 없음)
        full.push(entry);
        fromIndex++;
      }
    }

    // ── 3. createdAt 기준 정렬 ───────────────────────────────────────────────
    full.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

    // ── 4. GitHub 현재 파일 sha 조회 ─────────────────────────────────────────
    const filePath = "data/cases.json";
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      { headers: githubHeaders(token) }
    );
    if (!fileRes.ok) {
      return json({ ok: false, message: `GitHub 파일 조회 실패 (${fileRes.status})` }, 500);
    }
    const fileInfo = await fileRes.json();
    const sha = fileInfo.sha;

    // ── 5. GitHub 덮어쓰기 ──────────────────────────────────────────────────
    const newContent = JSON.stringify(full, null, 2);
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify({
          message: `sync: KV→GitHub ${full.length} cases (was ${index.length} in KV)`,
          content: encodeBase64(newContent),
          sha,
          branch,
        }),
      }
    );

    if (!putRes.ok) {
      const detail = await putRes.text();
      return json({ ok: false, message: "GitHub 저장 실패", detail }, 500);
    }

    return json({
      ok: true,
      message: `KV(${index.length}개) → GitHub cases.json 동기화 완료`,
      total: full.length,
      fromIndexOnly: fromIndex,
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

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
