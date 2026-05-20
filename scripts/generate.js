import fs from 'fs-extra';
import path from 'path';

const root = process.cwd();

const dataPath = path.join(root, 'data', 'cases.json');
const publicDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');

const groups = [
{
  key: 'a',
  outDir: path.join(root, 'dist-a'),
  template: 'group-a.html',
  siteUrl: 'https://new-project-9o2.pages.dev',
  pathPrefix: 'prosecute',
  titleSuffix: '형사고소 및 법적대응',
  descriptionSuffix: '형사고소, 법적제재, 형사합의, 피해금 회수 대응 절차를 안내합니다.',
  ogSuffix: '형사고소 및 법적대응',
},
{
  key: 'b',
  outDir: path.join(root, 'dist-b'),
  template: 'group-b.html',
  siteUrl: 'https://new-project-b.pages.dev',
  pathPrefix: 'civil',
  titleSuffix: '민사소송 및 피해금 회수',
  descriptionSuffix: '민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.',
  ogSuffix: '민사소송 및 회수 대응',
},
{
  key: 'c',
  outDir: path.join(root, 'dist-c'),
  template: 'group-c.html',
  siteUrl: 'https://new-project-c.pages.dev',
  pathPrefix: 'success',
  titleSuffix: '회수 성공사례',
  descriptionSuffix: '성공사례, 지역별 대응, 회수율, 전액 회수 및 일부 회수 사례를 안내합니다.',
  ogSuffix: '회수 성공사례',
},
{
  key: 'd',
  outDir: path.join(root, 'dist-d'),
  template: 'group-d.html',
  siteUrl: 'https://new-project-d.pages.dev',
  pathPrefix: 'briefing',
  titleSuffix: '피해 대응 정보',
  descriptionSuffix: '네이버 AI브리핑 노출을 고려한 사건 개요, 피해 구조, 대응 방법 정보를 안내합니다.',
  ogSuffix: 'AI브리핑 피해 대응 정보',
},
{
  key: 'e',
  outDir: path.join(root, 'dist-e'),
  template: 'group-e.html',
  siteUrl: 'https://new-project-e.pages.dev',
  pathPrefix: 'case',
  titleSuffix: '사건 종합 안내',
  descriptionSuffix: '전체 사건 허브, 관련 사건, 유형별 대응 정보와 내부 연결 페이지를 안내합니다.',
  ogSuffix: '전체 허브',
},
];

const cases = await fs.readJson(dataPath);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceAllPlaceholders(template, data) {
  return template
    .replaceAll('{{title}}', data.title)
    .replaceAll('{{description}}', data.description)
    .replaceAll('{{canonical}}', data.canonical)
    .replaceAll('{{ogTitle}}', data.ogTitle)
    .replaceAll('{{ogDescription}}', data.ogDescription)
    .replaceAll('{{ogImage}}', data.ogImage)
    .replaceAll('{{schema}}', data.schema)
    .replaceAll('{{h1}}', data.h1)
    .replaceAll('{{summary}}', data.summary)
    .replaceAll('{{content}}', data.content)
    .replaceAll('{{relatedLinks}}', data.relatedLinks || '');
}

function createLandingContent(caseItem, group) {
  const caseName = caseItem.caseName || caseItem.name;
  const summary = caseItem.summary || `${caseName} 사기 피해 구조와 대응 방법을 정리한 안내입니다.`;

  if (caseItem.content) {
    return caseItem.content;
  }

  return `
    <section>
      <h2>${caseName} 사기 피해 개요</h2>
      <p>${summary}</p>
    </section>

    <section>
      <h2>${caseName} 사기 대응 방향</h2>
      <p>${group.descriptionSuffix}</p>
    </section>

    <section>
      <h2>증거 보존 및 추가 피해 예방</h2>
      <p>입금 내역, 대화 내역, 사이트 주소, 계정 정보, 지갑 주소 등은 삭제하지 말고 즉시 보존해야 합니다.</p>
    </section>
  `;
}

function createRelatedLinks(caseItem) {
  const caseName = caseItem.caseName || caseItem.name;
  const slug = caseItem.slug;

  return `
    <ul>
      <li><a href="/case/${slug}/">${caseName} 사기 종합 안내</a></li>
      <li><a href="/prosecute/${slug}/">${caseName} 사기 형사고소 대응</a></li>
      <li><a href="/civil/${slug}/">${caseName} 사기 민사소송 대응</a></li>
      <li><a href="/success/${slug}/">${caseName} 사기 회수 성공사례</a></li>
      <li><a href="/briefing/${slug}/">${caseName} 사기 AI브리핑 정보</a></li>
    </ul>
  `;
}

function createSchema({ caseItem, group, canonical, title, description }) {
  const caseName = caseItem.caseName || caseItem.name;
  const updatedAt = caseItem.updatedAt || '2026-05-20';

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonical}#page`,
          name: title,
          description,
          url: canonical,
          inLanguage: 'ko-KR',
          datePublished: updatedAt,
          dateModified: updatedAt,
        },
        {
          '@type': 'Article',
          headline: title,
          description,
          url: canonical,
          datePublished: updatedAt,
          dateModified: updatedAt,
          inLanguage: 'ko-KR',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: '홈',
              item: `${group.siteUrl}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: `${caseName} 사기`,
              item: canonical,
            },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `${caseName} 피해금을 회수할 수 있나요?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: '증거와 자금 흐름이 남아 있다면 가압류, 민사소송, 형사합의 등으로 회수 가능성을 검토할 수 있습니다.',
              },
            },
            {
              '@type': 'Question',
              name: '추가 입금을 요구받으면 어떻게 해야 하나요?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: '추가 입금을 중단하고 대화 내역, 입금 내역, 사이트 주소, 계정 정보 등을 보존해야 합니다.',
              },
            },
          ],
        },
      ],
    },
    null,
    2
  );
}

for (const group of groups) {
  const templatePath = path.join(templatesDir, group.template);
  const template = await fs.readFile(templatePath, 'utf8');

  await fs.emptyDir(group.outDir);

  if (await fs.pathExists(publicDir)) {
    await fs.copy(publicDir, path.join(group.outDir, 'assets'));
  }

  const hubItems = cases
    .map((item) => {
      const caseName = item.caseName || item.name;
      return `
        <li>
          <a href="/${group.pathPrefix}/${item.slug}/">
            ${caseName} 사기 ${group.ogSuffix}
          </a>
        </li>
      `;
    })
    .join('\n');

  const hubHtml = replaceAllPlaceholders(template, {
    title: `피해사건 ${group.ogSuffix} 목록 | 피해사건 공동대응 센터`,
    description: group.descriptionSuffix,
    canonical: `${group.siteUrl}/`,
    ogTitle: `피해사건 ${group.ogSuffix} 목록`,
    ogDescription: group.descriptionSuffix,
    ogImage: '/assets/og.jpg',
    schema: JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `피해사건 ${group.ogSuffix} 목록`,
        url: `${group.siteUrl}/`,
        inLanguage: 'ko-KR',
      },
      null,
      2
    ),
    h1: `피해사건 ${group.ogSuffix} 목록`,
    summary: group.descriptionSuffix,
    content: `<section><h2>현재 대응 중인 사건</h2><ul>${hubItems}</ul></section>`,
    relatedLinks: '',
  });

  await fs.outputFile(path.join(group.outDir, 'index.html'), hubHtml);

  for (const caseItem of cases) {
    const caseName = caseItem.caseName || caseItem.name;
    const canonical = `${group.siteUrl}/${group.pathPrefix}/${caseItem.slug}/`;

    const title = `${caseName} 사기 ${group.titleSuffix} | 피해사건 공동대응 센터`;
    const description = `${caseName} 사기 피해 대응 안내. ${group.descriptionSuffix}`;
    const content = createLandingContent(caseItem, group);

    const schema = createSchema({
      caseItem,
      group,
      canonical,
      title,
      description,
    });

    const html = replaceAllPlaceholders(template, {
      title: escapeHtml(title),
      description: escapeHtml(description),
      canonical,
      ogTitle: escapeHtml(`${caseName} 사기 ${group.ogSuffix}`),
      ogDescription: escapeHtml(description),
      ogImage: '/assets/og.jpg',
      schema,
      h1: `${caseName} 사기 ${group.titleSuffix}`,
      summary: description,
      content,
      relatedLinks: createRelatedLinks(caseItem),
    });

    await fs.outputFile(
      path.join(group.outDir, group.pathPrefix, caseItem.slug, 'index.html'),
      html
    );
  }

  const urls = [
    `${group.siteUrl}/`,
    ...cases.map((item) => `${group.siteUrl}/${group.pathPrefix}/${item.slug}/`),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${url}</loc><lastmod>2026-05-20</lastmod></url>`)
  .join('\n')}
</urlset>`;

  await fs.outputFile(path.join(group.outDir, 'sitemap.xml'), sitemap);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>피해사건 공동대응 센터 - ${group.ogSuffix}</title>
    <link>${group.siteUrl}/</link>
    <description>${group.descriptionSuffix}</description>
    ${cases
      .map((item) => {
        const caseName = item.caseName || item.name;
        return `
    <item>
      <title>${caseName} 사기 ${group.ogSuffix}</title>
      <link>${group.siteUrl}/${group.pathPrefix}/${item.slug}/</link>
      <description>${escapeHtml(item.summary || group.descriptionSuffix)}</description>
      <pubDate>Wed, 20 May 2026 00:00:00 +0900</pubDate>
    </item>`;
      })
      .join('')}
  </channel>
</rss>`;

  await fs.outputFile(path.join(group.outDir, 'rss.xml'), rss);

  const robots = `User-agent: *
Allow: /
Sitemap: ${group.siteUrl}/sitemap.xml
`;

  await fs.outputFile(path.join(group.outDir, 'robots.txt'), robots);

  console.log(`[OK] generated ${cases.length} pages in dist-${group.key}/`);
}

console.log('[OK] generated all group landing pages');