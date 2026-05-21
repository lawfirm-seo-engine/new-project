const EDITABLE_LANDING_FIELDS = ["body", "victimCases", "suspiciousCompanies", "faq", "h1", "title", "description"];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { slug, action, groupKey, field, value, comment } = body;

    if (!slug) return json({ ok: false, message: "slug 필수" }, 400);

    const { repoOwner, repoName, branch, token } = githubEnv(env);
    const filePath = "data/cases.json";
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;

    const res = await fetch(apiUrl, { headers: githubHeaders(token) });
    if (!res.ok) return json({ ok: false, message: "cases.json 로드 실패" }, 500);

    const file = await res.json();
    const cases = JSON.parse(decodeBase64(file.content));
    const idx = cases.findIndex((c) => c.slug === slug);
    if (idx === -1) return json({ ok: false, message: "사건을 찾을 수 없습니다." }, 404);

    const now = new Date().toISOString().slice(0, 10);

    if (action === "update-landing" && groupKey && field) {
      if (!EDITABLE_LANDING_FIELDS.includes(field)) {
        return json({ ok: false, message: "편집 불가 필드입니다." }, 400);
      }
      if (!cases[idx].landings) cases[idx].landings = {};
      if (!cases[idx].landings[groupKey]) cases[idx].landings[groupKey] = {};
      cases[idx].landings[groupKey][field] = value;
      cases[idx].updatedAt = now;

    } else if (action === "update-memo") {
      cases[idx].memo = String(value || "").trim();

    } else if (action === "update-thumbnail") {
      cases[idx].thumbnailUrl = String(value || "").trim();

    } else if (action === "add-comment") {
      if (!comment || !comment.trim()) return json({ ok: false, message: "댓글 내용 필수" }, 400);
      if (!Array.isArray(cases[idx].comments)) cases[idx].comments = [];
      cases[idx].comments.push({
        id: Date.now(),
        text: comment.trim(),
        createdAt: now,
      });

    } else if (action === "delete-comment") {
      const { commentId } = body;
      if (!Array.isArray(cases[idx].comments)) return json({ ok: false, message: "댓글 없음" }, 404);
      cases[idx].comments = cases[idx].comments.filter((c) => c.id !== commentId);

    } else {
      return json({ ok: false, message: "유효하지 않은 action" }, 400);
    }

    const updateRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify({
          message: `Admin: ${action} for ${slug}`,
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

    return json({ ok: true, updatedCase: cases[idx] });
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
