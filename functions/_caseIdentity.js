import { STATIC_CASE_NAME_INDEX } from "./_caseNameIndex.generated.js";

const IDENTITY_BUCKET_COUNT = 64;
const IDENTITY_BUCKET_PREFIX = "case-names:v1:";

export function normalizeCaseIdentity(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "")
    .replace(/[^0-9a-z가-힣.]+/g, "")
    .trim();
}

export function caseIdentityBucketKey(value = "") {
  const identity = normalizeCaseIdentity(value);
  if (!identity) return "";
  return `${IDENTITY_BUCKET_PREFIX}${(fnv1a(identity) % IDENTITY_BUCKET_COUNT).toString(16).padStart(2, "0")}`;
}

export async function findCaseSlugByIdentity(env, caseName = "") {
  const identity = normalizeCaseIdentity(caseName);
  if (!identity) return "";
  if (!env?.CASES) return String(STATIC_CASE_NAME_INDEX[identity] || "").trim();
  const key = caseIdentityBucketKey(identity);
  if (!key) return String(STATIC_CASE_NAME_INDEX[identity] || "").trim();
  const raw = await env.CASES.get(key);
  if (!raw) return String(STATIC_CASE_NAME_INDEX[identity] || "").trim();
  try {
    return String(JSON.parse(raw)?.[identity] || STATIC_CASE_NAME_INDEX[identity] || "").trim();
  } catch {
    return String(STATIC_CASE_NAME_INDEX[identity] || "").trim();
  }
}

export async function rememberCaseIdentity(env, item = {}) {
  if (!env?.CASES || !item?.slug) return;
  const identity = normalizeCaseIdentity(item.caseName || item.name || item.title);
  const key = caseIdentityBucketKey(identity);
  if (!identity || !key) return;
  const raw = await env.CASES.get(key);
  let bucket = {};
  try { bucket = raw ? JSON.parse(raw) : {}; } catch { bucket = {}; }
  if (bucket[identity] === item.slug) return;
  bucket[identity] = item.slug;
  await env.CASES.put(key, JSON.stringify(bucket));
}

export async function rebuildCaseIdentityBuckets(env, cases = []) {
  if (!env?.CASES) return { buckets: 0, identities: 0 };
  const buckets = new Map();
  let identities = 0;
  for (const item of Array.isArray(cases) ? cases : []) {
    if (!item?.slug) continue;
    const identity = normalizeCaseIdentity(item.caseName || item.name || item.title);
    const key = caseIdentityBucketKey(identity);
    if (!identity || !key) continue;
    if (!buckets.has(key)) buckets.set(key, {});
    if (!buckets.get(key)[identity]) identities += 1;
    buckets.get(key)[identity] = item.slug;
  }
  await Promise.all([...buckets.entries()].map(([key, value]) => env.CASES.put(key, JSON.stringify(value))));
  return { buckets: buckets.size, identities };
}

function fnv1a(value = "") {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
