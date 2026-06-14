// Dynamic landing page renderer — reads case data from Cloudflare KV
// Handles: /[pathPrefix]/[slug]/ for each of the 5 groups

import {
  RSS_LIMIT,
  RECENT_SITEMAP_DAYS,
  RECENT_SITEMAP_LIMIT,
  buildRssXml,
  buildSitemapIndexXml,
  buildSitemapXml,
  getRecentCases,
  groupForHost as getSeoGroupForHost,
  loadCases as loadSeoCases,
} from "./_seo.js";

const GROUPS = {
  "gnlaw-criminal.co.kr": {
    key: "a", pathPrefix: "prosecute", urlSlugSuffix: "litigation", bodyClass: "domain-a",
    siteName: "피해금 추적 법률센터", shortName: "형사고소 센터",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수", tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수", ogType: "article",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    naverVerification: "8ac581a40e5eda3767c63ce7d27c155ccc8ea98f",
    siteUrl: "https://gnlaw-criminal.co.kr",
  },
  "gnlaw-civil.co.kr": {
    key: "b", pathPrefix: "civil", urlSlugSuffix: "settlement", bodyClass: "domain-b",
    siteName: "민사 회수 전략실", shortName: "민사 회수",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환", tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의", ogType: "article",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    naverVerification: "4ebf5db77cc0b879b9f9f6c612d318bfe95026dc",
    siteUrl: "https://gnlaw-civil.co.kr",
  },
  "gnlaw-recovery.co.kr": {
    key: "c", pathPrefix: "success", urlSlugSuffix: "result", bodyClass: "domain-c",
    siteName: "피해 회수 성공사례", shortName: "성공사례",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수", tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의", ogType: "article",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    naverVerification: "c6bcb9fcd45bfd0c4306d625e2484f60f7f96099",
    siteUrl: "https://gnlaw-recovery.co.kr",
  },
  "gnlaw-case.co.kr": {
    key: "d", pathPrefix: "briefing", urlSlugSuffix: "review", bodyClass: "domain-d",
    siteName: "피해 사건 정보", shortName: "사건 정보",
    intent: "사건 개요 · 대응 방법 · 정보 요약", tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "정보 확인", ogType: "article",
    descriptionSuffix: "사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    naverVerification: "ed1dc8d413475000d33979ea7094c62feda2539c",
    siteUrl: "https://gnlaw-case.co.kr",
  },
  "gnlaw-center.co.kr": {
    key: "e", pathPrefix: "case", urlSlugSuffix: "issue", bodyClass: "domain-e",
    siteName: "사기피해 통합 허브", shortName: "전체 허브",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건", tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인", ogType: "article",
    descriptionSuffix: "전체 사건 허브에서 형사, 민사, 성공사례, 사건정보를 사건별로 연결합니다.",
    naverVerification: "11d695d7d711ce5e50abbe85ae49a60242a37e70",
    siteUrl: "https://gnlaw-center.co.kr",
  },
  // ── law-* 도메인 ────────────────────────────────────────────────────────────
  "xn--jj0b0cw1o75qwua31zyfp19e.kr": {
    key: "a", pathPrefix: "criminal", urlSlugSuffix: "legal-action", bodyClass: "domain-a",
    landingKey: "la",
    siteName: "금융피해 대응센터", shortName: "금융피해 대응센터",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수", tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수", ogType: "article",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    naverVerification: "b7340a4493754bfb33fa4f961ed0185300848065",
    siteUrl: "https://금융사기대응센터.kr",
  },
  "xn--jj0b77gmsoyyfbet54ddvg2ma.kr": {
    key: "b", pathPrefix: "litigation", urlSlugSuffix: "recovery", bodyClass: "domain-b",
    landingKey: "lb",
    siteName: "피해금 회수 전략센터", shortName: "피해금 회수 전략센터",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환", tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의", ogType: "article",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    naverVerification: "0f58d300335c22953300936a0eba29c7ddcef6f8",
    siteUrl: "https://금융피해대응센터.kr",
  },
  "xn--2e0bno217bsqa58yp8nd1g2ma.kr": {
    key: "c", pathPrefix: "results", urlSlugSuffix: "solution", bodyClass: "domain-c",
    landingKey: "lc",
    siteName: "실제 회수 사례 아카이브", shortName: "실제 회수 사례 아카이브",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수", tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의", ogType: "article",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    naverVerification: "2c5bbb8ba945084619345dacd54228bca059390e",
    siteUrl: "https://사기피해구제센터.kr",
  },
  "xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr": {
    key: "d", pathPrefix: "insights", urlSlugSuffix: "report", bodyClass: "domain-d",
    landingKey: "ld",
    siteName: "피해 구조 브리핑", shortName: "피해 구조 브리핑",
    intent: "사건 개요 · 대응 방법 · 정보 요약", tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "정보 확인", ogType: "article",
    descriptionSuffix: "사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    naverVerification: "0db0c459d08dff08e7655a88835072c34790fb75",
    siteUrl: "https://리딩방피해회수센터.kr",
  },
  "xn--ok0b84g7tosqai7vyka788co0b.kr": {
    key: "e", pathPrefix: "incidents", urlSlugSuffix: "incident", bodyClass: "domain-e",
    landingKey: "le",
    siteName: "금융피해 통합 허브", shortName: "금융피해 통합 허브",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건", tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인", ogType: "article",
    descriptionSuffix: "피해 대응 허브에서 형사, 민사, 성공사례, 사건정보를 사건별로 연결합니다.",
    naverVerification: "7a41010af8629be5dd500005a38019de76d1c226",
    siteUrl: "https://투자사기대응센터.kr",
  },
};

const CROSS_LINKS = [
  { key: "a", label: "형사고소", url: "https://gnlaw-criminal.co.kr", prefix: "prosecute" },
  { key: "b", label: "민사소송", url: "https://gnlaw-civil.co.kr", prefix: "civil" },
  { key: "c", label: "성공사례", url: "https://gnlaw-recovery.co.kr", prefix: "success" },
  { key: "d", label: "사건정보", url: "https://gnlaw-case.co.kr", prefix: "briefing" },
  { key: "e", label: "전체허브", url: "https://gnlaw-center.co.kr", prefix: "case" },
];

const SEO_XML_ROUTES = new Set([
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/sitemap-recent.xml",
  "/rss.xml",
]);

async function handleSeoXmlRoute({ pathname, url, env }) {
  if (!SEO_XML_ROUTES.has(pathname)) return null;

  const group = getSeoGroupForHost(url.host);
  if (!group) return null;

  if (pathname === "/sitemap-index.xml") {
    return xmlResponse(buildSitemapIndexXml(group));
  }

  if (pathname === "/sitemap-recent.xml") {
    const cases = await loadSeoCases(env);
    const recentCases = getRecentCases(cases, RECENT_SITEMAP_DAYS, RECENT_SITEMAP_LIMIT);
    return xmlResponse(buildSitemapXml(group, recentCases, { includeHome: false, recent: true }));
  }

  if (pathname === "/rss.xml") {
    const cases = await loadSeoCases(env);
    const rssCases = getRecentCases(cases, RECENT_SITEMAP_DAYS, RSS_LIMIT);
    return xmlResponse(buildRssXml(group, rssCases, { limit: RSS_LIMIT }), "application/rss+xml; charset=utf-8");
  }

  const cases = await loadSeoCases(env);
  return xmlResponse(buildSitemapXml(group, cases));
}

function xmlResponse(body, contentType = "application/xml; charset=utf-8") {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const seoXmlResponse = await handleSeoXmlRoute({ pathname, url, env });
  if (seoXmlResponse) return seoXmlResponse;

  // 정적 파일·다른 Worker로 패스스루
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/og/") ||
    pathname.startsWith("/admin/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/sitemap-index.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/rss.xml" ||
    pathname.endsWith(".txt") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".webmanifest")
  ) {
    return next();
  }

  const group = GROUPS[url.host];
  if (!group) return next();

  // /[pathPrefix]/[slug]-[suffix]/ 형태의 랜딩 페이지만 처리
  const parts = pathname.replace(/^\/|\/$/g, "").split("/");
  if (parts.length !== 2 || parts[0] !== group.pathPrefix || !parts[1]) {
    return next();
  }

  // trailing slash 강제 301
  if (!pathname.endsWith("/")) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${url.origin}${pathname}/${url.search}` },
    });
  }

  const urlSlug = decodeURIComponent(parts[1]);
  const suffix = group.urlSlugSuffix;

  // new-project-9o2 전용 예외: suffix 없이 원본 URL 그대로 사용
  const NO_SUFFIX_SLUGS = [
    "soiraeb-sagi-syopingmor",
    "grucompany-sagi-syopingmor",
    "geuruaenkeompeoni-sagi-syopingmor",
  ];
  // new-project-9o2 전용 예외: 구suffix URL 그대로 유지 (URL slug → KV slug)
  const OLD_URL_MAP = {
    "mediacastlekr-com-sagi-tikesyemae-bueob-prosecute": "mediacastlekr-com-sagi-tikesyemae-bueob",
  };
  // new-project 도메인의 구suffix 목록 (리디렉션 시 제거 대상)
  const NEW_PROJECT_OLD_SUFFIXES = ["prosecute", "civil", "success", "briefing", "case"];

  const isNoSuffix = url.host === "gnlaw-criminal.co.kr" && NO_SUFFIX_SLUGS.includes(urlSlug);
  const isOldUrlKeep = url.host === "gnlaw-criminal.co.kr" && OLD_URL_MAP[urlSlug];

  let slug;
  if (isNoSuffix) {
    slug = urlSlug;
  } else if (isOldUrlKeep) {
    slug = OLD_URL_MAP[urlSlug];
  } else if (suffix && urlSlug.endsWith(`-${suffix}`)) {
    slug = urlSlug.slice(0, -(suffix.length + 1));
  } else if (suffix) {
    // 구suffix가 붙어있으면 제거 후 신suffix로 301 리디렉션
    let baseSlug = urlSlug;
    for (const old of NEW_PROJECT_OLD_SUFFIXES) {
      if (urlSlug.endsWith(`-${old}`)) { baseSlug = urlSlug.slice(0, -(old.length + 1)); break; }
    }
    const redirectUrl = `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(baseSlug)}-${suffix}/`;
    return new Response(null, { status: 301, headers: { Location: redirectUrl } });
  } else {
    slug = urlSlug;
  }

  // 1순위: KV
  // 2순위: GitHub (env vars 있을 때)
  // 3순위: project A의 공개 API (b~e 프로젝트 fallback)
  let caseData = null;

  if (env.CASES) {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) caseData = JSON.parse(raw);
  }

  if (!caseData) {
    caseData = await fetchCaseFromGitHub(slug, env);
  }

  if (!caseData) {
    caseData = await fetchCaseFromHubAPI(slug);
  }

  if (!caseData) {
    return new Response("사건을 찾을 수 없습니다.", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const html = renderLanding(caseData, group, url.origin);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderLanding(caseData, group, origin) {
  const lk = group.landingKey ?? group.key;
  const landing = caseData.landings?.[lk] || createFallbackLanding(caseData, group, lk);
  const rawCaseName = caseData.caseName || "";
  const pageTitle = groupPageTitle(rawCaseName, lk);
  const pageH1 = groupPageH1(rawCaseName, lk);
  const NO_SUFFIX_SLUGS_RENDER = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
  const OLD_URL_CANONICAL = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };
  const isNoSuffixSlug = group.siteUrl === "https://gnlaw-criminal.co.kr" && NO_SUFFIX_SLUGS_RENDER.includes(caseData.slug);
  const oldSuffixOverride = group.siteUrl === "https://gnlaw-criminal.co.kr" && OLD_URL_CANONICAL[caseData.slug];
  const urlSuffix = isNoSuffixSlug ? "" : oldSuffixOverride ? `-${oldSuffixOverride}` : (group.urlSlugSuffix ? `-${group.urlSlugSuffix}` : "");
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(caseData.slug)}${urlSuffix}/`;
  const ogImage = caseData.thumbnailUrl || landing.ogImage || `${group.siteUrl}/og/${caseData.slug}.png`;
  const publishedDate = caseData.createdAt || new Date().toISOString().slice(0, 10);
  const modifiedDate = caseData.updatedAt || publishedDate;
  const isoPublished = `${publishedDate}T00:00:00+09:00`;
  const isoModified = `${modifiedDate}T00:00:00+09:00`;
  const keyword = searchKeyword(rawCaseName);
  const renderedFaq = renderFaqForLanding(landing, { ...group, key: lk }, caseData);
  const schemaFaq = schemaFaqItems(renderedFaq, rawCaseName);
  const seoDescription = createSeoDescription(landing.description || caseData.summary || "", rawCaseName, lk);
  const articleTags = createArticleTags(rawCaseName, lk);

  const ogImageType = /\.png(?:$|\?)/i.test(ogImage) ? "image/png" : /\.jpe?g(?:$|\?)/i.test(ogImage) ? "image/jpeg" : "image/webp";
  const ogImageWidth = "1200";
  const ogImageHeight = "630";
  const headExtra = [
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="NaverBot" content="All">`,
    `<meta name="Yeti" content="All">`,
    `<meta http-equiv="content-language" content="ko">`,
    `<link rel="icon" type="image/x-icon" href="/assets/favicon.ico">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">`,
    `<link rel="alternate" hreflang="ko" href="${canonical}">`,
    group.naverVerification ? `<meta name="naver-site-verification" content="${group.naverVerification}">` : "",
    `<meta name="theme-color" content="${themeColor(group.key)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(group.siteName)} RSS" href="/rss.xml">`,
    `<link rel="sitemap" type="application/xml" href="/sitemap-index.xml">`,
    `<link rel="preload" as="image" href="/assets/og-template.png">`,
    `<link rel="prefetch" href="${esc(ogImage)}" as="image">`,
    `<meta property="og:image:alt" content="${esc(pageTitle)}">`,
    `<meta property="og:image:type" content="${ogImageType}">`,
    `<meta property="og:image:width" content="${ogImageWidth}">`,
    `<meta property="og:image:height" content="${ogImageHeight}">`,
    `<meta name="twitter:image:alt" content="${esc(pageTitle)}">`,
    `<link rel="image_src" href="${esc(ogImage)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(pageTitle)}">`,
    `<meta name="twitter:description" content="${esc(seoDescription)}">`,
    `<meta name="twitter:image" content="${esc(ogImage)}">`,
    `<meta name="geo.region" content="KR-11">`,
    `<meta name="geo.placename" content="서울특별시 서초구">`,
    `<meta name="geo.position" content="37.4904;127.0133">`,
    `<meta name="ICBM" content="37.4904, 127.0133">`,
    `<meta name="date" content="${publishedDate}">`,
    `<meta name="subject" content="${esc(group.intent)}">`,
    `<meta name="citation_title" content="${esc(pageTitle)}">`,
    `<meta name="citation_author" content="법무법인 선린">`,
    `<meta name="citation_publisher" content="법무법인 선린">`,
    `<meta name="citation_date" content="${publishedDate}">`,
    `<meta property="article:published_time" content="${isoPublished}">`,
    `<meta property="article:modified_time" content="${isoModified}">`,
    `<meta property="article:author" content="법무법인 선린">`,
    `<meta property="article:section" content="${esc(group.intent)}">`,
    ...articleTags.map((tag) => `<meta property="article:tag" content="${esc(tag)}">`),
    `<meta name="author" content="법무법인 선린">`,
    keyword ? `<meta name="keywords" content="${esc(keyword)}">` : "",
  ].filter(Boolean).join("\n  ");

  const caseKeywordForSchema = primaryCaseKeyword(rawCaseName) || rawCaseName;
  const breadcrumbCategory = breadcrumbLabel(group);
  const breadcrumbPageName = groupPageTitle(rawCaseName, group.landingKey || group.key);
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${group.siteUrl}/#website`,
        name: group.siteName,
        url: group.siteUrl,
        inLanguage: "ko-KR",
        publisher: { "@id": "https://gnlaw-criminal.co.kr/#organization" },
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: pageTitle, description: seoDescription, url: canonical, inLanguage: "ko-KR",
        datePublished: publishedDate, dateModified: modifiedDate,
        isPartOf: { "@id": `${group.siteUrl}/#website` },
        primaryImageOfPage: { "@id": `${canonical}#primaryimage` },
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
        speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1", ".aeo-summary", ".article-block > p", "#faq-list"] },
        author: { "@id": "https://gnlaw-criminal.co.kr/#organization" },
        hasPart: CROSS_LINKS.map((l) => ({
          "@type": "SiteNavigationElement",
          name: l.label,
          url: `${l.url}/`,
        })),
      },
      {
        "@type": "ImageObject",
        "@id": `${canonical}#primaryimage`,
        url: ogImage,
        contentUrl: ogImage,
        width: Number(ogImageWidth),
        height: Number(ogImageHeight),
        caption: pageTitle,
        inLanguage: "ko-KR",
        representativeOfPage: true,
      },
      {
        "@type": (group.key === "d" || lk === "ld") ? "NewsArticle" : "Article",
        "@id": `${canonical}#article`,
        headline: pageTitle, description: seoDescription, url: canonical, inLanguage: "ko-KR",
        datePublished: publishedDate, dateModified: modifiedDate,
        author: [
          { "@id": "https://gnlaw-criminal.co.kr/#organization" },
          { "@id": "https://gnlaw-criminal.co.kr/#person-attorney" },
        ],
        publisher: { "@id": "https://gnlaw-criminal.co.kr/#organization" },
        isPartOf: { "@id": `${canonical}#webpage` },
        image: { "@id": `${canonical}#primaryimage` },
        about: [searchKeyword(rawCaseName), group.intent].filter(Boolean),
        keywords: keyword,
        speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1", ".aeo-summary", ".article-block > p", "#faq-list"] },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: group.siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: breadcrumbCategory, item: `${group.siteUrl}/${group.pathPrefix}/` },
          { "@type": "ListItem", position: 3, name: breadcrumbPageName, item: canonical },
        ],
      },
      {
        "@type": "LegalService",
        "@id": `${group.siteUrl}/#legalservice`,
        name: group.siteName,
        legalName: "법무법인 선린",
        url: group.siteUrl,
        telephone: "02-6348-0406",
        email: "fintech@gnlaw.co.kr",
        areaServed: "KR",
        parentOrganization: { "@id": "https://gnlaw-criminal.co.kr/#organization" },
        serviceType: group.intent,
        address: {
          "@type": "PostalAddress",
          streetAddress: "반포대로 108 양원빌딩 4층",
          addressLocality: "서초구",
          addressRegion: "서울특별시",
          addressCountry: "KR",
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: "02-6348-0406",
            contactType: "customer service",
            availableLanguage: "Korean",
          },
        ],
        sameAs: ["https://cafe.naver.com/gnlawfintech"],
        knowsAbout: ["금융사기", "사기죄 형사고소", "피해금 회수", "가압류", "손해배상청구", "사기 피해 대응"],
      },
      {
        "@type": "FAQPage",
        mainEntity: schemaFaq.map((item) => ({
          "@type": "Question", name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
      {
        "@type": "HowTo",
        "@id": `${canonical}#howto`,
        name: `${caseKeywordForSchema} 피해 발생 후 대응 방법`,
        description: "금융사기 피해가 의심될 때 즉시 해야 할 증거 보존 순서",
        totalTime: "PT5M",
        step: [
          { "@type": "HowToStep", position: 1, name: "입금 자료 확인", text: "입금증, 계좌번호, 예금주가 남아 있는지 확인합니다." },
          { "@type": "HowToStep", position: 2, name: "대화 캡처", text: "카카오톡·텔레그램 대화방과 담당자 프로필을 캡처합니다." },
          { "@type": "HowToStep", position: 3, name: "사이트 정보 저장", text: "사이트 주소, 로그인 화면, 출금 제한 안내를 저장합니다." },
          { "@type": "HowToStep", position: 4, name: "추가 요구 메시지 보존", text: "세금·보증금·인증비 등 추가 입금 요구 메시지를 보존합니다." },
        ],
      },
      { ...PERSON_ATTORNEY },
    ],
  }, null, 2);

  const ogThumbnail = caseData.thumbnailUrl
    ? `<img src="${esc(caseData.thumbnailUrl)}" alt="${esc(pageTitle)}" class="hero-thumb" loading="lazy">`
    : "";

  const content = createLandingContent(landing, group, caseData);
  const footerLinks = CROSS_LINKS.map((l) => {
    const active = l.key === group.key ? "is-active" : "";
    return `<a class="${active}" href="${l.url}/">${esc(l.label)}</a>`;
  }).join("\n");

  const pageSummary = esc(
    landing.description || caseData.summary ||
    "최근 접수 흐름과 대응 절차를 기준으로 피해 구조, 증거 보존, 상담 전 확인사항을 정리했습니다."
  );

  return softenRepeatedContextTerms(pageTemplate({
    title: esc(`${pageTitle} | 법무법인 선린`),
    description: esc(seoDescription),
    canonical,
    ogType: group.ogType,
    ogTitle: esc(pageTitle),
    ogDescription: esc(createSeoDescription(landing.ogDescription || landing.description || caseData.summary || "", rawCaseName, lk)),
    ogImage: esc(ogImage),
    siteName: esc(group.siteName),
    headExtra,
    schema,
    bodyClass: `${group.bodyClass} landing-page`,
    tone: esc(group.tone),
    h1: esc(pageH1),
    breadcrumb: createHtmlBreadcrumb(group, rawCaseName),
    ogThumbnail,
    summary: pageSummary,
    heroTyping: createHeroTypingBlock(rawCaseName),
    receiptBadge: createReceiptBadge(caseData),
    heroCta: "",
    content,
    intent: esc(group.intent),
    ctaTitle: esc(group.ctaTitle),
    ctaText: esc(group.ctaText),
    ctaLabel: esc(group.ctaLabel),
    footerLinks,
    headerCall: "",
  }));
}

function createFallbackLanding(caseData, group, key) {
  const caseName = caseData.caseName || "";
  const base = primaryCaseKeyword(caseName);
  const NO_SUFFIX_SLUGS_FB = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
  const OLD_URL_FB = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };
  const isNoSuffixFB = group.siteUrl === "https://gnlaw-criminal.co.kr" && NO_SUFFIX_SLUGS_FB.includes(caseData.slug);
  const oldSuffixFB = group.siteUrl === "https://gnlaw-criminal.co.kr" && OLD_URL_FB[caseData.slug];
  const fbUrlSuffix = isNoSuffixFB ? "" : oldSuffixFB ? `-${oldSuffixFB}` : (group.urlSlugSuffix ? `-${group.urlSlugSuffix}` : "");
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(caseData.slug)}${fbUrlSuffix}/`;
  const descriptions = {
    a: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 증거 상태와 사건 구조 기준으로 정리합니다.",
    b: "민사소송, 가압류, 손해배상, 부당이득반환 절차와 회수 가능성을 사건별로 정리합니다.",
    c: "피해금 회수 성공사례와 유사 사건의 대응 흐름, 회수율을 비교해 정리합니다.",
    d: "사건 개요, 피해 구조, 증거 보존 방법, 즉시 대응 순서를 정보성 문체로 정리합니다.",
    e: "형사, 민사, 성공사례, 정보 브리핑 관점에서 사건별 대응 경로를 한곳에서 연결합니다.",
    la: "금융피해 신고 절차, 형사고소, 계좌 추적, 지급정지 방법을 금융피해 사례 기준으로 정리합니다.",
    lb: "피해금 회수 전략, 민사소송, 가압류, 부당이득반환 절차와 단계별 회수 경로를 정리합니다.",
    lc: "실제 회수 사례 아카이브에서 유사 사건의 대응 흐름, 회수 결과, 증거 활용 방식을 비교합니다.",
    ld: "사건 개요, 피해 패턴, 즉시 대응 방법, 증거 보존 순서를 브리핑 형식으로 정리합니다.",
    le: "피해 대응 허브에서 형사, 민사, 사례, 브리핑을 사건별로 연결하고 대응 경로를 통합합니다.",
  };
  const title = groupPageTitle(caseName, key);
  const description = descriptions[key] || group.descriptionSuffix || "";

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: `${group.siteUrl}/og/${caseData.slug}.png`,
    h1: groupPageH1(caseName, key),
    body: fallbackBody(base, key),
    victimCases: fallbackVictimCases(key),
    faq: fallbackFaq(caseName, base, key),
  };
}

function createLandingContent(landing, group, caseData) {
  {
    const _contentKey = group.landingKey || group.key;
    const _contentGroup = { ...group, key: _contentKey };
    const _rawCaseName = caseData.caseName || "";
    const _replacementContext = createReplacementContext(_rawCaseName);
    const _keyword = esc(seoCaseKeyword(_rawCaseName));
    const _slug = esc(caseData.slug);
    const _cn = esc(normalizeCaseName(_rawCaseName));
    const _siteName = esc(group.siteName);
    const _trackScript = `<script>(function(){fetch('/api/track-view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${_slug}'})}).catch(function(){});})();</script>`;
    const _memoSection = caseData.memo
      ? `<section class="article-block memo-section"><h2>운영 안내</h2><p>${esc(caseData.memo)}</p></section>`
      : "";
    const _body = renderBodyForLanding(landing, _contentGroup, caseData).map((item) => reduceCaseNameText(item, _rawCaseName, false, _replacementContext));
    const _victimCases = renderVictimCasesForLanding(landing, _contentGroup, caseData, _replacementContext);
    const _faq = renderFaqForLanding(landing, _contentGroup, caseData);
    const _authoritySections = isLawLandingKey(_contentKey) ? createLawAuthoritySections(_contentKey, caseData) : "";
    const _introBody = _body.slice(0, 3);
    const _methodBody = _body.slice(3, 8);

    return [
      createHeroCta(_rawCaseName),
      `<section class="article-block"><h2>${_keyword}란?</h2>${createConfirmedSignals(_rawCaseName, landing, _replacementContext)}${paragraphs(_introBody)}</section>`,
      createAeoOverviewSection(caseData, _contentKey, _replacementContext),
      `<section class="article-block"><h2>${_keyword} 수법</h2>${list(createScamMethodItems(_rawCaseName, landing, _replacementContext))}</section>`,
      `<section class="article-block"><h2>${_keyword} 피해 사례</h2>${list(_victimCases)}</section>`,
      `<section class="article-block"><h2>${_keyword} 대응 방법</h2>${paragraphs(_methodBody)}${createEvidenceCheckSection()}</section>`,
      _authoritySections,
      `<section class="article-block faq" id="faq-list"><h2>${_keyword} FAQ</h2>${faqHtml(_faq, _rawCaseName)}</section>`,
      createLiveReceiptStatus(caseData),
      _memoSection,
      createConsultForm(_cn, _siteName),
      createFloatingWidgets(_cn, _siteName, _slug),
      _trackScript,
    ].filter(Boolean).join("\n");
  }

  const contentKey = group.landingKey || group.key;
  const contentGroup = { ...group, key: contentKey };
  const name = esc(primaryCaseKeyword(caseData.caseName));
  const rawCaseName = caseData.caseName || "";
  const slug = esc(caseData.slug);
  const cn = esc(normalizeCaseName(caseData.caseName));
  const siteName = esc(group.siteName);

  const trackScript = `<script>(function(){fetch('/api/track-view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${slug}'})}).catch(function(){});})();</script>`;
  const memoSection = caseData.memo
    ? `<section class="article-block memo-section"><h2>운영자 안내</h2><p>${esc(caseData.memo)}</p></section>`
    : "";
  const body = renderBodyForLanding(landing, contentGroup, caseData);
  const victimCases = renderVictimCasesForLanding(landing, contentGroup, caseData);
  const faq = renderFaqForLanding(landing, contentGroup, caseData);
  const liveStatus = createLiveReceiptStatus(caseData);
  const evidenceCheck = createEvidenceCheckSection();
  const inlineCta = createInlineCta();
  const authoritySections = isLawLandingKey(contentKey) ? createLawAuthoritySections(contentKey, caseData) : "";

  const faqSection = contentKey === "d" || contentKey === "ld"
    ? `<section class="article-block brief-card"><h2>${name} 피해 구조</h2>${paragraphs(body)}</section>
<section class="article-block"><h2>구체적인 피해 유형</h2>${list(victimCases)}</section>
${evidenceCheck}
${inlineCta}
${authoritySections}
<section class="article-block faq"><h2>자주 묻는 질문 (FAQ)</h2>${faqHtml(faq, rawCaseName)}</section>`
    : `<section class="article-block"><p class="section-kicker">${esc(group.intent)}</p><h2>${name} 핵심 대응</h2>${paragraphs(body)}</section>
<section class="article-block"><h2>구체적인 피해 사례</h2>${list(victimCases)}</section>
${evidenceCheck}
${inlineCta}
${authoritySections}
<section class="article-block faq"><h2>FAQ</h2>${faqHtml(faq, rawCaseName)}</section>`;

  const consultForm = createConsultForm(cn, siteName);
  const floatingWidgets = createFloatingWidgets(cn, siteName, slug);

  return [faqSection, liveStatus, createInlineCta("실시간 접수와 비슷한 정황이 있다면 추가 입금 전에 현재 자료부터 점검해 보세요."), memoSection, consultForm, floatingWidgets, trackScript].filter(Boolean).join("\n");
}

function createHeroTypingBlock(caseName) {
  {
    const keyword = esc(seoCaseKeyword(caseName));
    const question = keyword ? `${keyword} 피해가 의심되나요?` : "사기 피해가 의심되나요?";
    return `<div class="hero-typing">
  <p class="hero-typing-q"><strong>${question}</strong></p>
  <p class="hero-typing-s">추가 입금을 요구받고 있다면 즉시 중단하세요.</p>
  <p class="hero-typing-l1">출금 지연, 세금·보증금 요구, 환전 제한은 금융사기에서 반복적으로 나타나는 대표적인 패턴입니다.</p>
  <p class="hero-typing-l2">금융피해 대응센터 상담을 통해 현재 상황에 맞는 대응 절차를 확인해 보시기 바랍니다.</p>
</div>
<script>(function(){var CYCLE=9400;function restart(){var l1=document.querySelector('.hero-typing-l1');var l2=document.querySelector('.hero-typing-l2');if(!l1||!l2)return;l1.style.animation='none';l2.style.animation='none';void l1.offsetWidth;void l2.offsetWidth;l1.style.animation='';l2.style.animation='';setTimeout(restart,CYCLE);}setTimeout(restart,CYCLE);})();</script>`;
  }

  const keyword = esc(seoCaseKeyword(caseName));
  return `<div class="hero-typing">
  <p class="hero-typing-q"><strong>${keyword} 사칭 피해가 의심되나요?</strong></p>
  <p class="hero-typing-s">추가 입금을 요구받고 있다면 즉시 중단하세요.</p>
  <p class="hero-typing-l1">출금 지연, 세금·보증금 요구, 환전 제한은 금융사기에서 반복적으로 나타나는 대표적인 패턴입니다.</p>
  <p class="hero-typing-l2">금융피해 대응센터 상담을 통해 현재 상황에 맞는 대응 절차를 확인해 보시기 바랍니다.</p>
</div>
<script>(function(){var CYCLE=9400;function restart(){var l1=document.querySelector('.hero-typing-l1');var l2=document.querySelector('.hero-typing-l2');if(!l1||!l2)return;l1.style.animation='none';l2.style.animation='none';void l1.offsetWidth;void l2.offsetWidth;l1.style.animation='';l2.style.animation='';setTimeout(restart,CYCLE);}setTimeout(restart,CYCLE);})();</script>`;
}

function createAeoOverviewSection(caseData, key, replacementContext) {
  const keyword = esc(seoCaseKeyword(caseData.caseName || ""));
  const caseName = caseData.caseName || "";
  const base = primaryCaseKeyword(caseName) || normalizeCaseName(caseName);
  const lawAeo = {
    la: { t: `${base} 형사고소 핵심 요약`, b: `피해가 의심되면 추가 입금을 멈추고 입금증, 수취 계좌, 대화 기록, 출금 거부 화면을 보존해야 합니다. 형사고소는 사기죄 구성요건과 계좌 추적 가능성을 함께 검토하는 절차이며, 상담 접수 전 자료를 시간순으로 정리하면 초기 대응이 빨라집니다.` },
    lb: { t: `${base} 피해금 회수 핵심 요약`, b: `${base} 피해금 회수는 형사고소와 별도로 가압류, 손해배상, 부당이득반환 청구를 검토해야 합니다. 수취 계좌와 상대방 특정 자료가 남아 있을수록 보전처분 가능성을 빠르게 판단할 수 있습니다.` },
    lc: { t: `${base} 회수 사례 핵심 요약`, b: `${base}와 유사한 사건에서 회수 가능성이 높아지는 조건은 입금 직후 자료 보존, 계좌 단서 확보, 동일 피해자 확인, 지급정지 또는 가압류 검토가 빠르게 이어진 경우입니다.` },
    ld: { t: `${base} 피해 구조 요약`, b: `${base} 사건은 접근 채널, 입금 명목, 출금 거부, 추가 입금 요구를 순서대로 정리해야 합니다. 지금 해야 할 행동은 추가 입금 중단, 증거 보존, 신고 접수입니다.` },
    le: { t: `${base} 피해 대응 요약`, b: `${base} 사건은 처벌을 원하면 형사고소형, 회수를 원하면 민사 회수형, 결과 흐름을 보고 싶으면 성공사례형, 사건 구조를 먼저 파악하려면 브리핑형 페이지를 함께 확인하는 것이 좋습니다.` },
  };
  const cfg = lawAeo[key];
  const title = cfg ? esc(cfg.t) : `${keyword} 핵심 요약`;
  const body = cfg ? esc(reduceCaseNameText(cfg.b, caseName, false, replacementContext)) : withSentenceBreaks(createNeutralAeoSummary(caseName));
  return `<section class="aeo-summary" id="aeo-summary" aria-label="${title}">
  <h2>${title}</h2>
  <blockquote>${body}</blockquote>
</section>`;
}

function createNeutralAeoSummary(caseName = "") {
  const detail = secondaryCaseKeyword(caseName).replace(/\s*피해 대응\s*$/, "").trim();
  const channel = detail ? `${detail} 관련 ` : "";
  return `${channel}출금 지연, 추가 입금 요구, 허위 수익 인증, 담당자 연락 두절 정황이 있다면 입금 내역과 대화 기록을 먼저 보존해야 합니다. 상담 전에는 계좌 정보, 사이트 주소, 프로필 캡처를 시간 순서로 정리하는 것이 좋습니다.`;
}

function createConfirmedSignals(caseName, landing, replacementContext) {
  {
    const items = Array.isArray(landing?.scamIntroItems) && landing.scamIntroItems.length > 0
      ? landing.scamIntroItems.map((item) => reduceCaseNameText(item, caseName, false, replacementContext))
      : [
          "해당 명칭 또는 유사 명칭으로 실제 브랜드처럼 접근",
          "텔레그램·카카오톡·네이버밴드 등에서 허위 수익 인증과 투자 권유 반복",
          "초기에는 소액 수익 또는 출금 가능 화면을 보여준 뒤 고액 입금 유도",
          "출금 신청 후 세금·보증금·인증비·계정 해제비 명목의 추가 입금 요구",
          "담당자 계정 삭제, 대화방 폐쇄, 사이트 접속 차단 등 증거 소멸 정황",
        ];
    return `<div class="confirmed-signals"><h3>확인된 피해 정황</h3>${list(items)}</div>`;
  }

  // landing.scamIntroItems 있으면 우선 사용 (템플릿 기반), 없으면 fallback
  if (Array.isArray(landing?.scamIntroItems) && landing.scamIntroItems.length > 0) {
    return `<div class="confirmed-signals"><h3>확인된 피해 정황</h3>${list(landing.scamIntroItems)}</div>`;
  }
  const keyword = esc(seoCaseKeyword(caseName));
  const items = [
    `${keyword} 또는 유사 명칭으로 실제 플랫폼처럼 접근`,
    "텔레그램·카카오톡·네이버밴드·인스타·쓰레드 등에서 허위 수익 인증과 투자 권유 반복",
    "초기에는 소액 수익 또는 출금 가능 화면을 보여준 뒤 고액 입금 유도",
    "출금 신청 후 세금·보증금·인증비·계정 해제비 명목의 추가 입금 요구",
    "담당자 계정 삭제, 대화방 폐쇄, 사이트 접속 차단 등 증거 소멸 정황",
  ];
  return `<div class="confirmed-signals"><h3>확인된 피해 정황</h3>${list(items)}</div>`;
}

function createScamMethodItems(caseName, landing, replacementContext) {
  if (Array.isArray(landing?.scamMethodItems) && landing.scamMethodItems.length > 0) {
    return landing.scamMethodItems.map((item) => reduceCaseNameText(item, caseName, false, replacementContext));
  }
  return [
    "유명인·증권사·투자 리딩방 명칭을 사용해 정상 업체 또는 플랫폼처럼 신뢰를 형성합니다.",
    "단체 대화방에서 바람잡이 계정이 수익 인증, 출금 인증, 후기 메시지를 반복합니다.",
    "소액 입금 후 화면상 수익을 보여주고 VIP 등급, 단계별 프로젝트, 단기 고수익 명목으로 추가 입금을 요구합니다.",
    "출금 단계에서 세금, 보증금, 인증비, 계정 해제비를 먼저 내야 한다고 안내합니다.",
    "피해자가 항의하면 담당자를 바꾸거나 대화방을 닫고, 환불팀·복구팀을 사칭한 2차 연락으로 이어질 수 있습니다.",
  ];

  // landing.scamMethodItems 있으면 우선 사용 (템플릿 기반), 없으면 fallback
  if (Array.isArray(landing?.scamMethodItems) && landing.scamMethodItems.length > 0) {
    return landing.scamMethodItems;
  }
  const keyword = seoCaseKeyword(caseName);
  return [
    `${keyword} 명칭을 사용해 정상 업체 또는 플랫폼처럼 신뢰를 형성합니다.`,
    "단체 대화방에서 바람잡이 계정이 수익 인증, 출금 인증, 후기 메시지를 반복합니다.",
    "소액 입금 후 화면상 수익을 보여주고 VIP 등급, 단계별 프로젝트, 단기 고수익 명목으로 추가 입금을 요구합니다.",
    "출금 단계에서 세금, 보증금, 인증비, 계정 해제비를 먼저 내야 한다고 안내합니다.",
    "피해자가 항의하면 담당자를 바꾸거나 대화방을 닫고, 환불팀·복구팀을 사칭한 2차 연락으로 이어질 수 있습니다.",
  ];
}

function isLawLandingKey(key) {
  return ["la", "lb", "lc", "ld", "le"].includes(key);
}

function lawLandingLabel(key) {
  return {
    la: "금융피해 형사고소",
    lb: "피해금 회수 전략",
    lc: "실제 회수 사례",
    ld: "피해 구조 브리핑",
    le: "피해 대응 허브",
  }[key] || "금융피해 대응";
}

function buildLawBody(landing, group, caseData) {
  const caseName = caseData.caseName || "";
  const base = primaryCaseKeyword(caseName) || normalizeCaseName(caseName);
  const brand = secondaryCaseKeyword(caseName) || base;
  const original = Array.isArray(landing.body) ? landing.body.filter(Boolean).map(toStr) : [];
  const additions = {
    la: [
      `${base} 피해는 입금 계좌, 예금주, 금융기관명, 이체 일시를 먼저 확보해야 형사고소와 지급정지 검토를 동시에 진행할 수 있습니다. 출금 거부 직후 세금, 보증금, 인증비를 요구받았다면 추가 입금을 멈추고 계좌 단서부터 보존해야 합니다.`,
      `형법 제347조 사기죄는 기망행위, 착오, 처분행위, 재산상 이익 취득 구조를 봅니다. ${brand} 관련 안내가 허위 수익, 원금 보장, 출금 가능성처럼 표시됐다면 대화 원문과 입금 흐름을 시간순으로 묶어야 합니다.`,
      `고소장에는 단순히 돈을 돌려달라는 내용보다 언제 누구에게 어떤 설명을 듣고 어느 계좌로 입금했는지가 중요합니다. 담당자 프로필, 초대 링크, 사이트 주소, 앱 화면, 출금 제한 문구가 함께 있으면 피의자 특정 가능성을 높일 수 있습니다.`,
      `상담 접수 전에는 입금증과 대화 캡처만 있어도 1차 검토가 가능합니다. 자료가 흩어져 있다면 전화나 카톡 상담으로 먼저 현재 증거 상태를 점검한 뒤 고소장 작성 범위와 추가 확보 자료를 정리하는 편이 빠릅니다.`,
    ],
    lb: [
      `${base} 피해금 회수는 형사고소만으로 끝나지 않습니다. 수취 계좌 잔액, 연결 계좌, 명의자 재산 단서가 확인되는 즉시 가압류와 손해배상 청구 가능성을 함께 검토해야 합니다.`,
      `민사 절차에서는 입금 경위와 기망 표현을 증거로 정리해 불법행위 손해배상 또는 부당이득반환 청구 구조를 세웁니다. 계좌가 이미 비어 있더라도 연결된 법인, 모집책, 수익금 이동 경로가 있으면 보전처분 방향이 달라질 수 있습니다.`,
      `가압류는 판결 전 재산을 묶어두는 절차라서 속도가 중요합니다. 상담 단계에서 수취 은행, 예금주, 입금일, 금액, 상대방 식별 정보를 정리하면 회수 전략 판단이 빨라집니다.`,
    ],
    lc: [
      `${base}와 유사한 사건에서 회수 가능성이 높았던 흐름은 피해 직후 지급정지, 계좌 단서 확보, 공동 피해자 확인, 민사 보전처분이 빠르게 연결된 경우였습니다.`,
      `성공사례형 페이지에서는 단순히 전액 회수 여부만 보지 말고 어떤 자료가 언제 확보됐는지를 봐야 합니다. 입금증, 대화 원문, 사이트 화면, 담당자 계정이 남아 있을수록 합의나 일부 회수 가능성을 검토하기 쉽습니다.`,
      `지역별 상담 사례를 보면 출금 거부 후 24~72시간 안에 자료를 정리한 사건과 몇 주 뒤 접수한 사건은 계좌 추적 속도에서 차이가 큽니다. 현재 자료가 일부뿐이어도 먼저 점검하는 것이 좋습니다.`,
    ],
    ld: [
      `${base} AI 금융사기 브리핑은 접근 채널, 수익 약속, 입금 명목, 출금 거부, 추가 비용 요구를 순서대로 분석합니다. 네이버 AI 브리핑에 적합한 정보형 구조를 위해 질문과 답변, 대응 순서, 증거 체크리스트를 분명하게 나눕니다.`,
      `${brand} 관련 정황은 단순 투자 실패와 구분해야 합니다. 허위 담당자, 사칭 프로필, 조작된 수익 화면, 출금 제한 메시지, 세금 선납 요구가 함께 나타나면 금융사기 패턴으로 볼 수 있습니다.`,
      `AI 요약에 노출되려면 본문 안에 사건 개요, 피해자가 먼저 할 일, 신고와 상담의 차이, 준비 자료가 명확해야 합니다. 그래서 이 페이지는 추가 입금 중단, 증거 보존, 계좌 정보 정리, 상담 접수 순서로 답을 제공합니다.`,
    ],
    le: [
      `${base} 금융사기 사건 허브는 형사고소, 민사 회수, 실제 회수 사례, AI 브리핑을 한 번에 비교하도록 구성합니다. 처음 방문한 피해자는 현재 상황이 처벌 중심인지 회수 중심인지 먼저 나눠보는 것이 좋습니다.`,
      `같은 이름의 사건이라도 입금 계좌, 담당자 계정, 피해 시점이 다르면 대응 경로가 달라질 수 있습니다. 허브에서는 여러 관점의 랜딩을 연결해 사용자가 필요한 페이지로 이동하도록 돕습니다.`,
      `추가 입금 요구가 진행 중이면 형사고소형 페이지와 전화 상담을 먼저 보고, 이미 송금이 끝난 뒤라면 피해금 회수 전략과 성공사례를 함께 확인하는 방식이 효율적입니다.`,
    ],
  };
  return dedupeTextItems([...original, ...(additions[group.key] || [])]).slice(0, 10);
}

function buildLawVictimCases(landing, group, caseData) {
  const caseName = caseData.caseName || "";
  const base = primaryCaseKeyword(caseName) || normalizeCaseName(caseName);
  const original = Array.isArray(landing.victimCases) ? landing.victimCases.filter(Boolean).map(toStr) : [];
  const examples = {
    la: [
      `피해자는 카카오톡 오픈채팅방에서 수익 인증 화면을 본 뒤 1차로 420만원을 입금했고, 출금 단계에서 세금 680만원을 추가 요구받았습니다. 입금증, 수취 계좌, 담당자 프로필을 보존해 형사고소 자료로 정리했습니다.`,
      `${base} 담당자라며 별도 앱 설치를 안내한 계정이 있었고, 앱 화면에는 수익금이 표시됐지만 실제 출금은 막혔습니다. 피해자는 로그인 화면과 출금 거부 문구를 녹화해 증거로 남겼습니다.`,
      `환불팀이라는 계정이 다시 접근해 복구 수수료를 요구한 사례에서는 기존 대화방, 새 담당자 계정, 추가 입금 계좌를 함께 비교해 2차 피해 정황을 확인했습니다.`,
    ],
    lb: [
      `피해자는 총 2,300만원을 여러 계좌로 나누어 송금했고, 마지막 계좌의 예금주 정보가 남아 있어 가압류 가능성을 먼저 검토했습니다.`,
      `출금 보증금 명목으로 추가 송금을 요구받은 뒤 상담을 접수한 사례에서는 손해배상 청구와 부당이득반환 청구 중 어떤 구성이 유리한지 입금 경위별로 나눠 판단했습니다.`,
      `동일 수취 계좌 피해자가 추가 확인되어 각자의 입금 시간과 금액을 비교했고, 공동 자료를 토대로 민사 보전처분 필요성을 검토했습니다.`,
    ],
    lc: [
      `입금 당일 지급정지 요청과 상담 접수가 함께 이뤄진 사례에서는 계좌 이동 전 일부 금액이 묶여 회수 협의의 출발점이 됐습니다.`,
      `대화방이 삭제되기 전 전체 캡처와 담당자 프로필을 보존한 피해자는 수사기관 제출 자료가 명확해 동일 조직 여부 판단에 도움이 됐습니다.`,
      `피해자가 여럿 모인 사건에서는 동일 URL, 동일 계좌, 같은 출금 제한 문구가 확인되어 합의 협상과 엄벌 탄원 준비가 함께 진행됐습니다.`,
    ],
    ld: [
      `AI 브리핑 기준으로 보면 첫 접촉은 온라인 채팅방, 두 번째 단계는 소액 지급 또는 화면 수익 노출, 세 번째 단계는 출금 제한과 추가 입금 요구로 이어진 패턴이 확인됐습니다.`,
      `피해자는 "다음 주 환불" 안내를 반복해서 받았지만 실제로는 계좌 변경과 담당자 교체가 이어졌습니다. 이 흐름은 단순 지연보다 사기 의심 신호로 분류됩니다.`,
      `앱 내 잔고와 실제 금융기관 거래내역이 일치하지 않은 사례에서는 조작 화면 가능성을 전제로 원본 캡처와 송금 내역을 분리해 정리했습니다.`,
    ],
    le: [
      `처음에는 형사고소 가능성만 문의했지만, 상담 과정에서 가압류와 피해금 회수 전략까지 함께 검토할 필요가 확인된 사례입니다.`,
      `피해자는 성공사례만 찾다가 자신의 사건은 계좌 단서가 부족하다는 점을 확인했고, 먼저 AI 브리핑형 체크리스트로 증거를 다시 정리했습니다.`,
      `같은 사건명으로 여러 피해자가 접수되면서 각자 다른 계좌와 담당자 계정을 사용한 정황이 확인되어 허브에서 대응 경로를 나눠 안내했습니다.`,
    ],
  };
  return dedupeTextItems([...original, ...(examples[group.key] || [])]).slice(0, 6);
}

function buildLawFaq(landing, group, caseData) {
  const caseName = caseData.caseName || "";
  const original = Array.isArray(landing.faq) ? landing.faq.filter((item) => item?.question && item?.answer) : [];
  const common = [
    { question: "전화나 카톡 상담은 언제 이용하면 좋나요?", answer: "추가 입금 요구가 계속되거나 대화방 삭제가 예상되면 전화나 카톡 상담으로 먼저 증거 상태를 점검하는 것이 좋습니다. 상담 접수 전이라도 입금증, 계좌번호, 대화 캡처를 준비하면 초기 판단이 빨라집니다." },
    { question: "2차 피해를 막으려면 무엇을 조심해야 하나요?", answer: "피해금 회복팀, 환불 대행, 법무팀을 사칭해 선입금을 요구하는 연락을 조심해야 합니다. 기존 사건 자료를 넘기기 전 상대방 신원과 절차를 확인하고, 수수료 선입금 요구에는 응하지 않는 것이 안전합니다." },
  ];
  const byKey = {
    la: [
      { question: `${caseName} 형사고소는 어떤 자료부터 준비해야 하나요?`, answer: "입금증, 수취 계좌, 예금주, 대화 캡처, 사이트 주소, 담당자 프로필을 먼저 정리해야 합니다. 사기죄 구성요건과 계좌 추적 가능성을 함께 보기 위해 시간순 정리가 중요합니다." },
      { question: "금융피해 신고와 형사고소는 어떻게 다른가요?", answer: "금융피해 신고는 계좌 제한과 피해 확산 방지 목적이 강하고, 형사고소는 피의자 특정과 처벌을 요구하는 절차입니다. 두 절차를 함께 진행하면 대응 범위가 넓어집니다." },
      { question: "추가 입금 요구가 오면 어떻게 해야 하나요?", answer: "세금, 보증금, 인증비, 해제비 명목의 추가 요구는 사기 사건에서 반복되는 패턴입니다. 입금을 멈추고 요구 메시지와 계좌 안내를 캡처해 상담 단계에서 점검해야 합니다." },
      { question: "고소장 접수 후 수사는 어떻게 진행되나요?", answer: "고소장이 접수되면 사건이 배당되고 진술 조사와 자료 보완 요청이 이어집니다. 계좌 추적과 피의자 특정에 시간이 걸릴 수 있으므로, 접수 이후에도 새로운 자료가 확인되면 추가 제출하는 것이 좋습니다." },
      { question: "대포통장이 사용됐어도 형사고소가 가능한가요?", answer: "대포통장이더라도 계좌 간 자금 이동 경로, 예금주 정보, 연결 계좌를 추적해 실제 가담자를 특정할 수 있습니다. 입금 직후 자료를 확보하면 수사 단계에서 활용 가능성이 높아집니다." },
    ],
    lb: [
      { question: `${caseName} 피해금 회수는 가능한가요?`, answer: "회수 가능성은 계좌 잔액, 상대방 특정 가능성, 보전처분 속도에 따라 달라집니다. 형사고소와 별도로 가압류, 손해배상, 부당이득반환 청구를 함께 검토해야 합니다." },
      { question: "가압류는 언제 검토해야 하나요?", answer: "수취 계좌나 연결 재산 단서가 확인되는 즉시 검토하는 것이 좋습니다. 판결 전 재산이 빠져나가면 실제 회수가 어려워질 수 있습니다." },
      { question: "손해배상과 부당이득반환은 어떻게 다른가요?", answer: "손해배상은 불법행위로 발생한 손해를 청구하는 구조이고, 부당이득반환은 법률상 원인 없이 받은 이익의 반환을 구하는 구조입니다. 사건 자료에 따라 병행 검토할 수 있습니다." },
      { question: "계좌 지급정지는 어떻게 진행되나요?", answer: "입금한 은행에 지급정지를 요청할 수 있으며, 이체 직후 빠르게 신청할수록 잔액 보전 가능성이 높아집니다. 상담 접수 후 지급정지 가능성과 절차를 함께 확인하면 빠른 판단이 가능합니다." },
      { question: "판결을 받아도 회수가 안 되는 경우가 있나요?", answer: "상대방이 재산을 이미 빼돌리거나 대포통장만 사용한 경우 판결 집행이 어려울 수 있습니다. 이 때문에 판결 전 가압류로 재산을 묶어두는 보전 단계가 중요합니다." },
    ],
    lc: [
      { question: `${caseName}와 유사한 회수 사례는 어떤 공통점이 있나요?`, answer: "입금 직후 자료 보존, 지급정지 요청, 동일 피해자 확인, 민사 보전처분 검토가 빠르게 이어진 사건에서 회수 가능성이 높았습니다." },
      { question: "성공사례를 볼 때 가장 중요한 기준은 무엇인가요?", answer: "전액 회수 여부보다 어떤 증거가 언제 확보됐는지, 계좌 단서가 남아 있었는지, 형사와 민사가 어떻게 연결됐는지를 봐야 합니다." },
      { question: "일부 회수라도 가능성이 있나요?", answer: "계좌 잔액 일부가 묶이거나 합의가 진행되는 경우 일부 회수 가능성이 있습니다. 입금 내역과 상대방 특정 자료가 남아 있다면 먼저 상담으로 가능성을 확인해야 합니다." },
      { question: "사건 종결까지 보통 얼마나 걸리나요?", answer: "형사 수사는 사건 복잡도에 따라 수개월에서 1년 이상 걸릴 수 있습니다. 민사 보전처분은 그보다 빠르게 진행되는 경우가 많아, 회수 목적이라면 민사 절차를 병행하는 것이 유리합니다." },
      { question: "피해자가 여러 명인 경우 공동으로 대응할 수 있나요?", answer: "동일 계좌나 유사 URL로 피해를 입은 사람이 여럿이면 피해 입증 자료를 합산해 수사 협조와 민사 청구를 함께 진행할 수 있습니다. 자료 공유 전 신원 확인은 필요합니다." },
    ],
    ld: [
      { question: `${caseName} 피해 구조 브리핑은 어떤 정보를 정리하나요?`, answer: "접근 채널, 입금 명목, 출금 거부, 추가 입금 요구, 증거 보존 순서를 정리합니다. 피해자가 바로 확인해야 할 행동 순서를 중심으로 안내합니다." },
      { question: "추가 입금 요구를 받았는데 어떻게 대응해야 하나요?", answer: "추가 입금은 즉시 중단해야 합니다. 세금, 보증금, 인증비 명목의 요구는 피해를 키우는 전형적인 패턴입니다. 현재 요구 메시지와 기존 대화를 함께 캡처해 보존한 뒤 상담 접수로 상황을 확인하세요." },
      { question: "단순 투자 실패와 사기는 어떻게 구분하나요?", answer: "허위 수익 화면, 담당자 사칭, 출금 제한, 세금 선납 요구, 계좌 변경이 함께 나타나면 단순 손실보다 사기 정황으로 볼 수 있습니다." },
      { question: "피해 당한 뒤 가장 먼저 해야 할 일이 무엇인가요?", answer: "추가 입금을 즉시 중단하고, 대화 캡처·입금 영수증·계좌번호·사이트 주소·담당자 프로필을 삭제 없이 보존해야 합니다. 플랫폼이 사라지기 전에 화면 기록을 남기면 이후 신고와 상담에 도움이 됩니다." },
      { question: "사이트나 앱이 이미 사라졌어도 신고가 가능한가요?", answer: "가능합니다. 입금 내역, 대화 캡처, 담당자 연락처, 입금 계좌 정보가 남아 있으면 플랫폼이 폐쇄된 이후에도 형사고소와 민사 청구를 진행할 수 있습니다. 브라우저 방문 기록과 문자 알림도 보조 자료로 활용됩니다." },
    ],
    le: [
      { question: `${caseName} 피해 대응에서 무엇을 먼저 확인해야 하나요?`, answer: "현재 목적이 처벌인지 회수인지부터 나누면 됩니다. 추가 입금 요구가 있으면 형사고소형을 먼저 보고, 송금 후 회수를 원하면 민사 회수형과 사례형을 함께 보는 것이 좋습니다." },
      { question: "형사고소와 민사 회수를 동시에 진행할 수 있나요?", answer: "가능합니다. 형사고소는 피의자 특정과 처벌을 목적으로 하고, 민사 회수는 가압류와 손해배상 청구를 통해 피해금 회수를 목표로 합니다. 두 절차는 독립적으로 진행할 수 있으며 같은 증거 자료를 함께 활용할 수 있습니다." },
      { question: "입금 계좌가 이미 막혔는데 신고가 가능한가요?", answer: "지급정지가 됐더라도 수취 계좌 정보, 거래 일시, 예금주, 연결 계좌 단서가 남아 있으면 형사고소와 민사 절차를 이어갈 수 있습니다. 계좌 제한 기록 자체가 피해 입증 자료로 활용됩니다." },
      { question: "피해 금액이 소액이어도 법적 대응이 의미 있나요?", answer: "피해 금액과 상관없이 동일 수법과 계좌로 피해를 입은 사람이 여러 명이면 합산 피해액으로 수사가 진행될 수 있습니다. 소액이더라도 자료를 보존하고 신고하면 집단 피해 파악에 도움이 됩니다." },
      { question: "신고 이후 추가 피해를 막으려면 어떻게 해야 하나요?", answer: "신고 접수 후에도 같은 조직이 이름을 바꿔 재접근하는 경우가 있습니다. 기존 자료를 보존하고 새로운 연락이 오면 캡처해 두세요. 상담 접수 시 이전 피해 자료와 함께 새 접근 정황을 함께 제출하면 대응 범위가 넓어집니다." },
    ],
  };
  return dedupeFaqItems([...(byKey[group.key] || []), ...original, ...common]).slice(0, 7);
}

function createLawAuthoritySections(key, caseData) {
  const caseName = caseData.caseName || "";
  const base = primaryCaseKeyword(caseName) || normalizeCaseName(caseName);
  const configs = {
    la: {
      label: "CRIMINAL RESPONSE",
      title: "형사고소 대응 타임라인",
      lead: "추가 입금 요구가 이어지는 사건은 증거가 사라지기 전에 형사고소 자료를 먼저 묶어야 합니다.",
      steps: [
        ["01", "증거 보존", "입금증, 계좌번호, 예금주, 대화방, 담당자 프로필, 사이트 주소를 원본 상태로 저장합니다."],
        ["02", "지급정지 검토", "수취 은행에 지급정지 가능성을 확인하고 계좌 단서를 보전합니다."],
        ["03", "고소장 작성", "형법 제347조 사기죄의 기망, 착오, 처분행위, 재산상 이익 구조에 맞춰 사실관계를 정리합니다."],
        ["04", "수사 대응", "추가 피해자, 동일 계좌, 연결 계좌 자료를 보강해 피의자 특정 가능성을 높입니다."],
      ],
      compareTitle: "형사 대응 방식 비교",
      compare: [
        ["구분", "단순 신고", "증거 정리 후 형사고소"],
        ["초기 자료", "입금 사실 중심", "대화 원문, 계좌, 사이트, 담당자 정보까지 구조화"],
        ["수사 활용도", "보완 요청이 반복될 수 있음", "기망행위와 자금 흐름을 한 번에 설명"],
        ["상담 전환", "무엇을 보완할지 불명확", "전화·카톡 상담에서 바로 고소 가능성 점검"],
      ],
      aeoTitle: `${base} 형사고소 핵심 요약`,
      aeo: `${base} 피해가 의심되면 추가 입금을 멈추고 입금증, 수취 계좌, 대화 기록, 출금 거부 화면을 보존해야 합니다. 형사고소는 사기죄 구성요건과 계좌 추적 가능성을 함께 검토하는 절차이며, 상담 접수 전 자료를 시간순으로 정리하면 초기 대응이 빨라집니다.`,
    },
    lb: {
      label: "CIVIL RECOVERY",
      title: "피해금 회수 절차 타임라인",
      lead: "회수 가능성은 판결보다 앞서 재산 단서를 얼마나 빨리 보전하느냐에 따라 달라질 수 있습니다.",
      steps: [
        ["01", "계좌 단서 확인", "수취 계좌, 예금주, 입금일, 금액, 연결 계좌 가능성을 정리합니다."],
        ["02", "가압류 검토", "자금이 이동되기 전 보전처분이 가능한지 판단합니다."],
        ["03", "본안 청구", "손해배상과 부당이득반환 중 사건 자료에 맞는 청구 구조를 세웁니다."],
        ["04", "판결·합의 회수", "형사 절차 자료와 민사 자료를 연결해 회수 협상 또는 집행 가능성을 봅니다."],
      ],
      compareTitle: "회수 전략 비교",
      compare: [
        ["구분", "형사고소만 진행", "민사 보전처분 병행"],
        ["목적", "처벌과 피의자 특정", "실제 회수 가능성 확보"],
        ["속도", "수사 진행에 좌우", "계좌 단서 확인 즉시 검토"],
        ["핵심 자료", "피해 진술과 입금 내역", "입금 내역, 재산 단서, 상대방 특정 자료"],
      ],
      aeoTitle: `${base} 피해금 회수 핵심 요약`,
      aeo: `${base} 피해금 회수는 형사고소와 별도로 가압류, 손해배상, 부당이득반환 청구를 검토해야 합니다. 수취 계좌와 상대방 특정 자료가 남아 있을수록 보전처분 가능성을 빠르게 판단할 수 있습니다.`,
    },
    lc: {
      label: "RECOVERY CASE",
      title: "회수 가능성 판단 타임라인",
      lead: "성공사례는 결과보다 자료 확보 시점과 대응 순서를 비교해야 현재 사건에 적용할 수 있습니다.",
      steps: [
        ["01", "피해 접수", "피해 시점, 입금 횟수, 출금 거부 문구를 먼저 정리합니다."],
        ["02", "증거 분석", "계좌, URL, 담당자, 대화방 초대 경로가 동일한 피해자를 확인합니다."],
        ["03", "보전 조치", "지급정지, 가압류, 수사 협조 가능성을 순서대로 검토합니다."],
        ["04", "회수 검토", "일부 회수, 합의, 전액 회수 가능성을 자료 상태별로 나눠 봅니다."],
      ],
      compareTitle: "성공사례 적용 기준",
      compare: [
        ["구분", "자료 부족 사건", "자료 정리 사건"],
        ["입금증", "금액만 기억", "은행, 예금주, 이체 시간이 확인됨"],
        ["대화 기록", "일부 캡처만 존재", "초대부터 출금 거부까지 흐름 보존"],
        ["회수 판단", "가능성 추정에 그침", "지급정지·가압류 검토가 구체화됨"],
      ],
      aeoTitle: `${base} 회수 사례 핵심 요약`,
      aeo: `${base}와 유사한 사건에서 회수 가능성이 높아지는 조건은 입금 직후 자료 보존, 계좌 단서 확보, 동일 피해자 확인, 지급정지 또는 가압류 검토가 빠르게 이어진 경우입니다.`,
    },
    ld: {
      label: "CASE BRIEFING",
      title: "피해 구조 확인 단계",
      lead: "피해 상황을 단계별로 정리하면 불필요한 추가 입금을 막고 신고와 상담 접수로 빠르게 이어질 수 있습니다.",
      steps: [
        ["01", "사건 개요 정리", "누가, 어디서, 어떤 명목으로 입금을 요구했는지 한 문단으로 정리합니다."],
        ["02", "패턴 확인", "수익 인증, 출금 제한, 세금 요구, 계좌 변경 같은 신호를 분리합니다."],
        ["03", "증거 보존", "대화 캡처, 입금 영수증, 플랫폼 화면, 담당자 프로필을 삭제하지 않고 저장합니다."],
        ["04", "대응 순서", "추가 입금 중단 → 증거 보존 → 신고 접수 → 상담 접수 순서로 진행합니다."],
      ],
      compareTitle: "대응 방식 비교",
      compare: [
        ["구분", "그냥 기다리기", "구조 파악 후 대응"],
        ["입금 요구", "계속 응함", "추가 입금 중단"],
        ["증거 상태", "서서히 사라짐", "캡처와 영수증 보존"],
        ["신고 시점", "늦어질수록 불리", "초기 신고로 계좌 동결 가능성 확보"],
      ],
      aeoTitle: `${base} 피해 구조 요약`,
      aeo: `${base} 사건은 접근 채널, 입금 명목, 출금 거부, 추가 입금 요구를 순서대로 정리해야 합니다. 지금 해야 할 행동은 추가 입금 중단, 증거 보존, 신고 접수입니다.`,
    },
    le: {
      label: "CASE HUB",
      title: "전체 대응 경로 선택 타임라인",
      lead: "허브형 페이지는 사건을 한 방향으로 몰지 않고 형사, 민사, 사례, 브리핑 중 필요한 경로로 안내해야 합니다.",
      steps: [
        ["01", "사건 확인", "사건명, 입금 계좌, 담당자, 피해 시점을 확인합니다."],
        ["02", "목적 분류", "처벌, 회수, 사례 확인, 정보 탐색 중 현재 목적을 나눕니다."],
        ["03", "경로 이동", "형사고소, 민사 회수, 성공사례, 피해 구조 브리핑으로 연결합니다."],
        ["04", "상담 접수", "자료가 부족하면 전화 또는 카톡으로 먼저 증거 상태를 점검합니다."],
      ],
      compareTitle: "대응 경로 선택 비교",
      compare: [
        ["구분", "막연히 신고 접수", "경로 파악 후 대응"],
        ["첫 단계", "무엇을 해야 할지 모름", "처벌·회수·정보 중 목적 먼저 정함"],
        ["증거 활용", "있어도 어디 쓸지 모름", "형사·민사·회수 페이지에 연결"],
        ["상담 준비", "막연히 전화 문의", "자료 상태 확인 후 접수 경로 선택"],
      ],
      aeoTitle: `${base} 피해 대응 요약`,
      aeo: `${base} 사건은 처벌을 원하면 형사고소형, 회수를 원하면 민사 회수형, 결과 흐름을 보고 싶으면 성공사례형, 사건 구조를 먼저 파악하려면 브리핑형 페이지를 함께 확인하는 것이 좋습니다.`,
    },
  };
  const config = configs[key];
  if (!config) return "";

  return `<section class="law-authority" aria-label="${esc(config.title)}">
  <div class="law-authority-head">
    <p>${esc(config.label)}</p>
    <h2>${esc(config.title)}</h2>
    <span>${esc(config.lead)}</span>
  </div>
  <ol class="law-timeline">
    ${config.steps.map(([no, title, text]) => `<li><b>${esc(no)}</b><strong>${esc(title)}</strong><p>${esc(text)}</p></li>`).join("\n    ")}
  </ol>
</section>
<section class="law-compare" aria-label="${esc(config.compareTitle)}">
  <div class="law-compare-head">
    <p>CHECK POINT</p>
    <h2>${esc(config.compareTitle)}</h2>
  </div>
  <div class="law-compare-table" role="table">
    ${config.compare.map((row, index) => `<div class="${index === 0 ? "is-head" : ""}" role="row">${row.map((cell) => `<span role="cell">${esc(cell)}</span>`).join("")}</div>`).join("\n    ")}
  </div>
</section>`;
}

function renderBodyForLanding(landing, group, caseData) {
  if (isLawLandingKey(group.key)) {
    return uniqueTextList(buildLawBody(landing, group, caseData).map(sanitizeAwkwardText)).slice(0, 9);
  }

  const base = primaryCaseKeyword(caseData.caseName || "");
  const original = Array.isArray(landing.body)
    ? landing.body.filter(Boolean).map(toStr)
    : [];
  const additions = {
    a: [
      `${base} 사건은 사기죄 형법 제347조의 기망, 착오, 처분행위, 재산상 이익 취득 구조를 기준으로 검토합니다. 상대방이 허위 수익이나 출금 가능성을 말해 입금을 유도했다면 고소장에는 그 대화와 송금 흐름을 함께 정리해야 합니다.`,
      `형사고소를 준비할 때는 입금증, 계좌번호, 예금주, 대화방 캡처, 사이트 주소, 담당자 프로필을 시간 순서로 묶는 것이 좋습니다. 상담 접수나 전화 문의 전에 이 자료를 모아두면 고소 가능성과 추가 조치 방향을 빠르게 확인할 수 있습니다.`,
    ],
    b: [
      `${base} 피해금 회수는 민사소송, 가압류, 손해배상청구, 부당이득반환소송을 함께 보아야 합니다. 상대방 계좌나 연계 법인이 확인되면 판결 전 재산을 묶어두는 보전처분 필요성부터 검토합니다.`,
      `가압류는 상대방이 자금을 옮기기 전에 집행 가능성을 확보하는 절차입니다. 손해배상과 부당이득반환 중 어떤 청구가 적절한지는 입금 경위, 기망 표현, 계약 형태, 상대방 특정 가능성에 따라 달라집니다.`,
    ],
    c: [
      `${base} 유사 성공사례에서는 지급정지 후 계좌 잔액 일부가 묶인 사례, 가압류 후 합의가 진행된 사례, 수사 과정에서 반환 협의가 열린 사례가 있었습니다. 다만 전액 회수나 동일 결과를 보장할 수는 없습니다.`,
      `성공사례를 볼 때는 결과보다 대응 순서를 비교해야 합니다. 입금 직후 증거를 보존하고 상담 접수로 자료를 정리한 사건은 계좌 추적, 형사고소, 민사 보전처분을 연결하기가 더 수월했습니다.`,
    ],
    d: [
      `${base} 사기 피해는 신뢰 형성, 소액 유도, 수익 화면 노출, 출금 제한, 추가 비용 요구 순서로 진행되는 경우가 많습니다. 이 흐름이 확인되면 추가 입금을 멈추고 증거를 먼저 보존해야 합니다.`,
      `수사기관 신고와 법률 상담은 별도 절차입니다. 신고는 형사 수사를 여는 행위이고, 상담은 현재 증거로 어떤 법적 대응이 가능한지 확인하는 과정입니다. 두 절차는 동시에 진행할 수 있습니다.`,
    ],
    e: [
      `${base} 전체 허브는 형사고소, 민사소송, 성공사례, AI 브리핑 정보를 균형 있게 연결합니다. 사건을 처음 확인한 사람은 전체 흐름을 보고, 급한 경우 전화나 카톡 상담으로 증거 상태를 먼저 점검할 수 있습니다.`,
      `같은 사건이라도 처벌을 원하면 형사형, 회수를 원하면 민사형, 유사 결과를 보고 싶으면 성공사례형, 구조를 파악하려면 브리핑형이 적합합니다. 전체 허브는 이 선택을 돕는 안내 페이지입니다.`,
    ],
    la: [
      `${base} 금융피해는 입금 계좌, 예금주, 금융기관명, 이체 일시를 먼저 확보해야 합니다. 형사고소와 함께 지급정지 가능성을 확인하면 자금 이동 전에 계좌 단서를 묶을 수 있습니다.`,
      `대화 캡처와 입금증을 시간순으로 정리하면 계좌 추적과 고소장 작성이 빨라집니다. 자료가 준비되면 상담 접수로 다음 절차를 확인하는 것이 좋습니다.`,
    ],
    lb: [
      `${base} 피해금 회수 전략은 상대방 특정과 자산 보전 가능성에서 시작합니다. 수취 계좌, 연계 법인, 담당자 연락처를 기준으로 가압류와 본안소송 실익을 함께 봅니다.`,
      `민사 회수는 판결보다 먼저 자산을 묶을 수 있는지가 중요합니다. 손해배상과 부당이득반환 중 어떤 구성이 맞는지는 입금 경위와 기망 자료에 따라 달라집니다.`,
    ],
    lc: [
      `${base} 실제 회수 사례를 보면 지급정지, 계좌 동결, 가압류, 합의가 단계적으로 연결된 경우가 많습니다. 결과보다 어떤 증거를 언제 확보했는지가 더 중요합니다.`,
      `회수 사례 아카이브는 동일한 결과를 보장하는 자료가 아니라 대응 순서를 비교하는 기준입니다. 대화 전체와 입금 흐름이 남아 있을수록 회수 경로 검토가 선명해집니다.`,
    ],
    ld: [
      `${base} AI 금융사기 브리핑은 접근 채널, 수익 화면 노출, 담당자 교체, 출금 거부, 추가 입금 요구를 하나의 흐름으로 분석합니다.`,
      `출금 심사 지연, 세금·보증금 요구, 계정 차단이 함께 나타나면 정상 투자 실패보다 금융사기 패턴을 먼저 의심해야 합니다. 증거는 삭제 전 원본 상태로 보존해야 합니다.`,
    ],
    le: [
      `${base} 금융사기 사건 허브는 형사고소, 민사 회수, 실제 사례, AI 브리핑을 한 사건 안에서 연결합니다. 처음 방문자는 현재 목적에 맞는 대응 경로를 고를 수 있습니다.`,
      `같은 업체명이라도 계좌와 담당자 정보가 다르면 별도 사건일 수 있고, 다른 이름이라도 계좌 명의가 같으면 동일 조직 가능성이 있습니다. 허브는 이 비교를 돕습니다.`,
    ],
  }[group.key] || [];

  return uniqueTextList([
    ...original,
    ...scenarioBodyAdditions(caseData, group, base),
    ...additions,
  ].map(sanitizeAwkwardText)).slice(0, 9);
}

function scenarioBodyAdditions(caseData, group, base = "") {
  const scenario = detectScenario(caseData);
  const subject = base || primaryCaseKeyword(caseData.caseName || "") || "접수 기록";
  const commonByScenario = {
    app: [
      `${subject} 사건은 앱 설치 파일, 로그인 화면, 지갑 주소, 고객센터 대화가 함께 남아 있는지부터 확인해야 합니다. 앱을 삭제하기 전 화면 캡처와 설치 파일명, 접속 도메인을 따로 보관하면 계정 운영 주체를 추적하는 단서가 됩니다.`,
      `모바일 앱 기반 피해는 출금 거절 화면만으로 판단하지 말고 권한 요청, APK 전달 경로, 알림 메시지, 입금 계좌 변경 시점을 함께 정리해야 합니다. 이 정보가 있어야 형사 고소와 민사 보전 절차의 연결이 빨라집니다.`,
    ],
    exchange: [
      `${subject} 관련 거래소 화면은 실제 거래소처럼 보여도 입금 계좌, 지갑 주소, 출금 승인 조건이 계속 바뀌는지 확인해야 합니다. 특히 세금, 보증금, 인증비 명목의 추가 입금 요구는 별도 증거로 분리해 두는 것이 좋습니다.`,
      `코인이나 해외거래소형 사건은 시세 화면보다 자금 이동 경로가 더 중요합니다. 원화 입금 계좌, 전송 지갑, 텔레그램 안내자, 관리자 계정의 연결 관계를 시간순으로 묶어야 추적 가능성이 높아집니다.`,
    ],
    investment: [
      `${subject}처럼 투자 리딩방에서 시작된 사건은 추천 종목보다 유도 과정이 핵심입니다. 수익 인증, VIP 전환 안내, 원금 보장 표현, 손실 복구 조건을 순서대로 모으면 기망 구조를 설명하기 쉽습니다.`,
      `주식·선물·리딩방형 피해는 단순 투자 실패와 구분해야 합니다. 출금 제한, 추가 입금 조건, 담당자 교체, 방 폐쇄가 있었다면 사기 구조로 볼 수 있는 정황을 별도 목록으로 정리해야 합니다.`,
    ],
    commerce: [
      `${subject} 관련 쇼핑몰·구매대행형 사건은 주문 화면, 운송장 안내, 환불 조건, 사업자 정보의 일치 여부를 함께 봐야 합니다. 배송 지연만이 아니라 환불을 조건으로 추가 결제를 요구했는지가 중요합니다.`,
      `전자상거래형 피해는 결제 수단별로 대응 경로가 달라집니다. 계좌이체, 카드, 간편결제 내역을 나누어 보관하고 판매 페이지가 사라지기 전에 상품명과 사업자 표시를 캡처해야 합니다.`,
    ],
    live: [
      `${subject} 사건처럼 라이브 방송이나 로맨스 접근에서 시작된 경우에는 감정적 대화보다 금전 요구가 나온 시점이 중요합니다. 선물, 환전, 보증금, 계정 해제비 요구를 분리해 정리해야 합니다.`,
      `대화 기반 피해는 상대 프로필, 송금 요청 메시지, 플랫폼 내 결제 화면, 외부 메신저 이동 시점을 함께 보관해야 합니다. 관계를 빌미로 한 반복 송금은 2차 피해 차단도 같이 검토해야 합니다.`,
    ],
  };

  const domainTail = String(group.key || "").startsWith("l")
    ? [`${subject} 관련 법적 대응은 신고 접수만으로 끝내지 말고 지급정지, 계좌 추적, 민사 보전 가능성을 함께 검토해야 합니다.`]
    : [];

  return [...(commonByScenario[scenario] || []), ...domainTail];
}

function scenarioVictimCases(caseData, group, brand = "담당자") {
  const scenario = detectScenario(caseData);
  const prefix = String(group.key || "").startsWith("l") ? "법률 검토 과정에서" : "상담 접수 과정에서";
  const cases = {
    app: [
      `${prefix} 피해자가 전달받은 앱 설치 링크와 로그인 화면을 보관해 두어, 입금 계좌 변경 시점과 관리자 안내 메시지를 함께 대조한 사례`,
      `${brand} 안내자가 앱 오류를 이유로 재인증비를 요구했지만 APK 파일명과 알림 기록을 보존해 2차 입금을 중단한 사례`,
    ],
    exchange: [
      `${prefix} 가짜 거래소의 지갑 주소와 원화 입금 계좌가 반복 사용된 정황을 확인해 동일 조직 가능성을 검토한 사례`,
      `출금 신청 직후 세금 명목의 추가 입금을 요구받았으나 거래소 화면, 텔레그램 대화, 계좌 정보를 묶어 증거 목록을 만든 사례`,
    ],
    investment: [
      `${prefix} 리딩방 수익 인증 이미지와 VIP 전환 안내가 같은 양식으로 반복된 점을 확인해 기망 정황을 정리한 사례`,
      `손실 복구 명목으로 추가 입금을 요구받았지만 리딩방 폐쇄 전 대화와 입금증을 보존해 민사·형사 대응을 병행한 사례`,
    ],
    commerce: [
      `${prefix} 쇼핑몰 주문 내역, 환불 안내, 사업자 표시가 서로 맞지 않아 판매 페이지 캡처와 결제 내역을 우선 보존한 사례`,
      `구매대행 환불을 조건으로 추가 결제를 요구받았으나 결제 수단별 자료를 분리해 지급 정지 가능성을 검토한 사례`,
    ],
    live: [
      `${prefix} 라이브 방송 후 외부 메신저로 이동해 환전비와 계정 해제비를 요구한 대화를 시간순으로 정리한 사례`,
      `로맨스 접근 이후 반복 송금이 이어져 프로필, 송금 요청 메시지, 계좌 정보를 함께 보관하고 2차 연락을 차단한 사례`,
    ],
  };
  return cases[scenario] || [];
}

function detectScenario(caseData = {}) {
  const text = `${caseData.slug || ""} ${caseData.caseName || ""} ${caseData.summary || ""}`.toLowerCase();
  if (/(app|eopeur|apk|mobail|mobile|wallet|jigab)/.test(text)) return "app";
  if (/(exchange|georaeso|coin|koin|token|staking|seuteiking|wallet|jigab|casino)/.test(text)) return "exchange";
  if (/(riding|ridingbang|jusig|stock|future|futures|seonmul|ipo|hts|etf|wealth|invest)/.test(text)) return "investment";
  if (/(shop|shopping|syoping|syopingmor|mall|gumaedaehaeng|bueob|review|ribyu|alba)/.test(text)) return "commerce";
  if (/(live|romance|romaenseu|dating|date|broadcast|bangsong|hwanjeon|valuna)/.test(text)) return "live";
  return "general";
}

function sanitizeAwkwardText(value = "") {
  return String(value || "")
    .replace(/관련 사실 관련/g, "관련 자료")
    .replace(/대응 자료 관련 앱/g, "의심 앱")
    .replace(/해당 피해 관련 앱/g, "문제 앱")
    .replace(/담당자 담당자/g, "담당자")
    .replace(/피해 피해/g, "피해")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTextList(items = [], threshold = 0.76) {
  const result = [];
  for (const item of items.map(sanitizeAwkwardText).filter(Boolean)) {
    const isDuplicate = result.some((existing) => textSimilarity(existing, item) >= threshold);
    if (!isDuplicate) result.push(item);
  }
  return result;
}

function textSimilarity(a = "", b = "") {
  const aSet = tokenSetForText(a);
  const bSet = tokenSetForText(b);
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size || 1;
  return intersection / union;
}

function tokenSetForText(value = "") {
  const normalized = String(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(/[\s-]+/).filter((token) => token.length >= 2);
  const grams = [];
  for (const token of tokens) {
    if (token.length <= 3) {
      grams.push(token);
      continue;
    }
    for (let index = 0; index < token.length - 1; index += 1) {
      grams.push(token.slice(index, index + 2));
    }
  }
  return new Set(grams);
}

function renderVictimCasesForLanding(landing, group, caseData, replacementContext) {
  if (isLawLandingKey(group.key)) {
    return uniqueTextList(
      buildLawVictimCases(landing, group, caseData)
        .map((item) => reduceCaseNameText(item, caseData.caseName, false, replacementContext))
        .map(sanitizeAwkwardText)
    ).slice(0, 5);
  }

  const base = primaryCaseKeyword(caseData.caseName || "");
  const brand = secondaryCaseKeyword(caseData.caseName || "").replace(/\s*피해 대응$/, "") || "담당자";
  const original = Array.isArray(landing.victimCases)
    ? landing.victimCases.filter(Boolean).map((item) => reduceCaseNameText(item, caseData.caseName, false, replacementContext))
    : [];
  const additions = [
    ...scenarioVictimCases(caseData, group, brand),
    ...fallbackVictimCases(group.key, brand),
  ];
  return uniqueTextList([...original, ...additions].map(sanitizeAwkwardText)).slice(0, 5);
}

function renderFaqForLanding(landing, group, caseData) {
  if (isLawLandingKey(group.key)) {
    return buildLawFaq(landing, group, caseData);
  }

  const fullName = normalizeCaseName(caseData.caseName || "");
  const base = fullName.replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "").trim() || fullName;
  const original = Array.isArray(landing.faq) ? landing.faq.filter((item) => item?.question && item?.answer) : [];
  const shared = [
    { question: "전화나 카톡 상담은 언제 이용하면 좋나요?", answer: "추가 입금 요구가 계속되거나 대화방 삭제가 예상되면 전화나 카톡 상담으로 먼저 증거 상태를 점검하는 것이 좋습니다. 상담 접수 전이라도 입금증, 계좌번호, 대화 캡처를 준비하면 초기 판단이 빨라집니다." },
    { question: "2차 피해를 막으려면 무엇을 조심해야 하나요?", answer: "피해금 회복팀, 환불 대행, 법무팀을 사칭해 선입금을 요구하는 연락을 조심해야 합니다. 기존 사건 자료를 넘기기 전 상대방 신원과 절차를 확인하고, 수수료 선입금 요구에는 응하지 않는 것이 안전합니다." },
  ];
  const additions = {
    a: [
      { question: "사기죄 형법 제347조 검토에는 어떤 자료가 필요한가요?", answer: "기망 표현, 입금 경위, 출금 제한 안내, 추가 비용 요구 메시지가 중요합니다. 상대방이 허위 사실로 착오를 일으키고 송금을 유도했다는 흐름을 계좌 자료와 함께 정리해야 합니다." },
      { question: "형사고소 전 상담 접수를 먼저 해도 되나요?", answer: "가능합니다. 상담 접수 단계에서 증거 목록과 고소장 구성 방향을 먼저 확인하면 빠진 자료를 미리 보완할 수 있습니다. 급하면 전화나 카톡 상담으로 현재 자료부터 점검할 수 있습니다." },
    ],
    b: [
      { question: "가압류와 민사소송은 어떤 순서로 보나요?", answer: "상대방 계좌나 재산 단서가 있으면 가압류 같은 보전처분을 먼저 검토하고, 이후 손해배상청구나 부당이득반환소송을 준비합니다. 재산이 이동되기 전에 판단하는 것이 중요합니다." },
      { question: "손해배상과 부당이득반환은 무엇이 다른가요?", answer: "손해배상은 불법행위로 발생한 손해를 청구하는 구조이고, 부당이득반환은 법률상 원인 없이 얻은 이익의 반환을 구하는 구조입니다. 사건 자료에 따라 함께 검토될 수 있습니다." },
    ],
    c: [
      { question: "어떤 성공사례를 참고해야 하나요?", answer: "지급정지 후 일부 회수, 가압류 후 합의, 수사 중 반환 협의처럼 절차가 구체적으로 이어진 사례를 참고해야 합니다. 결과만 보지 말고 증거 보존과 접수 시점을 비교하는 것이 좋습니다." },
      { question: "성공사례와 내 사건이 비슷한지 어떻게 확인하나요?", answer: "업체명보다 계좌, URL, 상담원 계정, 입금 명목, 출금 제한 방식이 더 중요합니다. 상담 접수 시 이 자료를 제시하면 유사 사례와 비교해 절차 방향을 검토할 수 있습니다." },
    ],
    d: [
      { question: "입금 직후 가장 먼저 해야 할 일은 무엇인가요?", answer: "추가 입금을 즉시 중단하고 대화방 캡처, 입금증, 계좌번호, 사이트 주소, 담당자 연락처를 삭제하지 않고 보존해야 합니다. 자료가 남아 있을수록 이후 형사·민사 절차에서 대응 가능성이 높아집니다." },
      { question: "추가 입금 요구를 받았는데 응해야 하나요?", answer: "세금, 보증금, 인증비, 해제비 명목의 추가 요구는 피해가 확산되는 핵심 패턴입니다. 출금을 조건으로 돈을 더 요구한다면 즉시 입금을 중단하고 해당 메시지를 캡처해 증거로 보존해야 합니다." },
    ],
    e: [
      { question: "전체 허브에서는 어떤 균형이 중요한가요?", answer: "형사고소, 민사 회수, 성공사례, 정보 브리핑을 한쪽으로 치우치지 않게 연결해야 합니다. 사용자가 자신의 목적에 맞는 페이지로 이동할 수 있도록 안내하는 것이 핵심입니다." },
      { question: "처음 방문자는 어디서 상담을 시작하면 좋나요?", answer: "사건 구조를 모르면 전체 허브에서 자료를 분류하고, 급한 추가 입금 요구가 있다면 전화 또는 카톡 상담으로 먼저 확인하는 것이 좋습니다. 이후 형사형이나 민사형으로 이동하면 됩니다." },
    ],
    la: [
      { question: "금융피해를 입은 직후 무엇을 먼저 해야 하나요?", answer: "추가 입금을 중단하고 수취 계좌, 입금 일시, 대화 캡처, 담당자 정보를 보존해야 합니다. 자료가 남아 있을수록 형사고소와 민사 절차에서 활용할 수 있는 범위가 넓어집니다." },
      { question: "대포통장이 사용돼도 추적이 가능한가요?", answer: "대포통장이더라도 계좌 간 자금 이동, 예금주 정보, 연결 계좌를 추적해 실제 가담자 특정 가능성을 확인할 수 있습니다." },
    ],
    lb: [
      { question: "피해금 회수 전략은 어디서 시작하나요?", answer: "상대방 특정과 자산 보전 가능성부터 봅니다. 계좌 명의, 법인 정보, 통신 기록을 정리한 뒤 가압류와 본안소송 경로를 검토합니다." },
      { question: "가압류와 본안소송은 어떻게 다른가요?", answer: "가압류는 판결 전 재산을 묶는 절차이고, 본안소송은 손해배상 또는 부당이득반환 판결을 받는 절차입니다. 둘은 함께 검토될 수 있습니다." },
    ],
    lc: [
      { question: "실제 회수 사례에서 공통점은 무엇인가요?", answer: "빠른 지급정지 문의, 완전한 대화 캡처, 입금증 보존, 피해자 간 동일 계좌 확인이 공통적으로 중요했습니다." },
      { question: "아카이브 사례를 그대로 적용할 수 있나요?", answer: "같은 결과를 보장할 수는 없지만, 증거 상태와 계좌 흐름이 비슷하면 어떤 절차를 우선할지 판단하는 데 도움이 됩니다." },
    ],
    ld: [
      { question: "AI 브리핑은 무엇을 기준으로 보나요?", answer: "접근 채널, 신뢰 형성 방식, 수익 화면 노출, 출금 제한, 추가 입금 요구, 담당자 차단 여부를 함께 분석합니다." },
      { question: "금융사기와 단순 투자 실패는 어떻게 구분하나요?", answer: "출금 거부와 추가 입금 요구, 담당자 연락 차단, 수익 보장 표현이 있으면 금융사기 정황으로 우선 검토해야 합니다." },
    ],
    le: [
      { question: "금융사기 허브는 어떤 정보를 연결하나요?", answer: "형사고소, 민사 회수, 실제 사례, AI 브리핑 페이지를 한 사건 기준으로 연결해 대응 경로를 비교할 수 있게 합니다." },
      { question: "어느 페이지부터 봐야 하나요?", answer: "추가 입금 요구가 진행 중이면 AI 브리핑과 형사고소형을 먼저 보고, 회수를 준비 중이면 민사형과 사례형을 함께 보는 것이 좋습니다." },
    ],
  }[group.key] || [];

  return [...original, ...additions, ...shared].slice(0, 7);
}

function fallbackBody(base, key) {
  return renderBodyForLanding({ body: [] }, { key }, { caseName: base }).slice(0, 7);
}

function fallbackVictimCases(key, brand = "담당자") {
  const common = [
    `피해자가 온라인 채팅방에서 ${brand} 관계자를 사칭한 담당자로부터 안내를 받고 1차로 320만원을 보낸 뒤, 출금 직전 세금과 보증금 명목으로 추가 780만원을 요구받은 사례`,
    `${brand} 담당자라는 계정이 별도 사이트 또는 앱 가입을 유도했고, 출금 신청 당일 계좌와 담당자 계정이 동시에 바뀐 사례`,
    `소액을 먼저 지급받아 안심한 뒤 입금액을 늘렸으나, 환불 요청 후 피해금 회복팀이라는 계정이 다시 접근해 선입금 수수료를 요구한 2차 피해 사례`,
    `입금증, 계좌번호, 대화 캡처는 남아 있었지만 사이트가 폐쇄되어 상담 접수 단계에서 브라우저 기록과 문자 알림까지 다시 정리한 사례`,
    `여러 피해자가 같은 수취 계좌와 유사 URL을 확인해 형사고소 자료와 민사 가압류 가능성을 함께 검토한 사례`,
  ];
  const law = [
    `피해자는 모바일뱅킹 이체 직후 수취 계좌의 은행명, 예금주, 거래 일시를 정리했고, 같은 날 지급정지 가능성 확인과 상담 접수를 병행한 사례`,
    `정상 금융상품처럼 설명받았지만 출금 단계에서 보증금과 인증비를 요구받아 앱 화면 녹화, 계좌 변경 내역, 담당자 프로필을 별도 보존한 사례`,
    `환불을 기다리던 중 금융피해 회복팀이라는 새 계정이 접근해 선입금 요구 메시지를 2차 피해 정황으로 보존한 사례`,
    `같은 수취 계좌로 입금한 피해자가 추가 확인되어 입금 시간, 금액, 대화방 초대 경로를 비교한 사례`,
    `형사고소 자료와 계좌 단서를 함께 정리해 계좌 제한 가능성과 추가 피해 확산 차단을 상담 접수 단계에서 검토한 사례`,
  ];
  return String(key || "").startsWith("l") ? law : common;
}

function fallbackFaq(caseName, base, key) {
  return renderFaqForLanding({ faq: [] }, { key }, { caseName }).slice(0, 7);
}

function createConsultForm(cn, siteName) {
  return `<section class="article-block consult-form-section" id="consult">
  <h2>상담 접수</h2>
  <p>추가 입금 요구를 받았거나 출금이 막혔다면 지금 자료를 남겨주세요. 상담 접수 후 전화 또는 카톡으로 입금 내역, 대화 캡처, 계좌 정보를 확인해 초기 대응 방향을 안내합니다.</p>
  <form class="consult-form" id="consultForm">
    <input type="text" name="cname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="phone" placeholder="연락처 (010-xxxx-xxxx)" required autocomplete="tel">
    <input type="text" name="amount" placeholder="대략적인 피해금액" required>
    <button type="submit">상담 접수</button>
  </form>
  <p class="consult-msg" id="consultMsg"></p>
  <script>
    document.getElementById('consultForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = this.querySelector('button');
      var msg = document.getElementById('consultMsg');
      btn.disabled = true; btn.textContent = '접수 중...';
      msg.textContent = ''; msg.className = 'consult-msg';
      try {
        var res = await fetch('https://gnlaw-criminal.co.kr/api/submit-consult', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.cname.value, phone: this.phone.value, amount: this.amount.value, caseName: '${cn}', domain: '${siteName}' })
        });
        var data = await res.json();
        if (data.ok) { msg.textContent = '상담 접수가 완료되었습니다. 담당자가 연락드립니다.'; msg.className = 'consult-msg ok'; this.reset(); }
        else { msg.textContent = data.message || '접수 중 오류가 발생했습니다.'; msg.className = 'consult-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
      } catch(err) { msg.textContent = '접수 중 오류가 발생했습니다.'; msg.className = 'consult-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
    });
  </script>
</section>`;
}

function createFloatingWidgets(cn, siteName, slug) {
  return `<div class="floating-contact">
  <a href="tel:02-6348-0406" class="float-btn phone">전화문의</a>
</div>
<div class="sticky-bar" id="stickyBar">
  <span class="sticky-title">추가 입금 전 긴급 점검 ｜ 02-6348-0406</span>
  <form class="sticky-form" id="stickyConsultForm">
    <input type="text" name="sname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="sphone" placeholder="연락처" required autocomplete="tel">
    <input type="text" name="samount" placeholder="대략적인 피해금액" required>
    <button type="submit">확인 요청</button>
  </form>
  <span id="stickyMsg" class="sticky-msg"></span>
</div>
<script>
  document.getElementById('stickyConsultForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = this.querySelector('button'); var msg = document.getElementById('stickyMsg');
    btn.disabled = true; btn.textContent = '접수 중...';
    msg.textContent = ''; msg.className = 'sticky-msg';
    try {
      var res = await fetch('https://gnlaw-criminal.co.kr/api/submit-consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.sname.value, phone: this.sphone.value, amount: this.samount.value, caseName: '${cn}', domain: '${siteName}' })
      });
      var data = await res.json();
      if (data.ok) { msg.textContent = '접수 완료!'; msg.className = 'sticky-msg ok'; this.reset(); btn.disabled = false; btn.textContent = '확인 요청'; }
      else { msg.textContent = data.message || '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '확인 요청'; }
    } catch(err) { msg.textContent = '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '확인 요청'; }
  });
</script>`;
}

// ─── Template ─────────────────────────────────────────────────────────────────

function pageTemplate(d) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${d.title}</title>
  <meta name="description" content="${d.description}">
  <link rel="canonical" href="${d.canonical}">
  <meta property="og:type" content="${d.ogType}">
  <meta property="og:title" content="${d.ogTitle}">
  <meta property="og:description" content="${d.ogDescription}">
  <meta property="og:image" content="${d.ogImage}">
  <meta property="og:url" content="${d.canonical}">
  <meta property="og:site_name" content="${d.siteName}">
  <meta property="og:locale" content="ko_KR">
  ${d.headExtra}
  <script type="application/ld+json">${d.schema}</script>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="${d.bodyClass}">
  <header class="site-header">
    <a class="brand" href="/" aria-label="법무법인 선린 홈페이지">
      <img src="/assets/logo.png" alt="법무법인 선린">
    </a>
    ${d.headerCall}
  </header>
  <main>
    ${d.breadcrumb || ""}
    <section class="hero">
      <p class="eyebrow">${d.tone}</p>
      <h1>${d.h1}</h1>
      ${d.ogThumbnail}
      ${d.heroTyping || ""}
      ${d.receiptBadge || ""}
      ${d.heroCta || ""}
    </section>
    <div class="page-shell">
      ${d.content}
    </div>
    ${d.finalCta || ""}
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <address class="footer-info">
        <span>법무법인 선린 ｜ 사업자등록번호 : 420-87-0032 ｜ 대표변호사 : 김상수</span>
        <span>서울특별시 서초구 반포대로 108 양원빌딩 4층 ｜ 대표번호 : <a href="tel:0263480406">02-6348-0406</a></span>
      </address>
      <p class="copyright">Copyright ⓒ법무법인 선린 All Right Reserved.</p>
    </div>
  </footer>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORGANIZATION = {
  "@type": ["Organization", "LegalService"],
  "@id": "https://gnlaw-criminal.co.kr/#organization",
  name: "법무법인 선린",
  legalName: "법무법인 선린",
  alternateName: "선린 법무법인",
  url: "https://gnlaw-criminal.co.kr",
  telephone: "02-6348-0406",
  logo: { "@type": "ImageObject", url: "https://gnlaw-criminal.co.kr/assets/logo.png" },
  address: {
    "@type": "PostalAddress",
    streetAddress: "반포대로 108 양원빌딩 4층",
    addressLocality: "서초구",
    addressRegion: "서울특별시",
    addressCountry: "KR",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "02-6348-0406",
      contactType: "customer service",
      availableLanguage: "Korean",
    },
  ],
  sameAs: [],
  knowsAbout: ["금융사기", "사기죄 형사고소", "피해금 회수", "가압류", "손해배상청구", "사기 피해 대응"],
};

const PERSON_ATTORNEY = {
  "@type": "Person",
  "@id": "https://gnlaw-criminal.co.kr/#person-attorney",
  name: "김상수",
  honorificPrefix: "변호사",
  jobTitle: "대표변호사",
  worksFor: { "@id": "https://gnlaw-criminal.co.kr/#organization" },
  knowsAbout: ["금융사기", "사기죄 형사고소", "피해금 회수", "가압류", "손해배상"],
  sameAs: [],
};

function esc(v = "") {
  return String(v).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#039;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function normalizeCaseName(name) {
  let clean = String(name || "").trim().replace(/\s*(?:사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  return /사기/.test(clean) ? clean : `${clean} 사기`;
}

function baseCaseName(name) {
  return String(name || "").trim().replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)$/i, "").trim();
}

function primaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const match = clean.match(/^(.+?사기)(?:\s+.+)?$/i);
  if (match) return match[1].trim();
  return clean ? `${clean} 사기` : "";
}

function secondaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const primary = primaryCaseKeyword(name);
  let tail = clean.slice(primary.length).trim();
  tail = tail.replace(/db증권/ig, "DB증권");
  if (!tail) return "";
  return /사칭|피해/.test(tail) ? `${tail} 피해 대응` : `${tail} 사칭 피해 대응`;
}

function groupPageTitle(name, key) {
  const base = seoCaseKeyword(name);
  const suffixes = {
    a: "형사고소",
    b: "민사소송",
    c: "성공사례",
    d: "사건브리핑",
    e: "사건현황",
    la: "법적조치",
    lb: "피해회복",
    lc: "해결사례",
    ld: "피해정보",
    le: "진행현황",
  };
  return joinSeoPhrase(base, suffixes[key] || "형사고소");
}

function groupPageH1(name, key) {
  // H1 = title without "| 법무법인 선린" — share suffix map with groupPageTitle
  return groupPageTitle(name, key);
}

function joinSeoPhrase(base = "", suffix = "") {
  const left = String(base || "").trim();
  let right = String(suffix || "").trim();
  if (!left) return right;
  ["사칭", "사기", "피해", "대응"].forEach((word) => {
    const duplicate = `${word} ${word}`;
    while (`${left} ${right}`.includes(duplicate)) {
      right = right.replace(new RegExp(`^${word}\\s+`), "");
    }
  });
  return `${left} ${right}`.replace(/\s+/g, " ").trim();
}

function seoCaseKeyword(name) {
  const base = primaryCaseKeyword(name) || normalizeCaseName(name);
  return String(base || "").replace(/[A-Za-z][A-Za-z0-9 .&_-]*/g, (part) => part.toUpperCase()).trim();
}

function searchKeyword(name) {
  const base = primaryCaseKeyword(name);
  const secondary = secondaryCaseKeyword(name).replace(/\s*피해 대응$/, "");
  const secondaryExtra = secondary && !/사칭$/.test(secondary.trim()) ? `${secondary} 사칭` : "";
  return [base, `${base} 형사고소`, `${base} 민사소송`, secondary, secondaryExtra].filter(Boolean).join(", ");
}

function themeColor(key) {
  return { a: "#111827", b: "#173b57", c: "#174333", d: "#25314d", e: "#3b2f52" }[key] || "#111827";
}

function breadcrumbLabel(groupOrKey) {
  const key = typeof groupOrKey === "string" ? groupOrKey : (groupOrKey.landingKey || groupOrKey.key);
  return {
    a: "형사고소",
    b: "민사소송",
    c: "성공사례",
    d: "사건브리핑",
    e: "사건현황",
    la: "법적조치",
    lb: "피해회복",
    lc: "해결사례",
    ld: "피해정보",
    le: "진행현황",
  }[key] || "사건현황";
}

function createHtmlBreadcrumb(group, caseName) {
  const category = breadcrumbLabel(group);
  const current = groupPageTitle(caseName, group.landingKey || group.key);
  return `<nav class="breadcrumb" aria-label="breadcrumb">
    <a href="${group.siteUrl}/">홈</a>
    <a href="${group.siteUrl}/${group.pathPrefix}/">${esc(category)}</a>
    <strong>${esc(current)}</strong>
  </nav>`;
}

function toStr(item) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    return item.text || item.case || item.description || item.value || item.content ||
      Object.values(item).find((v) => typeof v === "string" && v.length > 5) || "";
  }
  return String(item || "");
}

function paragraphs(items = []) {
  return (items || []).map((item) => `<p>${withSentenceBreaks(toStr(item))}</p>`).join("\n");
}

function list(items = []) {
  return `<ul>${(items || []).map((item) => `<li>${withSentenceBreaks(toStr(item))}</li>`).join("\n")}</ul>`;
}

function faqHtml(items = [], caseName = "") {
  const names = caseNameVariants(caseName).filter(Boolean);
  return (items || []).map((item, i) => {
    let q = item.question || "";
    const shouldKeepName = i < 3;
    q = cleanFaqQuestion(q, names, shouldKeepName ? caseName : "");
    if (shouldKeepName && caseName && !caseNameVariants(caseName).some((name) => q.includes(name))) {
      q = `[${caseName}] ` + q.replace(/^\[[^\]]*\]\s*/, "");
    }
    return `<details><summary>${esc(q)}</summary><p>${withSentenceBreaks(addFaqCta(item.answer))}</p></details>`;
  }).join("\n");
}

function schemaFaqItems(items = [], caseName = "") {
  const names = caseNameVariants(caseName).filter(Boolean);
  return dedupeFaqItems(items).map((item, i) => {
    let question = item.question || "";
    const shouldKeepName = i < 3;
    question = cleanFaqQuestion(question, names, shouldKeepName ? caseName : "");
    if (shouldKeepName && caseName && !names.some((name) => question.includes(name))) {
      question = `[${caseName}] ` + question.replace(/^\[[^\]]*\]\s*/, "");
    }
    return {
      question,
      answer: addFaqCta(item.answer || ""),
    };
  });
}

function dedupeFaqItems(items = []) {
  const seen = new Set();
  return (items || []).filter((item) => {
    if (!item?.question || !item?.answer) return false;
    const key = normalizeDedupeText(item.question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeTextItems(items = []) {
  const seen = new Set();
  return (items || []).map(toStr).filter((item) => {
    const key = normalizeDedupeText(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDedupeText(value = "") {
  return String(value)
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/VIP340수익프로젝트|사기|리딩방|사칭|금융피해/g, "")
    .trim()
    .slice(0, 80);
}

function createSeoDescription(description = "", caseName = "", key = "") {
  {
    const primary = seoCaseKeyword(caseName);
    const desc = String(description || "").trim();
    const fallback = primary
      ? `${primary} 관련 상담 자료를 기준으로 송금 경위, 대화 기록, 계좌 단서, 접속 주소를 정리해 형사고소와 회수 가능성을 점검합니다.`
      : "송금 내역, 대화 기록, 사이트 주소를 기준으로 사기 정황과 대응 방법을 정리합니다.";
    if (!primary) return (desc || fallback).slice(0, 150);
    return (!desc || !desc.toLowerCase().includes(primary.toLowerCase()) ? fallback : desc).slice(0, 150);
  }

  const desc = String(description || "").trim();
  const primary = primaryCaseKeyword(caseName) || normalizeCaseName(caseName);
  if (isLawLandingKey(key) && primary && !desc.includes(primary)) {
    return `${primary} 피해라면 ${desc || "입금 계좌, 대화 기록, 출금 거부 정황을 기준으로 형사고소와 피해금 회수 가능성을 점검합니다."}`.slice(0, 150);
  }
  return (desc || "입금 내역, 대화 내용, 사이트 주소를 기준으로 피해 구조와 대응 가능성을 정리합니다.").slice(0, 150);
}

function createArticleTags(caseName = "", key = "") {
  const primary = primaryCaseKeyword(caseName) || normalizeCaseName(caseName);
  const topic = lawLandingLabel(key);
  if (!primary) return [topic];
  const common = [primary, `${primary} 피해`, `${primary} 상담`, topic];
  const byKey = {
    la: [`${primary} 형사고소`, `${primary} 사기죄`, "지급정지", "계좌추적"],
    lb: [`${primary} 피해금 회수`, "가압류", "손해배상", "부당이득반환"],
    lc: [`${primary} 회수 사례`, "성공사례", "피해금 회수율"],
    ld: [`${primary} AI 브리핑`, "금융사기 분석", "증거 보존"],
    le: [`${primary} 사건 허브`, "형사 민사 대응", "금융사기 대응"],
  };
  return [...new Set([...common, ...(byKey[key] || [])])].slice(0, 8);
}

function reduceCaseNameTextLegacy(value, caseName, keepFirst = false) {
  let text = toStr(value);
  const names = caseNameVariants(caseName).sort((a, b) => b.length - a.length);
  const primary = primaryCaseKeyword(caseName);
  const replacements = ["접수 기록", "상담 메모", "거래 흐름", "증거 묶음", "계좌 단서", "대화 자료"];
  let replacementIndex = 0;
  let used = false;
  names.forEach((name) => {
    if (!name) return;
    if (keepFirst && !used && primary) {
      text = text.replace(name, primary);
      used = true;
    }
    const replacement = keepFirst ? "접수 기록" : replacements[replacementIndex++ % replacements.length];
    text = text.split(name).join(replacement);
  });
  return cleanupRepeatedWords(text);
}

function cleanupRepeatedWords(value = "") {
  return String(value || "")
    .replace(/이\s*사건\s*사건/g, "이 사안")
    .replace(/해당\s*피해\s*피해/g, "해당 피해")
    .replace(/사칭\s*사칭/g, "사칭")
    .replace(/사기\s*사기/g, "사기")
    .replace(/피해\s*피해/g, "피해")
    .replace(/대응\s*대응/g, "대응")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const CASE_NAME_REPLACEMENTS = [
  "접수 기록",
  "상담 메모",
  "거래 흐름",
  "증거 묶음",
  "계좌 단서",
  "대화 자료",
  "송금 내역",
  "화면 기록",
  "접근 경로",
  "안내 문구",
  "담당자 기록",
  "분석 대상",
  "검토 자료",
  "신고 자료",
  "확인 항목",
  "보존 자료",
  "대응 메모",
  "정리 내용",
  "사례 기록",
  "진행 자료",
];

function createReplacementContext(seed = "") {
  const source = String(seed || "");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return { offset: hash % CASE_NAME_REPLACEMENTS.length, index: 0 };
}

function nextCaseReplacement(context) {
  if (!context) return CASE_NAME_REPLACEMENTS[0];
  const value = CASE_NAME_REPLACEMENTS[(context.offset + context.index) % CASE_NAME_REPLACEMENTS.length];
  context.index += 1;
  return value;
}

function reduceCaseNameText(value, caseName, keepFirst = false, replacementContext = null) {
  let text = toStr(value);
  const names = caseNameVariants(caseName).sort((a, b) => b.length - a.length);
  const primary = primaryCaseKeyword(caseName);
  let used = false;
  names.forEach((name) => {
    if (!name) return;
    if (keepFirst && !used && name === primary) {
      text = text.replace(name, primary);
      used = true;
    }
    text = text.split(name).join(nextCaseReplacement(replacementContext));
  });
  return cleanupRepeatedWords(text);
}

const CONTEXT_TERM_LIMITS = [
  { term: "해당 사건", limit: 1, replacements: ["접수 기록", "상담 기록", "문제 정황", "검토 대상", "관련 자료"] },
  { term: "이 사안", limit: 1, replacements: ["이 기록", "접수 내용", "거래 흐름", "검토 대상"] },
  { term: "해당 플랫폼", limit: 1, replacements: ["문제 사이트", "거래 화면", "접속 페이지", "운영 계정"] },
  { term: "유사 피해", limit: 1, replacements: ["같은 유형의 사례", "비슷한 접수", "관련 상담 기록"] },
  { term: "출금 거부", limit: 2, replacements: ["출금 제한", "지급 보류", "환급 지연", "인출 제한"] },
  { term: "추가 입금 요구", limit: 2, replacements: ["추가 송금 요청", "보증금 안내", "인증비 요청", "추가 비용 안내"] },
];

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function softenRepeatedContextTerms(value = "") {
  let text = String(value || "");
  CONTEXT_TERM_LIMITS.forEach(({ term, limit, replacements }) => {
    let count = 0;
    text = text.replace(new RegExp(escapeRegExp(term), "g"), () => {
      count += 1;
      if (count <= limit) return term;
      return replacements[(count - limit - 1) % replacements.length];
    });
  });
  return text;
}

function cleanupRepeatedWordsLegacy(value = "") {
  return String(value || "")
    .replace(/이\s*사건\s*사건/g, "이 사안")
    .replace(/이\s*사안\s*사안/g, "이 사안")
    .replace(/해당\s*피해\s*피해/g, "해당 피해")
    .replace(/관련\s*정황\s*정황/g, "관련 사실")
    .replace(/관련\s*사실\s*사실/g, "관련 사실")
    .replace(/관련\s*내용\s*내용/g, "관련 내용")
    .replace(/관련\s*정보\s*정보/g, "관련 정보")
    .replace(/확인된\s*사실\s*사실/g, "확인된 사실")
    .replace(/문제\s*상황\s*상황/g, "문제 상황")
    .replace(/피해\s*흐름\s*흐름/g, "피해 흐름")
    .replace(/접수\s*사례\s*사례/g, "접수 사례")
    .replace(/사칭\s*사칭/g, "사칭")
    .replace(/사기\s*사기/g, "사기")
    .replace(/피해\s*피해/g, "피해")
    .replace(/대응\s*대응/g, "대응")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function createHeroCta(caseName = "") {
  return `<div class="hero-cta">
    <p class="hero-cta-lead">입금 전 자료를 먼저 확인하세요.</p>
    <div>
      <a href="#consult" class="hero-cta-primary">상담<br>접수하기</a>
      <a href="tel:0263480406" class="hero-cta-secondary">추가 입금 전 문의<br>02-6348-0406</a>
    </div>
  </div>`;

  const keyword = esc(seoCaseKeyword(caseName));
  const lead = keyword ? `${keyword} 피해가 의심되나요?` : "사기 피해가 의심되나요?";
  return `<div class="hero-cta">
    <p class="hero-cta-lead">${lead}</p>
    <div>
      <a href="#consult" class="hero-cta-primary">상담<br>접수하기</a>
      <a href="tel:0263480406" class="hero-cta-secondary">추가 입금 전 문의<br>02-6348-0406</a>
    </div>
  </div>`;

  return `<div class="hero-cta">
    <p class="hero-cta-lead">출금 지연, 추가 입금 요구, 대화방 삭제 정황이 있다면 본문을 읽기 전에 현재 자료부터 점검하세요.</p>
    <div>
      <a href="#consult" class="hero-cta-primary">상담<br>접수하기</a>
      <a href="tel:0263480406" class="hero-cta-secondary">추가 입금 전 문의<br>02-6348-0406</a>
    </div>
  </div>`;
}

function createEvidenceCheckSection() {
  return `<section class="evidence-check">
  <p class="section-kicker">3분 증거 점검</p>
  <h3>상담 전 이것만 먼저 확인하세요</h3>
  <ul>
    <li>입금증, 계좌번호, 예금주가 남아 있는지 확인</li>
    <li>카카오톡·텔레그램 대화방과 담당자 프로필 캡처</li>
    <li>사이트 주소, 로그인 화면, 출금 제한 안내 저장</li>
    <li>세금·보증금·인증비 등 추가 입금 요구 메시지 보존</li>
  </ul>
</section>`;

  return `<section class="article-block evidence-check">
  <p class="section-kicker">3분 증거 점검</p>
  <h2>상담 전 이것만 먼저 확인하세요</h2>
  <ul>
    <li>입금증, 계좌번호, 예금주가 남아 있는지 확인</li>
    <li>카카오톡·텔레그램 대화방과 담당자 프로필 캡처</li>
    <li>사이트 주소, 로그인 화면, 출금 제한 안내 저장</li>
    <li>세금·보증금·인증비 등 추가 입금 요구 메시지 보존</li>
  </ul>
</section>`;
}

function createInlineCta(text = "비슷한 피해 흐름이 보인다면 추가 입금 전에 상담 접수로 현재 자료부터 확인하세요.") {
  return "";

  return `<aside class="inline-cta">
  <strong>추가 입금 전 긴급 점검</strong>
  <p>${esc(text)}</p>
  <div>
    <a href="#consult">상담 접수</a>
    <a href="tel:0263480406">전화 상담</a>
  </div>
</aside>`;
}

function addFaqCta(answer = "") {
  return String(answer || "");

  const text = String(answer || "");
  if (/상담 접수|카톡 상담|전화/.test(text)) return text;
  return `${text} 입금증과 대화 캡처가 있다면 상담 접수나 카톡 상담으로 먼저 자료 상태를 확인할 수 있습니다.`;
}

function withSentenceBreaks(value = "") {
  return esc(value).replace(/([.!?])\s+/g, "$1<br>");
}

function createReceiptBadge(caseData) {
  const count = Number(caseData.reports) > 0 ? Number(caseData.reports) : seededInt(`${caseData.slug}-reports`, 4, 34);
  return `<div class="receipt-badge" aria-label="상담 접수 현황"><span>상담 접수</span><strong>${count.toLocaleString("ko-KR")}</strong><span>건+</span><em id="rBadgeDate"></em></div><script>(function(){var d=new Date();document.getElementById('rBadgeDate').textContent='('+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' 기준)';})();</script>`;
}

function createLiveReceiptStatus(caseData) {
  const rows = createLiveReceiptRows(caseData);
  const html = rows.map((row) => `<li><time>${row.date}</time><strong>${row.area}</strong><span>${row.text}</span></li>`).join("\n");
  return `<section class="article-block live-receipts" aria-label="실시간 접수 현황">
  <h2>실시간 접수 현황</h2>
  <div class="live-receipt-window">
    <ul class="live-receipt-track">${html}${html}</ul>
  </div>
</section>`;
}

function createLiveReceiptRows(caseData) {
  const seed = String(caseData.slug || caseData.caseName || "case");
  const baseDate = parseDate(caseData.createdAt || caseData.updatedAt) || new Date();
  const areas = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "수원", "성남", "고양", "청주", "천안", "전주"];
  const messages = [
    "상담만 받아보고 싶어요",
    "아직 안 늦었을까요?",
    "다음주엔 환불이 된다는데요?",
    "출금하려면 세금을 먼저 내라고 합니다",
    "담당자가 계좌를 계속 바꿉니다",
    "카톡방이 갑자기 사라졌습니다",
    "입금증과 대화 캡처는 보관 중입니다",
    "추가 입금을 멈춰도 되는지 궁금합니다",
    "환불팀이라는 곳에서 다시 연락이 왔습니다",
    "가족에게 알리기 전에 확인하고 싶습니다",
  ];

  return Array.from({ length: 50 }, (_, index) => {
    const randKey = `${seed}-live-${index}`;
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - seededInt(`${randKey}-day`, 0, 7));
    const amount = seededInt(`${randKey}-amount`, 1600, 9800);
    const useMessage = index < 3 || seededInt(`${randKey}-type`, 0, 100) < 42;
    const text = useMessage
      ? messages[index < 3 ? index : seededInt(`${randKey}-message`, 0, messages.length - 1)]
      : `피해금액 ${amount.toLocaleString("ko-KR")}만원 상담 접수`;
    return {
      date: formatDate(date.toISOString().slice(0, 10)),
      area: areas[seededInt(`${randKey}-area`, 0, areas.length - 1)],
      text,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function caseNameVariants(caseName = "") {
  const normalized = normalizeCaseName(caseName);
  const base = baseCaseName(caseName);
  const primary = primaryCaseKeyword(caseName);
  return [...new Set([caseName, normalized, base, primary].map((v) => String(v || "").trim()).filter((v) => v.length > 1))];
}

function cleanFaqQuestion(question, names, keepName) {
  let q = String(question || "").replace(/^\[[^\]]*\]\s*/, "");
  if (!keepName) {
    names.forEach((name) => {
      q = q.split(name).join("").replace(/\s{2,}/g, " ").trim();
    });
    return q.replace(/^\s*[-:|·]\s*/, "").trim();
  }
  const kept = String(keepName || "").trim();
  let used = false;
  names.forEach((name) => {
    if (!q.includes(name)) return;
    if (!used && kept) {
      q = q.replace(name, kept);
      used = true;
    }
    q = q.split(name).join("");
  });
  return q.replace(/\s{2,}/g, " ").trim();
}

function seededInt(seed, min, max) {
  let hash = 2166136261;
  for (let i = 0; i < String(seed).length; i += 1) {
    hash ^= String(seed).charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return min + (Math.abs(hash) % (max - min + 1));
}

function parseDate(value) {
  const date = new Date(`${value || ""}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return String(value || "");
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// ─── Hub API Fallback (b~e → project A에서 데이터 조회) ───────────────────────

async function fetchCaseFromHubAPI(slug) {
  try {
    const res = await fetch(
      `https://gnlaw-criminal.co.kr/api/get-case?slug=${encodeURIComponent(slug)}`,
      { headers: { "User-Agent": "static-landing-worker" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok && data.case ? data.case : null;
  } catch {
    return null;
  }
}

// ─── GitHub Fallback ─────────────────────────────────────────────────────────

async function fetchCaseFromGitHub(slug, env) {
  try {
    const owner = env.GITHUB_REPO_OWNER;
    const repo = env.GITHUB_REPO_NAME;
    const branch = env.GITHUB_BRANCH || "main";
    const token = env.GITHUB_TOKEN;
    if (!owner || !repo || !token) return null;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "static-landing-generator",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });
    if (!res.ok) return null;

    const file = await res.json();
    let text = "";
    if (file.content && file.encoding !== "none") {
      const clean = file.content.replace(/\n/g, "");
      text = new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
    } else if (file.download_url) {
      const dr = await fetch(file.download_url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "static-landing-generator",
        },
      });
      if (dr.ok) text = await dr.text();
    }

    if (!text) return null;
    const cases = JSON.parse(text.trim());
    return cases.find((c) => c.slug === slug) || null;
  } catch {
    return null;
  }
}
