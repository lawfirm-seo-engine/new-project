const CHO = ["g", "gg", "n", "d", "dd", "r", "m", "b", "bb", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "g", "gg", "gs", "n", "nj", "nh", "d", "r", "rg", "rm", "rb", "rs", "rt", "rp", "rh", "m", "b", "bs", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"];

const GENERIC_TERMS = [
  "\uc0ac\uce6d", "\uc0ac\uae30", "\ud53c\ud574", "\ud22c\uc790\uc0ac\uae30",
  "\ub9ac\ub529\ubc29", "\ub9ac\ub529", "\uc8fc\uc2dd", "\ucf54\uc778", "\uac70\ub798\uc18c",
  "\ud22c\uc790\uc99d\uad8c", "\uc99d\uad8c", "\ud22c\uc790", "\ud53c\ud574\uae08",
  "\ud22c\uc790\uae08", "\ud68c\uc218", "\ud574\uacb0", "\ubc29\ubc95", "\ub300\uc751",
  "\uc804\ub7b5", "\ud544\uc218", "\ube60\ub978", "\uc0c1\ub2f4", "\uac00\ub2a5",
  "24\uc2dc\uac04", "\ucd9c\uae08", "\uac70\ubd80",
  "saching", "sagi", "pihae", "tujasagi", "ridingbang", "riding", "jusig",
  "coin", "koin", "georaeso", "tujajeunggwon", "jeunggwon", "tuja", "pihaegeum",
  "tujageum", "hoesu", "haegyeol", "bangbeob", "daeeung", "jeonryag", "pilsu",
  "ppareun", "sangdam", "ganeung", "chulgeum", "geobu",
];

export function hangulToRoman(text = "") {
  let out = "";
  for (const ch of String(text || "")) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const off = code - 0xac00;
      out += CHO[Math.floor(off / 28 / 21)] + JUNG[Math.floor(off / 28) % 21] + JONG[off % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

export function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/www\./g, " ")
    .replace(/\.(com|net|org|co|kr|vip|shop|site|store|io)\b/g, " ")
    .replace(/[^0-9a-z\uac00-\ud7a3]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactSearchText(value = "") {
  return compact(normalizeSearchText(value));
}

export function searchAliases(value = "") {
  const raw = normalizeSearchText(value);
  const roman = normalizeSearchText(hangulToRoman(value));
  const withoutGeneric = stripGenericTerms(raw);
  const romanWithoutGeneric = stripGenericTerms(roman);
  return unique([
    raw,
    compact(raw),
    roman,
    compact(roman),
    ...[withoutGeneric, compact(withoutGeneric), romanWithoutGeneric, compact(romanWithoutGeneric)]
      .filter((item) => item && item.length >= 4),
  ].filter((item) => item && item.length >= 2));
}

export function compareCaseIdentity(incoming = {}, existing = {}) {
  const incomingSlugAliases = searchAliases(incoming.slug || "");
  const existingSlugAliases = searchAliases(existing.slug || "");
  const incomingAliases = aliasesForCase(incoming);
  const existingAliases = aliasesForCase(existing);
  const exactSlug = hasStrongOverlap(incomingSlugAliases, existingSlugAliases);
  const exactAlias = hasStrongOverlap(incomingAliases, existingAliases);
  const incomingCoreAliases = coreAliasesForCase(incoming);
  const existingCoreAliases = coreAliasesForCase(existing);
  const exactCore = hasStrongOverlap(incomingCoreAliases, existingCoreAliases);
  const containsCore = hasStrongContainment(incomingCoreAliases, existingCoreAliases);
  const containsAlias = hasStrongContainment(incomingAliases, existingAliases) && containsCore;
  const fuzzyScore = maxSimilarity(incomingAliases, existingAliases);
  const adjustedFuzzyScore = exactCore || containsCore ? fuzzyScore : Math.min(fuzzyScore, 0.69);
  const score = exactSlug || exactAlias || exactCore ? 1 : containsAlias ? Math.max(0.92, adjustedFuzzyScore) : adjustedFuzzyScore;
  return {
    score,
    exactSlug,
    exactAlias,
    exactCore,
    containsAlias,
    containsCore,
  };
}

function aliasesForCase(item = {}) {
  const values = [
    item.slug,
    item.caseName,
    item.name,
    item.title,
    item.h1,
    item.ogTitle,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ];
  if (item.landings && typeof item.landings === "object") {
    Object.values(item.landings).forEach((landing) => {
      if (!landing || typeof landing !== "object") return;
      values.push(landing.title, landing.h1, landing.ogTitle);
    });
  }
  return unique(values.flatMap((value) => searchAliases(value || "")));
}

function coreAliasesForCase(item = {}) {
  return aliasesForCase(item)
    .flatMap((value) => {
      const stripped = stripGenericTerms(value);
      const compacted = compact(stripped);
      return [
        stripped,
        compacted,
        ...stripped.split(/\s+/).filter(Boolean),
      ];
    })
    .filter((value) => value.length >= 4);
}

function stripGenericTerms(value = "") {
  let result = normalizeSearchText(value);
  for (const term of GENERIC_TERMS) {
    result = result.split(term).join(" ");
  }
  return result.replace(/\s+/g, " ").trim();
}

function compact(value = "") {
  return String(value || "").replace(/\s+/g, "");
}

function hasStrongOverlap(left = [], right = []) {
  const rightSet = new Set(right.filter((item) => item.length >= 4));
  return left.some((item) => item.length >= 4 && rightSet.has(item));
}

function hasStrongContainment(left = [], right = []) {
  const a = left.filter((item) => item.length >= 5);
  const b = right.filter((item) => item.length >= 5);
  return a.some((x) => b.some((y) => x.includes(y) || y.includes(x)));
}

function maxSimilarity(left = [], right = []) {
  let best = 0;
  for (const a of left) {
    for (const b of right) {
      best = Math.max(best, similarity(a, b));
    }
  }
  return best;
}

function similarity(a = "", b = "") {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size || 1;
  return intersection / union;
}

function tokenSet(value = "") {
  const chunks = normalizeSearchText(value).split(/\s+/).filter(Boolean);
  const grams = [];
  for (const chunk of chunks) {
    const compactChunk = compact(chunk);
    if (compactChunk.length <= 2) {
      grams.push(compactChunk);
      continue;
    }
    for (let i = 0; i < compactChunk.length - 1; i += 1) {
      grams.push(compactChunk.slice(i, i + 2));
    }
  }
  return new Set(grams);
}

function unique(items = []) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}
