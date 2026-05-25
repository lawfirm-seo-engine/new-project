const GROUPS = [
  {
    key: "a",
    label: "법률형",
    siteUrl: "https://new-project-9o2.pages.dev",
    pathPrefix: "prosecute",
    suffix: "사기 형사고소 법적 대응",
    intent: "형사고소, 법적제재, 형사합의, 피해금 회수",
    primaryKeywords: ["형사고소", "사기 피해", "법적 대응", "피해금 회수", "증거 보존"],
  },
  {
    key: "b",
    label: "민사형",
    siteUrl: "https://new-project-b.pages.dev",
    pathPrefix: "civil",
    suffix: "사기 민사소송 회수 절차",
    intent: "민사소송, 가압류, 손해배상, 부당이득반환, 민사 합의",
    primaryKeywords: ["민사소송", "가압류", "손해배상", "부당이득반환", "피해금 회수"],
  },
  {
    key: "c",
    label: "성공사례형",
    siteUrl: "https://new-project-c.pages.dev",
    pathPrefix: "success",
    suffix: "사기 피해금 회수 성공사례",
    intent: "성공사례, 지역, 회수율, 전액 회수, 일부 회수",
    primaryKeywords: ["성공사례", "회수율", "피해금 회수", "증거 확보", "합의 회수"],
  },
  {
    key: "d",
    label: "AI브리핑형",
    siteUrl: "https://new-project-d.pages.dev",
    pathPrefix: "briefing",
    suffix: "사기 사건 AI브리핑",
    intent: "사건 개요, 피해 구조, 대응 방법, 증거 보존, 주의사항",
    primaryKeywords: ["AI브리핑", "사건 개요", "피해 구조", "대응 방법", "증거 보존"],
  },
  {
    key: "e",
    label: "전체 허브형",
    siteUrl: "https://new-project-e.pages.dev",
    pathPrefix: "case",
    suffix: "사기 피해 전체 대응 허브",
    intent: "전체 허브, 사건명 리스트, 관련 사건, 유형별 대응 경로",
    primaryKeywords: ["전체 허브", "관련 사건", "형사고소", "민사소송", "성공사례"],
  },
];

const CATEGORY_RULES = [
  { re: /공동고소|집단|단체|형사|고소|합의|검찰|경찰/i, value: "공동고소 형사대응" },
  { re: /민사|가압류|손해배상|부당이득|반환|채권|소송/i, value: "민사소송 회수" },
  { re: /성공|회수율|전액|일부회수|사례/i, value: "회수 성공사례" },
  { re: /브리핑|개요|대응방법|정보|주의/i, value: "AI브리핑 정보" },
  { re: /방송|라이브|미션|사인|충전/i, value: "방송 미션 사기" },
  { re: /로맨스|sns|채팅|연애|외국인/i, value: "로맨스스캠 사기" },
  { re: /카지노|게임|출금|보증금|롤링|베팅/i, value: "사설 도박 사기" },
  { re: /코인|거래소|선물|투자|리딩|주식|증권|공모주/i, value: "투자 사기" },
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const rawName = normalizeSpace(body.caseName);
    const caseName = normalizeCaseName(rawName);

    if (!caseName) {
      return json({ ok: false, message: "사건명을 입력해주세요." }, 400);
    }

    const cases = await loadCases(env);
    const slug = createSlug(baseCaseName(rawName));
    const category = detectCategory(caseName);
    const duplicateCheck = findDuplicateRisks(caseName, slug, cases);
    const generated = await createGeneratedData({ caseName, slug, category, duplicateCheck, env });

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
        source: generated.source,
      },
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function loadCases(env) {
  if (env.CASES) {
    const raw = await env.CASES.get("cases:index");
    if (raw) return JSON.parse(raw);
  }

  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return [];

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
    { headers: githubHeaders(token) },
  );
  if (!res.ok) return [];

  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

async function createGeneratedData({ caseName, slug, category, duplicateCheck, env }) {
  const fallback = createRuleBasedData({ caseName, slug, category, duplicateCheck });
  const apiKey = await resolveOpenAiKey(env) || env.OPENAI_API_KEY;

  if (!apiKey) {
    fallback.source = "no-key";
    return fallback;
  }

  try {
    const aiResult = await callOpenAI({ caseName, slug, category, env: { ...env, OPENAI_API_KEY: apiKey } });
    return mergeWithFallback(aiResult, fallback);
  } catch (err) {
    console.error("[generate-draft] OpenAI error:", err.message);
    fallback.source = "openai-error";
    fallback.reviewNotes.unshift(`OpenAI 오류: ${err.message}`);
    return fallback;
  }
}

async function resolveOpenAiKey(env) {
  try {
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    if (!owner || !repo || !token) return null;
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/settings.json?ref=${branch}`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) return null;
    const file = await res.json();
    const settings = JSON.parse(decodeBase64(file.content));
    const stored = settings.openaiApiKey || null;
    if (!stored) return null;
    if (stored.startsWith("_r_")) return stored.slice(3).split("").reverse().join("");
    return stored;
  } catch {
    return null;
  }
}

async function callOpenAI({ caseName, slug, category, env }) {
  const base = baseCaseName(caseName);
  const groupGuide = GROUPS.map((group) => {
    return `${group.key}. ${group.label}
- 검색 의도: ${group.intent}
- 핵심 키워드: ${group.primaryKeywords.join(", ")}
- canonical: ${group.siteUrl}/${group.pathPrefix}/${slug}/`;
  }).join("\n\n");

  const systemPrompt = `너는 한국 네이버 검색 노출을 목표로 하는 법률·피해구제 SEO 원고 작성자다.
출력은 반드시 JSON 객체만 반환한다. HTML, 마크다운, 코드블록, 설명문은 금지한다.

[네이버 SEO 작성 원칙]
- 제목, 설명, H1, 본문, FAQ가 같은 검색 의도를 반복해서 설명해야 한다.
- 단순 키워드 나열이나 과도한 반복은 금지한다. 문맥 안에서 자연스럽게 반복한다.
- 사건명은 title, description, H1, 본문 첫 문단, FAQ 첫 질문에 포함한다.
- FAQ 7개 전체에 사건명을 반복하지 않는다. 첫 질문은 전체 사건명, 2~3개 질문은 업체명 기본형, 나머지는 절차·증거·상담 키워드 중심으로 쓴다.
- 각 도메인 유형은 문체와 관점이 달라야 한다. 같은 문장을 돌려쓰지 않는다.
- 독자가 바로 행동할 수 있도록 증거 보존, 입금 중단, 상담 접수, 법적 절차를 구체적으로 쓴다.
- 마지막 문단에는 "상담 접수", "전화", "카톡 상담" 중 1~2개를 자연스럽게 넣되 과장하지 않는다.
- 확정적 회수 보장, 승소 보장, 허위 사실 단정은 금지한다. "가능성 검토", "의심 정황", "절차 검토"처럼 표현한다.
- 가독성을 위해 한 문단은 2~3문장으로 작성하고, 문장은 짧게 쓴다.

[분량 기준]
- 각 landing.body는 7개 문단. 각 문단은 110~180자 수준의 한국어 문장 2~3개로 작성한다.
- 각 landing.victimCases는 5개. 날짜 흐름, 연락 채널, 입금 명목, 피해자 행동, 증거 형태가 드러나게 구체적으로 작성한다.
- 각 landing.suspiciousCompanies는 5개. 사건명 기반 사이트, 상담원 사칭 계정, 입금 계좌, 연계 법인, 재접촉 채널을 구체화한다.
- 각 landing.faq는 7개. 질문은 검색 키워드를 포함하고, 답변은 130~220자 수준으로 구체적으로 작성한다.
- description과 ogDescription은 80~130자, title은 28~45자, H1은 24~45자를 권장한다.

[유형별 차별화]
${groupGuide}

[유형별 필수 내용]
- a 법률형: 사기죄 형법 제347조의 기망, 착오, 처분행위, 재산상 이익 구조를 설명하고 형사고소 자료를 안내한다.
- b 민사형: 가압류, 손해배상청구, 부당이득반환소송, 민사 합의, 집행 가능성을 중심으로 쓴다.
- c 성공사례형: 전액 회수 보장처럼 쓰지 말고, "지급정지 후 일부 회수", "가압류 후 합의", "수사 중 반환 협의"처럼 있었을 법한 유형별 성공 흐름을 사례형으로 설명한다.
- d AI브리핑형: 네이버 AI 브리핑에 노출될 수 있도록 질문형 소제목에 답하듯 사건 개요, 피해 구조, 즉시 대응, 증거 목록을 균형 있게 쓴다.
- e 전체 허브형: 형사, 민사, 성공사례, 정보 브리핑의 균형을 맞추고 어느 페이지로 이동해야 하는지 안내한다.

[반환 JSON 형식]
{
  "summary": "",
  "tags": [],
  "reviewNotes": [],
  "landings": {
    "a": {"title":"","description":"","canonical":"","ogTitle":"","ogDescription":"","ogImage":"","h1":"","body":[],"victimCases":[],"suspiciousCompanies":[],"faq":[{"question":"","answer":""}]},
    "b": {},
    "c": {},
    "d": {},
    "e": {}
  }
}`;

  const userPrompt = `사건명: ${caseName}
업체명 기본형: ${base}
감지 카테고리: ${category}

이 사건명으로 5개 도메인 유형별 SEO 원고를 새로 작성하라.
네이버에서 "${base} 사기", "${base} 피해", "${base} 형사고소", "${base} 피해금 회수" 검색 의도를 모두 고려하라.
피해사례는 현재보다 더 구체적으로, 하지만 실제 확인되지 않은 날짜·실명·금액은 임의로 단정하지 말고 "수백만 원대", "추가 입금", "메신저 상담"처럼 범주형으로 표현하라.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.65,
      max_completion_tokens: 12000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI 응답 없음");
  return JSON.parse(text);
}

function mergeWithFallback(ai, fallback) {
  const result = {
    source: "openai",
    summary: normalizeSpace(ai.summary) || fallback.summary,
    tags: normalizeStringArray(ai.tags, fallback.tags).slice(0, 10),
    reviewNotes: normalizeStringArray(ai.reviewNotes, fallback.reviewNotes),
    landings: {},
  };

  for (const group of GROUPS) {
    result.landings[group.key] = mergeGroupLanding(ai.landings?.[group.key], fallback.landings[group.key]);
  }
  return result;
}

function mergeGroupLanding(ai, fallback) {
  return {
    ...fallback,
    title: normalizeSpace(ai?.title) || fallback.title,
    description: normalizeSpace(ai?.description) || fallback.description,
    canonical: normalizeSpace(ai?.canonical) || fallback.canonical,
    ogTitle: normalizeSpace(ai?.ogTitle) || fallback.ogTitle,
    ogDescription: normalizeSpace(ai?.ogDescription) || fallback.ogDescription,
    ogImage: normalizeSpace(ai?.ogImage) || fallback.ogImage,
    h1: normalizeSpace(ai?.h1) || fallback.h1,
    body: normalizeStringArray(ai?.body, fallback.body).slice(0, 9),
    victimCases: normalizeStringArray(ai?.victimCases, fallback.victimCases).slice(0, 7),
    suspiciousCompanies: normalizeStringArray(ai?.suspiciousCompanies, fallback.suspiciousCompanies).slice(0, 7),
    faq: normalizeFaq(ai?.faq, fallback.faq).slice(0, 8),
  };
}

function createRuleBasedData({ caseName, slug, category, duplicateCheck }) {
  const summary = createSummary(caseName, category);
  const tags = createTags(caseName, category);
  const reviewNotes = [
    duplicateCheck.block
      ? "동일하거나 매우 유사한 사건이 있어 저장을 차단해야 합니다."
      : duplicateCheck.warn
        ? "유사 사건이 있어 기존 사건과 별도 사건인지 확인해야 합니다."
        : "중복 위험은 낮습니다.",
    `${category} 검색 의도 기준으로 SEO 원고 초안을 생성했습니다. OpenAI API 키가 설정되면 더 정교한 유형별 원고가 생성됩니다.`,
  ];
  const landings = Object.fromEntries(GROUPS.map((group) => [group.key, createLandingData({ caseName, slug, group })]));

  return { source: "rule-based", summary, tags, reviewNotes, landings };
}

function createLandingData({ caseName, slug, group }) {
  const base = baseCaseName(caseName);
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${slug}/`;
  const title = `${base} ${group.suffix}`;
  const description = `${caseName} 관련 ${group.intent} 검색 의도에 맞춰 피해 구조, 증거 보존, 상담 접수 전 확인할 내용을 정리합니다.`;
  const faq = makeFaq({ caseName, base, group });

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: `${group.siteUrl}/og/${slug}.webp`,
    h1: `${base} ${group.label} 대응 안내`,
    body: makeBody({ caseName, base, group }),
    victimCases: makeVictimCases({ base, group }),
    suspiciousCompanies: makeSuspiciousCompanies({ base }),
    faq,
    schema: createSchemaData({ title, description, canonical, caseName, faq }),
  };
}

function makeBody({ caseName, base, group }) {
  const typeCopy = {
    a: [
      `${caseName} 사건은 형사고소와 법적 대응을 함께 검토해야 하는 사기 피해 의심 사례입니다. 사기죄는 형법 제347조에서 사람을 기망해 재물이나 재산상 이익을 취득하는 구조를 문제 삼습니다. 입금 전후 대화, 계좌 정보, 사이트 화면을 정리하면 고소장 작성과 수사기관 제출 자료를 더 명확하게 구성할 수 있습니다.`,
      `${base} 관련 피해금 회수를 원한다면 먼저 추가 입금을 멈추고 증거를 보존해야 합니다. 형사고소는 피해 사실을 알리는 절차에 그치지 않고 계좌 추적, 관련자 특정, 합의 가능성 검토의 출발점이 됩니다.`,
      `경찰 신고만으로 피해금이 자동 반환되는 것은 아닙니다. 형사 절차와 함께 민사적 보전 조치, 지급정지 가능성, 사기 의심 업체의 반복 패턴을 동시에 살피는 것이 필요합니다.`,
      `상담 접수 전에는 입금 영수증, 계좌번호, 예금주, 대화방 캡처, 사이트 URL, 담당자 프로필을 한 폴더에 정리하는 것이 좋습니다. 자료가 흩어져 있으면 동일 조직의 반복 범행 여부를 놓칠 수 있습니다.`,
      `${base} 사기 피해자가 여러 명이라면 공동 자료 정리가 도움이 됩니다. 다만 사건마다 입금 경위와 담당자 계정이 다를 수 있으므로 개별 피해 내역도 함께 구분해야 합니다.`,
      `형사합의가 가능한지는 상대방 특정 여부와 수사 진행 상황에 따라 달라집니다. 회수 가능성을 단정하기보다 현재 증거로 어떤 절차를 먼저 밟을지 검토하는 방식이 안전합니다.`,
      `이 페이지는 ${group.intent} 검색 의도에 맞춰 ${base} 피해자가 확인해야 할 법적 대응 순서를 정리합니다. 증거를 보존한 뒤 상담 접수, 전화 문의, 카톡 상담 중 편한 방식으로 현재 자료를 점검하면 초기 대응 방향을 더 빠르게 정할 수 있습니다.`,
    ],
    b: [
      `${caseName} 피해금 회수는 민사소송, 가압류, 손해배상 청구, 부당이득반환소송을 함께 검토해야 합니다. 형사고소가 상대방 특정에 도움을 준다면 민사 절차는 확보된 자료로 실제 회수 경로를 만드는 단계입니다.`,
      `${base} 관련 입금 계좌, 연계 법인, 담당자 명의가 확인되면 가압류 필요성을 먼저 살펴야 합니다. 상대방 재산이 이동된 뒤에는 판결을 받아도 집행이 어려워질 수 있습니다.`,
      `민사소송에서는 피해 사실뿐 아니라 입금 원인, 기망 행위, 손해 발생, 상대방 관여 정황을 설명해야 합니다. 대화 내용과 플랫폼 화면은 청구 원인을 구성하는 핵심 자료가 됩니다.`,
      `부당이득반환과 손해배상은 사안에 따라 함께 검토될 수 있습니다. 계약서가 없더라도 송금 내역, 상담 기록, 수익 보장 표현이 남아 있다면 청구 구조를 만들 여지가 있습니다.`,
      `소액 피해라도 여러 차례 입금이 반복되었거나 동일 계좌 피해자가 확인되면 회수 전략이 달라질 수 있습니다. 사건 규모와 계좌 흐름을 같이 보아야 실익을 판단할 수 있습니다.`,
      `민사 합의는 상대방이 특정되고 지급 능력 또는 합의 압박 요인이 있을 때 검토됩니다. 합의서 작성 전에는 지급 기한, 분할 조건, 불이행 시 조치까지 명확히 해야 합니다.`,
      `이 페이지는 ${group.intent} 검색 의도에 맞춰 ${base} 피해자의 민사 회수 절차를 정리합니다. 가압류나 손해배상청구가 필요한지 상담 접수로 먼저 확인하고, 급한 사안은 전화 또는 카톡 상담으로 증거 상태를 점검하는 것이 좋습니다.`,
    ],
    c: [
      `${caseName} 성공사례형 페이지는 유사 피해에서 어떤 자료가 회수 가능성을 높였는지 확인하기 위한 안내입니다. 실제 결과는 사건마다 다르지만, 공통적으로 빠른 증거 보존과 계좌 추적이 중요했습니다.`,
      `${base} 피해금 회수 사례에서는 입금 직후 상담을 접수하고 대화방, 사이트 화면, 담당자 계정 정보를 보존한 경우 절차 진행이 빨랐습니다. 자료가 명확할수록 상대방 특정 가능성도 커집니다.`,
      `전액 회수와 일부 회수는 피해액, 계좌 잔액, 관련자 특정 여부, 합의 가능성에 따라 달라집니다. 실제 성공 흐름은 지급정지 후 일부 반환, 가압류 후 합의, 수사 중 반환 협의처럼 절차가 단계적으로 이어진 경우가 많았습니다.`,
      `지역별 수사기관 접수, 금융기관 지급정지, 민사 보전처분이 연결되면 회수 경로가 넓어질 수 있습니다. 단일 절차보다 형사와 민사를 병행한 사례에서 실익이 생기는 경우가 많습니다.`,
      `${base}와 유사한 사칭 사기에서는 추가 입금 요구를 끊은 시점도 중요했습니다. 계속 입금하면 피해액이 커지고 증거가 복잡해져 회수 전략 수립이 늦어질 수 있습니다.`,
      `성공사례를 참고할 때는 같은 업체명만 볼 것이 아니라 입금 명목, 상담 채널, 사이트 주소, 계좌명의까지 비교해야 합니다. 동일 조직이 다른 이름으로 운영되는 경우도 있습니다.`,
      `이 페이지는 ${group.intent} 검색 의도에 맞춰 ${base} 회수 성공 가능성을 판단할 때 확인할 요소를 정리합니다. 유사 사례와 내 자료가 얼마나 맞는지 상담 접수나 전화 문의로 비교하면 대응 순서를 정하는 데 도움이 됩니다.`,
    ],
    d: [
      `${caseName} AI브리핑은 네이버 AI 브리핑 노출을 고려해 사건 구조를 빠르게 이해하려는 검색자를 위한 정보성 원고입니다. ${base} 피해는 업체명, 메신저 상담, 입금 계좌, 출금 제한이 어떻게 연결되는지 먼저 확인해야 합니다.`,
      `일반적인 사기 의심 구조는 신뢰 형성, 소액 입금 유도, 수익 화면 노출, 출금 제한, 추가 비용 요구 순서로 진행됩니다. 이 흐름이 확인되면 추가 입금을 멈추는 것이 우선입니다.`,
      `${base} 관련 상담원이나 담당자가 세금, 보증금, 인증비, 해제비를 요구한다면 피해 확산 가능성을 의심해야 합니다. 정상적인 금융 절차라면 출금을 위해 반복 송금을 요구하지 않습니다.`,
      `증거 보존은 대응의 시작입니다. 대화방이 삭제되기 전 캡처하고, URL, 계좌번호, 입금증, 담당자 프로필, 앱 설치 파일 또는 다운로드 링크를 따로 저장해야 합니다.`,
      `신고와 상담은 서로 대체 관계가 아닙니다. 신고는 수사기관 절차를 여는 행위이고, 상담은 현재 증거로 어떤 법적 대응이 가능한지 정리하는 과정입니다.`,
      `${base} 사건을 검색하는 사람은 이미 피해를 입었거나 추가 입금 요구를 받은 경우가 많습니다. 이때 가장 위험한 행동은 상대방 말만 믿고 새 계좌로 돈을 보내는 것입니다.`,
      `이 페이지는 ${group.intent} 검색 의도에 맞춰 ${base} 피해 구조와 즉시 해야 할 대응 방법을 정리합니다. 정보 확인 후에는 증거를 보존한 상태로 상담 접수, 전화 문의, 카톡 상담을 통해 다음 절차를 확인하는 것이 좋습니다.`,
    ],
    e: [
      `${caseName} 전체 허브는 형사고소, 민사소송, 성공사례, AI브리핑 정보를 한곳에서 연결하는 페이지입니다. ${base} 피해자가 자신의 상황에 맞는 대응 경로를 선택할 수 있도록 구성했습니다.`,
      `형사고소 페이지는 사기 혐의와 수사 절차를 중심으로 봅니다. 민사형 페이지는 가압류와 손해배상, 부당이득반환처럼 실제 피해금 회수 절차에 초점을 둡니다.`,
      `성공사례형 페이지는 유사 사건에서 어떤 증거와 순서가 도움이 되었는지 비교합니다. AI브리핑형 페이지는 사건 구조, 증거 보존, 즉시 대응 방법을 정보성으로 정리합니다.`,
      `${base} 관련 피해를 처음 확인했다면 먼저 사건명, 입금 계좌, 연락 채널, 사이트 주소를 기준으로 자료를 정리해야 합니다. 이후 형사와 민사 중 어느 절차를 먼저 진행할지 판단합니다.`,
      `같은 업체명이라도 상담원 계정, 계좌 명의, URL이 다르면 별도 사건으로 분리해야 할 수 있습니다. 반대로 동일 조직이면 피해자 자료를 묶어 보는 것이 도움이 됩니다.`,
      `전체 허브의 목적은 검색 의도별 페이지를 연결해 중복 원고를 줄이고, 사용자가 필요한 정보를 빠르게 찾게 하는 것입니다. 네이버 크롤러 입장에서도 내부 링크 구조가 명확해집니다.`,
      `이 페이지는 ${group.intent} 검색 의도에 맞춰 ${base} 관련 대응 정보를 연결합니다. 사건 구조를 확인한 뒤 필요한 유형의 상세 페이지로 이동하고, 상담 접수나 전화 문의로 자료 점검을 시작하세요.`,
    ],
  };
  return typeCopy[group.key] || typeCopy.a;
}

function makeVictimCases({ base, group }) {
  const common = [
    `${base} 사이트에서 소액 수익을 보여준 뒤 출금을 신청하자 세금 또는 인증비 명목의 추가 입금을 요구받은 사례`,
    `카카오톡·텔레그램 상담원이 ${base} 담당자를 사칭하며 지정 계좌로 입금을 안내하고, 입금 뒤 대화방 이름을 바꾼 사례`,
    `처음에는 수십만 원대 입금으로 시작했지만 손실 복구, VIP 등급, 보증금 명목으로 반복 송금이 이어진 사례`,
    `${base} 플랫폼 화면에는 잔액과 수익률이 표시되지만 실제 출금 버튼을 누르면 심사 중 또는 계정 제한 안내만 반복된 사례`,
    `피해자가 환불을 요구하자 담당자가 변호사 비용, 해제 수수료, 보안 인증비를 추가로 요구하며 시간을 끈 사례`,
  ];

  const extra = {
    a: `${base} 피해자가 경찰 신고 전 대화방을 나가 증거 일부가 사라졌지만, 입금증과 계좌번호를 보존해 형사고소 자료를 다시 구성한 사례`,
    b: `${base} 입금 계좌 명의와 연계 법인명이 확인되어 민사 가압류 가능성을 먼저 검토한 사례`,
    c: `${base} 유사 사건에서 피해자 여러 명의 계좌 흐름이 모여 일부 피해금 반환 협의가 진행된 사례`,
    d: `${base} 관련 앱 설치 파일과 URL이 삭제되기 전 캡처되어 피해 구조 설명 자료로 활용된 사례`,
    e: `${base} 사건을 형사고소와 민사소송 중 어디서 시작할지 몰라 전체 허브에서 자료를 분류한 사례`,
  };

  return [...common.slice(0, 4), extra[group.key] || common[4]];
}

function makeSuspiciousCompanies({ base }) {
  return [
    `${base} 공식 사이트처럼 보이지만 출금 조건으로 추가 입금을 요구하는 웹사이트 또는 앱`,
    `${base} 고객센터, 담당자, 분석가, 변호사팀을 사칭하는 카카오톡·텔레그램 계정`,
    `${base} 입금 안내에 사용된 개인 명의 계좌, 법인 명의 계좌, 반복 변경되는 수취 계좌`,
    `${base} 피해자에게 세금, 보증금, 인증비, 해제비 명목으로 재입금을 요구하는 연계 업체명`,
    `${base} 상담 종료 뒤 다른 이름으로 재접촉해 피해금 회복을 미끼로 접근하는 2차 피해 채널`,
  ];
}

function makeFaq({ caseName, base, group }) {
  const shared = [
    {
      question: `${caseName} 피해금을 회수할 수 있나요?`,
      answer: `회수 가능성은 입금 계좌, 상대방 특정 가능성, 증거 보존 상태에 따라 달라집니다. ${base} 관련 대화 내용, 입금증, 사이트 주소, 담당자 계정이 남아 있다면 형사와 민사 절차를 함께 검토할 수 있습니다.`,
    },
    {
      question: `${base} 사기 의심 상황에서 가장 먼저 할 일은 무엇인가요?`,
      answer: "추가 입금을 중단하고 기존 자료를 삭제하지 않는 것이 우선입니다. 입금 내역, 대화방, URL, 계좌번호, 담당자 프로필, 앱 화면을 캡처한 뒤 시간 순서대로 정리해야 합니다.",
    },
    {
      question: "상담 접수 전에 어떤 자료를 준비해야 하나요?",
      answer: "입금 영수증, 계좌번호, 예금주, 대화방 캡처, 사이트 주소, 로그인 화면, 출금 제한 안내, 담당자 연락처를 준비하면 됩니다. 자료가 부족해도 현재 남아 있는 증거부터 확인할 수 있습니다.",
    },
  ];

  const byType = {
    a: [
      { question: `${base} 형사고소는 경찰 신고와 다른가요?`, answer: "경찰 신고는 피해 사실을 알리는 출발점이고, 형사고소는 피고소인, 범행 구조, 증거 목록을 정리해 처벌 의사를 명확히 하는 절차입니다. 고소장에는 입금 경위와 기망 행위를 구체적으로 써야 합니다." },
      { question: "형사합의로 피해금 회수가 가능한가요?", answer: "상대방이 특정되고 수사 절차가 진행되면 합의 가능성을 검토할 수 있습니다. 다만 합의와 회수는 보장할 수 없으므로 계좌 추적, 지급정지, 민사 보전 조치도 함께 살피는 것이 좋습니다." },
      { question: "공동고소가 유리한 경우는 언제인가요?", answer: "동일 사이트, 동일 계좌, 동일 상담원 계정으로 여러 피해자가 발생했다면 공동 자료 정리가 도움이 됩니다. 다만 피해 금액과 입금 경위는 개인별로 다르므로 개별 증거도 함께 준비해야 합니다." },
      { question: "추가 입금을 요구받았는데 응해야 하나요?", answer: "세금, 보증금, 인증비, 해제비 명목의 추가 입금은 피해가 커지는 주요 패턴입니다. 출금을 조건으로 돈을 더 보내라는 요구에는 응하지 말고, 해당 메시지를 캡처해 증거로 보존해야 합니다." },
    ],
    b: [
      { question: `${base} 민사소송은 언제 검토해야 하나요?`, answer: "상대방 계좌나 연계 법인, 담당자 정보가 확인되면 민사소송과 가압류를 함께 검토할 수 있습니다. 형사고소만으로 회수가 어렵다면 손해배상 또는 부당이득반환 청구 구조를 봐야 합니다." },
      { question: "가압류는 왜 중요한가요?", answer: "가압류는 판결 전 상대방 재산을 묶어두는 보전 절차입니다. 상대방이 자금을 이동한 뒤에는 승소해도 회수가 어려울 수 있으므로 계좌와 재산 단서가 있을 때 빠르게 검토해야 합니다." },
      { question: "상대방 이름을 몰라도 민사 절차가 가능한가요?", answer: "처음부터 모든 정보를 알 필요는 없지만, 민사소송에는 상대방 특정이 필요합니다. 입금 계좌, 예금주, 통신 기록, 형사절차에서 확보되는 자료가 특정 단서가 될 수 있습니다." },
      { question: "민사 합의서는 어떻게 작성해야 하나요?", answer: "합의금, 지급일, 분할 여부, 지연 시 조치, 비밀유지 범위, 불이행 시 강제집행 가능성을 명확히 해야 합니다. 구두 약속만으로는 회수 안정성이 떨어질 수 있습니다." },
    ],
    c: [
      { question: `${base} 성공사례를 그대로 적용할 수 있나요?`, answer: "성공사례는 참고 자료일 뿐 같은 결과를 보장하지 않습니다. 다만 입금 계좌, 담당자 계정, 증거 보존 상태가 비슷하다면 어떤 절차를 먼저 검토할지 판단하는 데 도움이 됩니다." },
      { question: "회수율은 무엇에 따라 달라지나요?", answer: "회수율은 계좌 잔액, 상대방 특정 여부, 피해자 수, 수사 진행 속도, 민사 보전처분 가능성에 따라 달라집니다. 빠른 접수와 증거 정리가 회수 가능성을 높이는 요소가 됩니다." },
      { question: "전액 회수가 가능한 사건의 특징은 무엇인가요?", answer: "상대방이 빠르게 특정되고 계좌에 자금이 남아 있으며 대화와 입금 증거가 명확한 사건은 전액 또는 높은 비율의 회수 가능성을 검토할 수 있습니다. 그러나 결과는 사건별로 다릅니다." },
      { question: "지역별 성공사례도 중요한가요?", answer: "지역 자체보다 관할 수사기관 접수, 피해자 분포, 관련 계좌 흐름이 더 중요합니다. 다만 같은 지역 피해자가 모이면 자료 정리와 상담 동선이 빨라질 수 있습니다." },
    ],
    d: [
      { question: `${base} 사기 구조는 어떻게 진행되나요?`, answer: "대체로 신뢰 형성, 소액 입금 유도, 수익 화면 노출, 출금 제한, 추가 비용 요구 순서로 진행됩니다. 이 흐름이 보이면 정상 거래보다 사기 의심 정황을 먼저 검토해야 합니다." },
      { question: "출금 심사 중이라는 말은 믿어도 되나요?", answer: "정상적인 서비스라면 출금을 위해 반복적인 세금, 보증금, 인증비를 요구하지 않습니다. 심사 중이라는 말로 시간을 끌며 추가 입금을 유도한다면 대화 내용을 보존하고 입금을 멈춰야 합니다." },
      { question: "삭제된 대화도 복구할 수 있나요?", answer: "기기 초기화를 하지 않았다면 일부 자료가 남아 있을 수 있습니다. 메시지 백업, 이메일 알림, 통장 거래 내역, 캡처 파일, 브라우저 기록도 대체 증거가 될 수 있습니다." },
      { question: "2차 피해는 어떻게 막나요?", answer: "피해금 회복팀, 변호사팀, 환불 대행을 사칭해 다시 접근하는 경우가 있습니다. 선입금이나 수수료를 요구하는 연락은 의심하고, 기존 사건 자료와 함께 상담에서 확인해야 합니다." },
    ],
    e: [
      { question: `${base} 관련 페이지가 여러 개인 이유는 무엇인가요?`, answer: "검색 의도에 따라 필요한 정보가 다르기 때문입니다. 형사고소는 처벌과 수사, 민사소송은 회수 절차, 성공사례는 유사 흐름, AI브리핑은 사건 구조 이해에 초점을 둡니다." },
      { question: "어떤 페이지부터 봐야 하나요?", answer: "추가 입금 요구를 받고 있다면 AI브리핑과 형사고소 페이지를 먼저 확인하세요. 이미 피해금 회수를 준비 중이라면 민사형과 성공사례형 페이지에서 증거와 절차를 비교하는 것이 좋습니다." },
      { question: "동일 업체명인데 다른 사건일 수 있나요?", answer: "같은 업체명이라도 URL, 계좌, 상담원 계정이 다르면 별도 사건일 수 있습니다. 반대로 다른 이름을 쓰더라도 계좌와 담당자 정보가 같다면 같은 조직 가능성을 검토해야 합니다." },
      { question: "전체 허브는 상담 접수에 어떤 도움이 되나요?", answer: "허브에서 사건명과 유형을 먼저 분류하면 상담 시 필요한 자료가 명확해집니다. 형사, 민사, 사례, 정보성 페이지가 연결되어 있어 중복 검색 시간을 줄일 수 있습니다." },
    ],
  };

  return [...shared, ...(byType[group.key] || byType.a)];
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
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

function detectCategory(caseName) {
  const text = normalizeSpace(caseName);
  const match = CATEGORY_RULES.find((rule) => rule.re.test(text));
  return match?.value || "형사대응";
}

function explainCategory(caseName, category) {
  return `${caseName} 사건명에서 감지한 키워드를 기준으로 "${category}" 카테고리를 제안했습니다.`;
}

function createSummary(caseName, category) {
  return `${caseName} 관련 ${category} 사건으로, 입금 경위와 대화 내용, 계좌 정보, 사이트 주소를 정리해 피해 구조와 대응 가능성을 검토해야 합니다.`;
}

function createTags(caseName, category) {
  const tokens = normalizeSpace(caseName).split(/[\s-]+/).filter((token) => token.length >= 2).slice(0, 4);
  return [...new Set([...tokens, category, "사기피해", "피해금회수", "증거보존"])];
}

function findDuplicateRisks(caseName, slug, cases) {
  const normalizedName = normalizeForCompare(caseName);
  const matches = cases
    .map((item) => {
      const existingName = String(item.caseName || item.name || "");
      const existingSlug = String(item.slug || "");
      const score = Math.max(
        similarity(normalizedName, normalizeForCompare(existingName)),
        similarity(normalizeForCompare(slug), normalizeForCompare(existingSlug)),
      );
      return { slug: existingSlug, caseName: existingName, score: Number(score.toFixed(2)), exactSlug: existingSlug === slug };
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

function normalizeStringArray(value, fallback) {
  return Array.isArray(value) && value.length ? value.map(normalizeSpace).filter(Boolean) : fallback;
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

const _CHO = ["g","gg","n","d","dd","r","m","b","bb","s","ss","","j","jj","ch","k","t","p","h"];
const _JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const _JONG = ["","g","gg","gs","n","nj","nh","d","r","rg","rm","rb","rs","rt","rp","rh","m","b","bs","s","ss","ng","j","ch","k","t","p","h"];

function hangulToRoman(text) {
  let out = "";
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const off = code - 0xAC00;
      out += _CHO[Math.floor(off / 28 / 21)] + _JUNG[Math.floor(off / 28) % 21] + _JONG[off % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

function createSlug(value) {
  return hangulToRoman(normalizeSpace(value))
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
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
  const chunks = normalizeForCompare(value).split(/[\s-]+/).filter(Boolean);
  const grams = [];
  for (const chunk of chunks) {
    if (chunk.length <= 2) {
      grams.push(chunk);
      continue;
    }
    for (let i = 0; i < chunk.length - 1; i++) grams.push(chunk.slice(i, i + 2));
  }
  return new Set(grams);
}

function normalizeForCompare(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/\.(com|net|org|co|kr|vip|shop|site|store|io)/g, "")
    .replace(/사기|피해|투자|리딩방|거래소|증권|주식|코인/g, "")
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim();
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return min + (hash % (max - min + 1));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCaseName(name) {
  let clean = String(name || "").trim();
  clean = clean.replace(/\s*(?:사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  return /사기/.test(clean) ? clean : `${clean} 사칭 사기`;
}

function baseCaseName(name) {
  return String(name || "")
    .trim()
    .replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "")
    .trim();
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

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    return decodeBase64(file.content).trim();
  }
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
