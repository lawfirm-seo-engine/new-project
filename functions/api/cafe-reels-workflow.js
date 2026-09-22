const JOB_PREFIX = "cafe-reels:job:";
const INDEX_KEY = "cafe-reels:jobs:index:v1";
const SETTINGS_PATH = "data/settings.json";
const NAVER_TOKEN_KEY = "naver-cafe:oauth:v1";
const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";

export async function onRequestGet({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    const url = new URL(request.url);
    const jobId = safeId(url.searchParams.get("jobId") || "");
    if (jobId) {
      const job = await loadJob(env, jobId);
      if (!job) return json({ ok: false, message: "작업을 찾을 수 없습니다." }, 404);
      return json({ ok: true, job });
    }
    return json({ ok: true, jobs: await loadIndex(env) });
  } catch (error) {
    return json({ ok: false, message: error?.message || "작업을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "save-job");

    if (action === "save-job") {
      const job = await saveJob(env, buildJob(body));
      return json({ ok: true, job, message: "카페 원고·이미지·릴스 작업이 저장되었습니다." });
    }

    if (action === "prepare-cafe") {
      const job = await requireJob(env, body?.jobId);
      const publish = await publishNaverCafe(env, job);
      const next = await saveJob(env, {
        ...job,
        cafeStatus: publish.ok ? "posted" : publish.status,
        cafeUrl: publish.cafeUrl || job.cafeUrl || "",
        naverArticleId: publish.articleId || job.naverArticleId || "",
        naverUploadError: publish.ok ? "" : publish.message,
        cafePreparedAt: new Date().toISOString(),
        caption: buildCaption({ ...job, cafeUrl: publish.cafeUrl || job.cafeUrl || "" }),
      });
      return json({
        ok: true,
        job: next,
        message: publish.message,
      });
    }

    if (action === "set-cafe-url") {
      const job = await requireJob(env, body?.jobId);
      const cafeUrl = normalizeHttpUrl(body?.cafeUrl);
      if (!cafeUrl) return json({ ok: false, message: "카페 게시글 URL을 입력해주세요." }, 400);
      const next = await saveJob(env, {
        ...job,
        cafeUrl,
        cafeStatus: "posted",
        caption: buildCaption({ ...job, cafeUrl }),
      });
      return json({ ok: true, job: next, message: "카페 게시글 URL이 저장되었습니다." });
    }

    if (action === "set-video") {
      const job = await requireJob(env, body?.jobId);
      const videoUrl = normalizeHttpUrl(body?.videoUrl);
      if (!videoUrl) return json({ ok: false, message: "공개 접근 가능한 영상 URL이 필요합니다." }, 400);
      const next = await saveJob(env, {
        ...job,
        videoUrl,
        videoKey: String(body?.videoKey || job.videoKey || "").slice(0, 300),
        videoStatus: "ready",
        caption: buildCaption({ ...job, videoUrl }),
      });
      return json({ ok: true, job: next, message: "릴스 영상 URL이 저장되었습니다." });
    }

    if (action === "mark-instagram-ready") {
      const job = await requireJob(env, body?.jobId);
      const caption = normalizeCaption(body?.caption || job.caption || buildCaption(job));
      const next = await saveJob(env, {
        ...job,
        caption,
        instagramStatus: "ready-for-manual-upload",
      });
      return json({
        ok: true,
        job: next,
        message: "릴스 업로드용 영상 URL과 캡션이 준비되었습니다. 외부 계정 자동 게시 기능은 별도 승인과 계정 설정 후 연결할 수 있습니다.",
      });
    }

    return json({ ok: false, message: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    return json({ ok: false, message: error?.message || "작업 처리에 실패했습니다." }, 500);
  }
}

function buildJob(body = {}) {
  const now = new Date().toISOString();
  const id = safeId(body.jobId || crypto.randomUUID());
  const draft = body.draft && typeof body.draft === "object" ? body.draft : {};
  const caseName = normalizeText(body.caseName || draft.caseName || "");
  const fraudType = normalizeText(body.fraudType || draft.fraudType || "");
  if (!caseName) throw new Error("사건명이 필요합니다.");
  if (!draft.title && !body.title) throw new Error("생성된 카페 원고가 필요합니다.");

  const job = {
    id,
    caseName,
    fraudType,
    imageSetKey: normalizeText(body.imageSetKey || "fraud"),
    draft: {
      ...draft,
      title: normalizeText(body.title || draft.title || ""),
      body: String(body.body || draft.body || "").trim(),
    },
    images: sanitizeImages(body.images),
    cafeStatus: "draft-ready",
    cafeUrl: normalizeHttpUrl(body.cafeUrl),
    videoUrl: normalizeHttpUrl(body.videoUrl),
    videoKey: String(body.videoKey || "").slice(0, 300),
    videoStatus: body.videoUrl ? "ready" : "empty",
    instagramStatus: "empty",
    createdAt: now,
    updatedAt: now,
  };
  job.caption = buildCaption(job);
  return job;
}

async function requireJob(env, jobId) {
  const id = safeId(jobId || "");
  const job = await loadJob(env, id);
  if (!job) throw new Error("작업을 찾을 수 없습니다.");
  return job;
}

async function loadJob(env, jobId) {
  if (!jobId) return null;
  return env.CASES.get(`${JOB_PREFIX}${jobId}`, "json");
}

async function saveJob(env, job) {
  const next = { ...job, updatedAt: new Date().toISOString() };
  await env.CASES.put(`${JOB_PREFIX}${next.id}`, JSON.stringify(next));
  await updateIndex(env, next);
  return next;
}

async function updateIndex(env, job) {
  const index = await loadIndex(env);
  const item = {
    id: job.id,
    caseName: job.caseName,
    fraudType: job.fraudType,
    title: job.draft?.title || "",
    cafeStatus: job.cafeStatus || "",
    instagramStatus: job.instagramStatus || "",
    updatedAt: job.updatedAt,
  };
  const next = [item, ...index.filter((entry) => entry.id !== job.id)]
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 80);
  await env.CASES.put(INDEX_KEY, JSON.stringify(next));
}

async function loadIndex(env) {
  return (await env.CASES.get(INDEX_KEY, "json").catch(() => null)) || [];
}

async function publishNaverCafe(env, job) {
  const settings = await loadNaverCafeSettings(env);
  const missing = [];
  if (!env?.CASES) missing.push("KV 바인딩");
  if (!env?.NAVER_CLIENT_ID) missing.push("NAVER_CLIENT_ID");
  if (!env?.NAVER_CLIENT_SECRET) missing.push("NAVER_CLIENT_SECRET");
  if (!settings.naverCafeClubId) missing.push("카페 고유 ID(clubid)");
  if (!settings.naverCafeMenuId) missing.push("게시판 ID(menuid)");

  if (missing.length) {
    return {
      ok: false,
      status: "connection-required",
      message: `네이버 카페 자동 업로드 설정이 필요합니다. 누락: ${missing.join(", ")}. 관리자 설정에서 카페 ID를 저장하고 Cloudflare 시크릿 및 네이버 권한 연결을 완료해주세요.`,
    };
  }

  const token = await getNaverAccessToken(env);
  if (!token.ok) {
    return {
      ok: false,
      status: "connection-required",
      message: token.message,
    };
  }

  const subject = normalizeArticleSubject(job.draft?.title || job.title || `${job.caseName || "사기 피해"} 대응 안내`);
  const content = buildCafeArticleHtml(job);
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("content", content);

  const endpoint = `https://openapi.naver.com/v1/cafe/${encodeURIComponent(settings.naverCafeClubId)}/menu/${encodeURIComponent(settings.naverCafeMenuId)}/articles`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: params,
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }

  if (!res.ok || data.error) {
    return {
      ok: false,
      status: res.status === 401 ? "connection-required" : "upload-failed",
      message: `네이버 카페 업로드 실패 (${res.status}): ${extractNaverError(data, text)}`,
    };
  }

  const result = data.message?.result || data.result || {};
  const articleId = normalizeText(result.articleid || result.articleId || result.articleNo || result.id || "");
  const cafeUrl = normalizeHttpUrl(result.articleUrl || result.articleurl || result.url || buildCafeArticleUrl(settings, articleId));
  return {
    ok: true,
    status: "posted",
    articleId,
    cafeUrl,
    message: cafeUrl
      ? `네이버 카페에 자동 업로드했습니다.\n${cafeUrl}`
      : "네이버 카페에 자동 업로드했습니다. 네이버 응답에 게시글 URL이 없어 글 목록에서 확인해주세요.",
  };
}

async function loadNaverCafeSettings(env) {
  const { repoOwner, repoName, branch, token } = githubEnv(env);
  const res = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${SETTINGS_PATH}?ref=${branch}`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) return {};
  const file = await res.json();
  try {
    const raw = JSON.parse(decodeBase64(file.content));
    return {
      naverCafeClubId: normalizeText(raw.naverCafeClubId || ""),
      naverCafeMenuId: normalizeText(raw.naverCafeMenuId || ""),
      naverCafeSlug: normalizeText(raw.naverCafeSlug || "gnlawfintech") || "gnlawfintech",
    };
  } catch {
    return {};
  }
}

async function getNaverAccessToken(env) {
  const token = await env.CASES.get(NAVER_TOKEN_KEY, "json").catch(() => null);
  if (!token?.accessToken && !token?.refreshToken) {
    return {
      ok: false,
      message: "네이버 카페 권한 연결이 필요합니다. 관리자 설정에서 '네이버 권한 연결'을 먼저 완료해주세요.",
    };
  }
  if (token.accessToken && !isExpired(token.expiresAt)) {
    return { ok: true, accessToken: token.accessToken };
  }
  if (!token.refreshToken) {
    return {
      ok: false,
      message: "네이버 토큰이 만료되었고 갱신 토큰이 없습니다. 관리자 설정에서 네이버 권한 연결을 다시 진행해주세요.",
    };
  }
  return refreshNaverAccessToken(env, token);
}

async function refreshNaverAccessToken(env, token) {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("client_id", env.NAVER_CLIENT_ID || "");
  params.set("client_secret", env.NAVER_CLIENT_SECRET || "");
  params.set("refresh_token", token.refreshToken || "");

  const res = await fetch(`${NAVER_TOKEN_URL}?${params.toString()}`);
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok || data.error || !data.access_token) {
    return {
      ok: false,
      message: `네이버 토큰 갱신 실패 (${res.status}): ${extractNaverError(data, text)}. 관리자 설정에서 네이버 권한 연결을 다시 진행해주세요.`,
    };
  }

  const next = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken || "",
    tokenType: data.token_type || token.tokenType || "bearer",
    expiresAt: expiresAt(data.expires_in),
    refreshedAt: new Date().toISOString(),
  };
  await env.CASES.put(NAVER_TOKEN_KEY, JSON.stringify(next));
  return { ok: true, accessToken: next.accessToken };
}

function buildCafeArticleHtml(job) {
  const bodyHtml = bodyToCafeHtml(job.draft?.body || "");
  const imagesHtml = (job.images || []).map((image) => {
    const imageUrl = absoluteImageUrl(image.url);
    if (!imageUrl) return "";
    const href = normalizeHref(image.href || "") || imageUrl;
    const label = normalizeText(image.label || image.slot || "이미지");
    return `<p><a href="${escapeAttr(href)}" target="_blank" rel="noopener"><img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(label)}"></a></p>`;
  }).filter(Boolean).join("\n");
  return [bodyHtml, imagesHtml].filter(Boolean).join("\n");
}

function bodyToCafeHtml(body) {
  return String(body || "").split(/\r?\n/).map((line) => {
    const text = line.trim();
    if (!text) return "<br>";
    if (/^#{1,3}\s+/.test(text)) return `<p><strong>${inlineCafeText(text.replace(/^#{1,3}\s+/, ""))}</strong></p>`;
    if (/^[-*]\s+/.test(text)) return `<p>• ${inlineCafeText(text.replace(/^[-*]\s+/, ""))}</p>`;
    if (/^\d+\.\s+/.test(text)) return `<p>${inlineCafeText(text)}</p>`;
    return `<p>${inlineCafeText(text)}</p>`;
  }).join("\n");
}

function inlineCafeText(text) {
  const source = String(text || "");
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let html = "";
  let last = 0;
  for (const match of source.matchAll(linkRe)) {
    html += linkBareUrls(escapeHtml(source.slice(last, match.index)));
    html += `<a href="${escapeAttr(match[2])}" target="_blank" rel="noopener">${escapeHtml(match[1])}</a>`;
    last = match.index + match[0].length;
  }
  html += linkBareUrls(escapeHtml(source.slice(last)));
  return html;
}

function linkBareUrls(html) {
  return html.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${url}</a>`);
}

function normalizeArticleSubject(value) {
  return normalizeText(value).slice(0, 120) || "법무법인 선린 금융사기 피해 대응 안내";
}

function buildCafeArticleUrl(settings, articleId) {
  if (!articleId) return "";
  const slug = settings.naverCafeSlug || "gnlawfintech";
  return `https://cafe.naver.com/${encodeURIComponent(slug)}/${encodeURIComponent(articleId)}`;
}

function absoluteImageUrl(value = "") {
  const text = String(value || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return new URL(text, "https://gnlaw-criminal.co.kr").toString();
  return "";
}

function isExpired(value) {
  if (!value) return false;
  return new Date(value).getTime() - Date.now() < 120000;
}

function expiresAt(seconds) {
  const ttl = Math.max(0, Number(seconds || 0) - 60);
  return new Date(Date.now() + ttl * 1000).toISOString();
}

function extractNaverError(data, fallback) {
  return data.error_description || data.errorMessage || data.message?.error || data.error || String(fallback || "").slice(0, 300) || "알 수 없는 오류";
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

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.slice(0, 30).map((item) => ({
    slot: normalizeText(item?.slot || ""),
    label: normalizeText(item?.label || ""),
    url: normalizeHttpOrRelativeImage(item?.url || ""),
    href: normalizeHref(item?.href || ""),
  })).filter((item) => item.slot && item.url);
}

function buildCaption(job = {}) {
  const title = normalizeText(job.draft?.title || job.title || `${job.caseName || "사기 피해"} 대응 안내`);
  const cafeUrl = normalizeHttpUrl(job.cafeUrl || "");
  return normalizeCaption([
    title,
    "",
    "피해 정황과 입금 자료를 보존한 뒤 법률 대응 가능성을 확인하세요.",
    cafeUrl ? `자세한 내용: ${cafeUrl}` : "",
    "",
    "#법무법인선린 #사기피해 #금융사기 #피해회복",
  ].filter(Boolean).join("\n"));
}

function normalizeCaption(value = "") {
  return String(value || "").trim().slice(0, 2200);
}

function normalizeText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 180);
}

function normalizeHttpUrl(value = "") {
  const text = String(value || "").trim().slice(0, 1000);
  return /^https?:\/\//i.test(text) ? text : "";
}

function normalizeHttpOrRelativeImage(value = "") {
  const text = String(value || "").trim().slice(0, 1000);
  return /^(https?:\/\/|\/api\/criminal-board-image\?id=)/i.test(text) ? text : "";
}

function normalizeHref(value = "") {
  const text = String(value || "").trim().slice(0, 1000);
  return /^(https?:\/\/|tel:|mailto:)/i.test(text) ? text : "";
}

function safeId(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
