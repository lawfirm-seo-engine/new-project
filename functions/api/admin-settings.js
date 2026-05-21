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
    const { telegramChatId } = await request.json();

    const getRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${FILE_PATH}?ref=${branch}`,
      { headers: githubHeaders(token) }
    );

    const sha = getRes.ok ? (await getRes.json()).sha : undefined;
    const settings = { telegramChatId: String(telegramChatId || "").trim() };

    const putBody = {
      message: "Admin: update telegram settings",
      content: encodeBase64(JSON.stringify(settings, null, 2) + "\n"),
      branch,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify(putBody),
      }
    );

    if (!putRes.ok) {
      const detail = await putRes.text();
      return json({ ok: false, message: "GitHub 저장 실패", detail }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
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
