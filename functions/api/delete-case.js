export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { slug } = await request.json();
    if (!slug) return json({ ok: false, message: "slug 필수" }, 400);

    let deletedName = slug;

    // KV 우선 삭제
    if (env.CASES) {
      const raw = await env.CASES.get(`case:${slug}`);
      if (!raw) return json({ ok: false, message: "사건을 찾을 수 없습니다." }, 404);
      deletedName = JSON.parse(raw).caseName || slug;

      await env.CASES.delete(`case:${slug}`);
      const idxRaw = await env.CASES.get("cases:index");
      if (idxRaw) {
        const indexArr = JSON.parse(idxRaw).filter((e) => e.slug !== slug);
        await env.CASES.put("cases:index", JSON.stringify(indexArr));
      }

      // KV 전체를 GitHub에 동기화 (race condition 없음)
      const { repoOwner, repoName, branch, token } = githubEnv(env);
      if (repoOwner && repoName && token) {
        context.waitUntil?.(syncAllCasesToGitHub(env, repoOwner, repoName, branch, token).catch(() => {}));
      }

      return json({ ok: true, deleted: deletedName });
    }

    // KV 없는 환경: GitHub 직접 수정
    const { repoOwner, repoName, branch, token } = githubEnv(env);
    const filePath = "data/cases.json";
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`,
      { headers: githubHeaders(token) }
    );
    if (!res.ok) return json({ ok: false, message: "cases.json 로드 실패" }, 500);

    const file = await res.json();
    const raw = await readFileContent(file, token);
    const cases = raw ? JSON.parse(raw) : [];
    const idx = cases.findIndex((c) => c.slug === slug);
    if (idx === -1) return json({ ok: false, message: "사건을 찾을 수 없습니다." }, 404);

    deletedName = cases[idx].caseName;
    cases.splice(idx, 1);

    const updateRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify({
          message: `Admin: delete case ${slug}`,
          content: encodeBase64(JSON.stringify(cases, null, 2)),
          sha: file.sha,
          branch,
        }),
      }
    );

    if (!updateRes.ok) {
      const detail = await updateRes.text();
      return json({ ok: false, message: "GitHub 저장 실패", detail }, 500);
    }

    return json({ ok: true, deleted: deletedName });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function syncAllCasesToGitHub(env, owner, repo, branch, token) {
  if (!env.CASES) return;
  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return;
  const index = JSON.parse(idxRaw).filter((e) => e.slug);

  const raws = await Promise.all(index.map((e) => env.CASES.get(`case:${e.slug}`)));
  const full = index.map((e, i) => { try { return raws[i] ? JSON.parse(raws[i]) : e; } catch { return e; } });
  full.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

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
        message: `sync: KV→GitHub ${full.length} cases`,
        content: encodeBase64(JSON.stringify(full, null, 2)),
        sha: fileInfo.sha,
        branch,
      }),
    }
  );
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
