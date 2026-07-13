import { OG_IMAGE_VERSION } from "./_seo.js";

export const BOARD_HOST = "gnlaw-center.co.kr";
export const BOARD_PREFIX = "board";
export const BOARD_SITE_URL = "https://gnlaw-center.co.kr";
export const BOARD_INDEX_KEY = "center-board:index";
export const BOARD_POST_KEY_PREFIX = "center-board:post:";
export const BOARD_REFRESHED_AT = "2026-07-11";

const DEFAULT_OG_IMAGE = `${BOARD_SITE_URL}/assets/og-template.webp`;

export function isBoardHost(host = "") {
  return String(host || "").toLowerCase() === BOARD_HOST;
}

export function boardListUrl() {
  return `${BOARD_SITE_URL}/${BOARD_PREFIX}/`;
}

export function boardPostUrl(slug = "") {
  return `${BOARD_SITE_URL}/${BOARD_PREFIX}/${encodeURIComponent(normalizeSlug(slug))}/`;
}

export function boardTitle(post = {}) {
  return normalizeSpace(post.seoTitle) || normalizeSpace(post.title) || "사기피해 통합 허브 게시글";
}

export function boardDescription(post = {}) {
  return normalizeSpace(post.metaDescription) || normalizeSpace(post.excerpt) || createExcerpt(post.body, 150);
}

export function boardImageUrl(post = {}) {
  const slug = normalizeSlug(post.slug);
  if (!slug) return DEFAULT_OG_IMAGE;
  const revision = normalizeSpace(post.revision) || boardLastModified(post);
  return `${BOARD_SITE_URL}/og/board-${encodeURIComponent(slug)}.webp?v=${OG_IMAGE_VERSION}&r=${encodeURIComponent(revision)}`;
}

export function boardOgText(post = {}) {
  const explicit = normalizeSpace(post.ogText);
  if (explicit) return ensureSachingSagi(explicit);
  const source = normalizeSpace(post.title || post.seoTitle || post.slug);
  return ensureSachingSagi(source);
}

export function boardPostCaseEntry(post = {}) {
  const slug = normalizeSlug(post.slug);
  const title = boardTitle(post);
  const description = boardDescription(post);
  const image = boardImageUrl(post);
  const canonical = boardPostUrl(slug);
  const createdAt = normalizeDate(post.createdAt) || normalizeDate(post.publishedAt) || boardLastModified(post);
  const updatedAt = boardLastModified(post);

  return {
    slug,
    caseName: title,
    category: "통합 허브 게시글",
    createdAt,
    updatedAt,
    thumbnailUrl: image,
    landingViews: 0,
    reports: 0,
    summary: description,
    tags: ["통합 허브", "사기피해"],
    memo: "",
    noindex: false,
    targetGroups: ["e"],
    createdBy: "board-manual",
    listingPath: `/${BOARD_PREFIX}/${encodeURIComponent(slug)}/`,
    listingUrl: canonical,
    landings: {
      e: {
        title,
        description,
        canonical,
        ogTitle: title,
        ogDescription: description,
        ogImage: image,
        h1: title,
        body: [],
        victimCases: [],
        suspiciousCompanies: [],
        faq: normalizeFaq(post.faq),
      },
    },
  };
}

export function boardLastModified(post = {}) {
  return maxDate(post.updatedAt, post.publishedAt, post.createdAt, BOARD_REFRESHED_AT);
}

export function sortBoardPosts(posts = []) {
  return [...posts].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return boardLastModified(b).localeCompare(boardLastModified(a)) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export async function listBoardPosts(env) {
  if (!env?.CASES) return [];
  const raw = await env.CASES.get(BOARD_INDEX_KEY);
  const parsed = parseJson(raw, []);
  return sortBoardPosts(Array.isArray(parsed) ? parsed.map((item) => normalizeBoardPost(item, item, { forIndex: true })) : []);
}

export async function getBoardPost(env, slug) {
  const cleanSlug = normalizeSlug(slug);
  if (!env?.CASES || !cleanSlug) return null;
  const raw = await env.CASES.get(`${BOARD_POST_KEY_PREFIX}${cleanSlug}`);
  if (raw) return normalizeBoardPost(parseJson(raw, null));

  const posts = await listBoardPosts(env);
  return posts.find((item) => item.slug === cleanSlug) || null;
}

export async function saveBoardPost(env, input = {}) {
  if (!env?.CASES) throw new Error("KV 바인딩이 없습니다.");

  const originalSlug = normalizeSlug(input.originalSlug || input.currentSlug || input.oldSlug);
  const existing = originalSlug ? await getBoardPost(env, originalSlug) : null;
  const post = normalizeBoardPost(input, existing || {}, { touch: true });

  if (!post.title) throw new Error("제목을 입력해주세요.");
  if (!post.body) throw new Error("본문을 입력해주세요.");
  if (!post.slug) post.slug = createBoardSlug(post.title);
  if (!post.slug) throw new Error("슬러그를 생성할 수 없습니다.");

  const index = await listBoardPosts(env);
  const duplicated = index.find((item) => item.slug === post.slug && item.slug !== originalSlug);
  if (duplicated) throw new Error("이미 존재하는 슬러그입니다.");

  if (originalSlug && originalSlug !== post.slug) {
    await env.CASES.delete(`${BOARD_POST_KEY_PREFIX}${originalSlug}`);
  }

  await env.CASES.put(`${BOARD_POST_KEY_PREFIX}${post.slug}`, JSON.stringify(post));
  const nextIndex = sortBoardPosts([
    ...index.filter((item) => item.slug !== originalSlug && item.slug !== post.slug),
    boardIndexEntry(post),
  ]);
  await env.CASES.put(BOARD_INDEX_KEY, JSON.stringify(nextIndex));
  return post;
}

export async function deleteBoardPost(env, slug) {
  const cleanSlug = normalizeSlug(slug);
  if (!env?.CASES) throw new Error("KV 바인딩이 없습니다.");
  if (!cleanSlug) throw new Error("삭제할 슬러그가 없습니다.");
  await env.CASES.delete(`${BOARD_POST_KEY_PREFIX}${cleanSlug}`);
  const index = await listBoardPosts(env);
  const nextIndex = index.filter((item) => item.slug !== cleanSlug);
  await env.CASES.put(BOARD_INDEX_KEY, JSON.stringify(nextIndex));
  return cleanSlug;
}

export function normalizeBoardPost(input = {}, existing = {}, options = {}) {
  const now = todayKst();
  const title = normalizeSpace(input.title ?? existing.title);
  const slug = normalizeSlug(input.slug ?? existing.slug) || createBoardSlug(title);
  const body = normalizeTextBlock(input.body ?? existing.body);
  const excerpt = normalizeSpace(input.excerpt ?? existing.excerpt) || createExcerpt(body);
  const seoTitle = normalizeSpace(input.seoTitle ?? existing.seoTitle);
  const metaDescription = normalizeSpace(input.metaDescription ?? existing.metaDescription) || excerpt;
  const createdAt = normalizeDate(input.createdAt ?? existing.createdAt) || now;
  const shouldTouch = options.touch === true;
  const updatedAt = shouldTouch
    ? now
    : (normalizeDate(input.updatedAt ?? existing.updatedAt) || createdAt);
  const publishedAt = normalizeDate(input.publishedAt ?? existing.publishedAt) || createdAt;
  const revision = shouldTouch
    ? String(Date.now())
    : (normalizeSpace(input.revision ?? existing.revision) || updatedAt || createdAt);
  const ogText = boardOgText({ ogText: input.ogText ?? existing.ogText, title, seoTitle, slug });
  const imageAlt = normalizeSpace(input.imageAlt ?? existing.imageAlt);
  const imageCaption = normalizeSpace(input.imageCaption ?? existing.imageCaption);
  const imageDescription = normalizeSpace(input.imageDescription ?? existing.imageDescription);

  const post = {
    slug,
    title,
    body,
    excerpt,
    thumbnailUrl: "",
    imageUrl: "",
    ogText,
    imageAlt,
    imageCaption,
    imageDescription,
    seoTitle,
    metaDescription,
    faq: normalizeFaq(input.faq ?? existing.faq),
    pinned: toBoolean(input.pinned ?? existing.pinned),
    status: normalizeStatus(input.status ?? existing.status),
    publishedAt,
    updatedAt,
    createdAt,
    revision,
  };

  const autoImageUrl = boardImageUrl(post);
  post.thumbnailUrl = autoImageUrl;
  post.imageUrl = autoImageUrl;

  if (input.id || existing.id) post.id = normalizeSpace(input.id ?? existing.id);
  return post;
}

export function boardIndexEntry(post = {}) {
  return {
    slug: post.slug || "",
    title: post.title || "",
    excerpt: post.excerpt || "",
    thumbnailUrl: boardImageUrl(post),
    imageUrl: boardImageUrl(post),
    ogText: boardOgText(post),
    imageAlt: post.imageAlt || "",
    imageCaption: post.imageCaption || "",
    imageDescription: post.imageDescription || "",
    seoTitle: post.seoTitle || "",
    metaDescription: post.metaDescription || "",
    pinned: Boolean(post.pinned),
    status: post.status || "published",
    publishedAt: post.publishedAt || "",
    updatedAt: post.updatedAt || "",
    createdAt: post.createdAt || "",
    revision: post.revision || "",
    faq: normalizeFaq(post.faq),
  };
}

export function buildBoardSitemapEntries(posts = [], options = {}) {
  const includeList = options.includeList !== false;
  const listEntry = includeList
    ? `<url><loc>${escXml(boardListUrl())}</loc><lastmod>${BOARD_REFRESHED_AT}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
    : "";
  const postEntries = sortBoardPosts(posts)
    .filter((post) => (post.status || "published") === "published")
    .map((post) => `<url><loc>${escXml(boardPostUrl(post.slug))}</loc><lastmod>${boardLastModified(post)}</lastmod><changefreq>weekly</changefreq><priority>${post.pinned ? "0.8" : "0.7"}</priority></url>`)
    .join("");
  return `${listEntry}${postEntries}`;
}

export function injectBoardSitemapEntries(xml = "", posts = [], options = {}) {
  const entries = buildBoardSitemapEntries(posts, options);
  if (!entries || !String(xml).includes("</urlset>")) return xml;
  return String(xml).replace("</urlset>", `${entries}</urlset>`);
}

export function filterRecentBoardPosts(posts = [], days = 7, limit = 1000) {
  const cutoff = Date.now() - Math.max(1, Number(days) || 7) * 24 * 60 * 60 * 1000;
  return sortBoardPosts(posts)
    .filter((post) => {
      const time = Date.parse(`${boardLastModified(post)}T00:00:00+09:00`);
      return Number.isFinite(time) && time >= cutoff;
    })
    .slice(0, limit);
}

export function createBoardSlug(value = "") {
  const romanSlug = hangulToRoman(normalizeSpace(value))
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
  return romanSlug || normalizeSlug(value);
}

export function createExcerpt(value = "", limit = 120) {
  const text = stripHtml(value).replace(/[#*_>`~\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "사기 피해 대응과 피해 회복 절차를 정리한 게시글입니다.";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function normalizeFaq(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        question: normalizeSpace(item?.question ?? item?.q ?? ""),
        answer: normalizeSpace(item?.answer ?? item?.a ?? ""),
      }))
      .filter((item) => item.question && item.answer)
      .slice(0, 8);
  }
  const text = normalizeTextBlock(value);
  if (!text) return [];
  return text.split(/\n+/)
    .map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.split(/\s*\|\s*/);
      if (parts.length >= 2) return { question: normalizeSpace(parts[0]), answer: normalizeSpace(parts.slice(1).join(" | ")) };
      const qa = raw.match(/^Q[:.)]?\s*(.+?)\s+A[:.)]?\s*(.+)$/i);
      if (qa) return { question: normalizeSpace(qa[1]), answer: normalizeSpace(qa[2]) };
      return null;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeStatus(value = "") {
  const status = normalizeSpace(value).toLowerCase();
  return status === "draft" || status === "hidden" ? status : "published";
}

function toBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1 || value === "on";
}

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/%2f/gi, "-")
    .replace(/[/?#]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeDate(value = "") {
  const text = normalizeSpace(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeSpace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTextBlock(value = "") {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function ensureSachingSagi(value = "") {
  const source = normalizeSpace(value).replace(/[|｜]/g, " ");
  const exact = source.match(/^(.{1,42}?사칭\s*사기)(?:[\s,.:;!?·\-]|$)/);
  if (exact) return normalizeSpace(exact[1]);

  let base = source.split(/[,\n\r]/)[0] || source;
  base = base
    .replace(/\s*(출금\s*불가|출금\s*거부|피해\s*회복|피해\s*대응|형사고소|민사\s*대응|대응\s*방법|방법|절차).*$/i, "")
    .replace(/\s*(게시글|안내|정리)\s*$/i, "")
    .trim();
  if (!base) base = "사기 피해";
  if (/사칭\s*사기$/i.test(base)) return normalizeSpace(base);
  if (/사기$/i.test(base)) base = base.replace(/\s*사기$/i, "").trim();
  return `${base} 사칭 사기`.replace(/\s+/g, " ").trim();
}

function stripHtml(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function maxDate(...values) {
  const dates = values
    .map((value) => String(value || "").trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
  return dates[dates.length - 1] || BOARD_REFRESHED_AT;
}

function escXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const _CHO = ["g","gg","n","d","dd","r","m","b","bb","s","ss","","j","jj","ch","k","t","p","h"];
const _JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const _JONG = ["","g","gg","gs","n","nj","nh","d","r","rg","rm","rb","rs","rt","rp","rh","m","b","bs","s","ss","ng","j","ch","k","t","p","h"];

function hangulToRoman(text) {
  let out = "";
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const off = code - 0xAC00;
      out += _CHO[Math.floor(off / 28 / 21)] + _JUNG[Math.floor(off / 28) % 21] + _JONG[off % 28];
    } else {
      out += ch;
    }
  }
  return out;
}
