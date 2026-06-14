// Admin API: delete one Naver Powerlink landing page.

const GITHUB_FILE_PATH = "data/powerlinks.json";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const slug = normalizeSlug(body.slug);
    if (!slug) return json({ ok: false, message: "slug is required" }, 400);

    if (env.CASES) {
      await env.CASES.delete(`powerlink:${slug}`);
      const idxRaw = await env.CASES.get("powerlink:index");
      const index = idxRaw ? JSON.parse(idxRaw) : [];
      const nextIndex = index.filter((item) => item.slug !== slug);
      await env.CASES.put("powerlink:index", JSON.stringify(nextIndex));
      context.waitUntil?.(syncPowerlinksToGitHub(env, nextIndex).catch(() => {}));
      return json({ ok: true, message: "파워링크 랜딩이 삭제되었습니다.", slug });
    }

    const all = await loadPowerlinksFromGitHub(env);
    const next = all.filter((item) => item.slug !== slug);
    await savePowerlinksToGitHub(env, next, `Delete powerlink landing ${slug}`);
    return json({ ok: true, message: "파워링크 랜딩이 삭제되었습니다.", slug });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
