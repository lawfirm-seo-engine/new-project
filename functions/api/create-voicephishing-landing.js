import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const LA_HOST = "xn--jj0b0cw1o75qwua31zyfp19e.kr";
const LA_SITE_URL = "https://xn--jj0b0cw1o75qwua31zyfp19e.kr";
const LA_GROUP = GROUPS.find((g) => g.host === LA_HOST);
const TARGET_GROUPS = ["la"];
const CREATED_BY = "voicephishing-manual";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const title = normalizeSpace(body.title);
    const slug = normalizeSlug(body.slug || title);
    const isPreview = body.preview === true;

    if (!title || !slug) {
      return json({ ok: false, message: "페이지 제목은 필수입니다." }, 400);
    }

    const bank   = extractBank(title);
    const region = extractRegion(title);
    const action = extractAction(title, bank);

    if (isPreview) {
      // KV에서 기존 voicephishing-manual 케이스 찾아 참조 원고 추출
      const refBody = env.CASES
        ? await findReferenceBody(env, bank, region, action)
        : null;

      if (!refBody) {
        return json({
          ok: false,
          message: "기존 보이스피싱 페이지가 없습니다. 원고를 직접 입력하세요.",
          bank, region, action,
          noReference: true,
        });
      }

      return json({ ok: true, body: refBody, bank, region, action });
    }

    // ── 저장 ──────────────────────────────────────────────────────────────
    const rawBody = body.body;
    const confirmedBody = Array.isArray(rawBody) && rawBody.length
      ? rawBody
      : typeof rawBody === "string" && rawBody.trim()
        ? rawBody.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : null;

    if (!confirmedBody || !confirmedBody.length) {
      return json({ ok: false, message: "원고 내용이 없습니다. 직접 입력하거나 원고 미리보기를 먼저 실행하세요." }, 400);
    }

    const autoSummary = `${bank} ${action}은 신고 즉시 전문가와 상담하고, 피해금 회수 가능성과 대응 방향을 확인하는 것이 중요합니다. ${bank} ${action} ${region || "종로"}변호사가 피해 경위 분석부터 대응 절차까지 자세히 안내합니다.`;
    const summary = normalizeSpace(body.summary).slice(0, 180) || autoSummary;

    const imageAlt         = normalizeSpace(body.imageAlt).slice(0, 160);
    const imageCaption     = normalizeSpace(body.imageCaption).slice(0, 220);
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300);

    const existing = await loadExisting(env, slug);
    if (existing && existing.createdBy !== CREATED_BY) {
      return json({
        ok: false,
        message: "이미 다른 방식으로 생성된 slug입니다. 다른 slug를 입력하세요.",
      }, 409);
    }

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(LA_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, LA_SITE_URL),
      h1: title,
      ...(imageAlt         ? { imageAlt }         : {}),
      ...(imageCaption     ? { imageCaption }     : {}),
      ...(imageDescription ? { imageDescription } : {}),
      body: confirmedBody,
      victimCases: [],
      suspiciousCompanies: [],
      faq: [],
    };

    const item = {
      ...(existing || {}),
      slug,
      caseName: title,
      category: "보이스피싱 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: ["보이스피싱", "피해구제", "금융사기"],
      landings: { ...(existing?.landings || {}), la: landing },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} voicephishing landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmLaCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "보이스피싱 랜딩이 갱신되었습니다." : "보이스피싱 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(LA_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} voicephishing landing ${slug}`);
    return json({
      ok: true,
      message: existing ? "보이스피싱 랜딩이 갱신되었습니다." : "보이스피싱 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(LA_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

// ── 참조 원고 추출 (KV 기존 voicephishing-manual 케이스에서) ────────────────

async function findReferenceBody(env, newBank, newRegion, newAction) {
  try {
    const idxRaw = await env.CASES.get("cases:index");
    if (!idxRaw) return null;
    const index = JSON.parse(idxRaw);

    const candidates = index.filter((c) => c.createdBy === CREATED_BY);
    if (!candidates.length) return null;

    // 가장 최근 케이스를 참조로 선택
    const ref = candidates[0];
    const raw = await env.CASES.get(`case:${ref.slug}`);
    if (!raw) return null;

    const caseData = JSON.parse(raw);
    const refBody = caseData?.landings?.la?.body;
    if (!Array.isArray(refBody) || refBody.length < 3) return null;

    const refName = String(ref.caseName || ref.slug || "");
    const refBank   = extractBank(refName);
    const refRegion = extractRegion(refName);
    const refAction = extractAction(refName, refBank);

    // 참조 케이스의 은행·지역·행위를 새 값으로 치환
    return refBody.map((para) => {
      let s = String(para || "");
      if (refBank)   s = replaceAll(s, refBank, newBank);
      if (refRegion && newRegion && refRegion !== newRegion) s = replaceAll(s, refRegion, newRegion);
      if (refAction && newAction && refAction !== newAction) s = replaceAll(s, refAction, newAction);
      return s;
    });
  } catch {
    return null;
  }
}

// ── 제목 파싱 ────────────────────────────────────────────────────────────────

function extractBank(title) {
  const s = normalizeSpace(title);
  // "카카오뱅크 보이스피싱..." → "카카오뱅크"
  const m = s.match(/^(.+?)\s+(?:보이스피싱|전화금융사기|스미싱|피해)/);
  return m ? m[1].trim() : s.split(/[\s,·]/)[0];
}

function extractRegion(title) {
  const m = normalizeSpace(title).match(/[,\s\-–—·]?\s*(\S{1,6})변호사/);
  return m ? m[1].trim() : "";
}

function extractAction(title, bank) {
  const s = normalizeSpace(title);
  let rest = s.startsWith(bank) ? s.slice(bank.length).trim() : s;
  rest = rest.replace(/\s*[,·\-–—]?\s*\S{1,6}변호사[\s\S]*$/, "").trim();
  return rest || "보이스피싱";
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function replaceAll(str, from, to) {
  if (!from || from === to) return str;
  return str.split(from).join(to);
}

async function loadExisting(env, slug) {
  if (env.CASES) {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) return JSON.parse(raw);
  }
  const all = await loadCasesFromGitHub(env).catch(() => []);
  return all.find((item) => item.slug === slug) || null;
}

async function loadIndexFromKv(env) {
  const raw = await env.CASES.get("cases:index");
  return raw ? JSON.parse(raw) : [];
}

function upsertIndex(index, item) {
  const entry = buildIndexEntry(item);
  const pos = index.findIndex((c) => c.slug === item.slug);
  if (pos >= 0) index[pos] = entry;
  else index.push(entry);
  index.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function buildIndexEntry(item) {
  return {
    slug: item.slug,
    caseName: item.caseName || "",
    category: item.category || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    thumbnailUrl: item.thumbnailUrl || "",
    landingViews: item.landingViews || 0,
    reports: item.reports || 0,
    summary: item.summary || "",
    tags: item.tags || [],
    memo: item.memo || "",
    noindex: item.noindex || false,
    targetGroups: item.targetGroups || [],
    createdBy: item.createdBy || "",
  };
}

async function upsertCaseInGitHub(env, item, message) {
  const all = await loadCasesFromGitHub(env);
  const pos = all.findIndex((c) => c.slug === item.slug);
  if (pos >= 0) all[pos] = item;
  else all.push(item);
  all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  await saveCasesToGitHub(env, all, message);
}

async function loadCasesFromGitHub(env) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return [];
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`,
    { headers: githubHeaders(token) },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("GitHub cases.json 로드 실패");
  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

async function saveCasesToGitHub(env, list, message) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return;
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`,
    { headers: githubHeaders(token) },
  );
  let sha = null;
  if (getRes.ok) sha = (await getRes.json()).sha;
  else if (getRes.status !== 404) throw new Error("GitHub cases.json 상태 확인 실패");
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`,
    {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({ message, content: encodeBase64(JSON.stringify(list, null, 2)), branch, ...(sha ? { sha } : {}) }),
    },
  );
  if (!putRes.ok) throw new Error(`GitHub cases.json 저장 실패: ${(await putRes.text()).slice(0, 180)}`);
}

async function warmLaCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, LA_SITE_URL), { method: "GET" }),
    fetch(buildLandingUrl(LA_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: LA_HOST,
      key,
      keyLocation: `${LA_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(LA_GROUP, slug), `${LA_SITE_URL}/`],
    }),
  });
}

function githubEnv(env) {
  return { owner: env.GITHUB_REPO_OWNER, repo: env.GITHUB_REPO_NAME, branch: env.GITHUB_BRANCH || "main", token: env.GITHUB_TOKEN };
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin", "Cache-Control": "no-cache" };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") return decodeBase64(file.content).trim();
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function decodeBase64(value) {
  return new TextDecoder().decode(Uint8Array.from(atob(String(value || "").replace(/\n/g, "")), (c) => c.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let b = "";
  for (const byte of bytes) b += String.fromCharCode(byte);
  return btoa(b);
}

function normalizeSlug(value = "") {
  return String(value).trim().toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9가-힣_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return min + (hash % (max - min + 1));
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
