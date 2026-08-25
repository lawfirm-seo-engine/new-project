const DELETED_CASE_PREFIX = "deleted-case:";
const RESTORED_CASE_PREFIX = "restored-case:";

// This case body was deleted on 2026-08-25, but a concurrent bulk-create write
// restored its stale cases:index entry. Keep the tombstone in code so the
// already-deleted page cannot reappear before a KV tombstone is present.
const PREVIOUSLY_DELETED_CASE_SLUGS = new Set([
  "nunukeureiding",
]);

export async function filterDeletedCases(env, cases = []) {
  const list = Array.isArray(cases) ? cases : [];
  const deleted = await loadDeletedCaseSlugs(env);
  if (!deleted.size) return list;
  return list.filter((item) => !deleted.has(normalizeSlug(item?.slug)));
}

export async function recordCaseDeletion(env, slug, caseName = "") {
  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug || !env?.CASES) return;
  await env.CASES.put(`${DELETED_CASE_PREFIX}${cleanSlug}`, JSON.stringify({
    slug: cleanSlug,
    caseName: String(caseName || "").trim(),
    deletedAt: new Date().toISOString(),
  }));
  await env.CASES.delete(`${RESTORED_CASE_PREFIX}${cleanSlug}`);
}

export async function clearCaseDeletion(env, slug) {
  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug || !env?.CASES) return;
  const storedTombstone = await env.CASES.get(`${DELETED_CASE_PREFIX}${cleanSlug}`);
  if (!storedTombstone && !PREVIOUSLY_DELETED_CASE_SLUGS.has(cleanSlug)) return;
  await env.CASES.delete(`${DELETED_CASE_PREFIX}${cleanSlug}`);
  await env.CASES.put(`${RESTORED_CASE_PREFIX}${cleanSlug}`, new Date().toISOString());
}

async function loadDeletedCaseSlugs(env) {
  const deleted = new Set(PREVIOUSLY_DELETED_CASE_SLUGS);
  if (!env?.CASES?.list) return deleted;

  let cursor;
  do {
    const page = await env.CASES.list({
      prefix: DELETED_CASE_PREFIX,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    for (const key of page.keys || []) {
      const slug = normalizeSlug(String(key.name || "").slice(DELETED_CASE_PREFIX.length));
      if (slug) deleted.add(slug);
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);

  cursor = undefined;
  do {
    const page = await env.CASES.list({
      prefix: RESTORED_CASE_PREFIX,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    for (const key of page.keys || []) {
      const slug = normalizeSlug(String(key.name || "").slice(RESTORED_CASE_PREFIX.length));
      if (slug) deleted.delete(slug);
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);

  return deleted;
}

function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase();
}
