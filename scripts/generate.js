import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const dataPath = path.join(root, "data", "cases.json");
const publicDir = path.join(root, "public");
const templatesDir = path.join(root, "templates");

const crossLinks = [
  { key: "a", label: "형사고소", url: "https://new-project-9o2.pages.dev", prefix: "prosecute" },
  { key: "b", label: "민사소송", url: "https://new-project-b.pages.dev", prefix: "civil" },
  { key: "c", label: "성공사례", url: "https://new-project-c.pages.dev", prefix: "success" },
  { key: "d", label: "AI브리핑", url: "https://new-project-d.pages.dev", prefix: "briefing" },
  { key: "e", label: "전체허브", url: "https://new-project-e.pages.dev", prefix: "case" },
];

const groups = [
  {
    key: "a",
    outDir: path.join(root, "dist-a"),
    template: "group-a.html",
    siteUrl: "https://new-project-9o2.pages.dev",
    pathPrefix: "prosecute",
    bodyClass: "domain-a",
    siteName: "피해금 추적 법률센터",
    shortName: "형사고소 센터",
    label: "법률형",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수",
    ogType: "article",
    titleSuffix: "형사고소 및 법적 대응",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    ogSuffix: "형사고소 대응",
    hubTitle: "사기피해 형사 사건 접수 리스트",
    hubLead: "사기 의심 업체명과 접수 현황을 빠르게 확인하고, 동일 피해자가 모일 수 있도록 사건별 법적 대응 정보를 정리합니다.",
    tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수",
    tableTitle: "형사고소 진행 현황",
  },
  {
    key: "b",
    outDir: path.join(root, "dist-b"),
    template: "group-b.html",
    siteUrl: "https://new-project-b.pages.dev",
    pathPrefix: "civil",
    bodyClass: "domain-b",
    siteName: "민사 회수 전략실",
    shortName: "민사 회수",
    label: "민사형",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환",
    ogType: "article",
    titleSuffix: "민사소송 및 회수 절차",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    ogSuffix: "민사 회수 절차",
    hubTitle: "민사 소송 진행 사건 리스트",
    hubLead: "채권 보전과 손해배상 청구 관점에서 사건별 회수 가능성, 가압류 필요성, 합의 전략을 정리합니다.",
    tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의",
    tableTitle: "민사 소송 진행 현황",
  },
  {
    key: "c",
    outDir: path.join(root, "dist-c"),
    template: "group-c.html",
    siteUrl: "https://new-project-c.pages.dev",
    pathPrefix: "success",
    bodyClass: "domain-c",
    siteName: "피해 회수 성공사례",
    shortName: "성공사례",
    label: "성공사례형",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수",
    ogType: "article",
    titleSuffix: "회수 성공사례 분석",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    ogSuffix: "회수 성공사례",
    hubTitle: "피해 회수 성공 사건 리스트",
    hubLead: "유사 사건의 대응 흐름과 회수율을 비교할 수 있도록 성공사례 중심으로 재구성한 사건 목록입니다.",
    tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의",
    tableTitle: "성공사례 진행 현황",
  },
  {
    key: "d",
    outDir: path.join(root, "dist-d"),
    template: "group-d.html",
    siteUrl: "https://new-project-d.pages.dev",
    pathPrefix: "briefing",
    bodyClass: "domain-d",
    siteName: "AI 피해 브리핑",
    shortName: "AI 브리핑",
    label: "AI브리핑형",
    intent: "네이버 AI브리핑 · 사건 개요 · 대응 방법",
    ogType: "article",
    titleSuffix: "AI브리핑 대응 정보",
    descriptionSuffix: "네이버 AI브리핑 노출을 고려해 사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    ogSuffix: "AI브리핑",
    hubTitle: "AI브리핑 사건 정보 리스트",
    hubLead: "검색자가 사건 구조를 빠르게 이해할 수 있도록 질문과 답변, 핵심 요약, 대응 순서를 정보성으로 제공합니다.",
    tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "브리핑 확인",
    tableTitle: "AI브리핑 진행 현황",
  },
  {
    key: "e",
    outDir: path.join(root, "dist-e"),
    template: "group-e.html",
    siteUrl: "https://new-project-e.pages.dev",
    pathPrefix: "case",
    bodyClass: "domain-e",
    siteName: "사기피해 통합 허브",
    shortName: "전체 허브",
    label: "전체 허브형",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건",
    ogType: "website",
    titleSuffix: "전체 허브",
    descriptionSuffix: "전체 사건 허브에서 형사, 민사, 성공사례, AI브리핑 정보를 사건별로 연결합니다.",
    ogSuffix: "전체 허브",
    hubTitle: "사기피해 전체 사건 리스트",
    hubLead: "같은 사건을 형사고소, 민사소송, 성공사례, 정보 브리핑 관점으로 연결해 검색 의도별 진입 경로를 제공합니다.",
    tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인",
    tableTitle: "전체 사건 진행 현황",
  },
];

const cases = await fs.readJson(dataPath);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceAllPlaceholders(template, data) {
  return Object.entries(data).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value ?? ""),
    template,
  );
}

function getLanding(caseItem, group) {
  return caseItem.landings?.[group.key] || createFallbackLanding(caseItem, group);
}

function createFallbackLanding(caseItem, group) {
  const caseName = caseItem.caseName || caseItem.name;
  const slug = caseItem.slug;
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${slug}/`;
  const description = `${caseName} 관련 ${group.descriptionSuffix}`;
  const faq = [
    {
      question: `${caseName} 피해금을 회수할 수 있나요?`,
      answer: "입금 계좌, 대화 내역, 플랫폼 주소, 담당자 정보 등 증거가 남아 있다면 형사·민사 절차를 함께 검토할 수 있습니다.",
    },
    {
      question: "추가 입금을 요구받으면 어떻게 해야 하나요?",
      answer: "추가 입금은 중단하고 입금 내역, 대화방, URL, 계정 정보, 송금 영수증을 먼저 보존해야 합니다.",
    },
  ];

  return {
    title: `${caseName} ${group.titleSuffix}`,
    description,
    canonical,
    ogTitle: `${caseName} ${group.ogSuffix}`,
    ogDescription: description,
    ogImage: `${group.siteUrl}/og/${slug}.webp`,
    h1: `${caseName} ${group.titleSuffix}`,
    body: [
      caseItem.summary || `${caseName} 피해 구조와 대응 방법을 정리한 안내입니다.`,
      group.descriptionSuffix,
      "입금 내역, 대화 내용, 사이트 주소, 계정 정보는 삭제하지 않고 보존하는 것이 중요합니다.",
    ],
    victimCases: [
      "출금 또는 수익 실현을 조건으로 추가 입금을 요구받은 사례",
      "상담원 또는 담당자 사칭 계정으로 입금을 유도받은 사례",
      "화면상 잔액은 보이지만 실제 출금이 제한된 사례",
    ],
    suspiciousCompanies: [
      `${caseName} 관련 사이트 또는 앱`,
      `${caseName} 상담원·담당자 사칭 계정`,
      `${caseName} 입금 계좌 또는 연계 법인 명칭`,
    ],
    faq,
    schema: createSchemaData({ title: `${caseName} ${group.titleSuffix}`, description, canonical, faq }),
  };
}

function createSchemaData({ title, description, canonical, faq }) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: title,
        description,
        url: canonical,
        inLanguage: "ko-KR",
      },
      {
        "@type": "Article",
        headline: title,
        description,
        url: canonical,
        inLanguage: "ko-KR",
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

function createLandingContent(landing, group, caseItem) {
  return [
    `<section class="article-block"><p class="section-kicker">${escapeHtml(group.intent)}</p><h2>${escapeHtml(caseItem.caseName)} 핵심 대응</h2>${paragraphs(landing.body)}</section>`,
    `<section class="article-block ${group.key === "d" ? "brief-card" : ""}"><h2>피해 사례</h2>${list(landing.victimCases)}</section>`,
    `<section class="article-block"><h2>사기 의심 업체 리스트</h2>${list(landing.suspiciousCompanies)}</section>`,
    `<section class="article-block faq"><h2>FAQ</h2>${faqHtml(landing.faq)}</section>`,
    `<section class="related"><h2>검색 의도별 관련 페이지</h2>${createRelatedLinks(caseItem)}</section>`,
  ].join("\n");
}

function paragraphs(items = []) {
  return items.map((item) => `<p>${escapeHtml(item)}</p>`).join("\n");
}

function list(items = []) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}</ul>`;
}

function faqHtml(items = []) {
  return items
    .map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`)
    .join("\n");
}

function createRelatedLinks(caseItem, currentKey = "") {
  const caseName = escapeHtml(caseItem.caseName || caseItem.name);
  const slug = encodeURIComponent(caseItem.slug);

  return `
    <div class="related-grid">
      ${crossLinks
        .map((link) => {
          const active = link.key === currentKey ? " is-active" : "";
          return `<a class="related-card${active}" href="${link.url}/${link.prefix}/${slug}/"><span>${link.label}</span><strong>${caseName}</strong></a>`;
        })
        .join("\n")}
    </div>
  `;
}

function createHeadExtra({ landing, group, caseItem, isHub = false }) {
  const slug = caseItem?.slug ? encodeURIComponent(caseItem.slug) : "";
  const links = [
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="NaverBot" content="All">`,
    `<meta name="Yeti" content="All">`,
    `<meta name="theme-color" content="${themeColor(group.key)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(group.siteName)} RSS" href="/rss.xml">`,
    `<link rel="sitemap" type="application/xml" href="/sitemap-index.xml">`,
    `<link rel="preload" as="image" href="/assets/og-template.png">`,
  ];

  if (slug) {
    links.push(`<link rel="prefetch" href="https://new-project-e.pages.dev/case/${slug}/">`);
    links.push(`<link rel="prefetch" href="${landing.ogImage}" as="image">`);
  }

  if (isHub) {
    links.push(`<meta name="classification" content="${escapeHtml(group.intent)}">`);
  }

  return links.join("\n  ");
}

function themeColor(key) {
  return {
    a: "#111827",
    b: "#173b57",
    c: "#174333",
    d: "#25314d",
    e: "#3b2f52",
  }[key];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createHubContent(group) {
  const caseViews = cases.map(() => randomInt(140, 8140));
  const caseReports = cases.map(() => randomInt(4, 34));
  const totalViews = caseViews.reduce((sum, v) => sum + v, 0);
  const totalReports = caseReports.reduce((sum, r) => sum + r, 0);

  const rows = cases
    .map((item, index) => {
      const caseName = escapeHtml(item.caseName || item.name);
      const url = `/${group.pathPrefix}/${encodeURIComponent(item.slug)}/`;
      return `
        <a href="${url}" class="case-row" data-title="${caseName}">
          <span class="case-no">${cases.length - index}</span>
          <span class="case-title-wrap">
            <strong class="case-title">${caseName}</strong>
            ${index < 6 ? '<em class="today-badge">TODAY</em>' : ""}
          </span>
          <span class="case-status">${statusLabel(group.key)}</span>
          <span class="case-date">${escapeHtml(item.updatedAt)}</span>
          <span class="case-views">${caseViews[index].toLocaleString("ko-KR")}</span>
        </a>`;
    })
    .join("\n");

  return `
    <section class="hub-stats-section">
      <div class="hub-stats">
        <div><strong>${cases.length.toLocaleString("ko-KR")}</strong><span>등록 사건</span></div>
        <div><strong>${totalReports.toLocaleString("ko-KR")}</strong><span>누적 접수</span></div>
        <div><strong>${totalViews.toLocaleString("ko-KR")}</strong><span>조회수</span></div>
      </div>
    </section>
    <div class="case-search-wrap">
      <input id="case-search" type="search" class="case-search" placeholder="사기 업체명 또는 사건명 검색" autocomplete="off">
      <button class="search-btn" type="button">검색</button>
    </div>
    <section class="case-table-wrap" aria-label="${escapeHtml(group.tableTitle)}">
      <div class="case-table-title">
        <h2>${escapeHtml(group.tableTitle)}</h2>
        <p class="case-table-lead">${escapeHtml(group.hubLead)}</p>
      </div>
      <div class="case-table-header"><span>No.</span><span>사건명</span><span>상태</span><span>등록일</span><span>조회수</span></div>
      ${rows}
    </section>
    <script>
      const searchInput = document.getElementById("case-search");
      const rows = Array.from(document.querySelectorAll(".case-row"));
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          const query = searchInput.value.trim().toLowerCase();
          rows.forEach((row) => {
            row.style.display = row.dataset.title.toLowerCase().includes(query) ? "grid" : "none";
          });
        });
      }
    </script>`;
}

function statusLabel(key) {
  return {
    a: "형사 검토중",
    b: "민사 검토중",
    c: "사례 분석",
    d: "브리핑 공개",
    e: "허브 연결",
  }[key];
}

function buildPage(template, group, data) {
  return replaceAllPlaceholders(template, {
    bodyClass: group.bodyClass,
    siteName: escapeHtml(group.siteName),
    shortName: escapeHtml(group.shortName),
    intent: escapeHtml(group.intent),
    tone: escapeHtml(group.tone),
    footerLinks: createFooterLinks(group),
    ctaTitle: escapeHtml(group.ctaTitle),
    ctaText: escapeHtml(group.ctaText),
    ctaLabel: escapeHtml(group.ctaLabel),
    ogType: group.ogType,
    ...data,
  });
}

function createFooterLinks(group) {
  return crossLinks
    .map((link) => {
      const active = link.key === group.key ? "is-active" : "";
      return `<a class="${active}" href="${link.url}/">${escapeHtml(link.label)}</a>`;
    })
    .join("\n");
}

for (const group of groups) {
  const template = await fs.readFile(path.join(templatesDir, group.template), "utf8");

  await fs.emptyDir(group.outDir);

  if (await fs.pathExists(publicDir)) {
    await fs.copy(publicDir, path.join(group.outDir, "assets"));
  }

  if (group.key === "a") {
    await fs.copy(path.join(root, "admin"), path.join(root, "dist-a", "admin"));
  }

  const hubTitle = group.hubTitle;
  const hubDescription = group.hubLead;
  const hubHtml = buildPage(template, group, {
    title: escapeHtml(hubTitle),
    description: escapeHtml(hubDescription),
    canonical: `${group.siteUrl}/`,
    ogTitle: escapeHtml(hubTitle),
    ogDescription: escapeHtml(hubDescription),
    ogImage: `${group.siteUrl}/og/hub.webp`,
    headExtra: createHeadExtra({ group, isHub: true }),
    schema: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hubTitle,
      url: `${group.siteUrl}/`,
      inLanguage: "ko-KR",
      description: hubDescription,
    }),
    h1: escapeHtml(hubTitle),
    summary: "",
    content: createHubContent(group),
    pageKind: "hub-page",
  });

  await fs.outputFile(path.join(group.outDir, "index.html"), hubHtml);

  for (const caseItem of cases) {
    const landing = getLanding(caseItem, group);
    const html = buildPage(template, group, {
      title: escapeHtml(landing.title),
      description: escapeHtml(landing.description),
      canonical: landing.canonical,
      ogTitle: escapeHtml(landing.ogTitle),
      ogDescription: escapeHtml(landing.ogDescription),
      ogImage: landing.ogImage,
      headExtra: createHeadExtra({ landing, group, caseItem }),
      schema: JSON.stringify(landing.schema, null, 2),
      h1: escapeHtml(landing.h1),
      summary: escapeHtml(landing.description),
      content: createLandingContent(landing, group, caseItem),
      pageKind: "landing-page",
    });

    await fs.outputFile(path.join(group.outDir, group.pathPrefix, caseItem.slug, "index.html"), html);
  }

  const urls = [
    `${group.siteUrl}/`,
    ...cases.map((item) => `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(item.slug)}/`),
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url, index) => `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>${index === 0 ? "hourly" : "daily"}</changefreq><priority>${index === 0 ? "1.0" : "0.8"}</priority></url>`).join("\n")}
</urlset>`;

  await fs.outputFile(path.join(group.outDir, "sitemap.xml"), sitemap);

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${group.siteUrl}/sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
</sitemapindex>`;

  await fs.outputFile(path.join(group.outDir, "sitemap-index.xml"), sitemapIndex);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(group.siteName)} - ${escapeHtml(group.label)}</title>
    <link>${group.siteUrl}/</link>
    <description>${escapeHtml(group.descriptionSuffix)}</description>
    ${cases.map((item) => {
      const landing = getLanding(item, group);
      return `
    <item>
      <title>${escapeHtml(landing.title)}</title>
      <link>${landing.canonical}</link>
      <description>${escapeHtml(landing.description)}</description>
      <pubDate>${new Date(`${item.updatedAt || lastmod}T00:00:00+09:00`).toUTCString()}</pubDate>
    </item>`;
    }).join("")}
  </channel>
</rss>`;

  await fs.outputFile(path.join(group.outDir, "rss.xml"), rss);

  await fs.outputFile(path.join(group.outDir, "robots.txt"), `User-agent: *
Allow: /
Sitemap: ${group.siteUrl}/sitemap-index.xml
Sitemap: ${group.siteUrl}/sitemap.xml
`);

  console.log(`[OK] generated ${cases.length} pages in dist-${group.key}/`);
}

console.log("[OK] generated all group landing pages");
