export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { slug } = await request.json();
    if (!slug) return json({ ok: false }, 400);

    const { repoOwner, repoName, branch, token } = githubEnv(env);
    if (!token || !repoOwner || !repoName) return json({ ok: false });

    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/cases.json?ref=${branch}`;
    const res = await fetch(apiUrl, { headers: githubHeaders(token) });
    if (!res.ok) return json({ ok: false });

    const file = await res.json();
    const cases = JSON.parse(decodeBase64(file.content));
    const idx = cases.findIndex((c) => c.slug === slug);
    if (idx === -1) return json({ ok: false });

    cases[idx].landingViews = (cases[idx].landingViews || 0) + 1;
    const newViews = cases[idx].landingViews;

    const updateRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/cases.json`,
      {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify({
          message: `Track view: ${slug}`,
          content: encodeBase64(JSON.stringify(cases, null, 2)),
          sha: file.sha,
          branch,
        }),
      }
    );

    return json({ ok: updateRes.ok, views: newViews });
  } catch (error) {
    return json({ ok: false, message: error.message });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
