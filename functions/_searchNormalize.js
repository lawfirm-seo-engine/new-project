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

// 금융업 일반명사(증권/투자/거래소 등)는 특정 업체를 식별하는 신호가 아니므로
// "HDFC Securities" vs "Toss Securities"처럼 이름은 전혀 다른데 이 단어 하나만 겹쳐서
// 완전일치(exactSlug/exactAlias)로 오판되는 걸 막기 위해 브랜드 별칭 단계에서부터 제외한다.
const SHORT_BRAND_STOPWORDS = new Set([
  "app", "pro", "vip", "hts", "mts", "fx", "tv", "kr", "com", "net", "org", "co",
  "shop", "site", "store", "ltd", "inc", "llc", "corp", "group", "global", "asset",
  "assets", "capital", "invest", "investment", "investments", "bank", "coin", "stock",
  "securities", "security", "finance", "financial", "fintech",
  "trade", "trading", "market", "markets", "limited", "company", "partners", "partner",
  "management", "holdings", "holding", "fund", "funds", "exchange",
]);

const CORE_STOPWORDS = new Set([
  ...SHORT_BRAND_STOPWORDS,
]);

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
  const shortCore = shortBrandAliases(withoutGeneric);
  const romanShortCore = shortBrandAliases(romanWithoutGeneric);
  return unique([
    raw,
    compact(raw),
    roman,
    compact(roman),
    ...[withoutGeneric, compact(withoutGeneric), romanWithoutGeneric, compact(romanWithoutGeneric)]
      .filter((item) => item && item.length >= 4),
    ...shortCore,
    ...romanShortCore,
  ].filter((item) => item && item.length >= 2));
}

// 케이스 1건에 대한 별칭 묶음을 미리 계산해둔다. 배치 중복 검수처럼 같은 "existing" 케이스를
// 여러 "incoming" 항목과 반복 비교할 때, 이 묶음을 한 번만 만들어 재사용하면
// aliasesForCase/coreAliasesForCase 등 비싼 정규화 연산의 반복 계산을 피할 수 있다.
export function buildCaseIdentityBundle(item = {}) {
  return {
    slugAliases: searchAliases(item.slug || ""),
    aliases: aliasesForCase(item),
    coreAliases: coreAliasesForCase(item),
    brandAliases: brandAliasesForCase(item),
  };
}

export function compareIdentityBundles(incomingBundle, existingBundle, tokenCache = null) {
  const exactSlug = hasStrongOverlap(incomingBundle.slugAliases, existingBundle.slugAliases);
  const exactAlias = hasStrongOverlap(incomingBundle.aliases, existingBundle.aliases);
  const exactCore = hasStrongOverlap(incomingBundle.coreAliases, existingBundle.coreAliases);
  const containsCore = hasStrongContainment(incomingBundle.coreAliases, existingBundle.coreAliases);
  const brandOverlap = hasBrandOverlap(incomingBundle.brandAliases, existingBundle.brandAliases);
  const containsAlias = hasStrongContainment(incomingBundle.aliases, existingBundle.aliases) && containsCore;
  const fuzzyScore = maxSimilarity(incomingBundle.aliases, existingBundle.aliases, tokenCache);
  const adjustedFuzzyScore = exactCore || containsCore ? fuzzyScore : Math.min(fuzzyScore, 0.69);
  const score = exactSlug || exactAlias || exactCore
    ? 1
    : containsAlias
      ? Math.max(0.92, adjustedFuzzyScore)
      : brandOverlap
        ? Math.max(0.72, adjustedFuzzyScore)
        : adjustedFuzzyScore;
  return {
    score,
    exactSlug,
    exactAlias,
    exactCore,
    containsAlias,
    containsCore,
    brandOverlap,
  };
}

export function compareCaseIdentity(incoming = {}, existing = {}) {
  return compareIdentityBundles(buildCaseIdentityBundle(incoming), buildCaseIdentityBundle(existing));
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
  return unique(caseValues(item).flatMap((value) => coreAliasesFromValue(value)));
}

function brandAliasesForCase(item = {}) {
  return unique(caseValues(item).flatMap((value) => shortBrandAliases(stripGenericTerms(value))));
}

function shortBrandAliases(value = "") {
  const normalized = normalizeSearchText(value);
  const tokens = [
    normalized,
    compact(normalized),
    ...normalized.split(/\s+/).filter(Boolean),
  ];
  return unique(tokens.filter((token) => {
    const value = compact(token);
    return /^[a-z0-9]{3,}$/.test(value) && !SHORT_BRAND_STOPWORDS.has(value);
  }));
}

function coreAliasesFromValue(value = "") {
  const variants = [
    normalizeSearchText(value),
    normalizeSearchText(hangulToRoman(value)),
  ];
  return unique(variants.flatMap((variant) => {
    const tokens = stripGenericTerms(variant)
      .split(/\s+/)
      .map((token) => compact(token))
      .filter(isMeaningfulCoreToken);
    return [
      ...tokens,
      tokens.length >= 2 ? tokens.join(" ") : "",
      tokens.length >= 2 ? tokens.join("") : "",
    ];
  })).filter((item) => item.length >= 3);
}

function isMeaningfulCoreToken(value = "") {
  const token = compact(normalizeSearchText(value));
  if (!token || CORE_STOPWORDS.has(token)) return false;
  if (/^[a-z0-9]+$/.test(token)) return token.length >= 3;
  return token.length >= 2;
}

function caseValues(item = {}) {
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
  return values.filter(Boolean);
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

function hasBrandOverlap(left = [], right = []) {
  const rightSet = new Set(right.filter((item) => item.length >= 3));
  return left.some((item) => item.length >= 3 && rightSet.has(item));
}

function hasStrongContainment(left = [], right = []) {
  const a = left.filter((item) => item.length >= 5);
  const b = right.filter((item) => item.length >= 5);
  return a.some((x) => b.some((y) => x.includes(y) || y.includes(x)));
}

function maxSimilarity(left = [], right = [], tokenCache = null) {
  let best = 0;
  for (const a of left) {
    for (const b of right) {
      best = Math.max(best, similarity(a, b, tokenCache));
      if (best === 1) return best;
    }
  }
  return best;
}

function similarity(a = "", b = "", tokenCache = null) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aSet = cachedTokenSet(a, tokenCache);
  const bSet = cachedTokenSet(b, tokenCache);
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size || 1;
  return intersection / union;
}

function cachedTokenSet(value, tokenCache) {
  if (!tokenCache) return tokenSet(value);
  let cached = tokenCache.get(value);
  if (!cached) {
    cached = tokenSet(value);
    tokenCache.set(value, cached);
  }
  return cached;
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
