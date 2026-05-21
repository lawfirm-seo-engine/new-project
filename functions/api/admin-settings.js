const FILE_PATH = "data/settings.json";

export async function onRequestGet(context) {
  const { env } = context;
  const { repoOwner, repoName, branch, token } = githubEnv(env);

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${FILE_PATH}?ref=${branch}`,
      { headers: githubHeaders(token) }
    );
    if (!res.ok) return json({ ok: true, settings: { telegramChatId: "" } });
    const file = await res.json();
    const settings = JSON.parse(decodeBase64(file.content));
    return json({ ok: true, settings });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { repoOwner, repoName, branch, token } = githubEnv(env);

  try {
    const body = await request.json();
    const { telegramChatId, openaiApiKey } = body;

    // SHA 충돌 방지: 항상 최신 파일 정보를 가져와 저장
    const result = await saveSettings({ repoOwner, repoName, branch, token, telegramChatId, openaiApiKey });
    if (!result.ok) {
      return json({ ok: false, message: result.message }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function saveSettings({ repoOwner, repoName, branch, token, telegramChatId, openaiApiKey }) {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${FILE_PATH}`;

  // 최신 파일 조회 (SHA + 현재 내용)
  const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers: githubHeaders(token) });

  let existingSettings = {};
  let sha;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
    try { existingSettings = JSON.parse(decodeBase64(file.content)); } catch { /* ignore */ }
  }

  const settings = { ...existingSettings };
  if (telegramChatId !== undefined) settings.telegramChatId = String(telegramChatId || "").trim();
  if (openaiApiKey !== undefined) settings.openaiApiKey = String(openaiApiKey || "").trim();

  const putBody = {
    message: "Admin: update settings",
    content: encodeBase64(JSON.stringify(settings, null, 2) + "\n"),
    branch,
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    // SHA 충돌(409/422)이면 한 번 재시도
    if (putRes.status === 409 || putRes.status === 422) {
      return saveSettings({ repoOwner, repoName, branch, token, telegramChatId, openaiApiKey });
    }
    let parsed = {};
    try { parsed = JSON.parse(detail); } catch { /* ignore */ }
    return { ok: false, message: `GitHub 저장 실패 (${putRes.status}): ${parsed.message || detail.slice(0, 200)}` };
  }

  return { ok: true };
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
  };
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
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
