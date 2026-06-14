// Admin API: list or load Naver Powerlink landing pages.

const GITHUB_FILE_PATH = "data/powerlinks.json";
const SITE_URL = "https://gnlaw-criminal.co.kr";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  try {
    if (slug) {
      const landing = await loadOne(env, slug);
      if (!landing) return json({ ok: false, message: "파워링크 랜딩을 찾을 수 없습니다." }, 404);
      return json({ ok: true, landing });
    }

    const landings = await loadIndex(env);
    return json({ ok: true, landings });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function loadOne(env, slug) {
  if (env.CASES) {
    const raw = await env.CASES.get(`powerlink:${slug}`);
    if (raw) return JSON.parse(raw);
  }

  const all = await loadPowerlinksFromGitHub(env);
  return all.find((item) => item.slug === slug) || null;
}

async function loadIndex(env) {
  if (env.CASES) {
    const raw = await env.CASES.get("powerlink:index");
    if (raw) return JSON.parse(raw);
  }

  const all = await loadPowerlinksFromGitHub(env);
  return all.map(buildIndexEntry).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function buildIndexEntry(item) {
  return {
    slug: item.slug,
    title: item.title,
    h1: item.h1,
    description: item.description,
    robots: item.robots,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    url: `${SITE_URL}/powerlink/${encodeURIComponent(item.slug)}/`,
  };
}

async function loadPowerlinksFromGitHub(env) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return [];

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error("GitHub powerlinks.json 로드 실패");

  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

function githubEnv(env) {
  return {
    owner: env.GITHUB_REPO_OWNER,
    repo: env.GITHUB_REPO_NAME,
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

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    const clean = file.content.replace(/\n/g, "");
    return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0))).trim();
  }
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
