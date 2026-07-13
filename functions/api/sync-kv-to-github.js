import { boardPostCaseEntry, listBoardPosts } from "../_board.js";

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

    // ── 2. cases:index 엔트리만 사용 (landings 제외 — KV에만 보관)
    // landings 포함 시 수십 MB로 Worker 메모리 초과. GitHub cases.json은
    // sitemap/허브 생성용 메타데이터 전용으로 사용.
    let fromIndex = 0;
    const full = index.filter((e) => e.slug).map((e) => { fromIndex++; return e; });
    fromIndex = 0; // index 엔트리만 사용하므로 fromIndex 불필요

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
    const existingCases = parseJson(await readFileContent(fileInfo, token), []);
    const boardEntries = mergeBySlug(
      existingCases.filter(isBoardCaseEntry),
      await loadBoardCaseEntries(env),
    );
    const boardAdded = mergeIntoCases(full, boardEntries);
    full.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

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
      boardEntries: boardEntries.length,
      boardAdded,
    });

  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

async function loadBoardCaseEntries(env) {
  const posts = await listBoardPosts(env).catch(() => []);
  return posts
    .filter((post) => (post.status || "published") === "published" && post.slug)
    .map(boardPostCaseEntry);
}

function isBoardCaseEntry(item = {}) {
  return item?.createdBy === "board-manual" || String(item?.listingPath || "").startsWith("/board/");
}

function mergeBySlug(...groups) {
  const bySlug = new Map();
  groups.flat().filter((item) => item?.slug).forEach((item) => {
    bySlug.set(item.slug, { ...(bySlug.get(item.slug) || {}), ...item });
  });
  return [...bySlug.values()];
}

function mergeIntoCases(cases, additions) {
  let added = 0;
  const bySlug = new Map(cases.map((item, index) => [item.slug, index]));
  additions.filter((item) => item?.slug).forEach((item) => {
    const index = bySlug.get(item.slug);
    if (index === undefined) {
      cases.push(item);
      bySlug.set(item.slug, cases.length - 1);
      added += 1;
    } else {
      cases[index] = { ...cases[index], ...item };
    }
  });
  return added;
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") return decodeBase64(file.content).trim();
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function decodeBase64(value = "") {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
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
