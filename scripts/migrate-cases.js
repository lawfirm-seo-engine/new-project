import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const dataPath = path.join(root, "data", "cases.json");

const groups = [
  {
    key: "a",
    label: "법률형",
    siteUrl: "https://new-project-9o2.pages.dev",
    pathPrefix: "prosecute",
    urlSlugSuffix: "litigation",
    intent: "형사고소, 법적제재, 형사합의, 피해금 회수",
  },
  {
    key: "b",
    label: "민사형",
    siteUrl: "https://new-project-b.pages.dev",
    pathPrefix: "civil",
    urlSlugSuffix: "settlement",
    intent: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수",
  },
  {
    key: "c",
    label: "성공사례형",
    siteUrl: "https://new-project-c.pages.dev",
    pathPrefix: "success",
    urlSlugSuffix: "result",
    intent: "성공사례, 지역, 회수율, 전액 또는 일부 회수 사례",
  },
  {
    key: "d",
    label: "AI브리핑형",
    siteUrl: "https://new-project-d.pages.dev",
    pathPrefix: "briefing",
    urlSlugSuffix: "review",
    intent: "네이버 AI브리핑용 사건 개요, 대응 방법, 정보성 문서",
  },
  {
    key: "e",
    label: "전체 허브형",
    siteUrl: "https://new-project-e.pages.dev",
    pathPrefix: "case",
    urlSlugSuffix: "issue",
    intent: "전체 허브, 사건명 리스트, 관련 대응 경로 안내",
  },
];

const cases = await fs.readJson(dataPath);
let migrated = 0;

const nextCases = cases.map((item) => {
  if (item.landings?.a && item.landings?.b && item.landings?.c && item.landings?.d && item.landings?.e) {
    return item;
  }

  migrated += 1;

  const slug = item.slug || createSlug(item.caseName || item.name);
  const caseName = item.caseName || item.name || slug.replace(/-/g, " ");
  const category = normalizeCategory(item.category) || detectCategory(caseName);
  const summary = item.summary || createSummary(caseName, category);
  const updatedAt = item.updatedAt || today();

  return {
    ...item,
    slug,
    caseName,
    category,
    landingViews: Number(item.landingViews) > 0 ? item.landingViews : randomInt(140, 8000, slug),
    reports: Number(item.reports) > 0 ? item.reports : randomInt(4, 34, `${slug}-reports`),
    createdAt: item.createdAt || updatedAt,
    updatedAt,
    summary,
    tags: Array.isArray(item.tags) && item.tags.length ? item.tags : createTags(caseName, category),
    landings: Object.fromEntries(
      groups.map((group) => [
        group.key,
        item.landings?.[group.key] || createLandingData({ caseName, slug, category, summary, group, updatedAt }),
      ])
    ),
  };
});

await fs.writeJson(dataPath, nextCases, { spaces: 2 });
console.log(`[OK] migrated ${migrated} cases`);

function createLandingData({ caseName, slug, category, summary, group, updatedAt }) {
  const canonical = buildLandingUrl(group, slug);
  const ogImage = `${group.siteUrl}/og/${slug}.png`;
  const title = `${caseName} ${group.label} 대응 안내`;
  const description = `${caseName} 관련 ${group.intent} 검색 의도에 맞춘 피해 대응 정보입니다.`;
  const h1 = `${caseName} ${group.label} 대응`;

  const body = [
    `${caseName} 사건은 ${category} 범주에서 검토할 수 있는 피해 상담형 사건입니다.`,
    `${group.label} 검색 의도에 맞춰 사건 개요, 입금 경위, 대화 내역, 계좌 정보, 플랫폼 주소를 정리해야 합니다.`,
    "추가 입금 요구가 이어지는 경우 즉시 중단하고, 기존 자료를 삭제하지 않은 상태로 상담 자료를 확보하는 것이 중요합니다.",
    summary,
  ];

  const victimCases = [
    "수익 실현 또는 출금을 앞세워 수수료, 세금, 보증금 명목의 추가 입금을 요구받은 사례",
    "카카오톡, 텔레그램, 문자, SNS 등으로 담당자나 상담원을 사칭해 입금을 유도받은 사례",
    "플랫폼 화면상 잔액은 표시되지만 실제 출금이 제한되거나 계정 제한 안내를 받은 사례",
  ];

  const suspiciousCompanies = [
    `${caseName} 관련 사이트 또는 앱`,
    `${caseName} 상담원·담당자 사칭 계정`,
    `${caseName} 입금 계좌 또는 연계 법인 명칭`,
  ];

  const faq = [
    {
      question: `${caseName} 피해금을 회수할 수 있나요?`,
      answer: "입금 계좌, 대화 내역, 플랫폼 주소, 담당자 정보 등 증거가 남아 있다면 형사·민사 절차를 함께 검토할 수 있습니다.",
    },
    {
      question: "추가 입금을 요구받으면 어떻게 해야 하나요?",
      answer: "추가 입금은 중단하고 입금 내역, 대화방, URL, 계정 정보, 송금 영수증을 먼저 보존해야 합니다.",
    },
    {
      question: "기존 사건과 유사하면 새 사건으로 분리해야 하나요?",
      answer: "동일 업체나 동일 URL이면 중복 등록을 피하고, 별도 사건이라면 지역, 플랫폼, 계좌 등 구분 정보를 사건명에 포함하는 것이 좋습니다.",
    },
  ];

  return {
    title,
    description,
    canonical,
    ogTitle: `${caseName} ${group.label}`,
    ogDescription: description,
    ogImage,
    h1,
    body,
    victimCases,
    suspiciousCompanies,
    faq,
    schema: createSchemaData({ title, description, canonical, caseName, faq, updatedAt }),
  };
}

function buildLandingUrl(group, slug) {
  const noSuffixSlugs = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
  const oldUrlSuffix = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };
  const isOldA = group.siteUrl === "https://new-project-9o2.pages.dev";
  const suffix = isOldA && noSuffixSlugs.includes(slug)
    ? ""
    : isOldA && oldUrlSuffix[slug]
      ? `-${oldUrlSuffix[slug]}`
      : group.urlSlugSuffix
        ? `-${group.urlSlugSuffix}`
        : "";
  return `${group.siteUrl}/${group.pathPrefix}/${slug}${suffix}/`;
}

function createSchemaData({ title, description, canonical, caseName, faq, updatedAt }) {
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
        datePublished: updatedAt,
        dateModified: updatedAt,
      },
      {
        "@type": "Article",
        headline: title,
        description,
        url: canonical,
        inLanguage: "ko-KR",
        about: caseName,
        datePublished: updatedAt,
        dateModified: updatedAt,
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

function normalizeCategory(value) {
  const category = String(value || "").trim();
  return category || "";
}

function detectCategory(caseName) {
  const text = String(caseName || "").toLowerCase();

  if (/공동고소|단체|집단|탈출|형사|고소|합의/.test(text)) return "공동고소 형사대응";
  if (/민사|가압류|손해배상|부당이득|판결|반환/.test(text)) return "민사소송 회수";
  if (/성공|회수율|전액|지역|사례/.test(text)) return "회수 성공사례";
  if (/브리핑|개요|대응방법|정보|주의/.test(text)) return "AI브리핑";
  if (/방송|라이브|미션|포인트|환전/.test(text)) return "방송 환전 사기";
  if (/로맨스|sns|채팅|연애|외국인/.test(text)) return "로맨스스캠 환전 사기";
  if (/카지노|게임|출금|보증금|피싱/.test(text)) return "환전 피싱";
  if (/코인|거래소|선물|투자|리딩|주식|증권|공모주/.test(text)) return "투자 사기";

  return "형사대응";
}

function createSummary(caseName, category) {
  return `${caseName} 관련 ${category} 피해 정황을 바탕으로 입금 경위, 대화 내용, 계좌 정보를 정리해 대응이 필요한 사건입니다.`;
}

function createTags(caseName, category) {
  const tokens = String(caseName || "")
    .trim()
    .split(/[\s-]+/)
    .filter((token) => token.length >= 2)
    .slice(0, 4);

  return [...new Set([...tokens, category, "피해회복", "증거보존"])];
}

function createSlug(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return min + (hash % (max - min + 1));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
