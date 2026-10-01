export function mergeDuplicateCase(winner = {}, duplicate = {}) {
  const merged = mergeObjects(duplicate, winner);
  merged.slug = winner.slug;
  merged.caseName = winner.caseName || duplicate.caseName || "";
  merged.createdAt = minDate(winner.createdAt, duplicate.createdAt);
  merged.updatedAt = maxDate(winner.updatedAt, duplicate.updatedAt);
  merged.tags = uniqueList(winner.tags, duplicate.tags);
  merged.memos = uniqueObjects(winner.memos, duplicate.memos);
  merged.redirectFrom = uniqueList(winner.redirectFrom, duplicate.redirectFrom, [duplicate.slug]);

  // The later registration contains the operator's most recent type choice.
  if (String(duplicate.fraudType || "").trim()) merged.fraudType = duplicate.fraudType;
  if (winner.landings || duplicate.landings) {
    merged.landings = mergeLandingMaps(winner.landings, duplicate.landings);
  }
  return merged;
}

function mergeLandingMaps(primary = {}, secondary = {}) {
  const out = {};
  const keys = new Set([...Object.keys(secondary || {}), ...Object.keys(primary || {})]);
  for (const key of keys) {
    const first = primary?.[key];
    const second = secondary?.[key];
    if (isObject(first) && isObject(second)) {
      const landing = { ...second, ...first };
      for (const field of ["body", "victimCases", "scamIntroItems", "scamMethodItems", "faq"]) {
        if (Array.isArray(first[field]) || Array.isArray(second[field])) {
          landing[field] = field === "faq"
            ? uniqueObjects(first[field], second[field])
            : uniqueList(first[field], second[field]);
        }
      }
      out[key] = landing;
    } else {
      out[key] = first ?? second;
    }
  }
  return out;
}

function mergeObjects(fallback = {}, primary = {}) {
  return { ...(fallback || {}), ...(primary || {}) };
}

function uniqueList(...groups) {
  const seen = new Set();
  const out = [];
  for (const item of groups.flat()) {
    const value = String(item || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function uniqueObjects(...groups) {
  const seen = new Set();
  const out = [];
  for (const item of groups.flat()) {
    if (!item) continue;
    const key = typeof item === "string"
      ? item.trim()
      : String(item.id || item.question || item.text || JSON.stringify(item)).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function minDate(...values) {
  return values.map(String).filter(Boolean).sort()[0] || "";
}

function maxDate(...values) {
  return values.map(String).filter(Boolean).sort().at(-1) || "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
