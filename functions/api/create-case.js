import { GROUPS, INDEXNOW_KEY, buildLandingUrl, caseOgImageUrl } from "../_seo.js";
import { normalizeFraudTypeKey } from "../_standardLanding.js";

const DEFAULT_CATEGORY = "형사대응";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const caseName = normalizeSpace(body.caseName);
    const slug = normalizeSpace(body.slug);
    const category = DEFAULT_CATEGORY;
    const summary = normalizeSpace(body.summary);
    const landings = body.landings && typeof body.landings === "object" ? body.landings : null;
    const tags = Array.isArray(body.tags) ? body.tags.map(normalizeSpace).filter(Boolean) : [];
    const landingViews = Number.isInteger(body.landingViews) ? body.landingViews : randomInt(140, 8000, slug);
    const reports = Number.isInteger(body.reports) ? body.reports : randomInt(4, 34, `${slug}-reports`);
    const fraudType = normalizeFraudTypeKey(body.fraudType || body.scamType, { caseName, slug, summary });

    if (!caseName || !slug || !summary) {
      return json({ ok: false, message: "필수 입력값이 누락되었습니다." }, 400);
    }

    if (!hasRequiredLandingData(landings)) {
      return json({
        ok: false,
        message: "AI 원고 데이터가 누락되었습니다. AI 원고 생성을 먼저 실행해주세요.",
      }, 400);
    }

    const now = today();
    const newCase = {
      slug,
      caseName,
      category,
      landingViews,
      reports,
      createdAt: normalizeSpace(body.createdAt) || now,
      updatedAt: normalizeSpace(body.updatedAt) || now,
      summary,
      tags,
      fraudType,
      landings,
    };

    if (env.CASES) {
      const existingRaw = await env.CASES.get(`case:${slug}`);
      if (existingRaw) {
        return json({ ok: false, message: "이미 존재하는 slug입니다." }, 409);
      }

      const idxRaw = await env.CASES.get("cases:index");
      const idx = idxRaw ? JSON.parse(idxRaw) : [];
      const similarCase = findTooSimilarCase({ caseName, slug, cases: idx });

      if (similarCase) {
        return json({
          ok: false,
          message: "유사하거나 중복된 사건이 감지되었습니다. 기존 사건과 별도 사건인지 확인해주세요.",
          similarCase,
        }, 409);
      }

      await env.CASES.put(`case:${slug}`, JSON.stringify(newCase));
      idx.push(buildIndexEntry(newCase));
      await env.CASES.put("cases:index", JSON.stringify(idx));

      // GitHub에도 동기화 — KV 전체를 덮어쓰는 방식으로 race condition 방지
      const repoOwner = env.GITHUB_REPO_OWNER;
      const repoName = env.GITHUB_REPO_NAME;
      const branch = env.GITHUB_BRANCH || "main";
      const token = env.GITHUB_TOKEN;
      if (repoOwner && repoName && token) {
        context.waitUntil?.(syncAllCasesToGitHub(env, repoOwner, repoName, branch, token).catch(() => {}));
      }

      const indexNowKey = env.INDEXNOW_KEY || INDEXNOW_KEY;
      // warmLandingCaches 완료 후 pingIndexNow — Naver가 크롤할 때 og:image가 CDN에 캐시된 상태 보장
      context.waitUntil?.(
        warmLandingCaches(slug)
          .catch(() => {})
          .then(() => pingIndexNow(slug, indexNowKey).catch(() => {})),
      );

      return json({
        ok: true,
        message: "사건이 저장되었습니다.",
        case: newCase,
        storage: "kv+github",
      });
    }

    const repoOwner = env.GITHUB_REPO_OWNER;
    const repoName = env.GITHUB_REPO_NAME;
    const branch = env.GITHUB_BRANCH || "main";
    const token = env.GITHUB_TOKEN;

    const filePath = "data/cases.json";
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
    const currentRes = await fetch(apiUrl, {
      headers: githubHeaders(token),
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
        githubError: errorText,
      }, 500);
    }

    const currentFile = await currentRes.json();
    const currentContent = await readFileContent(currentFile, token);
    const cases = currentContent ? JSON.parse(currentContent) : [];

    if (cases.some((item) => item.slug === slug)) {
      return json({ ok: false, message: "이미 존재하는 slug입니다." }, 409);
    }

    const similarCase = findTooSimilarCase({ caseName, slug, cases });

    if (similarCase) {
      return json({
        ok: false,
        message: "유사하거나 중복된 사건이 감지되었습니다. 기존 사건과 별도 사건인지 확인해주세요.",
        similarCase,
      }, 409);
    }

    cases.push(newCase);

    const newContent = JSON.stringify(cases, null, 2);
    const updateRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: `Add case ${caseName}`,
        content: encodeBase64(newContent),
        sha: currentFile.sha,
        branch,
      }),
    });

    if (!updateRes.ok) {
      const detail = await updateRes.text();
      return json({ ok: false, message: "GitHub 저장 실패", detail }, 500);
    }

    const indexNowKey = env.INDEXNOW_KEY || INDEXNOW_KEY;
    // warmLandingCaches 완료 후 pingIndexNow — Naver가 크롤할 때 og:image가 CDN에 캐시된 상태 보장
    context.waitUntil?.(
      warmLandingCaches(slug)
        .catch(() => {})
        .then(() => pingIndexNow(slug, indexNowKey).catch(() => {})),
    );

    return json({
      ok: true,
      message: "사건이 저장되었습니다.",
      case: newCase,
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function syncAllCasesToGitHub(env, owner, repo, branch, token) {
  // cases:index(메타데이터)만 GitHub에 저장 — landings는 KV 전용
  if (!env.CASES) return;
  const idxRaw = await env.CASES.get("cases:index");
  if (!idxRaw) return;
  const full = JSON.parse(idxRaw).filter((e) => e.slug);
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

function buildIndexEntry(c) {
  const entry = {
    slug: c.slug, caseName: c.caseName || "", category: c.category || "",
    createdAt: c.createdAt || "", updatedAt: c.updatedAt || "",
    thumbnailUrl: c.thumbnailUrl || "", landingViews: c.landingViews || 0,
    reports: c.reports || 0, summary: c.summary || "", tags: c.tags || [], memo: c.memo || "",
    noindex: c.noindex || false,
    targetGroups: c.targetGroups || [], createdBy: c.createdBy || "", fraudType: c.fraudType || "",
  };
  if (c.listingPath) entry.listingPath = c.listingPath;
  if (c.publicPath) entry.publicPath = c.publicPath;
  if (c.listingUrl) entry.listingUrl = c.listingUrl;
  if (c.hideFromListing) entry.hideFromListing = true;
  if (c.searchHidden) entry.searchHidden = true;
  return entry;
}

async function warmLandingCaches(slug) {
  await Promise.allSettled(
    GROUPS.filter((g) => (g.landingKey || g.key) === "a").flatMap((group) => [
      fetch(caseOgImageUrl(slug, group.siteUrl), { method: "GET" }),
      fetch(buildLandingUrl(group, slug), { method: "GET" }),
    ]),
  );
}

async function pingIndexNow(slug, key) {
  const results = await Promise.allSettled(
    GROUPS.filter((g) => (g.landingKey || g.key) === "a").map(async (group) => {
      const host = group.host || new URL(group.siteUrl).host;
      const urlList = [buildLandingUrl(group, slug), `${group.siteUrl}/`];
      const response = await fetch("https://searchadvisor.naver.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${group.siteUrl}/${key}.txt`,
          urlList,
        }),
      });
      const body = await response.text().catch(() => "");
      return { host, status: response.status, ok: response.ok, body: body.slice(0, 160) };
    })
  );

  console.log("[indexnow]", JSON.stringify(results.map((result) => (
    result.status === "fulfilled"
      ? result.value
      : { ok: false, error: result.reason?.message || String(result.reason) }
  ))));

  return results;
}

function hasRequiredLandingData(landings) {
  if (!landings) return false;

  return ["a"].every((key) => {
    const item = landings[key];
    return item &&
      item.title &&
      item.description &&
      item.canonical &&
      item.ogTitle &&
      item.ogDescription &&
      item.ogImage &&
      item.h1 &&
      Array.isArray(item.body) &&
      Array.isArray(item.victimCases) &&
      Array.isArray(item.faq) &&
      item.schema;
  });
}

function findTooSimilarCase({ caseName, slug, cases }) {
  const normalizedName = normalizeForCompare(caseName);
  const normalizedSlug = normalizeForCompare(slug);

  for (const item of cases) {
    const existingName = String(item.caseName || item.name || "");
    const existingSlug = String(item.slug || "");
    const score = Math.max(
      similarity(normalizedName, normalizeForCompare(existingName)),
      similarity(normalizedSlug, normalizeForCompare(existingSlug))
    );

    if (score >= 0.9) {
      return {
        slug: existingSlug,
        caseName: existingName,
        score: Number(score.toFixed(2)),
      };
    }
  }

  return null;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size || 1;

  return intersection / union;
}

function tokenSet(value) {
  const compact = normalizeForCompare(value);
  const chunks = compact.split(/[\s-]+/).filter(Boolean);
  const grams = [];

  for (const chunk of chunks) {
    if (chunk.length <= 2) {
      grams.push(chunk);
      continue;
    }

    for (let index = 0; index < chunk.length - 1; index += 1) {
      grams.push(chunk.slice(index, index + 2));
    }
  }

  return new Set(grams);
}

function normalizeForCompare(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/\.(com|net|org|co|kr|vip|shop|site|store|io)/g, "")
    .replace(/사기|사칭|피해|투자|리딩방|거래소|증권|주식|코인/g, "")
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim();
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

function normalizeSpace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
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
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
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
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
