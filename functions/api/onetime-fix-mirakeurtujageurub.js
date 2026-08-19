// 1회성 단발 수정: "미라클투자그룹 사칭 사기"(slug: mirakeurtujageurub) → "미라클투자 사칭 사기"로 개명.
// 이 사건은 일반(standard) 랜딩이라 개별 저장된 원고가 없고 caseName을 템플릿에 치환해 매 요청마다
// 렌더링되므로, caseName/summary/tags에서 "그룹"만 제거하면 노출되는 원고 전체에 자동 반영된다.
// /api/update-case가 GitHub 파일 전체를 읽어오다 실패하는 문제를 겪어(별도로 근본 수정함),
// 관리자 로그인 없이 이 케이스 하나만 안전하게 고치기 위한 1회용 엔드포인트. 실행 후 파일을 삭제한다.
const SLUG = "mirakeurtujageurub";
const OLD_TEXT = "미라클투자그룹";
const NEW_TEXT = "미라클투자";

export async function onRequestPost(context) {
  const { env } = context;

  try {
    if (!env.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    const raw = await env.CASES.get(`case:${SLUG}`);
    if (!raw) return json({ ok: false, message: `case:${SLUG} 를 KV에서 찾을 수 없습니다.` }, 404);

    const item = JSON.parse(raw);
    const replaceAll = (v) => (typeof v === "string" ? v.split(OLD_TEXT).join(NEW_TEXT) : v);

    item.caseName = replaceAll(item.caseName);
    item.title = replaceAll(item.title);
    item.h1 = replaceAll(item.h1);
    item.ogText = replaceAll(item.ogText);
    item.ogTitle = replaceAll(item.ogTitle);
    item.summary = replaceAll(item.summary);
    item.ogDescription = replaceAll(item.ogDescription);
    item.memo = replaceAll(item.memo);
    if (Array.isArray(item.tags)) item.tags = item.tags.map(replaceAll);
    if (Array.isArray(item.memos)) {
      item.memos = item.memos.map((m) => (m && typeof m === "object"
        ? { ...m, text: replaceAll(m.text) }
        : replaceAll(m)));
    }
    if (Array.isArray(item.comments)) {
      item.comments = item.comments.map((c) => (c && typeof c === "object"
        ? { ...c, text: replaceAll(c.text) }
        : c));
    }

    if (item.landings && typeof item.landings === "object") {
      for (const landing of Object.values(item.landings)) {
        if (!landing || typeof landing !== "object") continue;
        for (const field of ["title", "h1", "description", "ogTitle", "ogDescription", "ogText", "imageAlt", "imageCaption", "imageDescription"]) {
          if (typeof landing[field] === "string") landing[field] = replaceAll(landing[field]);
        }
        if (Array.isArray(landing.body)) landing.body = landing.body.map(replaceAll);
        if (Array.isArray(landing.victimCases)) landing.victimCases = landing.victimCases.map(replaceAll);
        if (Array.isArray(landing.faq)) {
          landing.faq = landing.faq.map((f) => (f && typeof f === "object"
            ? { ...f, question: replaceAll(f.question), answer: replaceAll(f.answer) }
            : f));
        }
      }
    }

    item.updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await env.CASES.put(`case:${SLUG}`, JSON.stringify(item));

    const idxRaw = await env.CASES.get("cases:index");
    if (idxRaw) {
      const idxArr = JSON.parse(idxRaw);
      const pos = idxArr.findIndex((e) => e.slug === SLUG);
      const entry = {
        slug: item.slug, caseName: item.caseName || "", category: item.category || "",
        createdAt: item.createdAt || "", updatedAt: item.updatedAt || "",
        thumbnailUrl: item.thumbnailUrl || "", landingViews: item.landingViews || 0,
        reports: item.reports || 0, summary: item.summary || "", tags: item.tags || [],
        memo: item.memo || "", noindex: item.noindex || false,
        targetGroups: item.targetGroups || [], createdBy: item.createdBy || "",
        fraudType: item.fraudType || "",
        ...(Array.isArray(item.memos) && item.memos.length ? { memos: item.memos } : {}),
      };
      if (pos !== -1) idxArr[pos] = entry; else idxArr.push(entry);
      await env.CASES.put("cases:index", JSON.stringify(idxArr));
    }

    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    if (owner && repo && token) {
      context.waitUntil?.(syncIndexToGithub(env, owner, repo, branch, token).catch(() => {}));
    }

    return json({ ok: true, message: "수정 완료", caseName: item.caseName, summary: item.summary, tags: item.tags });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

async function syncIndexToGithub(env, owner, repo, branch, token) {
  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return;
  const list = JSON.parse(idxRaw).filter((e) => e?.slug);
  list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  const filePath = "data/cases.json";
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin" };
  const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, { headers });
  if (!fileRes.ok) return;
  const fileInfo = await fileRes.json();
  await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `sync: KV→GitHub ${list.length} cases`,
      content: btoa(new TextEncoder().encode(JSON.stringify(list, null, 2)).reduce((s, b) => s + String.fromCharCode(b), "")),
      sha: fileInfo.sha,
      branch,
    }),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
