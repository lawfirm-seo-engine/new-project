import fs from 'fs-extra';
import path from 'path';
import ejs from 'ejs';

const root = process.cwd();
const dataPath = path.join(root, 'data', 'cases.json');
const outDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');
const siteUrl = 'https://example-seo-landing.co.kr';

const cases = await fs.readJson(dataPath);
await fs.emptyDir(outDir);
await fs.copy(publicDir, path.join(outDir, 'assets'));

const layoutTpl = await fs.readFile(path.join(templatesDir, 'layout.ejs'), 'utf8');
const hubTpl = await fs.readFile(path.join(templatesDir, 'hub.ejs'), 'utf8');
const landingTpl = await fs.readFile(path.join(templatesDir, 'landing.ejs'), 'utf8');

function renderLayout({ title, description, canonical, body, schema }) {
  return ejs.render(layoutTpl, { title, description, canonical, body, schema });
}

const totalViews = cases.reduce((sum, item) => sum + item.landingViews, 0);
const totalReports = cases.reduce((sum, item) => sum + item.reports, 0);

const hubBody = ejs.render(hubTpl, { cases, totalCases: cases.length, totalViews, totalReports });
const hubHtml = renderLayout({
  title: '실시간 피해 접수 사건 목록 | 피해사건 공동대응 센터',
  description: '랜딩페이지 조회수와 사건 접수 건수를 기준으로 현재 대응 중인 사기 피해 사건을 안내합니다.',
  canonical: `${siteUrl}/`,
  body: hubBody,
  schema: {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '실시간 피해 접수 사건 목록',
    url: `${siteUrl}/`,
    inLanguage: 'ko-KR',
    mainEntity: cases.map((item) => ({ '@type': 'Article', name: `${item.caseName} 사기 공동대응`, url: `${siteUrl}/prosecute/${item.slug}/` }))
  }
});
await fs.outputFile(path.join(outDir, 'index.html'), hubHtml);

for (const caseItem of cases) {
  const canonical = `${siteUrl}/prosecute/${caseItem.slug}/`;
  const title = `${caseItem.caseName} 사기 피해 공동대응 · 사건 접수 ${caseItem.reports}건 | 피해사건 공동대응 센터`;
  const description = `${caseItem.caseName} 사기 피해 접수 ${caseItem.reports}건, 랜딩페이지뷰 ${caseItem.landingViews.toLocaleString('ko-KR')}회. 증거 보존, 추가 입금 중단, 법적 대응 절차 안내.`;
  const body = ejs.render(landingTpl, { caseItem });
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#page`, name: title, description, url: canonical, inLanguage: 'ko-KR', datePublished: caseItem.updatedAt, dateModified: caseItem.updatedAt },
      { '@type': 'Article', headline: title, description, url: canonical, datePublished: caseItem.updatedAt, dateModified: caseItem.updatedAt, inLanguage: 'ko-KR' },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: `${caseItem.caseName} 사기`, item: canonical }
      ] },
      { '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: `${caseItem.caseName} 피해금을 회수할 수 있나요?`, acceptedAnswer: { '@type': 'Answer', text: '증거와 자금 흐름이 남아 있다면 회수 가능성을 검토할 수 있습니다.' } },
        { '@type': 'Question', name: '추가 입금을 요구받으면 어떻게 해야 하나요?', acceptedAnswer: { '@type': 'Answer', text: '추가 입금을 중단하고 대화 내역, 입금 내역, 사이트 주소를 보존해야 합니다.' } }
      ] }
    ]
  };
  const html = renderLayout({ title, description, canonical, body, schema });
  await fs.outputFile(path.join(outDir, 'prosecute', caseItem.slug, 'index.html'), html);
}

const urls = [`${siteUrl}/`, ...cases.map((item) => `${siteUrl}/prosecute/${item.slug}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc><lastmod>2026-05-18</lastmod></url>`).join('\n')}\n</urlset>`;
await fs.outputFile(path.join(outDir, 'sitemap.xml'), sitemap);

const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>피해사건 공동대응 센터</title><link>${siteUrl}/</link><description>신규 피해 사건 랜딩 업데이트</description>${cases.map((item) => `<item><title>${item.caseName} 사기 공동대응</title><link>${siteUrl}/prosecute/${item.slug}/</link><description>${item.summary}</description><pubDate>Mon, 18 May 2026 00:00:00 +0900</pubDate></item>`).join('')}</channel></rss>`;
await fs.outputFile(path.join(outDir, 'rss.xml'), rss);

const robots = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
await fs.outputFile(path.join(outDir, 'robots.txt'), robots);

console.log(`[OK] generated ${cases.length} landing pages in dist/`);
