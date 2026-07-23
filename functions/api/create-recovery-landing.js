import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const RECOVERY_HOST = "gnlaw-recovery.co.kr";
const RECOVERY_SITE_URL = "https://gnlaw-recovery.co.kr";
const RECOVERY_GROUP = GROUPS.find((group) => group.host === RECOVERY_HOST);
const TARGET_GROUPS = ["c"];
const CREATED_BY = "recovery-manual";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const title = normalizeSpace(body.title);
    const slug = normalizeSlug(body.slug || title);
    const h1 = normalizeSpace(body.h1) || title;
    const articleBody = normalizeBody(body.body);
    const summary = normalizeSpace(body.summary || body.description).slice(0, 180)
      || `${title} 관련 회복 사례와 대응 흐름을 정리했습니다.`;
    const imageAlt = normalizeSpace(body.imageAlt).slice(0, 160);
    const imageCaption = normalizeSpace(body.imageCaption).slice(0, 220);
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300);

    if (!title || !slug || !articleBody) {
      return json({ ok: false, message: "제목, URL slug, 원고는 필수입니다." }, 400);
    }

    const existing = await loadExisting(env, slug);
    if (existing && !isRecoveryManual(existing)) {
      return json({
        ok: false,
        message: "이미 일반 랜딩에서 사용 중인 slug입니다. 기존 랜딩을 덮어쓰지 않도록 다른 slug를 입력하세요.",
      }, 409);
    }

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(RECOVERY_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, RECOVERY_SITE_URL, "png"),
      h1,
      ...(imageAlt ? { imageAlt } : {}),
      ...(imageCaption ? { imageCaption } : {}),
      ...(imageDescription ? { imageDescription } : {}),
      body: bodyToParagraphs(articleBody),
      victimCases: [],
      suspiciousCompanies: [],
      faq: [],
    };
    const item = {
      ...(existing || {}),
      slug,
      caseName: title,
      category: "리커버리 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: normalizeTags(body.tags),
      landings: {
        ...(existing?.landings || {}),
        c: landing,
      },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} recovery landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmRecoveryCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "리커버리 랜딩이 갱신되었습니다." : "리커버리 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(RECOVERY_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} recovery landing ${slug}`);
    const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
    context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
    context.waitUntil?.(warmRecoveryCache(slug).catch(() => {}));

    return json({
      ok: true,
      message: existing ? "리커버리 랜딩이 갱신되었습니다." : "리커버리 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(RECOVERY_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
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
  const pos = index.findIndex((candidate) => candidate.slug === item.slug);
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

function isRecoveryManual(item = {}) {
  const targets = Array.isArray(item.targetGroups) ? item.targetGroups : [];
  return item.createdBy === CREATED_BY || (targets.length === 1 && targets[0] === "c");
}

async function upsertCaseInGitHub(env, item, message) {
  const all = await loadCasesFromGitHub(env);
  const pos = all.findIndex((candidate) => candidate.slug === item.slug);
  if (pos >= 0) all[pos] = item;
  else all.push(item);
  all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  await saveCasesToGitHub(env, all, message);
}

async function loadCasesFromGitHub(env) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return [];

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("GitHub cases.json 로드 실패");

  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

async function saveCasesToGitHub(env, list, message) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return;

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });

  let sha = null;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
  } else if (getRes.status !== 404) {
    throw new Error("GitHub cases.json 상태 확인 실패");
  }

  const body = {
    message,
    content: encodeBase64(JSON.stringify(list, null, 2)),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    throw new Error(`GitHub cases.json 저장 실패: ${detail.slice(0, 180)}`);
  }
}

function githubEnv(env) {
  return {
    owner: env.GITHUB_REPO_OWNER,
    repo: env.GITHUB_REPO_NAME,
    branch: env.GITHUB_BRANCH || "main",
    token: env.GITHUB_TOKEN,
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
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
  const clean = String(value || "").replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9\uac00-\ud7a3_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function normalizeBody(value = "") {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function bodyToParagraphs(value = "") {
  const paragraphs = normalizeBody(value)
    .split(/\n\s*\n+/)
    .map((part) => part.replace(/\n+/g, " ").trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs : [normalizeBody(value)];
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(normalizeSpace).filter(Boolean).slice(0, 8);
  const tags = String(value || "")
    .split(/[,\n]/)
    .map(normalizeSpace)
    .filter(Boolean);
  return tags.length ? tags.slice(0, 8) : ["리커버리", "성공사례"];
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function warmRecoveryCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, RECOVERY_SITE_URL, "png"), { method: "GET" }),
    fetch(caseOgImageUrl(slug, RECOVERY_SITE_URL, "webp"), { method: "GET" }),
    fetch(buildLandingUrl(RECOVERY_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: RECOVERY_HOST,
      key,
      keyLocation: `${RECOVERY_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(RECOVERY_GROUP, slug), `${RECOVERY_SITE_URL}/`],
    }),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
