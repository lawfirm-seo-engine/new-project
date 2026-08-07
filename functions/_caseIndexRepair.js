const INDEX_REPAIR_SLUGS = [
  "cvctujajeunggwon",
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

function buildIndexEntry(item = {}, fallbackSlug = "") {
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
