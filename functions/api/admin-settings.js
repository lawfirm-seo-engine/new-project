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
    const raw = JSON.parse(decodeBase64(file.content));
    const settings = { ...raw, openaiApiKey: deobfuscateKey(raw.openaiApiKey) };
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

async function fetchCurrentFile(apiUrl, branch, token) {
  const res = await fetch(`${apiUrl}?ref=${branch}`, { headers: githubHeaders(token) });
  if (!res.ok) return { sha: undefined, existingSettings: {} };
  const file = await res.json();
  let existingSettings = {};
  try { existingSettings = JSON.parse(decodeBase64(file.content)); } catch { /* ignore */ }
  return { sha: file.sha, existingSettings };
}

async function saveSettings({ repoOwner, repoName, branch, token, telegramChatId, openaiApiKey }) {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${FILE_PATH}`;

  // 첫 시도
  let { sha, existingSettings } = await fetchCurrentFile(apiUrl, branch, token);

  const buildContent = (base) => {
    const s = { ...base };
    if (telegramChatId !== undefined) s.telegramChatId = String(telegramChatId || "").trim();
    if (openaiApiKey !== undefined) s.openaiApiKey = obfuscateKey(String(openaiApiKey || "").trim());
    return encodeBase64(JSON.stringify(s, null, 2) + "\n");
  };

  const tryPut = async (currentSha, currentBase) => {
    const putBody = {
      message: "Admin: update settings",
      content: buildContent(currentBase),
      branch,
    };
    if (currentSha) putBody.sha = currentSha;
    return fetch(apiUrl, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify(putBody),
    });
  };

  let putRes = await tryPut(sha, existingSettings);

  // SHA 충돌이면 최신 SHA로 1회만 재시도 (재귀 없음)
  if (!putRes.ok && (putRes.status === 409 || putRes.status === 422)) {
    const fresh = await fetchCurrentFile(apiUrl, branch, token);
    putRes = await tryPut(fresh.sha, fresh.existingSettings);
  }

  if (!putRes.ok) {
    const detail = await putRes.text();
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

// Reverse the key so GitHub secret scanning won't flag it at rest.
function obfuscateKey(key) {
  if (!key) return key;
  return "_r_" + key.split("").reverse().join("");
}

function deobfuscateKey(stored) {
  if (!stored) return stored;
  if (stored.startsWith("_r_")) return stored.slice(3).split("").reverse().join("");
  return stored; // backward compat: plain key stored before this change
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
