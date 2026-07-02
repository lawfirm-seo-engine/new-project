export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const oldSlug = String(body.oldSlug || "").trim();
    const newSlug = String(body.newSlug || "").trim();

    if (!oldSlug || !newSlug) {
      return json({ ok: false, message: "oldSlug, newSlug 필수" }, 400);
    }
    if (oldSlug === newSlug) {
      return json({ ok: false, message: "oldSlug와 newSlug가 동일합니다" }, 400);
    }

    if (!env.CASES) {
      return json({ ok: false, message: "KV 환경 없음" }, 500);
    }

    // 1. Read old case
    const oldRaw = await env.CASES.get(`case:${oldSlug}`);
    if (!oldRaw) {
      return json({ ok: false, message: `case:${oldSlug} not found in KV` }, 404);
    }
    const caseData = JSON.parse(oldRaw);

    // 2. Check new slug doesn't already exist
    const existingNew = await env.CASES.get(`case:${newSlug}`);
    if (existingNew) {
      return json({ ok: false, message: `case:${newSlug} already exists in KV` }, 409);
    }

    // 3. Update slug field in case data
    caseData.slug = newSlug;

    // 4. Write to new key
    await env.CASES.put(`case:${newSlug}`, JSON.stringify(caseData));

    // 5. Delete old key
    await env.CASES.delete(`case:${oldSlug}`);

    // 6. Update cases:index
    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const entry = idx.find((e) => e.slug === oldSlug);
    if (entry) {
      entry.slug = newSlug;
    }
    await env.CASES.put("cases:index", JSON.stringify(idx));

    // 7. Sync index to GitHub
    const repoOwner = env.GITHUB_REPO_OWNER;
    const repoName = env.GITHUB_REPO_NAME;
    const branch = env.GITHUB_BRANCH || "main";
    const token = env.GITHUB_TOKEN;
    if (repoOwner && repoName && token) {
      context.waitUntil?.(syncToGitHub(env, idx, repoOwner, repoName, branch, token).catch(() => {}));
    }

    return json({
      ok: true,
      message: `${oldSlug} → ${newSlug} 완료`,
      oldSlug,
      newSlug,
    });
  } catch (err) {
    return json({ ok: false, message: err.message }, 500);
  }
}

async function syncToGitHub(env, idx, owner, repo, branch, token) {
  const filePath = "data/cases.json";
  const fileRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    { headers: githubHeaders(token) }
  );
  if (!fileRes.ok) return;
  const fileInfo = await fileRes.json();

  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: `sync: rename slug in KV→GitHub`,
        content: encodeBase64(JSON.stringify(idx, null, 2)),
        sha: fileInfo.sha,
        branch,
      }),
    }
  );
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
  };
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
