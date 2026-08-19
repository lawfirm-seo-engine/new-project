export const CRIMINAL_BOARD_HOST = "gnlaw-criminal.co.kr";
export const CRIMINAL_BOARD_SITE_URL = "https://gnlaw-criminal.co.kr";
export const CRIMINAL_BOARD_INDEX_KEY = "criminal-board:index";
export const CRIMINAL_BOARD_POST_KEY_PREFIX = "criminal-board:post:";

export function isCriminalBoardHost(host = "") {
  return String(host || "").toLowerCase() === CRIMINAL_BOARD_HOST;
}

export function criminalBoardListUrl() {
  return `${CRIMINAL_BOARD_SITE_URL}/board/`;
}

export function criminalBoardPostUrl(slug = "") {
  return `${CRIMINAL_BOARD_SITE_URL}/board/${encodeURIComponent(normalizeSlug(slug))}/`;
}

export function criminalBoardTitle(post = {}) {
  return normalizeSpace(post.seoTitle) || normalizeSpace(post.title) || "법무법인 선린 게시판";
}

export function criminalBoardDescription(post = {}) {
  return normalizeSpace(post.metaDescription) || normalizeSpace(post.excerpt) || createExcerpt(post.body, 150);
}

export function criminalBoardLastModified(post = {}) {
  return maxDate(post.updatedAt, post.publishedAt, post.createdAt, todayKst());
}

export function sortCriminalBoardPosts(posts = []) {
  return [...posts].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return criminalBoardLastModified(b).localeCompare(criminalBoardLastModified(a));
  });
}

export async function listCriminalBoardPosts(env) {
  if (!env?.CASES) return [];
  const raw = await env.CASES.get(CRIMINAL_BOARD_INDEX_KEY);
  const parsed = parseJson(raw, []);
  return sortCriminalBoardPosts(Array.isArray(parsed) ? parsed.map((item) => normalizeCriminalBoardPost(item, item, { forIndex: true })) : []);
}

export async function getCriminalBoardPost(env, slug) {
  const cleanSlug = normalizeSlug(slug);
  if (!env?.CASES || !cleanSlug) return null;
  const raw = await env.CASES.get(`${CRIMINAL_BOARD_POST_KEY_PREFIX}${cleanSlug}`);
  if (raw) return normalizeCriminalBoardPost(parseJson(raw, null));
  const posts = await listCriminalBoardPosts(env);
  return posts.find((item) => item.slug === cleanSlug) || null;
}

export async function saveCriminalBoardPost(env, input = {}) {
  if (!env?.CASES) throw new Error("KV 바인딩이 없습니다.");

  const originalSlug = normalizeSlug(input.originalSlug || input.currentSlug || input.oldSlug);
  const existing = originalSlug ? await getCriminalBoardPost(env, originalSlug) : null;
  const post = normalizeCriminalBoardPost(input, existing || {}, { touch: true });

  if (!post.title) throw new Error("제목을 입력해주세요.");
  if (!post.body) throw new Error("본문을 입력해주세요.");
  if (!post.slug) post.slug = createCriminalBoardSlug(post.title);
  if (!post.slug) throw new Error("슬러그를 생성할 수 없습니다.");

  const index = await listCriminalBoardPosts(env);
  const duplicated = index.find((item) => item.slug === post.slug && item.slug !== originalSlug);
  if (duplicated) throw new Error("이미 존재하는 URL slug입니다.");

  if (originalSlug && originalSlug !== post.slug) {
    await env.CASES.delete(`${CRIMINAL_BOARD_POST_KEY_PREFIX}${originalSlug}`);
  }

  await env.CASES.put(`${CRIMINAL_BOARD_POST_KEY_PREFIX}${post.slug}`, JSON.stringify(post));
  const nextIndex = sortCriminalBoardPosts([
    ...index.filter((item) => item.slug !== originalSlug && item.slug !== post.slug),
    criminalBoardIndexEntry(post),
  ]);
  await env.CASES.put(CRIMINAL_BOARD_INDEX_KEY, JSON.stringify(nextIndex));
  return post;
}

export async function deleteCriminalBoardPost(env, slug) {
  const cleanSlug = normalizeSlug(slug);
  if (!env?.CASES) throw new Error("KV 바인딩이 없습니다.");
  if (!cleanSlug) throw new Error("삭제할 게시글이 없습니다.");
  await env.CASES.delete(`${CRIMINAL_BOARD_POST_KEY_PREFIX}${cleanSlug}`);
  const index = await listCriminalBoardPosts(env);
  await env.CASES.put(CRIMINAL_BOARD_INDEX_KEY, JSON.stringify(index.filter((item) => item.slug !== cleanSlug)));
  return cleanSlug;
}

export function normalizeCriminalBoardPost(input = {}, existing = {}, options = {}) {
  const now = todayKst();
  const title = normalizeSpace(input.title ?? existing.title);
  const slug = normalizeSlug(input.slug ?? existing.slug) || createCriminalBoardSlug(title);
  const body = normalizeTextBlock(input.body ?? existing.body);
  const excerpt = normalizeSpace(input.excerpt ?? existing.excerpt) || createExcerpt(body);
  const createdAt = normalizeDate(input.createdAt ?? existing.createdAt) || now;
  const updatedAt = options.touch === true ? now : (normalizeDate(input.updatedAt ?? existing.updatedAt) || createdAt);
  const publishedAt = normalizeDate(input.publishedAt ?? existing.publishedAt) || createdAt;

  return {
    slug,
    title,
    category: normalizeSpace(input.category ?? existing.category) || "피해 대응",
    body,
    excerpt,
    thumbnailUrl: normalizeUrl(input.thumbnailUrl ?? existing.thumbnailUrl),
    seoTitle: normalizeSpace(input.seoTitle ?? existing.seoTitle),
    metaDescription: normalizeSpace(input.metaDescription ?? existing.metaDescription) || excerpt,
    pinned: toBoolean(input.pinned ?? existing.pinned),
    status: normalizeStatus(input.status ?? existing.status),
    publishedAt,
    updatedAt,
    createdAt,
  };
}

export function criminalBoardIndexEntry(post = {}) {
  return {
    slug: post.slug || "",
    title: post.title || "",
    category: post.category || "피해 대응",
    excerpt: post.excerpt || "",
    thumbnailUrl: post.thumbnailUrl || "",
    seoTitle: post.seoTitle || "",
    metaDescription: post.metaDescription || "",
    pinned: Boolean(post.pinned),
    status: post.status || "published",
    publishedAt: post.publishedAt || "",
    updatedAt: post.updatedAt || "",
    createdAt: post.createdAt || "",
  };
}

export function createCriminalBoardSlug(value = "") {
  const ascii = normalizeSpace(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90);
  return normalizeSlug(ascii);
}

export function createExcerpt(value = "", limit = 150) {
  const text = stripMarkup(value).replace(/\s+/g, " ").trim();
  if (!text) return "법무법인 선린의 사건 대응 관련 게시글입니다.";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function normalizeStatus(value = "") {
  const status = normalizeSpace(value).toLowerCase();
  return status === "draft" || status === "hidden" ? status : "published";
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

function normalizeUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text) || text.startsWith("/")) return text;
  return "";
}

function normalizeSpace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTextBlock(value = "") {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function toBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1 || value === "on";
}

function stripMarkup(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#*_>`~\[\]()]/g, " ");
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function maxDate(...values) {
  return values.map(normalizeDate).filter(Boolean).sort().pop() || todayKst();
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
