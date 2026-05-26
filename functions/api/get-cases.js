export async function onRequestGet(context) {
  const { env } = context;

  try {
    // KV 우선, 없으면 GitHub 폴백
    if (env.CASES) {
      const raw = await env.CASES.get("cases:index");
      if (raw) return json({ ok: true, cases: JSON.parse(raw) });
    }

    // GitHub 폴백 (KV 마이그레이션 전 또는 KV 미설정 시)
    const { repoOwner, repoName, branch, token } = githubEnv(env);
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/cases.json?ref=${branch}`,
      { headers: githubHeaders(token) }
    );
    if (!res.ok) return json({ ok: false, message: "cases.json 로드 실패" }, 500);

    const file = await res.json();
    const raw = await readFileContent(file, token, env);
    const cases = raw ? JSON.parse(raw) : [];
    return json({ ok: true, cases });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
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
  return { repoOwner: env.GITHUB_REPO_OWNER, repoName: env.GITHUB_REPO_NAME, branch: env.GITHUB_BRANCH || "main", token: env.GITHUB_TOKEN };
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
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
