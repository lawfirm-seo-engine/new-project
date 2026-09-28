// 검색엔진 색인 큐: gnlaw-criminal.co.kr / gnlaw-recovery.co.kr 랜딩페이지를
// 네이버 서치어드바이저(IndexNow, 즉시 서버에서 처리)와 구글 서치콘솔
// (로컬 PC의 Playwright 도구가 처리) 색인 요청 대상으로 등록·추적한다.
//
// 사람이 로그인하는 admin_session 쿠키(6시간 만료)는 예약 스캐너·로컬 도구처럼
// 오래 도는 프로세스에 맞지 않아, 이 엔드포인트는 별도의 장기 토큰
// (Authorization: Bearer <INDEX_QUEUE_TOKEN>)으로 인증한다.
//
// "scan" action은 Cloudflare 자체 Cron Trigger(별도의 workers/index-queue-cron
// 워커)가 주기적으로 호출한다. GitHub Actions에 의존하던 예전 스케줄러
// (scripts/scan-index-queue.js + .github/workflows/index-queue-scan.yml)는
// 수동 실행/백업 용도로만 남겨둔다.

import { GROUPS, buildLandingUrl, isCaseAllowedForGroup } from "../_seo.js";

const ITEM_PREFIX = "index-queue:item:";
const INDEX_KEY = "index-queue:index:v1";
const MAX_INDEX_ENTRIES = 5000;
const INDEXNOW_KEY = "6f71f78a3dc940b9a3e1025bf8460d3c";
const NAVER_INDEXNOW = "https://searchadvisor.naver.com/indexnow";
const CASES_INDEX_KEY = "cases:index";
const SCAN_CURSOR_KEY = "index-queue:scan-cursor:v1";

const ALLOWED_HOSTS = new Set(["gnlaw-criminal.co.kr", "gnlaw-recovery.co.kr"]);
const TARGET_SITE_URLS = new Set(["https://gnlaw-criminal.co.kr", "https://gnlaw-recovery.co.kr"]);
const REPORT_STATUSES = new Set(["requested", "indexed", "failed", "quota-exceeded"]);
// Cloudflare Function 실행시간 한도 안에서 안전하게 끝나도록, 한 번의 scan 호출은
// 전체 후보 중 일부(BATCH_SIZE)만 훑는다. 후보를 URL 문자열로 정렬해 커서(마지막으로
// 처리한 URL)를 KV에 저장해두고, 다음 호출은 그 다음부터 이어서 훑는다(끝까지
// 가면 처음으로 순환) — 새 사건이 추가/삭제돼 목록이 바뀌어도 커서 의미가 흔들리지
// 않는다. 그중에서도 실제 라이브 점검이 필요한 "신규" URL은 MAX_NEW_PER_SCAN으로
// 한 번 더 제한한다(이미 큐에 있는 URL은 빠른 KV 조회 한 번으로 끝나 이 한도에
// 포함되지 않는다).
const BATCH_SIZE = 150;
// 신규 URL 하나당 라이브 점검(페이지+sitemap fetch, 네이버 IndexNow 호출)이 실측
// 몇 초씩 걸릴 수 있어(외부 사이트 자체가 느릴 수 있음) 보수적으로 낮게 잡는다.
// 한도에 걸린 나머지는 다음 Cron 호출(15분 뒤)이 커서 그대로 이어받아 처리한다.
const MAX_NEW_PER_SCAN = 8;

export async function onRequestGet({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    if (!authorized(request, env)) return json({ ok: false, message: "인증이 필요합니다." }, 401);

    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    if (id) {
      const item = await loadItem(env, id);
      if (!item) return json({ ok: false, message: "항목을 찾을 수 없습니다." }, 404);
      return json({ ok: true, item });
    }

    const status = url.searchParams.get("status") || "";
    const index = await loadIndex(env);
    const filtered = status ? index.filter((entry) => entry.status === status) : index;
    return json({ ok: true, items: filtered, total: index.length });
  } catch (error) {
    return json({ ok: false, message: error?.message || "큐를 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    if (!authorized(request, env)) return json({ ok: false, message: "인증이 필요합니다." }, 401);

    const body = await request.json().catch(() => null);
    const action = String(body?.action || "");

    if (action === "enqueue") return json(await enqueue(env, body));
    if (action === "report") return json(await report(env, body));
    if (action === "scan") return json(await scan(env));
    return json({ ok: false, message: "지원하지 않는 action입니다." }, 400);
  } catch (error) {
    return json({ ok: false, message: error?.message || "요청을 처리하지 못했습니다." }, 500);
  }
}

function authorized(request, env) {
  const expected = String(env.INDEX_QUEUE_TOKEN || "");
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return timingSafeEqual(match[1].trim(), expected);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function enqueue(env, body) {
  const rawUrl = String(body?.url || "").trim();
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, message: "URL이 올바르지 않습니다." };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, message: `허용되지 않은 도메인입니다: ${parsed.hostname}` };
  }
  const canonicalUrl = parsed.href;
  const id = await hashId(canonicalUrl);

  const existing = await loadItem(env, id);
  if (existing) return { ok: true, item: existing, created: false };

  // 라이브 점검은 반드시 "새로 큐에 넣는" 이 경로에서만, Cloudflare 자체 네트워크로 한 번만
  // 실행한다. 예전 버전은 스캐너(GitHub Actions)가 매 실행마다 이미 등록된 URL까지 포함해
  // 수천 건을 직접 라이브로 다시 점검했는데, 그 대량·고속 순차 요청 패턴이 봇 트래픽으로
  // 오인되어 사이트 자체에서 403으로 막히는 문제가 있었다.
  const checks = await runChecks(canonicalUrl);
  if (!checks.pass) return { ok: true, created: false, rejected: true, reason: checks.reason };

  const now = new Date().toISOString();
  const naver = await pingNaverIndexNow(parsed.hostname, canonicalUrl).catch((error) => ({
    ok: false,
    message: error?.message || String(error),
  }));

  const item = {
    id,
    url: canonicalUrl,
    host: parsed.hostname,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    checkedAt: now,
    checks: checks.detail,
    naverStatus: naver.ok ? "submitted" : "failed",
    naverRespondedAt: now,
    naverMessage: naver.message || "",
    requestedAt: "",
    indexedAt: "",
    message: "",
  };
  await saveItem(env, item);
  return { ok: true, item, created: true };
}

async function runChecks(url) {
  const pageRes = await fetch(url, { redirect: "manual" }).catch((error) => ({ error }));
  if (pageRes?.error) return { pass: false, reason: `요청 실패: ${pageRes.error.message}` };
  if (pageRes.status !== 200) return { pass: false, reason: `HTTP ${pageRes.status}` };

  const html = await pageRes.text();

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonicalHref = canonicalMatch?.[1] || "";
  if (!canonicalHref || normalizeCheckUrl(canonicalHref) !== normalizeCheckUrl(url)) {
    return { pass: false, reason: `canonical 불일치: ${canonicalHref || "(없음)"}` };
  }

  const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robotsContent = (robotsMatch?.[1] || "").toLowerCase();
  if (robotsContent.includes("noindex")) {
    return { pass: false, reason: `robots noindex: ${robotsContent}` };
  }

  const siteUrl = new URL(url).origin;
  const inSitemap = await urlInSitemap(siteUrl, url);
  if (!inSitemap) return { pass: false, reason: "sitemap에 없음" };

  return { pass: true, detail: { http200: true, canonical: true, robotsIndex: true, sitemap: true } };
}

async function urlInSitemap(siteUrl, url) {
  for (const sitemapPath of ["/sitemap-recent.xml", "/sitemap.xml"]) {
    try {
      const res = await fetch(`${siteUrl}${sitemapPath}`);
      if (!res.ok) continue;
      const xml = await res.text();
      if (xml.includes(url)) return true;
    } catch {
      // 다음 sitemap으로 계속 시도
    }
  }
  return false;
}

function normalizeCheckUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function report(env, body) {
  const id = String(body?.id || "");
  const status = String(body?.status || "");
  if (!id) return { ok: false, message: "id가 필요합니다." };
  if (!REPORT_STATUSES.has(status)) return { ok: false, message: "status 값이 올바르지 않습니다." };

  const item = await loadItem(env, id);
  if (!item) return { ok: false, message: "항목을 찾을 수 없습니다." };

  const now = new Date().toISOString();
  const next = {
    ...item,
    status,
    updatedAt: now,
    message: String(body?.message || "").slice(0, 500),
    requestedAt: status === "requested" ? now : item.requestedAt,
    indexedAt: status === "indexed" ? now : item.indexedAt,
  };
  await saveItem(env, next);
  return { ok: true, item: next };
}

async function scan(env) {
  const targetGroups = GROUPS.filter((group) => TARGET_SITE_URLS.has(group.siteUrl));
  const cases = (await env.CASES.get(CASES_INDEX_KEY, "json").catch(() => null)) || [];

  const candidates = new Set();
  for (const group of targetGroups) {
    for (const item of cases) {
      if (item?.slug && isCaseAllowedForGroup(item, group)) {
        candidates.add(buildLandingUrl(group, item.slug));
      }
    }
  }
  const sorted = [...candidates].sort();
  if (!sorted.length) {
    return { ok: true, totalCandidates: 0, examined: 0, registered: 0, alreadyQueued: 0, rejected: 0, errors: 0 };
  }

  const cursor = String((await env.CASES.get(SCAN_CURSOR_KEY)) || "");
  let startIndex = sorted.findIndex((url) => url > cursor);
  if (startIndex < 0) startIndex = 0; // 끝까지 갔으면 처음으로 순환

  // 커서는 "실제로 끝까지 처리(기존 확인 또는 신규 등록/거절/오류)한 마지막 URL"까지만
  // 진행한다. MAX_NEW_PER_SCAN 한도에 걸려 건너뛴 URL이 있으면 거기서 멈춰, 다음 호출이
  // 그 URL부터 그대로 재시도한다 — 신규 URL이 한도를 넘겨도 뒤로 밀려 누락되지 않는다.
  const results = { registered: 0, alreadyQueued: 0, rejected: 0, errors: 0 };
  let newCount = 0;
  let examined = 0;
  let lastResolvedUrl = cursor;

  for (; examined < BATCH_SIZE && examined < sorted.length; examined += 1) {
    const url = sorted[(startIndex + examined) % sorted.length];
    const id = await hashId(url);
    const existing = await loadItem(env, id);
    if (existing) {
      results.alreadyQueued += 1;
      lastResolvedUrl = url;
      continue;
    }
    if (newCount >= MAX_NEW_PER_SCAN) break;
    newCount += 1;
    try {
      const result = await enqueue(env, { url });
      if (!result.ok) results.errors += 1;
      else if (result.rejected) results.rejected += 1;
      else if (result.created) results.registered += 1;
    } catch {
      results.errors += 1;
    }
    lastResolvedUrl = url;
  }
  await env.CASES.put(SCAN_CURSOR_KEY, lastResolvedUrl);

  return { ok: true, totalCandidates: sorted.length, examined, ...results };
}

async function pingNaverIndexNow(host, targetUrl) {
  const siteUrl = `https://${host}`;
  const res = await fetch(NAVER_INDEXNOW, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
      urlList: [targetUrl],
    }),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.status >= 200 && res.status < 300, message: `HTTP ${res.status} ${text.slice(0, 120)}` };
}

async function hashId(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function loadItem(env, id) {
  return env.CASES.get(`${ITEM_PREFIX}${id}`, "json");
}

async function saveItem(env, item) {
  await env.CASES.put(`${ITEM_PREFIX}${item.id}`, JSON.stringify(item));
  await updateIndex(env, item);
  return item;
}

async function loadIndex(env) {
  return (await env.CASES.get(INDEX_KEY, "json").catch(() => null)) || [];
}

async function updateIndex(env, item) {
  const index = await loadIndex(env);
  const entry = { id: item.id, url: item.url, host: item.host, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt };
  const next = [entry, ...index.filter((existing) => existing.id !== item.id)].slice(0, MAX_INDEX_ENTRIES);
  await env.CASES.put(INDEX_KEY, JSON.stringify(next));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
