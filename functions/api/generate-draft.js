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

const DEFAULT_CATEGORY = "형사대응";

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
    const category = DEFAULT_CATEGORY;
    const duplicateCheck = findDuplicateRisks(caseName, slug, cases);
    const generated = await createGeneratedData({ caseName, slug, duplicateCheck, env });

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
        categoryReason: explainCategory(),
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

async function createGeneratedData({ caseName, slug, duplicateCheck, env }) {
  const fallback = createRuleBasedData({ caseName, slug, duplicateCheck });
  const apiKey = await resolveOpenAiKey(env) || env.OPENAI_API_KEY;

  if (!apiKey) {
    fallback.source = "no-key";
    return fallback;
  }

  try {
    const aiResult = await callOpenAI({ caseName, slug, env: { ...env, OPENAI_API_KEY: apiKey } });
    return mergeWithFallback(aiResult, fallback, caseName);
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

async function callOpenAI({ caseName, slug, env }) {
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
- 사건명은 title, description, H1, 본문 첫 문단, FAQ 1~3번 질문에 포함한다.
- FAQ 7개 전체에 사건명을 반복하지 않는다. 1~3번 질문은 전체 사건명, 나머지는 절차·증거·상담 키워드 중심으로 쓴다.
- 각 도메인 유형은 문체와 관점이 달라야 한다. 같은 문장을 돌려쓰지 않는다.
- 독자가 바로 행동할 수 있도록 증거 보존, 입금 중단, 상담 접수, 법적 절차를 구체적으로 쓴다.
- 마지막 문단에는 "상담 접수", "전화", "카톡 상담" 중 1~2개를 자연스럽게 넣되 과장하지 않는다.
- 확정적 회수 보장, 승소 보장, 허위 사실 단정은 금지한다. "가능성 검토", "의심 정황", "절차 검토"처럼 표현한다.
- 가독성을 위해 한 문단은 2~3문장으로 작성하고, 문장은 짧게 쓴다.

[분량 기준]
- 각 landing.body는 7개 문단. 각 문단은 110~180자 수준의 한국어 문장 2~3개로 작성한다.
- 각 landing.victimCases는 5개. 날짜 흐름, 연락 채널, 입금 명목, 피해자 행동, 증거 형태가 드러나게 구체적으로 작성한다.
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
    "a": {"title":"","description":"","canonical":"","ogTitle":"","ogDescription":"","ogImage":"","h1":"","body":[],"victimCases":[],"faq":[{"question":"","answer":""}]},
    "b": {},
    "c": {},
    "d": {},
    "e": {}
  }
}`;

  const userPrompt = `사건명: ${caseName}
업체명 기본형: ${base}
카테고리: 사용하지 않음

이 사건명으로 5개 도메인 유형별 SEO 원고를 새로 작성하라.
네이버에서 "${base} 사기", "${base} 피해", "${base} 형사고소", "${base} 피해금 회수" 검색 의도를 모두 고려하라.
피해사례는 현재보다 더 구체적으로, 하지만 실제 확인되지 않은 날짜·실명·금액은 임의로 단정하지 말고 "수백만 원대", "추가 입금", "메신저 상담"처럼 범주형으로 표현하라.`;

  const requestBody = JSON.stringify({
    model: "gpt-5.4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.65,
    max_completion_tokens: 12000,
  });

  const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
  let lastErr = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("OpenAI 응답 없음");
      return JSON.parse(text);
    }

    const errText = await res.text();
    lastErr = new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);

    if (!RETRY_STATUSES.has(res.status)) throw lastErr; // 재시도 불필요한 오류
  }

  throw lastErr;
}

function mergeWithFallback(ai, fallback, caseName) {
  const result = {
    source: "openai",
    summary: normalizeSpace(ai.summary) || fallback.summary,
    tags: normalizeStringArray(ai.tags, fallback.tags).slice(0, 10),
    reviewNotes: normalizeStringArray(ai.reviewNotes, fallback.reviewNotes),
    landings: {},
  };

  for (const group of GROUPS) {
    result.landings[group.key] = mergeGroupLanding(ai.landings?.[group.key], fallback.landings[group.key], caseName);
  }
  return result;
}

function mergeGroupLanding(ai, fallback, caseName) {
  const faq = ensureFaqCaseName(normalizeFaq(ai?.faq, fallback.faq).slice(0, 8), caseName);
  const landing = {
    ...fallback,
    title: normalizeSpace(ai?.title) || fallback.title,
    description: normalizeSpace(ai?.description) || fallback.description,
    canonical: normalizeSpace(ai?.canonical) || fallback.canonical,
    ogTitle: normalizeSpace(ai?.ogTitle) || fallback.ogTitle,
    ogDescription: normalizeSpace(ai?.ogDescription) || fallback.ogDescription,
    ogImage: fallback.ogImage, // AI 값 무시 — 항상 /og/{slug}.webp 고정
    h1: normalizeSpace(ai?.h1) || fallback.h1,
    body: normalizeStringArray(ai?.body, fallback.body).slice(0, 9),
    victimCases: normalizeStringArray(ai?.victimCases, fallback.victimCases).slice(0, 7),
    suspiciousCompanies: normalizeStringArray(ai?.suspiciousCompanies, fallback.suspiciousCompanies).slice(0, 7),
    faq,
  };
  landing.schema = createSchemaData({
    title: landing.title,
    description: landing.description,
    canonical: landing.canonical,
    caseName,
    faq,
  });
  return landing;
}

function createRuleBasedData({ caseName, slug, duplicateCheck }) {
  const summary = createSummary(caseName);
  const tags = createTags(caseName);
  const reviewNotes = [
    duplicateCheck.block
      ? "동일하거나 매우 유사한 사건이 있어 저장을 차단해야 합니다."
      : duplicateCheck.warn
        ? "유사 사건이 있어 기존 사건과 별도 사건인지 확인해야 합니다."
        : "중복 위험은 낮습니다.",
    "카테고리 세부 분류 없이 사건명 검색 의도 기준으로 SEO 원고 초안을 생성했습니다. OpenAI API 키가 설정되면 더 정교한 사건별 원고가 생성됩니다.",
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
      `${caseName} 피해가 의심된다면 추가 입금을 멈추고 대화 기록과 입금 내역을 바로 묶어 두세요. 사기죄는 형법 제347조의 기망, 착오, 처분행위, 재산상 이익 구조를 확인하는 것이 출발점입니다.`,
      `메신저 상담 내용, 입금 영수증, 계좌번호, 담당자 프로필은 고소 자료의 핵심입니다. 삭제 요구를 받아도 응하지 말고 화면 캡처와 통화 녹음을 따로 저장해야 합니다.`,
      `고소장에는 언제, 어떤 경로로, 어떤 명목으로 돈을 보냈는지 시간순 흐름이 필요합니다. ${base} 측이 어떤 방식으로 안내했는지 기망 내용을 구체적으로 쓸수록 수사 방향이 빨리 잡힙니다.`,
      `입금 계좌, 예금주, 사이트 도메인, 담당자 연락처를 각각 따로 정리해 두세요. 계좌 명의와 운영 주체가 다를 수 있어 연결 관계를 파악하는 자료가 됩니다.`,
      `경찰 신고만으로 피해금이 자동 반환되지는 않습니다. 형사 절차와 함께 민사 가압류, 지급정지 가능성을 동시에 검토해야 회수 경로가 넓어집니다.`,
      `${base} 피해자가 여럿이라면 같은 계좌나 상담원 계정으로 연결되는지 확인해 보세요. 공동 자료 정리가 가능하면 수사 속도와 형사합의 가능성이 달라질 수 있습니다.`,
      `현재 남아 있는 증거로 어떤 절차부터 밟을지 확인하는 것이 우선입니다. 자료가 부족해도 상담 접수나 전화 문의로 대응 방향을 먼저 잡을 수 있습니다.`,
    ],
    b: [
      `${caseName} 피해는 형사 절차와 별개로 민사소송을 검토할 수 있습니다. 돈의 흐름과 상대방 재산이 확인되면 가압류와 부당이득반환 청구가 핵심 쟁점이 됩니다.`,
      `민사에서 가장 먼저 볼 것은 상대방 재산을 묶을 수 있는지 여부입니다. 계좌 잔액이 이동되기 전에 가압류를 신청해야 판결 후 집행 가능성이 높아집니다.`,
      `${base} 관련 입금 명목, 담당자 명의, 법인 정보가 확인되면 손해배상 청구 구조가 선명해집니다. 수익 보장 표현이나 안내 문구가 남아 있다면 청구 근거로 활용됩니다.`,
      `부당이득반환은 계약서가 없어도 검토할 수 있습니다. 상대방이 법률상 원인 없이 이익을 얻은 사실이 입증되면 반환 청구 구조를 만들 수 있습니다.`,
      `피해금이 소액이라도 같은 계좌로 여러 피해가 확인되면 청구 전략이 달라집니다. 계좌 흐름과 피해자 수를 함께 보면 민사 대응의 실익을 판단하는 데 도움이 됩니다.`,
      `합의 진행 시에는 지급 금액, 기한, 불이행 시 조치를 합의서에 명확히 써야 합니다. 구두 약속만으로는 실제 회수 안정성이 낮아질 수 있습니다.`,
      `${base} 민사 대응 방향은 상대방 특정 여부와 재산 상태에 따라 달라집니다. 상담 접수나 전화 문의로 현재 자료를 점검하면 가압류와 청구 가능성을 먼저 확인할 수 있습니다.`,
    ],
    c: [
      `${caseName} 사건은 회수 결과가 모두 같지 않습니다. 지급정지, 가압류, 수사 협조가 맞물렸을 때 일부 회수나 합의로 이어진 흐름을 참고할 수 있습니다.`,
      `빠른 대응이 결과를 바꾼 경우가 많습니다. 입금 직후 대화 캡처와 계좌 정보를 보존하고 지급정지를 먼저 문의한 사례에서 추적 속도가 빨랐습니다.`,
      `${base} 유사 사건에서 형사와 민사 절차를 병행한 경우 회수 경로가 더 넓어졌습니다. 형사 수사에서 확인된 계좌 정보가 민사 가압류의 단서가 된 경우도 있습니다.`,
      `전액 회수는 상대방 계좌 잔액과 재산 상태에 따라 달라집니다. 일부 회수가 더 일반적이며, 합의 협의가 열렸을 때 지급 조건을 명확히 해야 실제 회수로 이어집니다.`,
      `추가 입금을 일찍 차단할수록 피해금 규모가 줄고 증거 구조도 단순해집니다. 반복 송금이 이어진 경우 회수 전략이 복잡해질 수 있어 빠른 차단이 중요합니다.`,
      `${base}와 유사한 이름이나 계좌로 접근한 사례가 더 있을 수 있습니다. 업체명뿐 아니라 계좌 명의와 담당자 연락처를 비교하면 동일 조직 여부를 확인하는 데 도움이 됩니다.`,
      `유사 성공사례와 내 상황이 얼마나 맞는지는 상담으로 확인하는 것이 정확합니다. 자료 상태와 상대방 특정 가능 여부를 기준으로 회수 가능성을 함께 검토합니다.`,
    ],
    d: [
      `${caseName} 사건 개요는 어떻게 정리하나요? 언제, 어떤 채널로, 어떤 명목의 입금 요구가 있었는지 순서대로 정리하는 것이 좋습니다. 메신저 상담, 수익 안내, 추가 입금 흐름이 어떻게 이어졌는지가 핵심입니다.`,
      `피해 구조는 어떻게 보나요? 초기 소액으로 신뢰를 만든 뒤 수수료, 세금, 인증비 명목으로 반복 입금을 유도하는 흐름이 자주 나타납니다. 계좌가 중간에 바뀌거나 담당자가 교체되면 의심 정황이 높아집니다.`,
      `즉시 해야 할 대응은 무엇인가요? 추가 입금을 멈추고 대화 기록, 계좌번호, 입금 영수증을 그대로 보존해야 합니다. 은행에 지급정지 가능 여부를 바로 문의하는 것이 초기에 할 수 있는 중요한 조치입니다.`,
      `증거는 어떻게 모아야 하나요? 메신저 대화 전체, 플랫폼 화면 캡처, 입금 내역, 담당자 프로필, 사이트 주소가 필요합니다. 앱 설치 파일이나 다운로드 링크도 삭제되기 전에 저장해 두세요.`,
      `${base} 관련 경고 신호는 무엇인가요? 출금 버튼이 작동하지 않거나 심사 중이라는 안내가 반복되면 의심해야 합니다. 세금이나 보증금을 보내야 출금된다는 요구는 사기의 전형적인 패턴입니다.`,
      `2차 피해는 어떻게 막나요? 피해 회복팀, 환불 대행을 사칭해 다시 접근하는 경우가 있습니다. 선입금이나 수수료를 요구하는 새로운 연락은 기존 사건과 함께 상담에서 먼저 확인해야 합니다.`,
      `${base} 사건 정보를 확인한 뒤에는 증거를 보존한 상태로 상담 접수나 전화 문의로 다음 절차를 잡는 것이 좋습니다. 자료가 부족해도 지금 있는 것부터 정리하면 방향을 잡는 데 도움이 됩니다.`,
    ],
    e: [
      `${caseName} 전체 허브에서는 형사고소, 민사소송, 성공사례, AI브리핑을 한 번에 비교할 수 있습니다. 사건 구조를 먼저 파악한 뒤 필요한 대응 페이지로 이동하면 됩니다.`,
      `형사고소가 필요하다면 법률형 페이지를 확인하세요. 사기죄의 기망 구조, 고소 자료 준비, 수사기관 제출 순서를 사건별로 정리합니다.`,
      `민사소송이 필요하다면 민사형 페이지에서 가압류, 손해배상, 부당이득반환 경로를 확인할 수 있습니다. 상대방 재산 추적과 집행 가능성을 함께 살피는 데 도움이 됩니다.`,
      `${base} 관련 피해가 처음이라면 AI브리핑 페이지에서 사건 개요와 즉시 대응 방법을 먼저 확인하세요. 어떤 증거를 어떻게 모아야 하는지 구체적으로 정리되어 있습니다.`,
      `성공사례 페이지에서는 유사 사건의 대응 흐름과 회수 경로를 비교할 수 있습니다. 어떤 순서로 절차가 진행됐는지 참고하면 자신의 상황에 맞는 경로를 잡는 데 도움이 됩니다.`,
      `같은 업체명이라도 계좌와 담당자 정보가 다르면 별도 사건일 수 있습니다. 반대로 다른 이름을 쓰더라도 계좌 명의가 같으면 동일 조직을 의심해 볼 수 있습니다.`,
      `${base} 피해 자료를 정리했다면 상담 접수, 전화 문의, 카톡 상담 중 편한 방식으로 현재 상태를 확인해 보세요. 어떤 경로가 먼저인지 함께 검토하겠습니다.`,
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
      question: `${caseName} 의심 상황에서 가장 먼저 할 일은 무엇인가요?`,
      answer: "추가 입금을 중단하고 기존 자료를 삭제하지 않는 것이 우선입니다. 입금 내역, 대화방, URL, 계좌번호, 담당자 프로필, 앱 화면을 캡처한 뒤 시간 순서대로 정리해야 합니다.",
    },
    {
      question: `${caseName} 상담 접수 전에 어떤 자료를 준비해야 하나요?`,
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

function explainCategory() {
  return "카테고리 자동 분류는 사용하지 않습니다.";
}

function createSummary(caseName) {
  return `${caseName} 관련 사기 피해 의심 사건으로, 입금 경위와 대화 내용, 계좌 정보, 사이트 주소를 정리해 피해 구조와 대응 가능성을 검토해야 합니다.`;
}

function createTags(caseName) {
  const tokens = normalizeSpace(caseName).split(/[\s-]+/).filter((token) => token.length >= 2).slice(0, 4);
  return [...new Set([...tokens, "사기피해", "피해금회수", "증거보존"])];
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
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.map((item) => {
    if (typeof item === "string") return normalizeSpace(item);
    if (item && typeof item === "object") {
      // AI가 객체로 반환한 경우 문자열 값 추출
      const str = item.text || item.case || item.description || item.value || item.content ||
        Object.values(item).find((v) => typeof v === "string" && v.length > 5) || "";
      return normalizeSpace(str);
    }
    return "";
  }).filter(Boolean);
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

function ensureFaqCaseName(faq, caseName) {
  const normalizedCaseName = normalizeSpace(caseName);
  const base = baseCaseName(normalizedCaseName);
  if (!normalizedCaseName) return faq;

  return faq.map((item, index) => {
    const question = normalizeSpace(item.question);

    if (index <= 2) {
      // Q1~Q3: 전체 사건명 포함 강제
      if (question.includes(normalizedCaseName)) return { ...item, question };
      if (base && question.includes(base)) {
        return {
          ...item,
          question: normalizeSpace(question.replace(base, normalizedCaseName).replace(/사기\s+사기/g, "사기")),
        };
      }
      return { ...item, question: normalizeSpace(`${normalizedCaseName} 관련 ${question}`) };
    }

    // Q4+: 사건명·업체명을 질문에서 제거
    let stripped = question;
    for (const name of [normalizedCaseName, base]) {
      if (!name || !stripped.includes(name)) continue;
      stripped = stripped
        .replace(new RegExp(escapeRegex(name) + "(\\s*(?:사칭\\s*사기)?)?(\\s*관련)?\\s*", "g"), "")
        .trim();
    }
    // 앞에 남은 조사(은/는/이/가/을/를/의/에서) 제거
    stripped = normalizeSpace(stripped).replace(/^(?:은|는|이|가|을|를|의|에서|에게|으로|로|과|와)\s+/, "");
    return { ...item, question: stripped || question };
  });
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
