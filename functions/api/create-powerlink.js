// Admin API: create or update one Naver Powerlink landing page.
// Storage is intentionally separate from normal case landings.

const GITHUB_FILE_PATH = "data/powerlinks.json";
const SITE_URL = "https://gnlaw-criminal.co.kr";
const DEFAULT_ROBOTS = "index, follow";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const title = normalizeSpace(body.title);
    const slug = normalizeSlug(body.slug || title);
    const h1 = normalizeSpace(body.h1) || title;
    const description = normalizeSpace(body.description).slice(0, 170);
    const articleBody = normalizeBody(body.body);
    const robots = normalizeRobots(body.robots);
    const ctaTitle = normalizeSpace(body.ctaTitle) || "피해 자료 검토 요청";
    const ctaText = normalizeSpace(body.ctaText) || "입금 내역, 대화 캡처, 사이트 주소를 남겨주시면 담당자가 확인 후 연락드립니다.";
    const ctaLabel = normalizeSpace(body.ctaLabel) || "상담 접수";
    const now = today();

    if (!title || !slug || !articleBody) {
      return json({ ok: false, message: "제목, URL slug, 원고는 필수입니다." }, 400);
    }

    const existing = await loadExisting(env, slug);
    const item = {
      slug,
      title,
      h1,
      description: description || `${title} 관련 신규 사건 진행 내용을 정리했습니다.`,
      body: articleBody,
      robots,
      ctaTitle,
      ctaText,
      ctaLabel,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (env.CASES) {
      await env.CASES.put(`powerlink:${slug}`, JSON.stringify(item));
      const idx = await loadIndexFromKv(env);
      upsertIndex(idx, item);
      await env.CASES.put("powerlink:index", JSON.stringify(idx));
      context.waitUntil?.(syncPowerlinksToGitHub(env).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "파워링크 랜딩이 갱신되었습니다." : "파워링크 랜딩이 생성되었습니다.",
        landing: item,
        url: `${SITE_URL}/powerlink/${encodeURIComponent(slug)}/`,
        storage: "kv+github",
      });
    }

    const all = await loadPowerlinksFromGitHub(env);
    upsertFull(all, item);
    await savePowerlinksToGitHub(env, all, existing ? `Update powerlink landing ${slug}` : `Add powerlink landing ${slug}`);

    return json({
      ok: true,
      message: existing ? "파워링크 랜딩이 갱신되었습니다." : "파워링크 랜딩이 생성되었습니다.",
      landing: item,
      url: `${SITE_URL}/powerlink/${encodeURIComponent(slug)}/`,
      storage: "github",
    });
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

async function syncPowerlinksToGitHub(env) {
  if (!env.CASES) return;
  const index = await loadIndexFromKv(env);
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

  const body = {
    message,
    content: encodeBase64(JSON.stringify(list, null, 2)),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    throw new Error(`GitHub powerlinks.json 저장 실패: ${detail.slice(0, 180)}`);
  }
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

function normalizeRobots(value = "") {
  return String(value).toLowerCase().includes("noindex") ? "noindex, follow" : DEFAULT_ROBOTS;
}

function normalizeBody(value = "") {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    return decodeBase64(file.content).trim();
  }
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
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
