const GROUPS = [
  {
    key: "a",
    label: "법률형",
    siteUrl: "https://gnlaw-criminal.co.kr",
    pathPrefix: "prosecute",
    suffix: "사기 형사고소 법적 대응",
    intent: "형사고소, 법적제재, 형사합의, 피해금 회수",
    primaryKeywords: ["형사고소", "사기 피해", "법적 대응", "피해금 회수", "증거 보존"],
  },
  {
    key: "b",
    label: "민사형",
    siteUrl: "https://gnlaw-civil.co.kr",
    pathPrefix: "civil",
    suffix: "사기 민사소송 회수 절차",
    intent: "민사소송, 가압류, 손해배상, 부당이득반환, 민사 합의",
    primaryKeywords: ["민사소송", "가압류", "손해배상", "부당이득반환", "피해금 회수"],
  },
  {
    key: "c",
    label: "성공사례형",
    siteUrl: "https://gnlaw-recovery.co.kr",
    pathPrefix: "success",
    suffix: "사기 피해금 회수 성공사례",
    intent: "성공사례, 지역, 회수율, 전액 회수, 일부 회수",
    primaryKeywords: ["성공사례", "회수율", "피해금 회수", "증거 확보", "합의 회수"],
  },
  {
    key: "d",
    label: "AI브리핑형",
    siteUrl: "https://gnlaw-case.co.kr",
    pathPrefix: "briefing",
    suffix: "사기 사건 AI브리핑",
    intent: "사건 개요, 피해 구조, 대응 방법, 증거 보존, 주의사항",
    primaryKeywords: ["AI브리핑", "사건 개요", "피해 구조", "대응 방법", "증거 보존"],
  },
  {
    key: "e",
    label: "전체 허브형",
    siteUrl: "https://gnlaw-center.co.kr",
    pathPrefix: "case",
    suffix: "사기 피해 전체 대응 허브",
    intent: "전체 허브, 사건명 리스트, 관련 사건, 유형별 대응 경로",
    primaryKeywords: ["전체 허브", "관련 사건", "형사고소", "민사소송", "성공사례"],
  },
  // ── law-* 도메인 전용 원고 ────────────────────────────────────────────────────
  {
    key: "la",
    label: "금융피해 대응센터형",
    siteUrl: "https://law-a.pages.dev",
    pathPrefix: "criminal",
    suffix: "금융피해 형사고소 법적 대응",
    intent: "형사고소, 금융피해 신고, 계좌 추적, 지급정지",
    primaryKeywords: ["금융피해", "형사고소", "사기 신고", "피해금 회수", "계좌 추적"],
  },
  {
    key: "lb",
    label: "피해금 회수 전략센터형",
    siteUrl: "https://law-b.pages.dev",
    pathPrefix: "litigation",
    suffix: "피해금 회수 전략 민사소송",
    intent: "피해금 회수, 민사소송, 가압류, 부당이득반환, 회수 전략",
    primaryKeywords: ["피해금 회수", "민사소송", "가압류", "부당이득반환", "회수 전략"],
  },
  {
    key: "lc",
    label: "실제 회수 사례 아카이브형",
    siteUrl: "https://law-c.pages.dev",
    pathPrefix: "results",
    suffix: "실제 피해금 회수 사례 아카이브",
    intent: "실제 회수 사례, 아카이브, 대응 흐름, 회수율",
    primaryKeywords: ["실제 회수 사례", "아카이브", "피해금 회수", "대응 흐름", "합의 회수"],
  },
  {
    key: "ld",
    label: "AI 금융사기 브리핑형",
    siteUrl: "https://law-d.pages.dev",
    pathPrefix: "insights",
    suffix: "AI 금융사기 브리핑 분석",
    intent: "AI 분석, 금융사기 패턴, 즉시 대응, 증거 보존",
    primaryKeywords: ["AI 브리핑", "금융사기", "사기 패턴", "즉시 대응", "증거 보존"],
  },
  {
    key: "le",
    label: "금융사기 사건 허브형",
    siteUrl: "https://law-e.pages.dev",
    pathPrefix: "incidents",
    suffix: "금융사기 피해 사건 통합 허브",
    intent: "금융사기 허브, 형사고소, 피해금 회수, 사례 아카이브, AI 브리핑",
    primaryKeywords: ["금융사기 허브", "피해 대응", "형사고소", "민사소송", "회수 사례"],
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
    const slug = createSlug(slugBase(rawName));
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
  return createRuleBasedData({ caseName, slug, duplicateCheck, env });
}


async function createRuleBasedData({ caseName, slug, duplicateCheck, env }) {
  const summary = createSummary(caseName);
  const tags = createTags(caseName);
  const reviewNotes = [
    duplicateCheck.block
      ? "동일하거나 매우 유사한 사건이 있어 저장을 차단해야 합니다."
      : duplicateCheck.warn
        ? "유사 사건이 있어 기존 사건과 별도 사건인지 확인해야 합니다."
        : "중복 위험은 낮습니다.",
    "사건명 검색 의도 기준으로 SEO 원고를 생성했습니다.",
  ];
  const templates = env ? await readTemplates(env) : {};
  const landings = Object.fromEntries(GROUPS.map((group) => [group.key, createLandingData({ caseName, slug, group, templates })]));

  return { source: "rule-based", summary, tags, reviewNotes, landings };
}

function createLandingData({ caseName, slug, group, templates = {} }) {
  const base = primaryCaseKeyword(caseName);
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${slug}/`;
  const title = groupPageTitle(caseName, group.key);
  const seed = `${slug}-${group.key}`;
  const descByType = {
    a: `형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 증거 상태와 사건 구조 기준으로 정리합니다.`,
    b: `민사소송, 가압류, 손해배상, 부당이득반환 절차와 회수 가능성을 사건별로 정리합니다.`,
    c: `피해금 회수 성공사례와 유사 사건의 대응 흐름, 회수율을 비교해 정리합니다.`,
    d: `사건 개요, 피해 구조, 증거 보존 방법, 즉시 대응 순서를 정보성 문체로 정리합니다.`,
    e: `형사, 민사, 성공사례, 정보 브리핑 관점에서 사건별 대응 경로를 한곳에서 연결합니다.`,
    la: `금융피해 신고 절차, 형사고소, 계좌 추적, 지급정지 방법을 금융피해 사례 기준으로 정리합니다.`,
    lb: `피해금 회수 전략, 민사소송, 가압류, 부당이득반환 절차와 단계별 회수 경로를 정리합니다.`,
    lc: `실제 회수 사례 아카이브에서 유사 사건의 대응 흐름, 회수 결과, 증거 활용 방식을 비교합니다.`,
    ld: `AI 분석 기반 금융사기 패턴, 즉시 대응 방법, 증거 보존 순서를 브리핑 형식으로 정리합니다.`,
    le: `금융사기 사건 허브에서 형사, 민사, 사례, AI 브리핑을 사건별로 연결하고 대응 경로를 통합합니다.`,
  };
  const description = descByType[group.key] || `${group.intent} 관련 피해 구조와 대응 절차를 정리합니다.`;
  // template-based variant selection (deterministic per slug+group)
  const scamIntroItems = templates.scamIntro
    ? applyTemplate(pickVariant(templates.scamIntro, seed) || [], caseName)
    : null;
  const scamMethodItems = templates.scamMethod
    ? applyTemplate(pickVariant(templates.scamMethod, seed + "m") || [], caseName)
    : null;
  const templateVictimCases = templates.scamExample
    ? applyTemplate(pickVariant(templates.scamExample, seed + "e") || [], caseName)
    : null;

  const body = reduceBodyDensity(makeBody({ caseName, base, group }), caseName);
  const victimCases = templateVictimCases?.length > 0 ? templateVictimCases : makeVictimCases({ base, group });
  const rawFaq = makeFaq({ caseName, base, group });
  const faq = reduceFaqDensity(rawFaq, caseName);

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: `${group.siteUrl}/og/${slug}.png`,
    h1: groupPageH1(caseName, group.key),
    body,
    victimCases,
    suspiciousCompanies: makeSuspiciousCompanies({ caseName }),
    faq,
    schema: createSchemaData({ title, description, canonical, caseName, faq }),
    ...(scamIntroItems ? { scamIntroItems } : {}),
    ...(scamMethodItems ? { scamMethodItems } : {}),
  };
}

function makeBody({ caseName, base, group }) {
  const displayName = base || primaryCaseKeyword(caseName);
  const typeCopy = {
    a: [
      `${displayName} 피해가 의심된다면 추가 입금을 멈추고 대화 기록과 입금 내역을 바로 묶어 두세요. 사기죄는 형법 제347조의 기망, 착오, 처분행위, 재산상 이익 구조를 확인하는 것이 출발점입니다.`,
      `메신저 상담 내용, 입금 영수증, 계좌번호, 담당자 프로필은 고소 자료의 핵심입니다. 삭제 요구를 받아도 응하지 말고 화면 캡처와 통화 녹음을 따로 저장해야 합니다.`,
      `고소장에는 언제, 어떤 경로로, 어떤 명목으로 돈을 보냈는지 시간순 흐름이 필요합니다. 상대방이 어떤 방식으로 안내했는지 기망 내용을 구체적으로 쓸수록 수사 방향이 빨리 잡힙니다.`,
      `입금 계좌, 예금주, 사이트 도메인, 담당자 연락처를 각각 따로 정리해 두세요. 계좌 명의와 운영 주체가 다를 수 있어 연결 관계를 파악하는 자료가 됩니다.`,
      `경찰 신고만으로 피해금이 자동 반환되지는 않습니다. 형사 절차와 함께 민사 가압류, 지급정지 가능성을 동시에 검토해야 회수 경로가 넓어집니다.`,
      `피해자가 여럿이라면 같은 계좌나 상담원 계정으로 연결되는지 확인해 보세요. 공동 자료 정리가 가능하면 수사 속도와 형사합의 가능성이 달라질 수 있습니다.`,
      `현재 남아 있는 증거로 어떤 절차부터 밟을지 확인하는 것이 우선입니다. 자료가 부족해도 상담 접수나 전화 문의로 대응 방향을 먼저 잡을 수 있습니다.`,
    ],
    b: [
      `${displayName} 피해는 형사 절차와 별개로 민사소송을 검토할 수 있습니다. 돈의 흐름과 상대방 재산이 확인되면 가압류와 부당이득반환 청구가 핵심 쟁점이 됩니다.`,
      `민사에서 가장 먼저 볼 것은 상대방 재산을 묶을 수 있는지 여부입니다. 계좌 잔액이 이동되기 전에 가압류를 신청해야 판결 후 집행 가능성이 높아집니다.`,
      `입금 명목, 담당자 명의, 법인 정보가 확인되면 손해배상 청구 구조가 선명해집니다. 수익 보장 표현이나 안내 문구가 남아 있다면 청구 근거로 활용됩니다.`,
      `부당이득반환은 계약서가 없어도 검토할 수 있습니다. 상대방이 법률상 원인 없이 이익을 얻은 사실이 입증되면 반환 청구 구조를 만들 수 있습니다.`,
      `피해금이 소액이라도 같은 계좌로 여러 피해가 확인되면 청구 전략이 달라집니다. 계좌 흐름과 피해자 수를 함께 보면 민사 대응의 실익을 판단하는 데 도움이 됩니다.`,
      `합의 진행 시에는 지급 금액, 기한, 불이행 시 조치를 합의서에 명확히 써야 합니다. 구두 약속만으로는 실제 회수 안정성이 낮아질 수 있습니다.`,
      `민사 대응 방향은 상대방 특정 여부와 재산 상태에 따라 달라집니다. 상담 접수나 전화 문의로 현재 자료를 점검하면 가압류와 청구 가능성을 먼저 확인할 수 있습니다.`,
    ],
    c: [
      `${displayName} 사건은 회수 결과가 모두 같지 않습니다. 지급정지, 가압류, 수사 협조가 맞물렸을 때 일부 회수나 합의로 이어진 흐름을 참고할 수 있습니다.`,
      `빠른 대응이 결과를 바꾼 경우가 많습니다. 입금 직후 대화 캡처와 계좌 정보를 보존하고 지급정지를 먼저 문의한 사례에서 추적 속도가 빨랐습니다.`,
      `유사 사건에서 형사와 민사 절차를 병행한 경우 회수 경로가 더 넓어졌습니다. 형사 수사에서 확인된 계좌 정보가 민사 가압류의 단서가 된 경우도 있습니다.`,
      `전액 회수는 상대방 계좌 잔액과 재산 상태에 따라 달라집니다. 일부 회수가 더 일반적이며, 합의 협의가 열렸을 때 지급 조건을 명확히 해야 실제 회수로 이어집니다.`,
      `추가 입금을 일찍 차단할수록 피해금 규모가 줄고 증거 구조도 단순해집니다. 반복 송금이 이어진 경우 회수 전략이 복잡해질 수 있어 빠른 차단이 중요합니다.`,
      `같거나 유사한 이름과 계좌로 접근한 사례가 더 있을 수 있습니다. 업체명뿐 아니라 계좌 명의와 담당자 연락처를 비교하면 동일 조직 여부를 확인하는 데 도움이 됩니다.`,
      `유사 성공사례와 내 상황이 얼마나 맞는지는 상담으로 확인하는 것이 정확합니다. 자료 상태와 상대방 특정 가능 여부를 기준으로 회수 가능성을 함께 검토합니다.`,
    ],
    d: [
      `${displayName} 사건 개요는 어떻게 정리하나요? 언제, 어떤 채널로, 어떤 명목의 입금 요구가 있었는지 순서대로 정리하는 것이 좋습니다. 메신저 상담, 수익 안내, 추가 입금 흐름이 어떻게 이어졌는지가 핵심입니다.`,
      `피해 구조는 어떻게 보나요? 초기 소액으로 신뢰를 만든 뒤 수수료, 세금, 인증비 명목으로 반복 입금을 유도하는 흐름이 자주 나타납니다. 계좌가 중간에 바뀌거나 담당자가 교체되면 의심 정황이 높아집니다.`,
      `즉시 해야 할 대응은 무엇인가요? 추가 입금을 멈추고 대화 기록, 계좌번호, 입금 영수증을 그대로 보존해야 합니다. 은행에 지급정지 가능 여부를 바로 문의하는 것이 초기에 할 수 있는 중요한 조치입니다.`,
      `증거는 어떻게 모아야 하나요? 메신저 대화 전체, 플랫폼 화면 캡처, 입금 내역, 담당자 프로필, 사이트 주소가 필요합니다. 앱 설치 파일이나 다운로드 링크도 삭제되기 전에 저장해 두세요.`,
      `경고 신호는 무엇인가요? 출금 버튼이 작동하지 않거나 심사 중이라는 안내가 반복되면 의심해야 합니다. 세금이나 보증금을 보내야 출금된다는 요구는 사기의 전형적인 패턴입니다.`,
      `2차 피해는 어떻게 막나요? 피해 회복팀, 환불 대행을 사칭해 다시 접근하는 경우가 있습니다. 선입금이나 수수료를 요구하는 새로운 연락은 기존 사건과 함께 상담에서 먼저 확인해야 합니다.`,
      `사건 정보를 확인한 뒤에는 증거를 보존한 상태로 상담 접수나 전화 문의로 다음 절차를 잡는 것이 좋습니다. 자료가 부족해도 지금 있는 것부터 정리하면 방향을 잡는 데 도움이 됩니다.`,
    ],
    e: [
      `${displayName} 전체 허브에서는 형사고소, 민사소송, 성공사례, AI브리핑을 한 번에 비교할 수 있습니다. 사건 구조를 먼저 파악한 뒤 필요한 대응 페이지로 이동하면 됩니다.`,
      `형사고소가 필요하다면 법률형 페이지를 확인하세요. 사기죄의 기망 구조, 고소 자료 준비, 수사기관 제출 순서를 사건별로 정리합니다.`,
      `민사소송이 필요하다면 민사형 페이지에서 가압류, 손해배상, 부당이득반환 경로를 확인할 수 있습니다. 상대방 재산 추적과 집행 가능성을 함께 살피는 데 도움이 됩니다.`,
      `처음 피해를 입었다면 AI브리핑 페이지에서 사건 개요와 즉시 대응 방법을 먼저 확인하세요. 어떤 증거를 어떻게 모아야 하는지 구체적으로 정리되어 있습니다.`,
      `성공사례 페이지에서는 유사 사건의 대응 흐름과 회수 경로를 비교할 수 있습니다. 어떤 순서로 절차가 진행됐는지 참고하면 자신의 상황에 맞는 경로를 잡는 데 도움이 됩니다.`,
      `같은 업체명이라도 계좌와 담당자 정보가 다르면 별도 사건일 수 있습니다. 반대로 다른 이름을 쓰더라도 계좌 명의가 같으면 동일 조직을 의심해 볼 수 있습니다.`,
      `피해 자료를 정리했다면 상담 접수, 전화 문의, 카톡 상담 중 편한 방식으로 현재 상태를 확인해 보세요. 어떤 경로가 먼저인지 함께 검토하겠습니다.`,
    ],
    // ── law-* 전용 원고 ──────────────────────────────────────────────────────────
    la: [
      `${displayName} 피해가 확인됐다면 추가 입금을 중단하고 금융거래 내역부터 확보해야 합니다. 금융피해는 사기죄 형사고소와 함께 금융감독원·금융정보분석원 신고를 병행하면 계좌 추적 속도가 빨라질 수 있습니다.`,
      `입금 계좌, 예금주, 금융기관명을 먼저 정리하세요. 해당 계좌가 사기 목적으로 개설됐다는 정황이 확인되면 은행 지급정지 신청과 금융당국 신고가 동시에 가능합니다.`,
      `피해 경위는 시간 순서대로 정리하는 것이 중요합니다. 어느 채널에서 처음 접촉했는지, 어떤 수익 약속을 받았는지, 언제 입금했고 출금 거부를 어떻게 통보받았는지 흐름이 고소장의 뼈대가 됩니다.`,
      `금융피해 수사는 계좌 명의인과 실제 운영자를 구분하는 과정이 필요합니다. 대포통장이 사용됐더라도 연결된 자금 흐름과 수신 계좌를 따라가면 실제 가담자 특정이 가능해집니다.`,
      `형사 절차만으로는 피해금이 자동 반환되지 않습니다. 형사고소, 지급정지, 민사 가압류를 동시에 검토해야 회수 경로가 넓어집니다. 대응이 빠를수록 자금이 이동되기 전에 묶을 가능성이 높아집니다.`,
      `금융피해 신고 시 피해자가 여럿이면 공동 대응이 수사 효율을 높일 수 있습니다. 같은 계좌나 플랫폼을 이용한 피해자를 연결하면 동일 조직 입증 자료가 강해집니다.`,
      `현재 남아 있는 자료가 부족해도 상담으로 대응 방향을 먼저 잡을 수 있습니다. 입금 내역과 대화 캡처 일부만 있어도 형사고소 가능성을 1차 검토합니다.`,
    ],
    lb: [
      `${displayName} 피해금 회수는 형사 절차와 별도로 민사 전략을 세우는 것이 중요합니다. 계좌 잔액이 남아 있는 시점에 가압류를 신청하면 판결 후 실제 회수로 이어질 가능성이 높아집니다.`,
      `피해금 회수 전략의 첫 번째 단계는 상대방 자산을 파악하는 것입니다. 입금 계좌 명의, 연계 법인 등기 정보, 담당자 연락처가 자산 추적의 출발점이 됩니다.`,
      `부당이득반환 청구는 계약서가 없어도 가능합니다. 상대방이 법률상 원인 없이 금전적 이익을 취했다는 사실이 입증되면 반환을 요구하는 법적 구조를 만들 수 있습니다.`,
      `회수 전략은 피해 규모에 따라 달라집니다. 소액 피해라면 지급명령이나 소액심판이 빠른 경로입니다. 고액이라면 가압류와 본안소송을 병행하는 전략이 필요합니다.`,
      `합의 협상도 회수 전략의 하나입니다. 다만 합의 조건이 불명확하면 실제 지급이 미루어질 수 있습니다. 지급 일정, 불이행 시 강제집행 조항, 위약금 조항을 반드시 명문화해야 합니다.`,
      `형사 수사에서 확인된 계좌 정보나 압수 자료가 민사 절차의 증거로 활용될 수 있습니다. 형사와 민사를 동시에 진행하면 서로 증거를 보강하는 효과가 생깁니다.`,
      `회수 가능성을 높이려면 자료 보존과 신속한 접수가 핵심입니다. 자료 상태와 상대방 특정 여부를 확인한 뒤 적합한 회수 전략을 함께 검토합니다.`,
    ],
    lc: [
      `${displayName} 관련 실제 회수 사례를 살펴보면 공통된 패턴이 있습니다. 피해 직후 지급정지를 신청한 경우, 동일 계좌 피해자가 여럿인 경우, 대화와 입금 기록이 완전하게 보존된 경우에서 회수 성과가 나왔습니다.`,
      `아카이브에 기록된 회수 사례 대부분은 초기 대응이 빨랐습니다. 피해를 인지한 직후 추가 입금을 차단하고 계좌 지급정지를 요청한 케이스는 자금이 이동되기 전 동결이 가능했습니다.`,
      `전액 회수보다 일부 회수가 더 많습니다. 일부 회수라도 형사합의나 민사소송을 통해 단계적으로 회수를 진행한 사례가 다수입니다. 처음부터 전액을 목표로 하되 현실적인 경로도 함께 검토해야 합니다.`,
      `같은 계좌나 업체명으로 피해자가 모인 경우, 피해자들이 자료를 공유하며 함께 대응하면 개별 대응보다 빠른 경로를 열 수 있었습니다. 아카이브 사례에서도 집단 자료 정리가 결과에 영향을 미쳤습니다.`,
      `회수 사례의 특징은 증거 품질에 있습니다. 입금 영수증, 대화 전체 캡처, 플랫폼 화면 녹화, 담당자 프로필 보존이 완전한 사건일수록 합의나 판결에서 유리한 결과가 많았습니다.`,
      `기록된 사례들을 보면 2차 피해 노출 없이 직접 법적 절차로 진입한 경우가 회수 효율이 높았습니다. 피해 회복팀·환불 대행 사칭 접근을 거절하고 바로 법률 상담을 받은 케이스가 많습니다.`,
      `내 사건과 비슷한 아카이브 사례가 있다면 어떤 순서로 대응이 진행됐는지 참고할 수 있습니다. 자료 상태와 상대방 특정 가능성을 기준으로 회수 경로를 함께 검토합니다.`,
    ],
    ld: [
      `${displayName} 사건에서 나타나는 피해 구조는 어떻게 진행되나요? 이 페이지에서는 유사 사건의 자금 흐름, 접근 채널, 담당자 교체 시점, 출금 거부 패턴을 정리해 현재 상황과 비교할 수 있습니다.`,
      `이 유형의 사기는 단계별 설계가 치밀합니다. 신뢰 구축 단계에서는 소액 수익을 지급해 실제 서비스처럼 보이고, 전환 단계에서는 고액 유도 후 출금을 차단합니다. 이 구조를 인식하면 2차 입금을 막을 수 있습니다.`,
      `주의해야 할 경고 지표는 무엇인가요? 출금 신청 후 반복되는 심사 지연, 세금·보증금·인증비 명목의 조건부 요구, 담당자 교체 및 연락 차단이 대표 지표입니다.`,
      `증거 보존은 어떤 순서로 해야 하나요? 대화 전체 캡처 → 입금 영수증 저장 → 플랫폼 도메인 기록 → 담당자 프로필 보존 순서로 진행하세요. 앱 설치 파일이 있다면 삭제 전에 저장해 두는 것이 좋습니다.`,
      `금융감독원·경찰청 사이버수사대에 동시 신고하면 어떤 효과가 있나요? 금융당국의 계좌 추적과 수사기관의 형사 수사가 병행되면 자금 흐름 파악이 빨라지고 관련 계좌 동결 가능성이 높아집니다.`,
      `2차 금융사기는 어떻게 접근하나요? 피해를 당한 뒤 금융피해 전담팀, 법원 판결 대행, 피해금 회수 보장을 제시하며 다시 접근하는 사례가 많습니다. 선입금·수수료 요구가 있다면 반드시 기존 사건과 함께 확인해야 합니다.`,
      `브리핑으로 사건 구조를 확인한 뒤 증거를 보존한 상태로 상담 접수나 전화 문의로 다음 절차를 잡으세요. 자료가 부족하더라도 현재 남아 있는 증거로 방향 설정이 가능합니다.`,
    ],
    le: [
      `${displayName} 피해 대응 허브에서는 형사고소, 피해금 회수, 실제 회수 사례, 피해 구조 브리핑을 사건별로 연결해 확인할 수 있습니다. 어떤 대응 경로가 필요한지 파악하는 데 도움이 됩니다.`,
      `금융피해 대응센터 페이지에서는 형사고소 절차와 계좌 추적 방법을 확인하세요. 입금 내역과 대화 기록을 기준으로 고소장 작성과 수사 연계 방향을 정리합니다.`,
      `피해금 회수 전략센터 페이지에서는 민사소송, 가압류, 부당이득반환 경로를 살펴볼 수 있습니다. 상대방 재산 파악과 보전처분 가능성을 함께 검토합니다.`,
      `실제 회수 사례 아카이브에서는 유사한 금융사기 사건의 대응 흐름과 회수 결과를 비교할 수 있습니다. 증거 상태와 피해 규모가 비슷한 케이스를 참고하면 절차 선택에 도움이 됩니다.`,
      `피해 구조 브리핑 페이지에서 사건 구조와 즉시 대응 순서를 확인하세요. 어떤 증거를 어떻게 보존해야 하는지, 어떤 신호가 전형적인 피해 패턴인지 구체적으로 설명합니다.`,
      `같은 조직이 여러 이름으로 운영되는 경우가 많습니다. 계좌 명의, 도메인 패턴, 담당자 연락처를 비교하면 동일 조직 연결 여부를 확인하는 데 도움이 됩니다.`,
      `피해 자료를 정리했다면 상담 접수, 전화 문의, 카톡 상담 중 편한 방식으로 현재 상황을 확인해 보세요. 피해 유형에 맞는 대응 경로를 함께 검토합니다.`,
    ],
  };
  return typeCopy[group.key] || typeCopy.a;
}

function makeVictimCases({ base, group }) {
  const common = [
    `카카오톡 채널에서 주식 단기 수익을 보장한다며 소액 입금을 유도했고, 출금 신청 직후 인증비 명목으로 추가 입금을 요구받았습니다. 대화방 캡처, 입금 내역, 계좌번호를 즉시 저장해 수사기관 제출 자료로 보존했습니다.`,
    `텔레그램 투자 리딩방에서 며칠간 수익 화면을 보여준 뒤 VIP 전환을 권유하며 고액 입금을 안내했고, 입금 직후 담당자 계정이 차단되며 연락이 끊겼습니다. 통화 녹음, 그룹방 화면 캡처, 입금 영수증을 삭제 전에 보존했습니다.`,
    `처음에는 소액 수익을 실제로 지급해 신뢰를 형성한 뒤 고액 입금을 유도했고, 출금 시도 직후 세금 처리 비용을 먼저 보내야 한다는 요구가 반복됐습니다. 요구 메시지 캡처와 이체 내역을 시간순으로 정리해 사기 구조를 문서화했습니다.`,
    `앱 설치 후 수익금 화면이 표시됐지만 출금 버튼을 누를 때마다 심사 중 또는 계정 제한 안내가 이어졌습니다. 앱 화면 녹화, 설치 링크, 담당자 대화 내용을 삭제 전에 확보해 피해 구조 설명 자료로 활용했습니다.`,
  ];

  const lawCommon = [
    `피해자는 모바일뱅킹 이체 직후 수취 계좌의 은행명, 예금주, 거래 일시를 정리했고, 같은 날 금융기관 지급정지 문의와 경찰 신고 접수번호 확보를 병행했습니다.`,
    `상담원은 정상 금융상품처럼 설명했지만 출금 단계에서 보증금과 인증비를 요구했습니다. 피해자는 앱 화면 녹화, 계좌 변경 내역, 담당자 프로필을 별도 폴더로 정리해 제출 자료를 만들었습니다.`,
    `환불을 기다리던 중 금융피해 회복팀이라는 새 계정이 접근했습니다. 피해자는 선입금 요구 메시지를 캡처해 2차 피해 정황으로 보존했고, 기존 사건 자료와 함께 상담 단계에서 확인했습니다.`,
    `같은 수취 계좌로 입금한 피해자가 추가로 확인되어 각자의 입금 시간, 금액, 대화방 초대 경로를 비교했습니다. 이 자료는 동일 조직 여부를 판단하는 근거로 활용됐습니다.`,
  ];

  const extra = {
    a: `경찰 신고 전 대화방을 나가 메시지 일부가 사라졌지만 출금 시도 화면과 이체 내역이 남아 있어 형사고소 자료를 다시 구성할 수 있었습니다. 상대방이 사용한 계좌번호, 예금주, 메신저 ID를 정리해 고소장에 명시했습니다.`,
    b: `입금 계좌 명의와 연계 법인명이 통신 기록에서 확인되어 민사 가압류 가능성을 먼저 검토했습니다. 법인 등록 정보와 계좌 명의를 비교해 손해배상 청구 구조를 구체화했습니다.`,
    c: `피해 직후 은행에 지급정지를 신청했고, 동일 계좌로 다른 피해자들의 신고가 추가로 접수되어 계좌가 동결됐습니다. 피해자들이 대화 캡처와 입금 내역을 함께 정리해 협의 과정에서 일부 금액을 회수했습니다.`,
    d: `피해 흐름을 시간순으로 정리하자 초기 신뢰 형성, 소액 수익 지급, 고액 유도, 출금 차단 순서가 전형적인 사기 구조임을 확인할 수 있었습니다. 이 구조를 문서화해 사건 개요 작성과 수사기관 설명 자료로 활용했습니다.`,
    e: `동일 업체명으로 접근했지만 계좌와 담당자 연락처가 달라 동일 사건인지 별도 사건인지 확인이 필요했습니다. 허브에서 계좌 명의, 담당자 ID, 플랫폼 주소를 비교한 뒤 형사와 민사 중 어떤 경로를 먼저 진행할지 결정할 수 있었습니다.`,
    la: `금융피해 신고 후 금융감독원 민원을 함께 제출한 케이스에서 해당 계좌의 금융서비스 이용이 제한되며 추가 피해 확산이 차단됐습니다. 입금 계좌와 수취 금융기관 정보를 정리해 형사고소 자료와 함께 제출했습니다.`,
    lb: `피해금 입금 계좌의 예금주가 법인으로 확인되어 법인 재산에 대한 가압류를 먼저 검토했습니다. 회수 전략 수립 과정에서 법인 등기부 열람과 자산 현황 파악이 핵심 단서가 됐습니다.`,
    lc: `피해자 세 명이 동일 업체 아카이브를 통해 연결되었고, 각자의 대화 캡처와 입금 내역을 공유해 동일 계좌 패턴을 입증했습니다. 집단 자료 정리 이후 합의 협상이 진행되어 피해 금액의 일부를 회수했습니다.`,
    ld: `피해 흐름을 정리하자 해당 사건의 자금 흐름이 4단계(접촉→신뢰→고액유도→출금차단) 구조와 일치함이 확인됐습니다. 이 구조를 수사기관 제출 자료에 시각화해 피해 패턴 입증에 활용했습니다.`,
    le: `통합 허브에서 같은 플랫폼 도메인과 계좌 명의로 연결된 다른 피해자 사례를 확인했습니다. 유형별 대응 페이지를 비교한 뒤 형사고소와 민사 가압류를 동시에 접수하는 경로를 선택했습니다.`,
  };

  const baseCases = group.key.startsWith("l") ? lawCommon : common;
  return [...baseCases, extra[group.key] || `피해자가 환불을 요구하자 담당자가 변호사 비용, 해제 수수료, 보안 인증비를 추가로 요구하며 시간을 끌었습니다. 이 요구 메시지도 캡처해 두면 2차 피해 구조를 입증하는 자료로 활용할 수 있습니다.`];
}

function makeSuspiciousCompanies({ caseName }) {
  const brand = secondaryCaseKeyword(caseName).replace(/\s*피해 대응$/, "");
  return [
    `공식 사이트처럼 보이지만 출금 조건으로 추가 입금을 요구하는 웹사이트 또는 앱`,
    `${brand || "고객센터"} 담당자, 분석가, 변호사팀을 사칭하는 카카오톡·텔레그램 계정`,
    `입금 안내에 사용된 개인 명의 계좌, 법인 명의 계좌, 반복 변경되는 수취 계좌`,
    `세금, 보증금, 인증비, 해제비 명목으로 재입금을 요구하는 연계 업체명`,
    `상담 종료 뒤 다른 이름으로 재접촉해 피해금 회복을 미끼로 접근하는 2차 피해 채널`,
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

  const lawShared = [
    {
      question: `${caseName} 금융피해 정황은 무엇부터 확인해야 하나요?`,
      answer: `먼저 수취 계좌, 예금주, 금융기관명, 이체 일시를 정리해야 합니다. ${base} 관련 대화방과 입금증이 남아 있다면 지급정지 검토와 형사고소 자료 준비를 동시에 시작할 수 있습니다.`,
    },
    {
      question: `${caseName} 추가 입금 요구가 오면 어떻게 해야 하나요?`,
      answer: "세금, 보증금, 인증비, 해제비 명목의 추가 요구는 금융사기에서 반복되는 패턴입니다. 입금을 멈추고 요구 메시지, 계좌 안내, 담당자 프로필을 캡처해 기존 자료와 함께 보존해야 합니다.",
    },
    {
      question: `${caseName} 상담 전에 준비할 금융자료는 무엇인가요?`,
      answer: "입금 영수증, 수취 계좌, 예금주, 거래 은행, 대화 캡처, 앱 화면, 출금 거부 안내를 준비하면 됩니다. 자료가 일부만 있어도 계좌 추적과 지급정지 가능성을 1차로 검토할 수 있습니다.",
    },
  ];

  const byType = {
    a: [
      { question: `형사고소는 경찰 신고와 다른가요?`, answer: "경찰 신고는 피해 사실을 알리는 출발점이고, 형사고소는 피고소인, 범행 구조, 증거 목록을 정리해 처벌 의사를 명확히 하는 절차입니다. 고소장에는 입금 경위와 기망 행위를 구체적으로 써야 합니다." },
      { question: "형사합의로 피해금 회수가 가능한가요?", answer: "상대방이 특정되고 수사 절차가 진행되면 합의 가능성을 검토할 수 있습니다. 다만 합의와 회수는 보장할 수 없으므로 계좌 추적, 지급정지, 민사 보전 조치도 함께 살피는 것이 좋습니다." },
      { question: "공동고소가 유리한 경우는 언제인가요?", answer: "동일 사이트, 동일 계좌, 동일 상담원 계정으로 여러 피해자가 발생했다면 공동 자료 정리가 도움이 됩니다. 다만 피해 금액과 입금 경위는 개인별로 다르므로 개별 증거도 함께 준비해야 합니다." },
      { question: "추가 입금을 요구받았는데 응해야 하나요?", answer: "세금, 보증금, 인증비, 해제비 명목의 추가 입금은 피해가 커지는 주요 패턴입니다. 출금을 조건으로 돈을 더 보내라는 요구에는 응하지 말고, 해당 메시지를 캡처해 증거로 보존해야 합니다." },
    ],
    b: [
      { question: `민사소송은 언제 검토해야 하나요?`, answer: "상대방 계좌나 연계 법인, 담당자 정보가 확인되면 민사소송과 가압류를 함께 검토할 수 있습니다. 형사고소만으로 회수가 어렵다면 손해배상 또는 부당이득반환 청구 구조를 봐야 합니다." },
      { question: "가압류는 왜 중요한가요?", answer: "가압류는 판결 전 상대방 재산을 묶어두는 보전 절차입니다. 상대방이 자금을 이동한 뒤에는 승소해도 회수가 어려울 수 있으므로 계좌와 재산 단서가 있을 때 빠르게 검토해야 합니다." },
      { question: "상대방 이름을 몰라도 민사 절차가 가능한가요?", answer: "처음부터 모든 정보를 알 필요는 없지만, 민사소송에는 상대방 특정이 필요합니다. 입금 계좌, 예금주, 통신 기록, 형사절차에서 확보되는 자료가 특정 단서가 될 수 있습니다." },
      { question: "민사 합의서는 어떻게 작성해야 하나요?", answer: "합의금, 지급일, 분할 여부, 지연 시 조치, 비밀유지 범위, 불이행 시 강제집행 가능성을 명확히 해야 합니다. 구두 약속만으로는 회수 안정성이 떨어질 수 있습니다." },
    ],
    c: [
      { question: `유사 성공사례를 그대로 적용할 수 있나요?`, answer: "성공사례는 참고 자료일 뿐 같은 결과를 보장하지 않습니다. 다만 입금 계좌, 담당자 계정, 증거 보존 상태가 비슷하다면 어떤 절차를 먼저 검토할지 판단하는 데 도움이 됩니다." },
      { question: "회수율은 무엇에 따라 달라지나요?", answer: "회수율은 계좌 잔액, 상대방 특정 여부, 피해자 수, 수사 진행 속도, 민사 보전처분 가능성에 따라 달라집니다. 빠른 접수와 증거 정리가 회수 가능성을 높이는 요소가 됩니다." },
      { question: "전액 회수가 가능한 사건의 특징은 무엇인가요?", answer: "상대방이 빠르게 특정되고 계좌에 자금이 남아 있으며 대화와 입금 증거가 명확한 사건은 전액 또는 높은 비율의 회수 가능성을 검토할 수 있습니다. 그러나 결과는 사건별로 다릅니다." },
      { question: "지역별 성공사례도 중요한가요?", answer: "지역 자체보다 관할 수사기관 접수, 피해자 분포, 관련 계좌 흐름이 더 중요합니다. 다만 같은 지역 피해자가 모이면 자료 정리와 상담 동선이 빨라질 수 있습니다." },
    ],
    d: [
      { question: `투자 사기 구조는 어떻게 진행되나요?`, answer: "대체로 신뢰 형성, 소액 입금 유도, 수익 화면 노출, 출금 제한, 추가 비용 요구 순서로 진행됩니다. 이 흐름이 보이면 정상 거래보다 사기 의심 정황을 먼저 검토해야 합니다." },
      { question: "출금 심사 중이라는 말은 믿어도 되나요?", answer: "정상적인 서비스라면 출금을 위해 반복적인 세금, 보증금, 인증비를 요구하지 않습니다. 심사 중이라는 말로 시간을 끌며 추가 입금을 유도한다면 대화 내용을 보존하고 입금을 멈춰야 합니다." },
      { question: "삭제된 대화도 복구할 수 있나요?", answer: "기기 초기화를 하지 않았다면 일부 자료가 남아 있을 수 있습니다. 메시지 백업, 이메일 알림, 통장 거래 내역, 캡처 파일, 브라우저 기록도 대체 증거가 될 수 있습니다." },
      { question: "2차 피해는 어떻게 막나요?", answer: "피해금 회복팀, 변호사팀, 환불 대행을 사칭해 다시 접근하는 경우가 있습니다. 선입금이나 수수료를 요구하는 연락은 의심하고, 기존 사건 자료와 함께 상담에서 확인해야 합니다." },
    ],
    e: [
      { question: `대응 페이지가 여러 개인 이유는 무엇인가요?`, answer: "검색 의도에 따라 필요한 정보가 다르기 때문입니다. 형사고소는 처벌과 수사, 민사소송은 회수 절차, 성공사례는 유사 흐름, AI브리핑은 사건 구조 이해에 초점을 둡니다." },
      { question: "어떤 페이지부터 봐야 하나요?", answer: "추가 입금 요구를 받고 있다면 AI브리핑과 형사고소 페이지를 먼저 확인하세요. 이미 피해금 회수를 준비 중이라면 민사형과 성공사례형 페이지에서 증거와 절차를 비교하는 것이 좋습니다." },
      { question: "동일 업체명인데 다른 사건일 수 있나요?", answer: "같은 업체명이라도 URL, 계좌, 상담원 계정이 다르면 별도 사건일 수 있습니다. 반대로 다른 이름을 쓰더라도 계좌와 담당자 정보가 같다면 같은 조직 가능성을 검토해야 합니다." },
      { question: "전체 허브는 상담 접수에 어떤 도움이 되나요?", answer: "허브에서 사건명과 유형을 먼저 분류하면 상담 시 필요한 자료가 명확해집니다. 형사, 민사, 사례, 정보성 페이지가 연결되어 있어 중복 검색 시간을 줄일 수 있습니다." },
    ],
    // ── law-* 전용 FAQ ───────────────────────────────────────────────────────────
    la: [
      { question: "금융피해 신고는 어디에 해야 하나요?", answer: "경찰청 사이버수사대, 금융감독원 불법금융신고센터, 금융정보분석원에 신고할 수 있습니다. 피해 입금 계좌와 금융기관을 특정해 신고하면 계좌 추적과 지급정지 검토에 도움이 됩니다." },
      { question: "금융감독원 신고와 형사고소는 어떻게 다른가요?", answer: "금융감독원 신고는 금융기관 제재와 계좌 제한을 통한 예방 목적이 강하고, 형사고소는 수사기관을 통해 피의자를 특정하고 처벌을 요구하는 절차입니다. 둘을 병행하면 대응 범위가 넓어집니다." },
      { question: "대포통장이 사용됐는데도 수사가 가능한가요?", answer: "대포통장은 명의 도용이나 매매로 개설된 경우가 많지만, 그 통장으로 자금을 수취한 사람을 추적하면 실제 가담자 특정이 가능합니다. 계좌 간 자금 이동 경로 분석이 핵심입니다." },
      { question: "피해 직후 은행에 해야 할 조치는 무엇인가요?", answer: "입금한 은행과 수취 은행 양쪽에 지급정지 신청을 요청할 수 있습니다. 사기 피해 신고 접수 번호를 은행에 제출하면 지급정지 검토가 빨라질 수 있습니다." },
    ],
    lb: [
      { question: "피해금 회수 전략은 어디서부터 시작해야 하나요?", answer: "상대방 특정과 자산 파악이 출발점입니다. 입금 계좌 명의, 연계 법인 정보, 통신 기록을 정리한 뒤 가압류 신청 가능성과 민사소송 경로를 함께 검토합니다." },
      { question: "가압류와 본안소송은 어떻게 다른가요?", answer: "가압류는 판결 전 상대방 재산을 묶어두는 보전처분이고, 본안소송은 손해배상이나 부당이득반환 청구 판결을 받는 절차입니다. 가압류를 먼저 신청하면 판결 후 집행 가능성이 높아집니다." },
      { question: "소액 피해도 민사 절차가 실익이 있나요?", answer: "소액이라면 소액심판(3천만 원 이하) 또는 지급명령 절차가 빠르고 비용이 적습니다. 상대방이 특정되고 계좌 정보가 있다면 실익을 검토해볼 수 있습니다." },
      { question: "상대방이 재산을 숨겼을 때 어떻게 하나요?", answer: "재산 은닉이 의심되면 사해행위취소소송을 검토할 수 있습니다. 판결 후에도 강제집행을 피하기 위해 재산을 이전한 경우 취소 청구가 가능합니다." },
    ],
    lc: [
      { question: "아카이브 사례가 내 상황과 다르면 어떻게 하나요?", answer: "아카이브 사례는 참고 자료이며 같은 결과를 보장하지 않습니다. 다만 증거 상태, 피해 유형, 상대방 특정 여부가 비슷하다면 어떤 절차를 우선할지 판단하는 기준이 됩니다." },
      { question: "실제 회수 사례에서 가장 중요한 공통점은 무엇인가요?", answer: "빠른 초기 대응과 완전한 증거 보존이 공통점입니다. 피해 인지 직후 지급정지를 신청하고 모든 대화와 입금 내역을 삭제하지 않은 경우에서 회수 성과가 더 많았습니다." },
      { question: "회수 완료까지 보통 얼마나 걸리나요?", answer: "사건마다 다르지만 합의 회수는 수 주에서 수 개월, 민사 판결 회수는 수 개월에서 1~2년이 걸릴 수 있습니다. 가압류로 먼저 자산을 묶어 두면 판결 후 집행이 빠릅니다." },
      { question: "피해자 여럿이 공동 대응하면 유리한가요?", answer: "동일 사건에서 공동 자료 정리는 수사 효율을 높이고 합의 협상력을 강화합니다. 다만 개별 입금 경위와 증거는 각자 따로 준비하는 것이 중요합니다." },
    ],
    ld: [
      { question: "피해 구조 브리핑은 어떤 정보를 정리하나요?", answer: "유사 사건의 접근 채널, 자금 흐름, 출금 거부 패턴, 담당자 교체 시점을 비교 정리합니다. 현재 상황과 일치하는 패턴이 있다면 사기 정황으로 판단할 근거가 됩니다." },
      { question: "투자 사기와 단순 투자 실패는 어떻게 구분하나요?", answer: "출금 거부, 추가 입금 요구, 담당자 연락 차단이 있다면 사기 정황입니다. 수익 보장 표현이나 원금 보전 약속도 불법 투자 권유의 지표가 됩니다. 대화 내용을 보존하면 구분이 명확해집니다." },
      { question: "신고 전에 어떤 정보를 준비해야 하나요?", answer: "입금 계좌번호, 예금주, 금융기관명, 대화 캡처, 수익 안내 화면, 플랫폼 도메인, 담당자 연락처를 준비하세요. 자료가 많을수록 사건 구조 파악과 신고 방향 설정이 빨라집니다." },
      { question: "피해 앱은 어떻게 증거로 남기나요?", answer: "앱 화면을 스크린 녹화로 캡처하고 설치 링크와 APK 파일을 삭제하지 마세요. 스크린샷에 시간 정보가 포함되도록 설정하면 피해 시점 입증에 도움이 됩니다." },
    ],
    le: [
      { question: "피해 대응 허브는 어떤 정보를 제공하나요?", answer: "금융피해 대응센터(형사고소), 피해금 회수 전략센터(민사소송), 실제 회수 사례 아카이브, 피해 구조 브리핑 페이지를 연결합니다. 사건별로 필요한 대응 경로를 한 곳에서 비교할 수 있습니다." },
      { question: "피해 여부를 먼저 확인하려면 어떻게 하나요?", answer: "출금 거부, 추가 조건부 입금 요구, 담당자 연락 차단이 있다면 즉시 브리핑 페이지에서 사건 구조를 확인하세요. 유사 패턴과 비교해 빠르게 정황을 파악할 수 있습니다." },
      { question: "어느 페이지부터 봐야 효과적인가요?", answer: "피해를 이제 인지했다면 브리핑 → 금융피해 대응센터 순서로 보세요. 이미 증거를 보존했다면 회수 전략센터와 실제 사례 아카이브를 함께 참고하는 것이 좋습니다." },
      { question: "같은 조직이 이름을 바꿔 재접근하는 경우는 어떻게 하나요?", answer: "계좌 명의와 담당자 연락처가 동일하거나 플랫폼 구조가 같다면 동일 조직으로 의심해야 합니다. 기존 자료와 새로운 접촉 내용을 모두 보존해 상담 시 함께 제출하면 됩니다." },
    ],
  };

  const sharedSet = group.key.startsWith("l") ? lawShared : shared;
  return [...sharedSet, ...(byType[group.key] || byType.a)];
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


function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── 템플릿 파일 로딩 ─────────────────────────────────────────────────────────

async function readTemplates(env) {
  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return {};
  const read = async (filename) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/${filename}?ref=${branch}`,
        { headers: githubHeaders(token) },
      );
      if (!res.ok) return null;
      const file = await res.json();
      const raw = await readFileContent(file, token);
      return raw ? parseVariants(raw) : null;
    } catch { return null; }
  };
  const [scamIntro, scamMethod, scamExample] = await Promise.all([
    read("scam-intro.txt"),
    read("scam-method.txt"),
    read("scam-example.txt"),
  ]);
  return { scamIntro, scamMethod, scamExample };
}

function parseVariants(raw) {
  return String(raw).split(/^---\s*$/m)
    .map((b) => b.trim().split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((v) => v.length > 0);
}

function pickVariant(variants, seed) {
  if (!variants || variants.length === 0) return null;
  let h = 2166136261 >>> 0;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return variants[h % variants.length];
}

function applyTemplate(items, caseName) {
  const kw = primaryCaseKeyword(caseName) || caseName;
  return items.map((s) => s.replace(/000/g, kw));
}

// ─── SEO 키워드 밀도 감소 ──────────────────────────────────────────────────────

function reduceBodyDensity(body, caseName) {
  const kw = primaryCaseKeyword(caseName);
  if (!kw) return body;
  const re = new RegExp(escapeRegex(kw), "g");
  const subs = ["이 업체", "해당 플랫폼", "위 조직", "이 사기 조직"];
  let n = 0;
  return body.map((p) =>
    p.replace(re, () => (++n <= 1 ? kw : subs[(n - 2) % subs.length])),
  );
}

function reduceFaqDensity(faq, caseName) {
  const names = [caseName, primaryCaseKeyword(caseName)].filter(Boolean);
  return faq.map((item, i) => {
    if (i < 3) return item; // 앞 3개 질문은 사건명 유지 (SEO 의도)
    let q = item.question;
    names.forEach((n) => { q = q.split(n).join("").replace(/\s+/g, " ").trim(); });
    return { ...item, question: q };
  });
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

function slugBase(name) {
  const s = String(name || "").trim();
  // "사기" 앞 부분만 추출 (예: "mediacastlekr.com 사기 티켓예매" → "mediacastlekr.com")
  const idx = s.search(/\s*사기/);
  return idx > 0 ? s.slice(0, idx).trim() : baseCaseName(s);
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

function primaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const match = clean.match(/^(.+?사기)(?:\s+.+)?$/i);
  return (match ? match[1] : clean).trim();
}

function secondaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const primary = primaryCaseKeyword(name);
  let tail = clean.slice(primary.length).trim();
  tail = tail.replace(/db증권/ig, "DB증권");
  if (!tail) return "";
  return /사칭|피해/.test(tail) ? `${tail} 피해 대응` : `${tail} 사칭 피해 대응`;
}

function groupPageTitle(name, groupKey) {
  const base = primaryCaseKeyword(name);
  const secondary = secondaryCaseKeyword(name);
  const suffixes = {
    a: "형사고소",
    b: "민사소송",
    c: "피해금 회수 사례",
    d: "AI브리핑",
    e: "피해 진행현황",
    la: "금융피해 형사고소",
    lb: "피해금 회수 전략",
    lc: "실제 회수 사례",
    ld: "피해 구조 분석",
    le: "피해 대응 허브",
  };
  return `${base} ${suffixes[groupKey] || "피해 대응"}${secondary ? ` | ${secondary}` : ""}`;
}

function groupPageH1(name, groupKey) {
  const base = primaryCaseKeyword(name);
  const suffixes = {
    a: "형사고소 대응",
    b: "민사소송 대응",
    c: "피해금 회수 사례",
    d: "AI브리핑",
    e: "피해 진행현황",
    la: "금융피해 형사고소 대응",
    lb: "피해금 회수 전략",
    lc: "실제 회수 사례 아카이브",
    ld: "피해 구조 브리핑",
    le: "피해 대응 허브",
  };
  return `${base} ${suffixes[groupKey] || "피해 대응"}`;
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
