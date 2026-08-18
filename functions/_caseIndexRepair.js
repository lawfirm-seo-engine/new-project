// cases:index는 여러 생성 엔드포인트가 "읽기→메모리에서 push→통째로 쓰기" 방식으로 갱신하는데,
// 두 요청이 거의 동시에 들어오면 나중에 쓰는 쪽이 먼저 쓴 쪽의 index 추가분을 덮어써 유실될 수 있다
// (case:{slug} 본문 레코드는 키가 겹치지 않아 살아있지만 목록/검색에서는 사라지는 증상).
// 이 목록은 그렇게 유실된 게 발견된 slug의 임시 땜질 목록이다 — 근본적으로는
// /api/repair-missing-index-entries로 전체를 한 번 정리하는 것이 맞다.
const INDEX_REPAIR_SLUGS = [
  "cvctujajeunggwon",
  "pcm-pro",
];

export async function mergeIndexRepairCases(env, cases = []) {
  const list = Array.isArray(cases) ? [...cases] : [];
  if (!env?.CASES) return list;

  const bySlug = new Map(list.filter((item) => item?.slug).map((item) => [item.slug, item]));

  for (const slug of INDEX_REPAIR_SLUGS) {
    if (bySlug.has(slug)) continue;

    try {
      const raw = await env.CASES.get(`case:${slug}`);
      if (!raw) continue;
      const fullCase = JSON.parse(raw);
      const entry = buildIndexEntry(fullCase, slug);
      if (entry.slug) bySlug.set(entry.slug, entry);
    } catch {
      // Keep the public/API response available even if a repair lookup fails.
    }
  }

  return [...bySlug.values()];
}

export function buildIndexEntry(item = {}, fallbackSlug = "") {
  const landings = item.landings && typeof item.landings === "object" ? item.landings : {};
  const firstLanding = landings.a || Object.values(landings)[0] || {};
  const entry = {
    slug: item.slug || fallbackSlug,
    caseName: item.caseName || item.name || firstLanding.h1 || firstLanding.title || fallbackSlug,
    category: item.category || "",
    createdAt: item.createdAt || item.updatedAt || "",
    updatedAt: item.updatedAt || item.createdAt || "",
    thumbnailUrl: item.thumbnailUrl || "",
    landingViews: item.landingViews || 0,
    reports: item.reports || 0,
    summary: item.summary || firstLanding.description || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    memo: item.memo || "",
    noindex: item.noindex || false,
    targetGroups: Array.isArray(item.targetGroups) ? item.targetGroups : [],
    createdBy: item.createdBy || "",
    fraudType: item.fraudType || item.scamType || "",
    landings: Object.keys(landings).length ? landings : undefined,
  };

  if (item.listingPath) entry.listingPath = item.listingPath;
  if (item.publicPath) entry.publicPath = item.publicPath;
  if (item.listingUrl) entry.listingUrl = item.listingUrl;
  if (item.hideFromListing) entry.hideFromListing = true;
  if (item.searchHidden) entry.searchHidden = true;

  return entry;
}
