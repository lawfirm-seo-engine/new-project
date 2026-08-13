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

function hasProgress(value) {
  if (Array.isArray(value)) return value.some((item) => String(item || "").trim());
  return Boolean(String(value || "").trim());
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
