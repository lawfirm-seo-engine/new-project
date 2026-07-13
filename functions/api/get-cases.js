import { boardPostCaseEntry, listBoardPosts } from "../_board.js";

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // KV 우선: create-case.js가 KV에 동기 쓰기하므로 항상 최신 데이터 보장
    if (env.CASES) {
      const idxRaw = await env.CASES.get("cases:index");
      if (idxRaw) {
        const cases = await mergeBoardPosts(env, JSON.parse(idxRaw));
        return json({ ok: true, cases, source: "kv" });
      }
    }

    // KV 없으면 GitHub fallback
    const { repoOwner, repoName, branch, token } = githubEnv(env);
    if (!repoOwner || !repoName || !token) {
      return json({ ok: false, message: "환경변수 누락" }, 500);
    }
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/cases.json?ref=${branch}`,
      { headers: githubHeaders(token) }
    );
    if (!res.ok) return json({ ok: false, message: "cases.json 로드 실패" }, 500);

    const file = await res.json();
    const raw = await readFileContent(file, token);
    const cases = await mergeBoardPosts(env, raw ? JSON.parse(raw) : []);
    return json({ ok: true, cases, source: "github" });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function mergeBoardPosts(env, cases = []) {
  const list = Array.isArray(cases) ? [...cases] : [];
  const posts = await listBoardPosts(env).catch(() => []);
  if (!posts.length) return list;

  const bySlug = new Map(list.filter((item) => item?.slug).map((item) => [item.slug, item]));
  posts
    .filter((post) => (post.status || "published") === "published" && post.slug)
    .map(boardPostCaseEntry)
    .forEach((entry) => {
      bySlug.set(entry.slug, { ...(bySlug.get(entry.slug) || {}), ...entry });
    });

  return [...bySlug.values()].sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
  );
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") return decodeBase64(file.content).trim();
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function githubEnv(env) {
  return {
    repoOwner: env.GITHUB_REPO_OWNER,
    repoName: env.GITHUB_REPO_NAME,
    branch: env.GITHUB_BRANCH || "main",
    token: env.GITHUB_TOKEN,
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
