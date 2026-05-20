export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const caseName = String(body.caseName || "").trim();
    const slug = String(body.slug || "").trim();
    const category = String(body.category || "").trim();
    const summary = String(body.summary || "").trim();

    if (!caseName || !slug || !category || !summary) {
      return json({ ok: false, message: "필수 입력값이 누락되었습니다." }, 400);
    }

    const repoOwner = env.GITHUB_REPO_OWNER;
    const repoName = env.GITHUB_REPO_NAME;
    const branch = env.GITHUB_BRANCH || "main";
    const token = env.GITHUB_TOKEN;

    const filePath = "data/cases.json";
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;

    const currentRes = await fetch(apiUrl, {
      headers: githubHeaders(token)
    });

    if (!currentRes.ok) {
        const errorText = await currentRes.text();

        return json({
          ok: false,
          message: "기존 cases.json을 불러오지 못했습니다.",
          status: currentRes.status,
          statusText: currentRes.statusText,
          repoOwner,
          repoName,
          branch,
          filePath,
          apiUrl,
          githubError: errorText
        }, 500);
    }

    const currentFile = await currentRes.json();
    const currentContent = decodeBase64(currentFile.content);
    const cases = JSON.parse(currentContent);

    if (cases.some((item) => item.slug === slug)) {
      return json({ ok: false, message: "이미 존재하는 slug입니다." }, 409);
    }

    const now = new Date().toISOString().slice(0, 10);

    cases.push({
      slug,
      caseName,
      category,
      landingViews: 0,
      reports: 0,
      updatedAt: now,
      summary,
      tags: []
    });

    const newContent = JSON.stringify(cases, null, 2);

    const updateRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: `Add case ${caseName}`,
        content: encodeBase64(newContent),
        sha: currentFile.sha,
        branch
      })
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      return json({ ok: false, message: "GitHub 저장 실패", detail: err }, 500);
    }

    return json({
      ok: true,
      message: "사건이 GitHub에 저장되었습니다. Pages가 자동 재배포됩니다.",
      case: {
        slug,
        caseName,
        category,
        summary
      }
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin"
  };
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}