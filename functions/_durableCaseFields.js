export function durableCaseIndexFields(item = {}) {
  return {
    ...(Array.isArray(item.memos) && item.memos.length ? { memos: item.memos } : {}),
    ...(hasProgress(item.currentProgress) ? { currentProgress: item.currentProgress } : {}),
    ...(item.currentProgressByKey ? { currentProgressByKey: item.currentProgressByKey } : {}),
  };
}

export function mergeDurableFieldsFromExisting(cases = [], existingCases = []) {
  const existingBySlug = new Map((Array.isArray(existingCases) ? existingCases : [])
    .filter((item) => item?.slug)
    .map((item) => [item.slug, item]));

  for (const item of cases) {
    const existing = existingBySlug.get(item.slug);
    if (!existing) continue;

    if (!String(item.memo || "").trim() && String(existing.memo || "").trim()) {
      item.memo = String(existing.memo).trim();
    }

    const memos = mergeMemos(existing.memos, item.memos);
    if (memos.length) item.memos = memos;

    if (!hasProgress(item.currentProgress) && hasProgress(existing.currentProgress)) {
      item.currentProgress = existing.currentProgress;
    }
    if (existing.currentProgressByKey || item.currentProgressByKey) {
      item.currentProgressByKey = { ...(existing.currentProgressByKey || {}), ...(item.currentProgressByKey || {}) };
    }

    const existingAProgress = existing.landings?.a?.currentProgress;
    if (!hasProgress(item.currentProgress) && hasProgress(existingAProgress)) {
      item.currentProgress = existingAProgress;
    }
    if (hasProgress(existingAProgress)) {
      item.currentProgressByKey = { ...(item.currentProgressByKey || {}), a: item.currentProgressByKey?.a || existingAProgress };
    }
  }

  return cases;
}

export function mergeCaseDataForRead(primary = {}, fallback = {}) {
  if (!fallback || typeof fallback !== "object") return primary;
  if (!primary || typeof primary !== "object") return fallback;

  const merged = { ...primary, ...fallback };
  merged.memos = mergeMemos(fallback.memos, primary.memos);
  if (!merged.memos.length) delete merged.memos;
  merged.landings = mergeLandingMaps(primary.landings, fallback.landings);
  if (!merged.landings) delete merged.landings;

  if (!hasProgress(merged.currentProgress) && hasProgress(primary.currentProgress)) {
    merged.currentProgress = primary.currentProgress;
  }
  if (primary.currentProgressByKey || fallback.currentProgressByKey) {
    merged.currentProgressByKey = { ...(primary.currentProgressByKey || {}), ...(fallback.currentProgressByKey || {}) };
  }
  return merged;
}

function hasProgress(value) {
  if (Array.isArray(value)) return value.some((item) => String(item || "").trim());
  return Boolean(String(value || "").trim());
}

function mergeLandingMaps(base = {}, updates = {}) {
  const merged = {};
  if (base && typeof base === "object" && !Array.isArray(base)) {
    for (const [key, value] of Object.entries(base)) {
      merged[key] = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : value;
    }
  }
  if (updates && typeof updates === "object" && !Array.isArray(updates)) {
    for (const [key, value] of Object.entries(updates)) {
      merged[key] = merged[key] && typeof merged[key] === "object" && !Array.isArray(merged[key]) && value && typeof value === "object" && !Array.isArray(value)
        ? { ...merged[key], ...value }
        : value;
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}

function mergeMemos(...groups) {
  const merged = [];
  const seen = new Set();
  function add(entry) {
    const text = typeof entry === "string" ? entry : entry?.text;
    const clean = String(text || "").trim();
    if (!clean) return;
    const createdAt = typeof entry === "object" && entry?.createdAt ? String(entry.createdAt).trim() : "";
    const id = typeof entry === "object" && entry?.id ? entry.id : "";
    const key = id || (createdAt ? `${createdAt}\n${clean}` : clean);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...(id ? { id } : {}),
      text: clean,
      ...(createdAt ? { createdAt } : {}),
    });
  }
  groups.flat().forEach(add);
  return merged;
}
