const EDITABLE_LANDING_FIELDS = ["body", "victimCases", "suspiciousCompanies", "faq", "h1", "title", "description"];
const FRAUD_TYPE_KEYS = new Set(["stock-project", "institution-exchange", "team-mission", "live-dating", "refund-reward"]);

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
    const raw = await readFileContent(file, token);
    const cases = raw ? JSON.parse(raw) : [];
    const idx = cases.findIndex((c) => c.slug === slug);
    if (idx === -1) return json({ ok: false, message: "사건을 찾을 수 없습니다." }, 404);

    const now = new Date().toISOString().slice(0, 10);
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);

    if (action === "update-landing" && groupKey && field) {
      if (!EDITABLE_LANDING_FIELDS.includes(field)) {
        return json({ ok: false, message: "편집 불가 필드입니다." }, 400);
      }
      if (!cases[idx].landings) cases[idx].landings = {};
      if (!cases[idx].landings[groupKey]) cases[idx].landings[groupKey] = {};
      cases[idx].landings[groupKey][field] = value;
      if (field === "title") cases[idx].landings[groupKey].ogTitle = value;
      if (field === "description") cases[idx].landings[groupKey].ogDescription = value;
      cases[idx].updatedAt = now;

    } else if (action === "sync-from-github") {
      // GitHub의 최신 cases.json 데이터를 KV에 즉시 반영
      if (!env.CASES) return json({ ok: false, message: "KV 없음" }, 500);
      const existing = await env.CASES.get(`case:${slug}`);
      const kvEntry = existing ? { ...JSON.parse(existing), ...cases[idx] } : cases[idx];
      await env.CASES.put(`case:${slug}`, JSON.stringify(kvEntry));
      const idxRaw = await env.CASES.get("cases:index");
      if (idxRaw) {
        const indexArr = JSON.parse(idxRaw);
        const pos = indexArr.findIndex((e) => e.slug === slug);
        if (pos !== -1) indexArr[pos] = buildIndexEntry(kvEntry);
        else indexArr.push(buildIndexEntry(kvEntry));
        await env.CASES.put("cases:index", JSON.stringify(indexArr));
      }
      return json({ ok: true, message: "KV 동기화 완료", updatedCase: kvEntry });

    } else if (action === "save-landings") {
      if (!value || typeof value !== "object") return json({ ok: false, message: "landings 객체 필수" }, 400);
      cases[idx].landings = value;
      cases[idx].updatedAt = now;

    } else if (action === "rename" || action === "update-title") {
      const newName = String(value || "").trim();
      if (!newName) return json({ ok: false, message: "새 사건명 필수" }, 400);
      updateCaseTitle(cases[idx], newName);
      cases[idx].updatedAt = now;

    } else if (action === "update-summary") {
      const newSummary = String(value || "").trim().slice(0, 300);
      if (!newSummary) return json({ ok: false, message: "요약 내용 필수" }, 400);
      cases[idx].summary = newSummary;
      cases[idx].updatedAt = now;

    } else if (action === "set-fraud-type") {
      const nextType = String(value || "").trim();
      if (!FRAUD_TYPE_KEYS.has(nextType)) return json({ ok: false, message: "유효하지 않은 유형입니다." }, 400);
      if (String(cases[idx].createdBy || "").trim()) return json({ ok: false, message: "일반 랜딩만 유형을 변경할 수 있습니다." }, 400);
      cases[idx].fraudType = nextType;
      cases[idx].updatedAt = now;

    } else if (action === "set-noindex") {
      cases[idx].noindex = toBoolean(value);
      cases[idx].updatedAt = now;

    } else if (action === "set-search-hidden") {
      const hidden = toBoolean(value);
      cases[idx].searchHidden = hidden;
      cases[idx].hideFromListing = hidden;
      cases[idx].noindex = hidden;
      cases[idx].updatedAt = now;

    } else if (action === "update-memo") {
      cases[idx].memo = String(value || "").trim();
      cases[idx].updatedAt = now;

    } else if (action === "add-memo") {
      const text = String(value || "").trim();
      if (!text) return json({ ok: false, message: "메모 내용 필수" }, 400);
      if (!Array.isArray(cases[idx].memos)) cases[idx].memos = [];
      cases[idx].memos.push({
        id: Date.now(),
        text,
        createdAt: nowKst,
      });
      cases[idx].updatedAt = now;

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

    // KV 업데이트 — rename 시 기존 KV의 landings 보존
    if (env.CASES) {
      let kvEntry = cases[idx];
      if (action === "rename" || action === "update-title" || action === "update-summary" || action === "set-noindex" || action === "set-search-hidden" || action === "update-memo" || action === "add-memo" || action === "update-thumbnail" || action === "add-comment" || action === "delete-comment") {
        const existing = await env.CASES.get(`case:${slug}`);
        if (existing) {
          const existingParsed = JSON.parse(existing);
          kvEntry = { ...existingParsed, ...cases[idx] };
          if (existingParsed.landings && !cases[idx].landings) {
            kvEntry.landings = existingParsed.landings;
          }
        }
      }
      if (action === "rename" || action === "update-title") {
        updateCaseTitle(kvEntry, cases[idx].caseName);
      }
      await env.CASES.put(`case:${slug}`, JSON.stringify(kvEntry));
      const idxRaw = await env.CASES.get("cases:index");
      if (idxRaw) {
        const indexArr = JSON.parse(idxRaw);
        const pos = indexArr.findIndex((e) => e.slug === slug);
        if (pos !== -1) indexArr[pos] = buildIndexEntry(cases[idx]);
        else indexArr.push(buildIndexEntry(cases[idx]));
        await env.CASES.put("cases:index", JSON.stringify(indexArr));
      }
    }

    return json({ ok: true, updatedCase: cases[idx] });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

function buildIndexEntry(c) {
  return {
    slug: c.slug, caseName: c.caseName || "", category: c.category || "",
    createdAt: c.createdAt || "", updatedAt: c.updatedAt || "",
    thumbnailUrl: c.thumbnailUrl || "", landingViews: c.landingViews || 0,
    reports: c.reports || 0, summary: c.summary || "", tags: c.tags || [], memo: c.memo || "",
    noindex: c.noindex || false,
    hideFromListing: c.hideFromListing || false,
    searchHidden: c.searchHidden || false,
    targetGroups: c.targetGroups || [],
    createdBy: c.createdBy || "",
    fraudType: c.fraudType || "",
    ...(c.listingPath ? { listingPath: c.listingPath } : {}),
    ...(c.publicPath ? { publicPath: c.publicPath } : {}),
    ...(c.listingUrl ? { listingUrl: c.listingUrl } : {}),
  };
}

function updateCaseTitle(item, title) {
  item.caseName = title;
  if (!item.landings || typeof item.landings !== "object") return;
  for (const landing of Object.values(item.landings)) {
    if (!landing || typeof landing !== "object") continue;
    landing.title = title;
    landing.h1 = title;
    landing.ogTitle = title;
  }
}

function toBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
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
