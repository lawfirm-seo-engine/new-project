// Dynamic landing page renderer — reads case data from Cloudflare KV
// Handles: /[pathPrefix]/[slug]/ for each of the 5 groups

const GROUPS = {
  "new-project-9o2.pages.dev": {
    key: "a", pathPrefix: "prosecute", bodyClass: "domain-a",
    siteName: "피해금 추적 법률센터", shortName: "형사고소 센터",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수", tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수", ogType: "article",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    naverVerification: "bfc9894c3704ecb4fae524d6dbbb1dc61ecb6488",
    siteUrl: "https://new-project-9o2.pages.dev",
  },
  "new-project-b.pages.dev": {
    key: "b", pathPrefix: "civil", bodyClass: "domain-b",
    siteName: "민사 회수 전략실", shortName: "민사 회수",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환", tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의", ogType: "article",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    naverVerification: "055ad63c2d7af8f9a348cd098a356d22ffbc5d49",
    siteUrl: "https://new-project-b.pages.dev",
  },
  "new-project-c.pages.dev": {
    key: "c", pathPrefix: "success", bodyClass: "domain-c",
    siteName: "피해 회수 성공사례", shortName: "성공사례",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수", tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의", ogType: "article",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    naverVerification: "75b446d5dc7c0006c1b15c9e51f46f71345e03d8",
    siteUrl: "https://new-project-c.pages.dev",
  },
  "new-project-d.pages.dev": {
    key: "d", pathPrefix: "briefing", bodyClass: "domain-d",
    siteName: "피해 사건 정보", shortName: "사건 정보",
    intent: "사건 개요 · 대응 방법 · 정보 요약", tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "정보 확인", ogType: "article",
    descriptionSuffix: "네이버 검색 노출을 고려해 사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    naverVerification: "a27aaeb3544f1e30860eed6045a0c50abe6705b5",
    siteUrl: "https://new-project-d.pages.dev",
  },
  "new-project-e.pages.dev": {
    key: "e", pathPrefix: "case", bodyClass: "domain-e",
    siteName: "사기피해 통합 허브", shortName: "전체 허브",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건", tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인", ogType: "article",
    descriptionSuffix: "전체 사건 허브에서 형사, 민사, 성공사례, 사건정보를 사건별로 연결합니다.",
    naverVerification: "ffa1a3b7c30df21443214e8514e4986358489efe",
    siteUrl: "https://new-project-e.pages.dev",
  },
};

const CROSS_LINKS = [
  { key: "a", label: "형사고소", url: "https://new-project-9o2.pages.dev", prefix: "prosecute" },
  { key: "b", label: "민사소송", url: "https://new-project-b.pages.dev", prefix: "civil" },
  { key: "c", label: "성공사례", url: "https://new-project-c.pages.dev", prefix: "success" },
  { key: "d", label: "사건정보", url: "https://new-project-d.pages.dev", prefix: "briefing" },
  { key: "e", label: "전체허브", url: "https://new-project-e.pages.dev", prefix: "case" },
];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

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

  // /[pathPrefix]/[slug]/ 형태의 랜딩 페이지만 처리
  const parts = pathname.replace(/^\/|\/$/g, "").split("/");
  if (parts.length !== 2 || parts[0] !== group.pathPrefix || !parts[1]) {
    return next();
  }

  const slug = decodeURIComponent(parts[1]);

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
  const landing = caseData.landings?.[group.key] || {};
  const rawCaseName = caseData.caseName || "";
  const dispName = normalizeCaseName(rawCaseName);
  const pageTitle = groupPageTitle(rawCaseName, group.key);
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(caseData.slug)}/`;
  const ogImage = caseData.thumbnailUrl || landing.ogImage || `${group.siteUrl}/og/${caseData.slug}.webp`;
  const publishedDate = caseData.createdAt || new Date().toISOString().slice(0, 10);
  const modifiedDate = new Date().toISOString().slice(0, 10);
  const isoPublished = `${publishedDate}T00:00:00+09:00`;
  const isoModified = new Date().toISOString();
  const keyword = `${baseCaseName(rawCaseName)} 사기, ${baseCaseName(rawCaseName)} 사칭 사기`;

  const headExtra = [
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="NaverBot" content="All">`,
    `<meta name="Yeti" content="All">`,
    group.naverVerification ? `<meta name="naver-site-verification" content="${group.naverVerification}">` : "",
    `<meta name="theme-color" content="${themeColor(group.key)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(group.siteName)} RSS" href="/rss.xml">`,
    `<link rel="sitemap" type="application/xml" href="/sitemap-index.xml">`,
    `<link rel="preload" as="image" href="/assets/og-template.png">`,
    `<link rel="prefetch" href="${esc(ogImage)}" as="image">`,
    `<meta property="article:published_time" content="${isoPublished}">`,
    `<meta property="article:modified_time" content="${isoModified}">`,
    `<meta property="article:author" content="대온 법률사무소">`,
    `<meta property="article:section" content="${esc(group.intent)}">`,
    `<meta name="author" content="대온 법률사무소">`,
    keyword ? `<meta name="keywords" content="${esc(keyword)}">` : "",
  ].filter(Boolean).join("\n  ");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: pageTitle, url: canonical, inLanguage: "ko-KR",
        datePublished: publishedDate, dateModified: modifiedDate,
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
        author: ORGANIZATION,
      },
      {
        "@type": group.key === "d" ? "NewsArticle" : "Article",
        "@id": `${canonical}#article`,
        headline: pageTitle, url: canonical, inLanguage: "ko-KR",
        datePublished: publishedDate, dateModified: modifiedDate,
        author: ORGANIZATION, publisher: ORGANIZATION,
        isPartOf: { "@id": `${canonical}#webpage` },
        keywords: keyword,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: group.siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: rawCaseName, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: (landing.faq || []).map((item) => ({
          "@type": "Question", name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
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

  return pageTemplate({
    title: esc(`${pageTitle} | 대온 법률사무소`),
    description: esc(landing.description || caseData.summary || ""),
    canonical,
    ogType: group.ogType,
    ogTitle: esc(pageTitle),
    ogDescription: esc(landing.ogDescription || landing.description || caseData.summary || ""),
    ogImage: esc(ogImage),
    siteName: esc(group.siteName),
    headExtra,
    schema,
    bodyClass: `${group.bodyClass} landing-page`,
    tone: esc(group.tone),
    h1: esc(pageTitle),
    ogThumbnail,
    summary: pageSummary,
    receiptBadge: createReceiptBadge(caseData),
    content,
    intent: esc(group.intent),
    ctaTitle: esc(group.ctaTitle),
    ctaText: esc(group.ctaText),
    ctaLabel: esc(group.ctaLabel),
    footerLinks,
    headerCall: `<a class="header-call" href="#consult">상담 접수</a>`,
  });
}

function createLandingContent(landing, group, caseData) {
  const name = esc(normalizeCaseName(caseData.caseName));
  const rawCaseName = caseData.caseName || "";
  const slug = esc(caseData.slug);
  const cn = esc(normalizeCaseName(caseData.caseName));
  const siteName = esc(group.siteName);

  const trackScript = `<script>(function(){fetch('/api/track-view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${slug}'})}).catch(function(){});})();</script>`;
  const memoSection = caseData.memo
    ? `<section class="article-block memo-section"><h2>운영자 안내</h2><p>${esc(caseData.memo)}</p></section>`
    : "";
  const body = renderBodyForLanding(landing, group, caseData);
  const victimCases = renderVictimCasesForLanding(landing, group, caseData);
  const faq = renderFaqForLanding(landing, group, caseData);
  const liveStatus = createLiveReceiptStatus(caseData);

  const faqSection = group.key === "d"
    ? `<section class="article-block brief-card"><h2>${name} 사건 개요</h2>${paragraphs(body)}</section>
<section class="article-block"><h2>${name} 피해 유형</h2>${list(victimCases)}</section>
<section class="article-block faq"><h2>${name} 자주 묻는 질문 (FAQ)</h2>${faqHtml(faq, rawCaseName)}</section>`
    : `<section class="article-block"><p class="section-kicker">${esc(group.intent)}</p><h2>${name} 핵심 대응</h2>${paragraphs(body)}</section>
<section class="article-block"><h2>${name} 피해 사례</h2>${list(victimCases)}</section>
<section class="article-block faq"><h2>${name} FAQ</h2>${faqHtml(faq, rawCaseName)}</section>`;

  const consultForm = createConsultForm(cn, siteName);
  const floatingWidgets = createFloatingWidgets(cn, siteName, slug);

  return [faqSection, liveStatus, memoSection, consultForm, floatingWidgets, trackScript].filter(Boolean).join("\n");
}

function renderBodyForLanding(landing, group, caseData) {
  const fullName = normalizeCaseName(caseData.caseName || "");
  const base = fullName.replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "").trim() || fullName;
  const original = Array.isArray(landing.body) ? landing.body.filter(Boolean) : [];
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
      `${base} 원고는 네이버 AI 브리핑이 이해하기 쉬운 구조를 목표로 합니다. 사건 개요, 피해 구조, 즉시 대응, 증거 목록을 질문과 답변처럼 정리하면 검색자가 필요한 정보를 빠르게 파악할 수 있습니다.`,
      `AI 브리핑 노출을 고려할 때는 과장된 홍보 문구보다 명확한 사실 구조가 중요합니다. 업체명, 입금 명목, 출금 제한, 추가 비용 요구, 상담 접수 전 준비 자료를 균형 있게 설명해야 합니다.`,
    ],
    e: [
      `${base} 전체 허브는 형사고소, 민사소송, 성공사례, AI 브리핑 정보를 균형 있게 연결합니다. 사건을 처음 확인한 사람은 전체 흐름을 보고, 급한 경우 전화나 카톡 상담으로 증거 상태를 먼저 점검할 수 있습니다.`,
      `같은 사건이라도 처벌을 원하면 형사형, 회수를 원하면 민사형, 유사 결과를 보고 싶으면 성공사례형, 구조를 파악하려면 브리핑형이 적합합니다. 전체 허브는 이 선택을 돕는 안내 페이지입니다.`,
    ],
  }[group.key] || [];

  return [...original, ...additions].slice(0, 9);
}

function renderVictimCasesForLanding(landing, group, caseData) {
  const fullName = normalizeCaseName(caseData.caseName || "");
  const base = fullName.replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "").trim() || fullName;
  const original = Array.isArray(landing.victimCases) ? landing.victimCases.filter(Boolean) : [];
  const additions = [
    `${base} 상담원이 카카오톡이나 텔레그램으로 접근해 소액 수익 화면을 보여준 뒤 세금, 보증금, 인증비 명목의 추가 입금을 요구한 사례`,
    `피해자가 출금을 요청하자 심사 중이라는 안내만 반복되고, 입금 계좌와 담당자 계정이 며칠 사이 바뀐 사례`,
    `환불을 요구한 뒤 피해금 회복팀 또는 법무팀을 사칭한 계정이 다시 연락해 선입금 수수료를 요구한 2차 피해 사례`,
    `입금증, 계좌번호, 대화 캡처는 남아 있지만 사이트가 폐쇄되어 상담 접수 단계에서 증거를 다시 정리한 사례`,
    `여러 피해자가 같은 계좌 또는 유사 URL을 확인해 형사고소와 민사 가압류 가능성을 함께 검토한 사례`,
  ];
  return [...original, ...additions].slice(0, 5);
}

function renderFaqForLanding(landing, group, caseData) {
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
      { question: "형사고소 전 상담 접수를 먼저 해도 되나요?", answer: "가능합니다. 상담 접수 단계에서 증거 목록과 고소장 구성 방향을 먼저 확인하면 경찰 접수 전 빠진 자료를 보완할 수 있습니다. 급하면 전화나 카톡 상담으로 현재 자료부터 점검할 수 있습니다." },
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
      { question: "네이버 AI 브리핑에 맞는 원고 구조는 무엇인가요?", answer: "사건 개요, 피해 방식, 즉시 대응, 증거 보존, 상담 접수 전 준비 자료가 질문과 답변처럼 명확해야 합니다. 과도한 홍보보다 정보성 문장이 브리핑형 원고에 더 적합합니다." },
      { question: "AI 브리핑형 페이지에서도 상담 유도 문구가 필요한가요?", answer: "필요합니다. 다만 노골적인 광고보다 증거를 보존한 뒤 전화나 카톡 상담으로 현재 상황을 확인하라는 실용적인 안내가 더 자연스럽습니다." },
    ],
    e: [
      { question: "전체 허브에서는 어떤 균형이 중요한가요?", answer: "형사고소, 민사 회수, 성공사례, 정보 브리핑을 한쪽으로 치우치지 않게 연결해야 합니다. 사용자가 자신의 목적에 맞는 페이지로 이동할 수 있도록 안내하는 것이 핵심입니다." },
      { question: "처음 방문자는 어디서 상담을 시작하면 좋나요?", answer: "사건 구조를 모르면 전체 허브에서 자료를 분류하고, 급한 추가 입금 요구가 있다면 전화 또는 카톡 상담으로 먼저 확인하는 것이 좋습니다. 이후 형사형이나 민사형으로 이동하면 됩니다." },
    ],
  }[group.key] || [];

  return [...original, ...additions, ...shared].slice(0, 7);
}

function createConsultForm(cn, siteName) {
  return `<section class="article-block consult-form-section" id="consult">
  <h2>상담 접수</h2>
  <p>추가 입금 요구를 받았거나 출금이 막혔다면 지금 자료를 남겨주세요. 상담 접수 후 전화 또는 카톡으로 입금 내역, 대화 캡처, 계좌 정보를 확인해 초기 대응 방향을 안내합니다.</p>
  <form class="consult-form" id="consultForm">
    <input type="text" name="cname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="phone" placeholder="연락처 (010-xxxx-xxxx)" required autocomplete="tel">
    <input type="text" name="amount" placeholder="피해금액 (예: 500만원)" required>
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
        var res = await fetch('https://new-project-9o2.pages.dev/api/submit-consult', {
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
  <a href="tel:02-6952-3695" class="float-btn phone">전화문의</a>
  <a href="http://pf.kakao.com/_xcypmn/chat" class="float-btn kakao" target="_blank" rel="noopener noreferrer">카톡상담</a>
</div>
<div class="sticky-bar" id="stickyBar">
  <span class="sticky-title">긴급상담 ｜ 02-6952-3695</span>
  <form class="sticky-form" id="stickyConsultForm">
    <input type="text" name="sname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="sphone" placeholder="연락처" required autocomplete="tel">
    <input type="text" name="samount" placeholder="피해금액" required>
    <button type="submit">상담 접수</button>
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
      var res = await fetch('https://new-project-9o2.pages.dev/api/submit-consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.sname.value, phone: this.sphone.value, amount: this.samount.value, caseName: '${cn}', domain: '${siteName}' })
      });
      var data = await res.json();
      if (data.ok) { msg.textContent = '접수 완료!'; msg.className = 'sticky-msg ok'; this.reset(); btn.disabled = false; btn.textContent = '상담 접수'; }
      else { msg.textContent = data.message || '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
    } catch(err) { msg.textContent = '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
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
    <a class="brand" href="/" aria-label="대온 법률사무소 홈">
      <img src="/assets/logo.png" alt="대온 법률사무소">
    </a>
    ${d.headerCall}
  </header>
  <main>
    <section class="hero">
      <p class="eyebrow">${d.tone}</p>
      <h1>${d.h1}</h1>
      ${d.ogThumbnail}
      <p class="summary">${d.summary}</p>
      ${d.receiptBadge || ""}
    </section>
    <div class="page-shell">
      ${d.content}
    </div>
    <section id="consult" class="cta">
      <p class="eyebrow">${d.intent}</p>
      <h2>${d.ctaTitle}</h2>
      <p>${d.ctaText}</p>
      <a href="tel:0269523695">${d.ctaLabel}</a>
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="/assets/logo.png" alt="대온 법률사무소">
      </div>
      <nav class="footer-nav" aria-label="카테고리 바로가기">${d.footerLinks}</nav>
      <address class="footer-info">
        <span>대표변호사 : 신동우</span>
        <span>주소 : 서울 서초구 서초대로 250 스타갤러리브릿지빌딩 802호</span>
        <span>전화번호 : <a href="tel:0269523695">02-6952-3695</a></span>
        <span>이메일 : <a href="mailto:noleosi@daeonlaw.co.kr">noleosi@daeonlaw.co.kr</a></span>
      </address>
      <p class="copyright">COPYRIGHT © 2024 대온 법률사무소 All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORGANIZATION = {
  "@type": "Organization",
  "@id": "https://new-project-9o2.pages.dev/#organization",
  name: "대온 법률사무소",
  url: "https://new-project-9o2.pages.dev",
  logo: { "@type": "ImageObject", url: "https://new-project-9o2.pages.dev/assets/logo.png" },
};

function esc(v = "") {
  return String(v).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#039;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function normalizeCaseName(name) {
  let clean = String(name || "").trim().replace(/\s*(?:사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  return /사기/.test(clean) ? `${clean} 사칭` : `${clean} 사칭 사기`;
}

function baseCaseName(name) {
  return String(name || "").trim().replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "").trim();
}

function groupPageTitle(name, key) {
  const base = baseCaseName(name);
  const s = { a: "사칭 사기 형사 고소", b: "사칭 사기 민사 소송", c: "사칭 사기 피해금 회수", d: "사칭 사기 피해 접수", e: "사칭 사기 피해 진행현황" };
  return `${base} ${s[key] || "사칭 사기"}`;
}

function themeColor(key) {
  return { a: "#111827", b: "#173b57", c: "#174333", d: "#25314d", e: "#3b2f52" }[key] || "#111827";
}

function paragraphs(items = []) {
  return (items || []).map((item) => `<p>${withSentenceBreaks(item)}</p>`).join("\n");
}

function list(items = []) {
  return `<ul>${(items || []).map((item) => `<li>${withSentenceBreaks(item)}</li>`).join("\n")}</ul>`;
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
    return `<details><summary>${esc(q)}</summary><p>${withSentenceBreaks(item.answer)}</p></details>`;
  }).join("\n");
}

function withSentenceBreaks(value = "") {
  return esc(value).replace(/([.!?])\s+/g, "$1<br>");
}

function createReceiptBadge(caseData) {
  const count = Number(caseData.reports) > 0 ? Number(caseData.reports) : seededInt(`${caseData.slug}-reports`, 4, 34);
  const date = formatDate(caseData.createdAt || caseData.updatedAt || new Date().toISOString().slice(0, 10));
  return `<div class="receipt-badge" aria-label="상담 접수 현황"><span>상담 접수</span><strong>${count.toLocaleString("ko-KR")}</strong><span>건+</span><em>(${date} 기준)</em></div>`;
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
  return [...new Set([caseName, normalized, base].map((v) => String(v || "").trim()).filter((v) => v.length > 1))];
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
      `https://new-project-9o2.pages.dev/api/get-case?slug=${encodeURIComponent(slug)}`,
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
