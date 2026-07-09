export async function onRequestPost(context) {
  const { env } = context;

  if (!env.CASES) {
    return json({ ok: false, message: "CASES KV 바인딩이 설정되지 않았습니다. Cloudflare Pages 설정을 확인하세요." });
  }

  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) {
    return json({ ok: false, message: "GitHub 환경변수가 누락되었습니다." });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
      { headers: githubHeaders(token) }
    );
    if (!res.ok) return json({ ok: false, message: `GitHub 로드 실패 (${res.status})` });

    const file = await res.json();
    let raw = "";
    if (file.content && file.encoding !== "none") {
      raw = decodeBase64(file.content).trim();
    } else if (file.download_url) {
      const r = await fetch(file.download_url, { headers: githubHeaders(token) });
      if (r.ok) raw = (await r.text()).trim();
    }

    if (!raw) return json({ ok: false, message: "cases.json 내용이 비어있습니다." });

    const cases = JSON.parse(raw);
    const index = [];

    // KV에 개별 사건 저장
    for (const c of cases) {
      if (!c.slug) continue;
      await env.CASES.put(`case:${c.slug}`, JSON.stringify(c));
      index.push(buildIndexEntry(c));
    }

    // 인덱스(메타데이터 목록) 저장
    await env.CASES.put("cases:index", JSON.stringify(index));

    return json({ ok: true, message: `${index.length}개 사건을 KV로 이전했습니다.`, count: index.length });
  } catch (e) {
    return json({ ok: false, message: e.message });
  }
}

function buildIndexEntry(c) {
  return {
    slug: c.slug,
    caseName: c.caseName || c.name || "",
    category: c.category || "",
    createdAt: c.createdAt || "",
    updatedAt: c.updatedAt || "",
    thumbnailUrl: c.thumbnailUrl || "",
    landingViews: c.landingViews || 0,
    reports: c.reports || 0,
    summary: c.summary || "",
    tags: c.tags || [],
    memo: c.memo || "",
    noindex: c.noindex || false,
    targetGroups: Array.isArray(c.targetGroups) ? c.targetGroups : [],
    createdBy: c.createdBy || "",
  };
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin" };
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
