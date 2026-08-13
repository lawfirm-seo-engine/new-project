import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";
import { appendStockReadingroomCta } from "../_stockReadingroomCta.js";
import { classifyLdCategory, isValidLdCategoryKey } from "../_readingroomCategory.js";
import {
  buildFromTemplate as buildReadingroomBodyFromTemplate,
  generateReadingroomMeta,
  parseReadingroomTitleParts,
} from "../_readingroomTemplate.js";
import { durableCaseIndexFields, mergeDurableFieldsFromExisting } from "../_durableCaseFields.js";

const GITHUB_FILE_PATH = "data/cases.json";
const LD_HOST = "xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr";
const LD_SITE_URL = "https://리딩방피해회수센터.kr";
const LD_GROUP = GROUPS.find((group) => group.host === LD_HOST);
const TARGET_GROUPS = ["ld"];
const CREATED_BY = "readingroom-manual";
const READINGROOM_TYPE_TITLE_RULES = {
  "stock-reading-room": { suffix: "사칭 사기 주식·투자 리딩방 피해회복 안내", label: "주식리딩방사기", ldCategory: "stock-reading" },
  "stock-reading": { suffix: "사칭 사기 주식·투자 리딩방 피해회복 안내", label: "주식리딩방사기", ldCategory: "stock-reading" },
  "coin-reading-room": { suffix: "사칭 사기 코인리딩방 피해회복 안내", label: "코인리딩방사기", ldCategory: "coin-reading" },
  "coin-reading": { suffix: "사칭 사기 코인리딩방 피해회복 안내", label: "코인리딩방사기", ldCategory: "coin-reading" },
  "platform-impersonation": { suffix: "사칭 사기 리딩방 피해회복 안내", label: "증권사·투자사·플랫폼 사칭 사기", ldCategory: "institution-impersonation" },
  "institution-impersonation": { suffix: "사칭 사기 리딩방 피해회복 안내", label: "증권사·투자사·플랫폼 사칭 사기", ldCategory: "institution-impersonation" },
  "trading-app": { suffix: "사칭 사기 리딩방 피해회복 안내", label: "HTS·MTS·어플", ldCategory: "hts-mts-app" },
  "hts-mts-app": { suffix: "사칭 사기 리딩방 피해회복 안내", label: "HTS·MTS·어플", ldCategory: "hts-mts-app" },
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const requestedTitle = buildRequestedReadingroomTitle(body.caseName || body.subject, body.type || body.readingRoomType);
    const title = requestedTitle || normalizeSpace(body.title);
    const slug = normalizeSlug(body.slug || title);
    const isPreview = body.preview === true;

    if (!title || !slug) {
      return json({ ok: false, message: "페이지 제목은 필수입니다." }, 400);
    }

    const { caseKeyword, subject, channelType } = parseReadingroomTitleParts(title);
    const generatedBody = appendStockReadingroomCta(buildReadingroomBodyFromTemplate(title, caseKeyword, channelType));
    const generatedMeta = generateReadingroomMeta(caseKeyword, channelType);
    const suggestedLdCategory = classifyLdCategory(`${title} ${subject}`);
    const requestedLdCategory = readingroomTypeRule(body.type || body.readingRoomType)?.ldCategory;
    const ldCategory = isValidLdCategoryKey(body.ldCategory)
      ? body.ldCategory
      : (requestedLdCategory || suggestedLdCategory);

    if (isPreview) {
      return json({
        ok: true,
        body: generatedBody,
        title,
        subject,
        caseKeyword,
        channelType,
        suggestedLdCategory: ldCategory,
        typeLabel: readingroomTypeRule(body.type || body.readingRoomType)?.label || channelType,
      });
    }

    const rawBody = body.body;
    const confirmedBody = appendStockReadingroomCta(Array.isArray(rawBody) && rawBody.length
      ? rawBody
      : typeof rawBody === "string" && rawBody.trim()
        ? rawBody.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : generatedBody);

    const summary = normalizeSpace(body.summary).slice(0, 180) || generatedMeta.summary;
    const imageAlt = normalizeSpace(body.imageAlt).slice(0, 160) || generatedMeta.imageAlt;
    const imageCaption = normalizeSpace(body.imageCaption).slice(0, 220) || generatedMeta.imageCaption;
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300) || generatedMeta.imageDescription;

    const existing = await loadExisting(env, slug);
    const isOwnReadingroomCase = !existing || existing.createdBy === CREATED_BY;

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(LD_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, LD_SITE_URL, "png"),
      h1: title,
      ...(imageAlt ? { imageAlt } : {}),
      ...(imageCaption ? { imageCaption } : {}),
      ...(imageDescription ? { imageDescription } : {}),
      body: confirmedBody,
      victimCases: [],
      suspiciousCompanies: [],
      faq: [],
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
    };

    const item = {
      ...(existing || {}),
      slug,
      caseName: isOwnReadingroomCase ? title : existing.caseName,
      category: isOwnReadingroomCase ? "주식리딩방사기 랜딩" : existing.category,
      createdBy: isOwnReadingroomCase ? CREATED_BY : existing.createdBy,
      targetGroups: isOwnReadingroomCase ? TARGET_GROUPS : (existing.targetGroups || []),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary: isOwnReadingroomCase ? summary : existing.summary,
      tags: isOwnReadingroomCase ? ["주식리딩방사기", "코인리딩방사기", "출금거부", "피해금회수", "법무법인선린"] : (existing.tags || []),
      landings: { ...(existing?.landings || {}), ld: landing },
      ldCategory: isOwnReadingroomCase ? ldCategory : (existing.ldCategory || ldCategory),
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} readingroom landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmLdCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "리딩방 랜딩이 갱신되었습니다." : "리딩방 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(LD_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} readingroom landing ${slug}`);
    return json({
      ok: true,
      message: existing ? "리딩방 랜딩이 갱신되었습니다." : "리딩방 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(LD_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}


function buildRequestedReadingroomTitle(subjectValue = "", typeValue = "") {
  const subject = cleanReadingroomSubject(subjectValue);
  const rule = readingroomTypeRule(typeValue);
  if (!subject || !rule) return "";
  return `${subject} ${rule.suffix}`.replace(/\s+/g, " ").trim();
}

function readingroomTypeRule(value = "") {
  const key = String(value || "").trim();
  return READINGROOM_TYPE_TITLE_RULES[key] || null;
}

function cleanReadingroomSubject(value = "") {
  return normalizeSpace(value)
    .replace(/\s*(?:사칭\s*사기\s*)?(?:주식[·ㆍ]?투자\s*)?리딩방\s*피해회복\s*안내\s*$/i, "")
    .replace(/\s*(?:사칭\s*사기\s*)?코인리딩방\s*피해회복\s*안내\s*$/i, "")
    .replace(/\s*사칭\s*사기\s*리딩방\s*피해회복\s*안내\s*$/i, "")
    .replace(/\s*(?:사칭\s*사기|사칭|사기)\s*$/i, "")
    .trim();
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
  const ldLanding = item.landings?.ld;
  const readingroomLanding = item.createdBy === CREATED_BY || ldLanding?.createdBy === CREATED_BY
    ? {
        createdBy: CREATED_BY,
        title: ldLanding?.title || item.caseName || "",
        h1: ldLanding?.h1 || ldLanding?.title || item.caseName || "",
        description: ldLanding?.description || item.summary || "",
        canonical: ldLanding?.canonical || buildLandingUrl(LD_GROUP, item.slug),
      }
    : null;

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
    hideFromListing: item.hideFromListing || false,
    searchHidden: item.searchHidden || false,
    targetGroups: item.targetGroups || [],
    createdBy: item.createdBy || "",
    ...durableCaseIndexFields(item),
    ...(item.ldCategory ? { ldCategory: item.ldCategory } : {}),
    ...(readingroomLanding ? { hasReadingroomLanding: true, landings: { ld: readingroomLanding } } : {}),
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
  if (getRes.ok) {
    const fileInfo = await getRes.json();
    sha = fileInfo.sha;
    mergeDurableFieldsFromExisting(list, JSON.parse(await readFileContent(fileInfo, token) || "[]"));
  }
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

async function warmLdCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, LD_SITE_URL, "png"), { method: "GET" }),
    fetch(caseOgImageUrl(slug, LD_SITE_URL, "webp"), { method: "GET" }),
    fetch(buildLandingUrl(LD_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: LD_HOST,
      key,
      keyLocation: `${LD_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(LD_GROUP, slug), `${LD_SITE_URL}/`],
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
