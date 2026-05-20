const GROUPS = [
  {
    key: "a",
    label: "법률형",
    siteUrl: "https://new-project-9o2.pages.dev",
    pathPrefix: "prosecute",
    intent: "형사고소, 법적제재, 형사합의, 피해금 회수",
  },
  {
    key: "b",
    label: "민사형",
    siteUrl: "https://new-project-b.pages.dev",
    pathPrefix: "civil",
    intent: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수",
  },
  {
    key: "c",
    label: "성공사례형",
    siteUrl: "https://new-project-c.pages.dev",
    pathPrefix: "success",
    intent: "성공사례, 지역, 회수율, 전액 또는 일부 회수 사례",
  },
  {
    key: "d",
    label: "AI브리핑형",
    siteUrl: "https://new-project-d.pages.dev",
    pathPrefix: "briefing",
    intent: "네이버 AI브리핑용 사건 개요, 대응 방법, 정보성 문서",
  },
  {
    key: "e",
    label: "전체 허브형",
    siteUrl: "https://new-project-e.pages.dev",
    pathPrefix: "case",
    intent: "전체 허브, 사건명 리스트, 관련 대응 경로 안내",
  },
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const caseName = normalizeSpace(body.caseName);

    if (!caseName) {
      return json({ ok: false, message: "사건명을 입력해주세요." }, 400);
    }

    const cases = await loadCases(env);
    const slug = createSlug(caseName);
    const category = detectCategory(caseName);
    const duplicateCheck = findDuplicateRisks(caseName, slug, cases);
    const generated = await createGeneratedData({
      caseName,
      slug,
      category,
      duplicateCheck,
      env,
    });

    return json({
      ok: true,
      case: {
        slug,
        caseName,
        category,
        summary: generated.summary,
        landingViews: randomInt(140, 8000, slug),
        reports: randomInt(4, 34, `${slug}-reports`),
        updatedAt: today(),
        createdAt: today(),
        tags: generated.tags,
        landings: generated.landings,
      },
      review: {
        status: duplicateCheck.block ? "blocked" : duplicateCheck.warn ? "warning" : "pass",
        duplicateCheck,
        categoryReason: explainCategory(caseName, category),
        notes: generated.reviewNotes,
      },
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function loadCases(env) {
  const repoOwner = env.GITHUB_REPO_OWNER;
  const repoName = env.GITHUB_REPO_NAME;
  const branch = env.GITHUB_BRANCH || "main";
  const token = env.GITHUB_TOKEN;

  if (!repoOwner || !repoName || !token) return [];

  const filePath = "data/cases.json";
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
  const response = await fetch(apiUrl, { headers: githubHeaders(token) });

  if (!response.ok) return [];

  const currentFile = await response.json();
  return JSON.parse(decodeBase64(currentFile.content));
}

async function createGeneratedData({ caseName, slug, category, duplicateCheck, env }) {
  const fallback = createRuleBasedData({ caseName, slug, category, duplicateCheck });

  if (!env.AI) return fallback;

  try {
    const prompt = [
      "너는 한국어 SEO 원고 데이터 생성기다.",
      "AI 생성은 데이터 작성 단계다. HTML 태그를 만들지 말고 JSON 데이터만 만든다.",
      "랜딩 출력은 별도 Static HTML 생성기가 담당한다.",
      "과장, 확정적 회수 보장, 허위 성공률, 단정적 범죄 판정 표현을 피한다.",
      `사건명: ${caseName}`,
      `slug: ${slug}`,
      `카테고리: ${category}`,
      `유사/중복 후보: ${JSON.stringify(duplicateCheck.matches)}`,
      `도메인 그룹: ${JSON.stringify(GROUPS)}`,
      "반드시 compact valid JSON만 반환한다.",
      "형식: {\"summary\":\"...\",\"tags\":[\"...\"],\"reviewNotes\":[\"...\"],\"landings\":{\"a\":{\"title\":\"...\",\"description\":\"...\",\"canonical\":\"...\",\"ogTitle\":\"...\",\"ogDescription\":\"...\",\"ogImage\":\"...\",\"h1\":\"...\",\"body\":[\"...\"],\"victimCases\":[\"...\"],\"suspiciousCompanies\":[\"...\"],\"faq\":[{\"question\":\"...\",\"answer\":\"...\"}],\"schema\":{\"@context\":\"https://schema.org\",\"@graph\":[]}},\"b\":{},\"c\":{},\"d\":{},\"e\":{}}}",
    ].join("\n");

    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "Return valid JSON only. No markdown." },
        { role: "user", content: prompt },
      ],
    });

    const text = String(result.response || result.text || "").trim();
    const parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim());
    return normalizeGeneratedData(parsed, fallback);
  } catch {
    return fallback;
  }
}

function createRuleBasedData({ caseName, slug, category, duplicateCheck }) {
  const summary = createSummary(caseName, category);
  const tags = createTags(caseName, category);
  const reviewNotes = [
    duplicateCheck.block
      ? "동일하거나 매우 유사한 사건이 있어 저장을 차단해야 합니다."
      : duplicateCheck.warn
        ? "유사 사건이 있어 기존 사건과 별도 사건인지 확인해야 합니다."
        : "중복 위험이 낮습니다.",
    `${category} 검색 의도 기준으로 원고 데이터를 생성했습니다.`,
  ];

  const landings = Object.fromEntries(
    GROUPS.map((group) => [group.key, createLandingData({ caseName, slug, category, summary, group })])
  );

  return { source: "rule-based", summary, tags, reviewNotes, landings };
}

function normalizeGeneratedData(parsed, fallback) {
  const result = {
    source: "workers-ai",
    summary: normalizeSpace(parsed.summary) || fallback.summary,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(normalizeSpace).filter(Boolean) : fallback.tags,
    reviewNotes: Array.isArray(parsed.reviewNotes)
      ? parsed.reviewNotes.map(normalizeSpace).filter(Boolean)
      : fallback.reviewNotes,
    landings: {},
  };

  for (const group of GROUPS) {
    result.landings[group.key] = normalizeLanding(parsed.landings?.[group.key], fallback.landings[group.key]);
  }

  return result;
}

function normalizeLanding(value, fallback) {
  return {
    title: normalizeSpace(value?.title) || fallback.title,
    description: normalizeSpace(value?.description) || fallback.description,
    canonical: normalizeSpace(value?.canonical) || fallback.canonical,
    ogTitle: normalizeSpace(value?.ogTitle) || fallback.ogTitle,
    ogDescription: normalizeSpace(value?.ogDescription) || fallback.ogDescription,
    ogImage: normalizeSpace(value?.ogImage) || fallback.ogImage,
    h1: normalizeSpace(value?.h1) || fallback.h1,
    body: normalizeStringArray(value?.body, fallback.body),
    victimCases: normalizeStringArray(value?.victimCases, fallback.victimCases),
    suspiciousCompanies: normalizeStringArray(value?.suspiciousCompanies, fallback.suspiciousCompanies),
    faq: normalizeFaq(value?.faq, fallback.faq),
    schema: value?.schema && typeof value.schema === "object" ? value.schema : fallback.schema,
  };
}

function createLandingData({ caseName, slug, category, summary, group }) {
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${slug}/`;
  const ogImage = `${group.siteUrl}/og/${slug}.webp`;
  const tone = {
    a: "형사고소와 법적 조치 가능성을 중심으로",
    b: "민사소송과 보전처분을 중심으로",
    c: "회수 진행 사례와 실무 포인트를 중심으로",
    d: "사건 개요와 대응 방법을 정보성으로",
    e: "전체 대응 경로와 관련 사건 탐색을 중심으로",
  }[group.key];

  const title = `${caseName} ${group.label} 대응 안내`;
  const description = `${caseName} 관련 ${group.intent} 검색 의도에 맞춘 피해 대응 정보입니다.`;
  const h1 = `${caseName} ${group.label} 대응`;

  const body = [
    `${caseName} 사건은 ${category} 범주에서 검토할 수 있는 피해 상담형 사건입니다.`,
    `${tone} 사건 개요, 입금 경위, 대화 내역, 계좌 정보, 플랫폼 주소를 정리해야 합니다.`,
    "추가 입금 요구가 이어지는 경우 즉시 중단하고, 기존 자료를 삭제하지 않은 상태로 상담 자료를 확보하는 것이 중요합니다.",
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
      question: "기존 사건과 유사하면 새로 등록해도 되나요?",
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
    schema: createSchemaData({ title, description, canonical, caseName, faq }),
  };
}

function createSchemaData({ title, description, canonical, caseName, faq }) {
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
        datePublished: today(),
        dateModified: today(),
      },
      {
        "@type": "Article",
        headline: title,
        description,
        url: canonical,
        inLanguage: "ko-KR",
        about: caseName,
        datePublished: today(),
        dateModified: today(),
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

function findDuplicateRisks(caseName, slug, cases) {
  const normalizedName = normalizeForCompare(caseName);
  const matches = cases
    .map((item) => {
      const existingName = String(item.caseName || item.name || "");
      const existingSlug = String(item.slug || "");
      const score = Math.max(
        similarity(normalizedName, normalizeForCompare(existingName)),
        similarity(normalizeForCompare(slug), normalizeForCompare(existingSlug))
      );

      return {
        slug: existingSlug,
        caseName: existingName,
        score: Number(score.toFixed(2)),
        exactSlug: existingSlug === slug,
      };
    })
    .filter((item) => item.exactSlug || item.score >= 0.58)
    .sort((a, b) => Number(b.exactSlug) - Number(a.exactSlug) || b.score - a.score)
    .slice(0, 5);

  return {
    block: matches.some((item) => item.exactSlug || item.score >= 0.9),
    warn: matches.some((item) => item.score >= 0.7),
    matches,
  };
}

function detectCategory(caseName) {
  const text = normalizeSpace(caseName).toLowerCase();

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

function explainCategory(caseName, category) {
  return `${caseName} 사건명에서 감지된 키워드를 기준으로 "${category}" 카테고리를 제안했습니다.`;
}

function createSummary(caseName, category) {
  const summaries = {
    "공동고소 형사대응": `${caseName} 관련 피해자들이 입금 유도와 추가 비용 요구를 겪은 사건으로, 공동고소와 형사대응 검토가 필요한 사안입니다.`,
    "민사소송 회수": `${caseName} 피해금 회수를 위해 가압류, 손해배상, 부당이득반환 등 민사 절차 검토가 필요한 사건입니다.`,
    "회수 성공사례": `${caseName} 피해 회수 진행 과정과 대응 포인트를 정리한 성공사례형 사건입니다.`,
    "AI브리핑": `${caseName} 사건 개요, 피해 구조, 증거 보존, 대응 방법을 정보성 브리핑 형식으로 정리한 사건입니다.`,
    "방송 환전 사기": `${caseName}에서 라이브 방송, 미션, 포인트 환전을 빙자해 추가 입금을 요구한 사건입니다.`,
    "로맨스스캠 환전 사기": `${caseName} 관련 SNS 접근과 친분 형성 후 플랫폼 가입, 환전, 보증금 명목의 입금을 유도한 사건입니다.`,
    "환전 피싱": `${caseName}에서 출금을 조건으로 보증금, 세금, 인증비 등 추가 입금을 요구한 사건입니다.`,
    "투자 사기": `${caseName} 명칭을 이용해 투자금 입금, 수익 실현, 출금 수수료 등을 반복적으로 유도한 투자 사기 의심 사건입니다.`,
    "형사대응": `${caseName} 관련 피해 정황을 바탕으로 입금 경위, 대화 내용, 계좌 정보를 정리해 형사대응이 필요한 사건입니다.`,
  };

  return summaries[category] || summaries["형사대응"];
}

function createTags(caseName, category) {
  const tokens = normalizeSpace(caseName)
    .split(/[\s-]+/)
    .filter((token) => token.length >= 2)
    .slice(0, 4);

  return [...new Set([...tokens, category, "피해회복", "증거보존"])];
}

function normalizeStringArray(value, fallback) {
  return Array.isArray(value) ? value.map(normalizeSpace).filter(Boolean) : fallback;
}

function normalizeFaq(value, fallback) {
  if (!Array.isArray(value)) return fallback;

  const faq = value
    .map((item) => ({
      question: normalizeSpace(item?.question),
      answer: normalizeSpace(item?.answer),
    }))
    .filter((item) => item.question && item.answer);

  return faq.length ? faq : fallback;
}

function createSlug(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size || 1;

  return intersection / union;
}

function tokenSet(value) {
  const compact = normalizeForCompare(value);
  const chunks = compact.split(/[\s-]+/).filter(Boolean);
  const grams = [];

  for (const chunk of chunks) {
    if (chunk.length <= 2) {
      grams.push(chunk);
      continue;
    }

    for (let index = 0; index < chunk.length - 1; index += 1) {
      grams.push(chunk.slice(index, index + 2));
    }
  }

  return new Set(grams);
}

function normalizeForCompare(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/\.(com|net|org|co|kr|vip|shop|site|store|io)/g, "")
    .replace(/사기|사칭|피해|투자|리딩방|거래소|증권|주식|코인/g, "")
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim();
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

function normalizeSpace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
  };
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
