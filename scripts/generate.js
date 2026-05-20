import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const dataPath = path.join(root, "data", "cases.json");
const publicDir = path.join(root, "public");
const templatesDir = path.join(root, "templates");

const groups = [
  {
    key: "a",
    outDir: path.join(root, "dist-a"),
    template: "group-a.html",
    siteUrl: "https://new-project-9o2.pages.dev",
    pathPrefix: "prosecute",
    label: "법률형",
    titleSuffix: "형사고소 및 법적 대응",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 검토합니다.",
    ogSuffix: "형사고소 대응",
  },
  {
    key: "b",
    outDir: path.join(root, "dist-b"),
    template: "group-b.html",
    siteUrl: "https://new-project-b.pages.dev",
    pathPrefix: "civil",
    label: "민사형",
    titleSuffix: "민사소송 및 회수 절차",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수를 안내합니다.",
    ogSuffix: "민사소송 회수",
  },
  {
    key: "c",
    outDir: path.join(root, "dist-c"),
    template: "group-c.html",
    siteUrl: "https://new-project-c.pages.dev",
    pathPrefix: "success",
    label: "성공사례형",
    titleSuffix: "회수 성공사례",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 사례를 중심으로 안내합니다.",
    ogSuffix: "회수 성공사례",
  },
  {
    key: "d",
    outDir: path.join(root, "dist-d"),
    template: "group-d.html",
    siteUrl: "https://new-project-d.pages.dev",
    pathPrefix: "briefing",
    label: "AI브리핑형",
    titleSuffix: "AI브리핑 정보",
    descriptionSuffix: "네이버 AI브리핑 노출을 고려해 사건 개요, 피해 구조, 대응 방법을 정보성으로 정리합니다.",
    ogSuffix: "AI브리핑",
  },
  {
    key: "e",
    outDir: path.join(root, "dist-e"),
    template: "group-e.html",
    siteUrl: "https://new-project-e.pages.dev",
    pathPrefix: "case",
    label: "전체 허브형",
    titleSuffix: "전체 허브",
    descriptionSuffix: "전체 사건 허브, 관련 사건, 유형별 대응 정보를 연결합니다.",
    ogSuffix: "전체 허브",
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
  return template
    .replaceAll("{{title}}", data.title)
    .replaceAll("{{description}}", data.description)
    .replaceAll("{{canonical}}", data.canonical)
    .replaceAll("{{ogTitle}}", data.ogTitle)
    .replaceAll("{{ogDescription}}", data.ogDescription)
    .replaceAll("{{ogImage}}", data.ogImage)
    .replaceAll("{{schema}}", data.schema)
    .replaceAll("{{h1}}", data.h1)
    .replaceAll("{{summary}}", data.summary)
    .replaceAll("{{content}}", data.content)
    .replaceAll("{{relatedLinks}}", data.relatedLinks || "");
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
      "플랫폼 잔액은 보이나 실제 출금이 제한된 사례",
    ],
    suspiciousCompanies: [
      `${caseName} 관련 사이트 또는 앱`,
      `${caseName} 담당자 사칭 계정`,
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

function createLandingContent(landing) {
  return [
    `<section><h2>본문 원고</h2>${paragraphs(landing.body)}</section>`,
    `<section><h2>피해사례</h2>${list(landing.victimCases)}</section>`,
    `<section><h2>사기 의심 업체 리스트</h2>${list(landing.suspiciousCompanies)}</section>`,
    `<section><h2>FAQ</h2>${faqHtml(landing.faq)}</section>`,
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

function createRelatedLinks(caseItem) {
  const caseName = escapeHtml(caseItem.caseName || caseItem.name);
  const slug = encodeURIComponent(caseItem.slug);

  return `
    <ul>
      <li><a href="https://new-project-e.pages.dev/case/${slug}/">${caseName} 전체 허브</a></li>
      <li><a href="https://new-project-9o2.pages.dev/prosecute/${slug}/">${caseName} 형사고소 대응</a></li>
      <li><a href="https://new-project-b.pages.dev/civil/${slug}/">${caseName} 민사소송 회수</a></li>
      <li><a href="https://new-project-c.pages.dev/success/${slug}/">${caseName} 회수 성공사례</a></li>
      <li><a href="https://new-project-d.pages.dev/briefing/${slug}/">${caseName} AI브리핑</a></li>
    </ul>
  `;
}

function createHubContent(group) {
  const items = cases
    .map((item) => {
      const caseName = escapeHtml(item.caseName || item.name);
      return `<li><a href="/${group.pathPrefix}/${encodeURIComponent(item.slug)}/">${caseName} ${escapeHtml(group.ogSuffix)}</a></li>`;
    })
    .join("\n");

  return `<section><h2>현재 등록된 사건</h2><ul>${items}</ul></section>`;
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

  const hubTitle = `피해사건 ${group.label} 목록`;
  const hubDescription = group.descriptionSuffix;
  const hubHtml = replaceAllPlaceholders(template, {
    title: escapeHtml(hubTitle),
    description: escapeHtml(hubDescription),
    canonical: `${group.siteUrl}/`,
    ogTitle: escapeHtml(hubTitle),
    ogDescription: escapeHtml(hubDescription),
    ogImage: `${group.siteUrl}/og/hub.webp`,
    schema: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hubTitle,
      url: `${group.siteUrl}/`,
      inLanguage: "ko-KR",
    }),
    h1: escapeHtml(hubTitle),
    summary: escapeHtml(hubDescription),
    content: createHubContent(group),
    relatedLinks: "",
  });

  await fs.outputFile(path.join(group.outDir, "index.html"), hubHtml);

  for (const caseItem of cases) {
    const landing = getLanding(caseItem, group);
    const html = replaceAllPlaceholders(template, {
      title: escapeHtml(landing.title),
      description: escapeHtml(landing.description),
      canonical: landing.canonical,
      ogTitle: escapeHtml(landing.ogTitle),
      ogDescription: escapeHtml(landing.ogDescription),
      ogImage: landing.ogImage,
      schema: JSON.stringify(landing.schema, null, 2),
      h1: escapeHtml(landing.h1),
      summary: escapeHtml(landing.description),
      content: createLandingContent(landing),
      relatedLinks: createRelatedLinks(caseItem),
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
${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>`;

  await fs.outputFile(path.join(group.outDir, "sitemap.xml"), sitemap);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>피해사건 센터 - ${group.label}</title>
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
Sitemap: ${group.siteUrl}/sitemap.xml
`);

  console.log(`[OK] generated ${cases.length} pages in dist-${group.key}/`);
}

console.log("[OK] generated all group landing pages");
