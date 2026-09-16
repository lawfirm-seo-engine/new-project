// Admin API: update visibility flags for one Naver Powerlink landing page.

const GITHUB_FILE_PATH = "data/powerlinks.json";
const SITE_URL = "https://gnlaw-criminal.co.kr";
const DEFAULT_ROBOTS = "index, follow";
const NOINDEX_ROBOTS = "noindex, follow";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const slug = normalizeSlug(body.slug);
    const action = String(body.action || "").trim();
    const value = toBoolean(body.value);

    if (!slug) return json({ ok: false, message: "slug is required" }, 400);

    const existing = await loadExisting(env, slug);
    if (!existing) return json({ ok: false, message: "파워링크 랜딩을 찾을 수 없습니다." }, 404);

    const item = { ...existing, updatedAt: today() };
    if (action === "set-noindex") {
      item.noindex = value;
      item.robots = value || isSearchHidden(item) ? NOINDEX_ROBOTS : DEFAULT_ROBOTS;
    } else if (action === "set-search-hidden") {
      item.searchHidden = value;
      item.hideFromListing = value;
      item.noindex = value;
      item.robots = value ? NOINDEX_ROBOTS : DEFAULT_ROBOTS;
    } else {
      return json({ ok: false, message: "지원하지 않는 작업입니다." }, 400);
    }

    if (env.CASES) {
      await env.CASES.put(`powerlink:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("powerlink:index", JSON.stringify(index));
      context.waitUntil?.(syncPowerlinksToGitHub(env, index).catch(() => {}));
      return json({ ok: true, landing: item, storage: "kv+github" });
    }

    const all = await loadPowerlinksFromGitHub(env);
    upsertFull(all, item);
    await savePowerlinksToGitHub(env, all, `Update powerlink visibility ${slug}`);
    return json({ ok: true, landing: item, storage: "github" });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function loadExisting(env, slug) {
  if (env.CASES) {
    const raw = await env.CASES.get(`powerlink:${slug}`);
    if (raw) return JSON.parse(raw);
  }

  const all = await loadPowerlinksFromGitHub(env).catch(() => []);
  return all.find((item) => item.slug === slug) || null;
}

async function loadIndexFromKv(env) {
  const raw = await env.CASES.get("powerlink:index");
  return raw ? JSON.parse(raw) : [];
}

function upsertIndex(index, item) {
  const entry = buildIndexEntry(item);
  const pos = index.findIndex((candidate) => candidate.slug === item.slug);
  if (pos >= 0) index[pos] = entry;
  else index.push(entry);
  index.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function upsertFull(list, item) {
  const pos = list.findIndex((candidate) => candidate.slug === item.slug);
  if (pos >= 0) list[pos] = item;
  else list.push(item);
  list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function buildIndexEntry(item) {
  const searchHidden = isSearchHidden(item);
  const noindex = Boolean(item.noindex || searchHidden || String(item.robots || "").toLowerCase().includes("noindex"));
  return {
    slug: item.slug,
    title: item.title,
    h1: item.h1,
    description: item.description,
    imageAlt: item.imageAlt,
    imageCaption: item.imageCaption,
    imageDescription: item.imageDescription,
    robots: noindex ? NOINDEX_ROBOTS : DEFAULT_ROBOTS,
    noindex,
    searchHidden,
    hideFromListing: searchHidden,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    landingViews: item.landingViews || 0,
    url: `${SITE_URL}/powerlink/${encodeURIComponent(item.slug)}/`,
  };
}

async function syncPowerlinksToGitHub(env, index) {
  if (!env.CASES) return;
  const full = [];

  for (const entry of index) {
    const raw = await env.CASES.get(`powerlink:${entry.slug}`);
    if (raw) full.push(JSON.parse(raw));
  }

  await savePowerlinksToGitHub(env, full, `sync: powerlink landings ${full.length}`);
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

async function savePowerlinksToGitHub(env, list, message) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return;

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });

  let sha = null;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
  } else if (getRes.status !== 404) {
    throw new Error("GitHub powerlinks.json 상태 확인 실패");
  }

  const putBody = {
    message,
    content: encodeBase64(JSON.stringify(list, null, 2)),
    branch,
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    throw new Error(`GitHub powerlinks.json 저장 실패: ${detail.slice(0, 180)}`);
  }
}

function isSearchHidden(item = {}) {
  return Boolean(item.searchHidden || item.hideFromListing);
}

function toBoolean(value) {
  return value === true || value === 1 || value === "true" || value === "1";
}

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9가-힣._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
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

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
