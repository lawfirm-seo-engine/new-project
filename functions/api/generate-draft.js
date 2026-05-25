const GROUPS = [
  { key: "a", label: "형사고소형", siteUrl: "https://new-project-9o2.pages.dev", pathPrefix: "prosecute", suffix: "사칭 사기 형사 고소" },
  { key: "b", label: "민사소송형", siteUrl: "https://new-project-b.pages.dev", pathPrefix: "civil", suffix: "사칭 사기 민사 소송" },
  { key: "c", label: "성공사례형", siteUrl: "https://new-project-c.pages.dev", pathPrefix: "success", suffix: "사칭 사기 피해금 회수" },
  { key: "d", label: "정보형", siteUrl: "https://new-project-d.pages.dev", pathPrefix: "briefing", suffix: "사칭 사기 피해 접수" },
  { key: "e", label: "전체허브형", siteUrl: "https://new-project-e.pages.dev", pathPrefix: "case", suffix: "사칭 사기 피해 진행현황" },
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

// ─── Data loading ────────────────────────────────────────────────────────────

async function loadCases(env) {
  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return [];

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) return [];
  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

// ─── AI generation ───────────────────────────────────────────────────────────

async function createGeneratedData({ caseName, slug, category, duplicateCheck, env }) {
  const fallback = createRuleBasedData({ caseName, slug, category, duplicateCheck });

  const apiKey = await resolveOpenAiKey(env) || env.OPENAI_API_KEY;
  if (!apiKey) {
    fallback.source = "no-key";
    return fallback;
  }

  try {
    const aiResult = await callOpenAI({ caseName, category, env: { ...env, OPENAI_API_KEY: apiKey } });
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
      { headers: githubHeaders(token) }
    );
    if (!res.ok) return null;
    const file = await res.json();
    const settings = JSON.parse(decodeBase64(file.content));
    const stored = settings.openaiApiKey || null;
    if (!stored) return null;
    if (stored.startsWith("_r_")) return stored.slice(3).split("").reverse().join("");
    return stored;
  } catch { return null; }
}

async function callOpenAI({ caseName, category, env }) {
  const base = baseCaseName(caseName);

  const systemPrompt = `너는 한국 투자사기 피해자 법률 대응 SEO 원고 전문 작성기다.
사건명을 받아 5개 도메인 그룹별 랜딩 원고를 JSON으로만 반환한다. HTML·마크다운·설명문 금지.

[그룹별 작성 방향]
a 형사고소: 경찰 고소 접수 절차, 사기죄 요건, 계좌 지급정지·동결 신청, 고소장 작성 증거 목록, 수사 진행 흐름. 톤: 긴급하고 실질적.
b 민사소송: 손해배상 청구(민법 750·741조), 가압류·가처분, 집행권원 확보, 상대방 재산 파악. 톤: 전략적·절차 중심.
c 성공사례: 피해 접수→증거 보전→고소·가압류→회수까지 단계별 흐름, 지역·플랫폼별 실제 결과. 톤: 결과 중심, 과장 없이.
d 사건정보: 사기 수법과 피해 구조 단계별 설명, 즉각 대응 방법, 핵심 증거 보존 순서. 톤: 중립적·정보성.
e 전체허브: 형사·민사·사례·정보 진입 경로 안내, 피해 단계별 행동 지침. 톤: 포괄적·안내형.

[작성 제약]
- 확정적 회수 보장·수익 보장 금지 (가능성, 검토, 정황 등으로 표현)
- 재판 전 범죄 단정 금지 ("사기 의심", "관련 정황" 사용)
- body: 완결된 단락 4개, 각 2~4문장. 업체명(base)은 자연스럽게 사용, 전체 사건명(xxx 사칭 사기)은 body 전체에서 최대 2회
- victimCases: 구체적인 실제 피해 패턴 4개 (막연한 표현 금지)
- description: 검색 키워드 포함 80~120자. 사건명은 1회만

반환 JSON 형식:
{"summary":"","tags":[],"reviewNotes":[],"landings":{"a":{"description":"","ogDescription":"","body":["","","",""],"victimCases":["","","",""]},"b":{},"c":{},"d":{},"e":{}}}`;

  const userPrompt = `사건명: ${caseName}\n업체명(기본): ${base}\n감지 카테고리: ${category}\n위 사건의 5개 그룹 랜딩 원고를 작성하라.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 4500,
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
    tags: normalizeStringArray(ai.tags, fallback.tags),
    reviewNotes: normalizeStringArray(ai.reviewNotes, fallback.reviewNotes),
    landings: {},
  };
  for (const g of GROUPS) {
    result.landings[g.key] = mergeGroupLanding(ai.landings?.[g.key], fallback.landings[g.key]);
  }
  return result;
}

function mergeGroupLanding(ai, fallback) {
  return {
    ...fallback,
    description: normalizeSpace(ai?.description) || fallback.description,
    ogDescription: normalizeSpace(ai?.ogDescription) || fallback.ogDescription,
    body: normalizeStringArray(ai?.body, fallback.body),
    victimCases: normalizeStringArray(ai?.victimCases, fallback.victimCases),
    faq: normalizeFaq(ai?.faq, fallback.faq),
  };
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

function createRuleBasedData({ caseName, slug, category, duplicateCheck }) {
  const summary = createSummary(caseName, category);
  const tags = createTags(caseName, category);
  const reviewNotes = [
    duplicateCheck.block
      ? "동일하거나 매우 유사한 사건이 있어 저장을 차단해야 합니다."
      : duplicateCheck.warn
        ? "유사 사건이 있어 기존 사건과 별도 사건인지 확인해야 합니다."
        : "중복 위험이 낮습니다.",
    `${category} 검색 의도 기준으로 기본 원고를 생성했습니다. OpenAI API 키가 설정되면 고품질 원고가 자동으로 생성됩니다.`,
  ];

  const landings = Object.fromEntries(
    GROUPS.map((g) => [g.key, createLandingData({ caseName, slug, group: g })])
  );

  return { source: "rule-based", summary, tags, reviewNotes, landings };
}

function createLandingData({ caseName, slug, group }) {
  const base = baseCaseName(caseName);
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${slug}/`;
  const pageTitle = `${base} ${group.suffix}`;
  const description = makeDescription(caseName, base, group.key);
  const body = makeBody(caseName, base, group.key);
  const victimCases = makeVictimCases(base, group.key);
  const faq = makeFaq(group.key);

  return {
    title: pageTitle,
    description,
    canonical,
    ogTitle: pageTitle,
    ogDescription: description,
    ogImage: `${group.siteUrl}/og/${slug}.webp`,
    h1: pageTitle,
    body,
    victimCases,
    faq,
    schema: createSchemaData({ title: pageTitle, description, canonical, caseName, faq }),
  };
}

function makeDescription(caseName, base, key) {
  return {
    a: `${caseName} 피해자를 위한 형사 고소 절차 안내입니다. 계좌 지급정지, 고소장 작성, 증거 보존 방법을 확인하세요.`,
    b: `${caseName} 피해금 회수를 위한 민사 소송 절차입니다. 가압류 신청, 손해배상 청구, 부당이득반환 전략을 안내합니다.`,
    c: `${caseName} 피해금 회수 사례를 정리했습니다. 접수부터 회수 완료까지 실제 대응 흐름과 결과를 확인하세요.`,
    d: `${caseName} 사건 수법과 피해 구조를 단계별로 정리합니다. 즉각 대응 방법과 핵심 증거 보존 순서를 안내합니다.`,
    e: `${caseName} 관련 형사고소·민사소송·성공사례·사건정보를 한곳에서 확인하세요. 피해 단계별 대응 경로를 연결합니다.`,
  }[key] || `${caseName} 피해 대응 정보입니다.`;
}

function makeBody(caseName, base, key) {
  const bodies = {
    a: [
      `${caseName} 관련 피해 신고가 지속적으로 접수되고 있습니다. 주요 피해 경로는 카카오톡·텔레그램·인스타그램 등 메신저를 통한 고수익 투자 플랫폼 유도이며, 초기 소액 출금 허용 후 대규모 입금 유도, 이후 출금 제한과 세금·수수료·보증금 명목의 추가 입금 요구가 반복되는 구조입니다.`,
      `형사 고소는 사기죄(형법 제347조)·특정경제범죄 가중처벌 등에 관한 법률 위반 혐의로 관할 경찰서 또는 사이버수사대에 고소장을 제출하는 방식으로 시작됩니다. ${base} 관련 피해 계좌에 대한 지급정지 신청을 병행하면 추가 피해 확산을 억제하는 데 도움이 될 수 있습니다.`,
      `고소장 작성에 필요한 핵심 증거는 입금 확인증·거래 내역·담당자와의 대화 기록·사이트·앱 화면 캡처·계좌번호와 예금주 명의입니다. ${caseName} 관련 자료는 삭제하지 말고 원본 상태로 보관해야 하며, 이미 앱이 삭제된 경우 기기를 초기화하지 않으면 디지털 포렌식을 통한 복원이 가능할 수 있습니다.`,
      `공동 피해자가 있다면 연명 고소 방식으로 피해 규모를 명확히 하면 수사기관의 집중도를 높일 수 있습니다. 피해금 규모·피해자 수·조직적 사기 여부에 따라 적용 법조항과 형량 기준이 달라질 수 있으므로, 관련 자료를 최대한 확보한 뒤 고소 절차를 진행하는 것이 중요합니다.`,
    ],
    b: [
      `${caseName} 피해금 회수를 위한 민사 절차는 불법행위로 인한 손해배상 청구(민법 제750조)와 부당이득반환 청구(민법 제741조)를 중심으로 진행됩니다. 상대방의 신원과 보유 재산을 먼저 파악하는 것이 소송 전략의 핵심입니다.`,
      `가압류·가처분은 판결 전에 상대방 재산을 동결해 이후 강제집행이 가능한 상태를 확보하는 보전처분입니다. ${base} 관련 입금 계좌나 연계 법인의 재산이 파악되면 빠르게 가압류를 신청하는 것이 중요합니다. 재산이 분산되거나 은닉되기 전에 조치를 취해야 집행력을 확보할 수 있습니다.`,
      `민사 소송의 핵심 증거는 계좌 입금 내역·상대방과의 계약·약정 자료·담당자 정보·서비스 이용 화면입니다. 상대방 특정이 어려운 경우 형사 고소를 먼저 진행해 수사기관의 계좌 추적 결과를 활용하는 방법도 있습니다.`,
      `소액 사건은 지급명령 신청(독촉 절차)으로 간이하게 집행권원을 확보할 수 있습니다. 피해금이 5천만 원 이상이면 ${caseName} 관련 민사 소송과 형사 고소를 병행하는 방식이 실질적 회수 가능성을 높이는 경우가 많습니다.`,
    ],
    c: [
      `${caseName}와 유사한 사건에서 피해 대응은 입금 계좌 지급정지 신청과 형사 고소를 병행하는 방식으로 시작된 경우가 많습니다. 초기 대응 속도가 빠를수록 계좌 내 잔여 피해금 동결 가능성이 높아집니다.`,
      `피해금 일부 회수는 가압류가 성공적으로 이루어진 경우에 집중됩니다. ${base} 관련 상대방 명의 계좌 또는 연계 법인 재산이 확인된 경우, 강제집행으로 피해금 일부를 돌려받은 사례가 있습니다. 단, 모든 사건에서 동일한 결과가 보장되지는 않습니다.`,
      `성공적인 대응에 공통적으로 필요한 조건은 입금 계좌 보존·담당자 연락처·사이트·앱 화면 캡처·대화 기록입니다. ${caseName} 피해자도 동일한 증거를 보존했을 경우 절차 진행이 원활하게 이루어질 가능성이 높습니다.`,
      `수사기관의 압수수색 이후 서버 자료가 확보되거나 관련자가 구속된 경우, 형사 합의 과정에서 피해금 일부를 반환받는 경로가 생기기도 합니다. 형사·민사 절차를 동시에 진행하면 협상 가능성과 실질적인 회수 경로가 넓어질 수 있습니다.`,
    ],
    d: [
      `${caseName}는 온라인 플랫폼 또는 메신저를 통해 고수익 투자·수익 창출 기회를 제안하며 피해자를 유인하는 방식의 사기 의심 사건입니다. 피해 구조는 초기 소액 출금 허용 → 대규모 입금 유도 → 출금 제한 → 추가 비용 요구 순으로 진행되는 경우가 전형적입니다.`,
      `${base} 관련 피해자들이 공통적으로 경험한 핵심 패턴은 담당자·상담원을 사칭한 계정을 통한 지속적인 연락과, 원금 보장·고수익을 강조한 투자 제안입니다. 플랫폼 화면상 잔액은 표시되지만 실제 출금은 차단되거나 추가 비용 요구로 이어집니다.`,
      `즉각적인 대응으로 가장 중요한 것은 증거 보존입니다. 대화 기록·입금 영수증·플랫폼 화면·계좌번호·담당자 이름과 연락처를 삭제하지 말고 스크린샷으로 저장하세요. 앱이 이미 삭제된 경우에도 기기 캐시·이메일 확인서·은행 거래 내역은 남아 있을 수 있습니다.`,
      `${caseName} 사건의 법적 대응 경로는 형사 고소(사기죄)와 민사 손해배상 청구 두 가지입니다. 수사기관에 고소장을 접수하면 계좌 추적과 금융정보 제공 명령이 이루어질 수 있으며, 민사 소송을 병행해 피해금 회수를 위한 보전처분도 신청할 수 있습니다.`,
    ],
    e: [
      `${caseName} 피해를 확인하셨다면 대응 경로는 크게 네 가지입니다. 형사 고소·민사 소송·성공사례 확인·사건정보 파악 중 현재 상황과 목적에 맞는 진입 경로를 선택하세요. 증거 확보 상황과 피해 규모에 따라 우선순위가 달라질 수 있습니다.`,
      `형사 고소 경로는 수사기관에 고소장을 제출하고 계좌 동결·압수수색·관련자 형사처벌을 목표로 합니다. 민사 소송 경로는 ${base} 피해금 직접 회수를 위해 손해배상 청구와 가압류 보전처분을 병행하는 방식입니다. 두 절차는 동시에 진행할 수 있습니다.`,
      `성공사례를 먼저 확인하면 ${caseName}와 유사한 피해 유형에서 어떤 절차가 효과적이었는지 파악할 수 있습니다. 비슷한 구조의 사건에서 실제 대응 흐름과 회수 경로를 비교해 전략을 수립하는 데 도움이 됩니다.`,
      `사건정보 페이지에서는 ${base} 수법·피해 구조·핵심 증거 목록·즉각 대응 순서를 정리한 정보를 확인할 수 있습니다. 어느 경로로 대응할지 결정하기 전에 사건 구조를 먼저 파악하면 절차 선택이 수월해집니다.`,
    ],
  };
  return bodies[key] || [makeDescription(caseName, base, key)];
}

function makeVictimCases(base, key) {
  const common = [
    `${base} 플랫폼·앱에서 수익이 발생했다는 화면을 확인한 뒤 출금을 신청했으나 세금·수수료·보증금 명목으로 추가 입금을 요구받은 사례`,
    `카카오톡·텔레그램·인스타그램 등 SNS에서 ${base} 담당자·상담원을 사칭하는 계정으로부터 투자 권유를 받고 입금을 유도받은 사례`,
    `${base} 사이트·앱 내 잔액은 정상적으로 표시되었으나 실제 출금 요청 시 계정 제한·점검 중·심사 중 안내만 반복된 사례`,
    `처음 소액 입금 후 출금이 한 번 가능해 신뢰가 형성된 뒤 대규모 입금을 유도받았고, 이후 연락이 두절되거나 플랫폼이 접속 불가 상태로 전환된 사례`,
  ];
  const extra = {
    a: `고소장 제출을 준비하던 중 상대방 측에서 소액 합의를 조건으로 고소 취하를 요청하며 추가 입금을 유도한 사례`,
    b: `피해 계좌 지급정지 신청 후 상대방이 다른 계좌로 자금을 이동시켜 가압류 집행이 어려워진 사례`,
    c: `형사 고소 접수 후 수사기관의 계좌 추적 과정에서 피해금 일부가 동결되어 피해자에게 반환된 사례`,
    d: `${base} 관련 플랫폼이 갑자기 폐쇄되고 앱 다운로드 링크도 삭제되어 증거 확보가 어려워진 사례`,
    e: `피해 후 혼자 대응을 시도했으나 형사·민사 절차 중 어느 것부터 시작해야 할지 판단하기 어려웠던 사례`,
  };
  return extra[key] ? [...common.slice(0, 3), extra[key]] : common.slice(0, 4);
}

function makeFaq(groupKey) {
  const Q1_ANSWER = "상담을 통해 입금 계좌·대화 기록·플랫폼 화면·담당자 정보 등 증거를 분석하여 형사·민사 절차의 전략을 수립, 회수 가능성을 구체적으로 검토합니다. 증거의 양과 상대방 특정 가능 여부가 결과에 큰 영향을 미칩니다.";
  const Q3_ANSWER = "변호사 선임에서 후불은 불법이기에 후불이 가능하다는 곳은 변호사를 사칭하는 곳이며, 변호사가 아닌 사람의 법률 서비스 제공 또한 불법이기에 각종 전문가를 자칭하는 곳도 2차 사기 위험이 있으니 주의하시기 바랍니다.";

  const faqs = {
    a: [
      { question: "[피해금 회수] 피해금을 돌려받을 수 있나요?", answer: Q1_ANSWER },
      { question: "[형사 고소] 경찰 신고만으로 해결되나요?", answer: "형사 고소는 중요한 첫 단계이지만, 수사 결과만으로 피해금이 자동 환급되지는 않습니다. 민사 손해배상 청구와 가압류 보전처분을 형사 절차와 병행해야 실질적인 회수 가능성이 높아집니다." },
      { question: "[후불 주의] 후불제로 사건 진행을 하고 싶은데 가능한가요?", answer: Q3_ANSWER },
      { question: "추가 입금 요구를 받았습니다. 어떻게 해야 하나요?", answer: "추가 입금은 즉시 중단하세요. 세금·수수료·보증금 명목의 추가 요구는 사기 수법의 핵심 패턴입니다. 추가 입금을 해도 출금이 허용되지 않는 경우가 대부분입니다. 기존 대화 기록과 입금 내역을 보존한 상태로 법률 상담을 먼저 진행하세요." },
      { question: "공동고소와 단독 고소의 차이점은?", answer: "공동 대응을 위해 기다리는 시간 동안 사기범은 도주할 수 있습니다. 피해 규모와 증거 상태에 따라 단독 고소가 더 신속한 경우가 많습니다." },
      { question: "단체소송(연대 소송)으로 진행하는게 좋은가요?", answer: "대표자 선정과 같은 사건의 피해자를 모집하는 기간이 길어져 의뢰인에게 실익이 없습니다." },
    ],
    b: [
      { question: "[민사 회수] 민사 소송으로 피해금을 돌려받을 수 있나요?", answer: Q1_ANSWER },
      { question: "[가압류 신청] 가압류는 언제 신청해야 하나요?", answer: "가압류는 판결 전에 상대방 재산을 동결하는 보전처분입니다. 입금 계좌나 상대방 재산이 파악되는 즉시 신청하는 것이 유리하며, 재산이 은닉되기 전에 빠르게 조치해야 집행력을 확보할 수 있습니다." },
      { question: "[후불 주의] 후불제로 사건 진행을 하고 싶은데 가능한가요?", answer: Q3_ANSWER },
      { question: "민사와 형사를 동시에 진행할 수 있나요?", answer: "형사 고소와 민사 손해배상 청구는 독립된 절차로 동시에 진행이 가능합니다. 형사 수사에서 확보된 계좌 추적 결과를 민사 소송의 증거로 활용하는 방법도 있습니다." },
      { question: "상대방 신원을 모르는데 소송이 가능한가요?", answer: "형사 고소를 먼저 진행해 수사기관의 계좌 추적으로 상대방 신원을 파악한 뒤 민사 소송을 진행하는 방법이 있습니다. 입금 계좌와 대화 내역만 있어도 절차를 시작할 수 있습니다." },
      { question: "소액 피해도 민사 소송이 가능한가요?", answer: "소액 사건은 지급명령 신청(독촉 절차)으로 간이하게 집행권원을 확보할 수 있습니다. 피해 규모와 상관없이 증거가 있다면 절차를 진행할 수 있으며, 소액사건심판 제도도 활용 가능합니다." },
    ],
    c: [
      { question: "[피해금 회수] 실제로 피해금을 돌려받은 사례가 있나요?", answer: Q1_ANSWER },
      { question: "[회수 기간] 피해금 회수까지 얼마나 걸리나요?", answer: "사건마다 다르지만, 계좌 지급정지와 가압류가 빠르게 이루어진 경우 수개월 내 일부 회수가 가능한 경우도 있습니다. 수사 진행 기간과 상대방 재산 현황에 따라 달라집니다." },
      { question: "[후불 주의] 후불제로 사건 진행을 하고 싶은데 가능한가요?", answer: Q3_ANSWER },
      { question: "어떤 증거가 있어야 회수 성공률이 높아지나요?", answer: "입금 계좌·거래 내역·담당자와의 대화 기록·사이트·앱 화면 캡처가 모두 보존된 경우 성공률이 가장 높습니다. 상대방 특정이 가능한 정보(이름, 연락처, 사업자 정보)가 있으면 절차 진행이 원활합니다." },
      { question: "전액 회수가 가능한가요?", answer: "전액 회수는 상대방 보유 재산과 계좌 잔액에 따라 달라집니다. 일부 회수 사례가 더 일반적이며, 형사·민사 절차를 병행하면 회수 경로가 넓어집니다." },
      { question: "해외 사기범에게도 법적 대응이 가능한가요?", answer: "국내 계좌를 이용한 경우 계좌 지급정지와 가압류가 가능합니다. 해외 서버를 이용하더라도 국내에 관련자가 있다면 형사 처벌과 민사 청구가 가능한 경우가 있습니다." },
    ],
    d: [
      { question: "[피해 구조] 이런 사기는 어떻게 진행되나요?", answer: Q1_ANSWER },
      { question: "[증거 보존] 어떤 증거를 보존해야 하나요?", answer: "대화 기록(카카오톡·텔레그램 등), 입금 영수증, 플랫폼 화면 캡처, 계좌번호와 예금주 명의, 담당자 이름과 연락처를 삭제하지 않고 원본 보존해야 합니다. 앱이 삭제된 경우에도 기기를 초기화하지 않으면 복원이 가능할 수 있습니다." },
      { question: "[후불 주의] 후불제로 사건 진행을 하고 싶은데 가능한가요?", answer: Q3_ANSWER },
      { question: "앱이 삭제된 경우 어떻게 해야 하나요?", answer: "앱을 삭제했더라도 기기 자체를 초기화하지 않았다면 디지털 포렌식을 통한 복원이 가능할 수 있습니다. 이메일 확인서, 은행 거래 내역, 카카오톡 채팅 백업도 대체 증거로 활용할 수 있습니다." },
      { question: "2차 피해를 막으려면 어떻게 해야 하나요?", answer: "사기범 측 연락을 즉시 차단하고 추가 입금을 절대 하지 않아야 합니다. 개인정보(신분증, 계좌정보)가 유출된 경우 금융기관에 연락해 계좌 보호 조치를 취하세요." },
      { question: "피해를 당한 뒤 얼마나 빨리 신고해야 하나요?", answer: "피해 인식 즉시 신고하는 것이 가장 좋습니다. 입금 계좌의 지급정지는 신속할수록 효과적이며, 시간이 지날수록 상대방이 자금을 이동하거나 증거를 삭제할 가능성이 높아집니다." },
    ],
    e: [
      { question: "[대응 경로] 어떤 법적 대응이 가능한가요?", answer: Q1_ANSWER },
      { question: "[형사·민사 병행] 형사와 민사 절차를 동시에 진행할 수 있나요?", answer: "형사 고소와 민사 손해배상 청구는 독립된 절차로 동시에 진행이 가능합니다. 형사 수사에서 확보된 계좌 추적 결과를 민사 소송의 증거로 활용하는 방법도 있습니다." },
      { question: "[후불 주의] 후불제로 사건 진행을 하고 싶은데 가능한가요?", answer: Q3_ANSWER },
      { question: "어떤 경로로 대응하는 게 가장 효과적인가요?", answer: "증거 상태와 피해 규모에 따라 다르지만, 형사 고소로 계좌 추적을 먼저 진행하고 민사 가압류를 병행하는 방식이 일반적으로 효과적입니다." },
      { question: "해외 서버를 이용한 사기도 대응이 가능한가요?", answer: "국내 계좌를 사용했거나 국내에 관련자가 있다면 형사 처벌과 민사 청구가 가능한 경우가 있습니다. 해외 주소지 사기범도 국내 입금 계좌가 있다면 지급정지와 가압류 조치가 가능합니다." },
      { question: "신고 시 개인정보 보호가 되나요?", answer: "수사기관에 고소장을 제출할 때 피해자 정보는 법적으로 보호되며, 가명 처리 제도도 활용 가능합니다. 법률 상담은 대화 내역이 외부에 공개되지 않습니다." },
    ],
  };
  return faqs[groupKey] || faqs.a;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

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

// ─── Category detection ───────────────────────────────────────────────────────

function detectCategory(caseName) {
  const text = normalizeSpace(caseName).toLowerCase();
  if (/공동고소|단체|집단|탈출|형사|고소|합의/.test(text)) return "공동고소 형사대응";
  if (/민사|가압류|손해배상|부당이득|판결|반환/.test(text)) return "민사소송 회수";
  if (/성공|회수율|전액|지역|사례/.test(text)) return "회수 성공사례";
  if (/브리핑|개요|대응방법|정보|주의/.test(text)) return "사건정보";
  if (/방송|라이브|미션|포인트|환전/.test(text)) return "방송 환전 사기";
  if (/로맨스|sns|채팅|연애|외국인/.test(text)) return "로맨스스캠 사기";
  if (/카지노|게임|출금|보증금|피싱/.test(text)) return "환전 피싱";
  if (/코인|거래소|선물|투자|리딩|주식|증권|공모주/.test(text)) return "투자 사기";
  return "형사대응";
}

function explainCategory(caseName, category) {
  return `${caseName} 사건명에서 감지된 키워드를 기준으로 "${category}" 카테고리를 제안했습니다.`;
}

function createSummary(caseName, category) {
  const map = {
    "공동고소 형사대응": `${caseName} 관련 피해자들이 입금 유도와 추가 비용 요구를 겪은 사건으로 공동고소와 형사대응 검토가 필요합니다.`,
    "민사소송 회수": `${caseName} 피해금 회수를 위해 가압류, 손해배상, 부당이득반환 등 민사 절차 검토가 필요한 사건입니다.`,
    "회수 성공사례": `${caseName} 피해 회수 진행 과정과 대응 포인트를 정리한 성공사례형 사건입니다.`,
    "사건정보": `${caseName} 사건 개요, 피해 구조, 증거 보존, 대응 방법을 정보성으로 정리한 사건입니다.`,
    "방송 환전 사기": `${caseName}에서 라이브 방송·미션·포인트 환전을 빙자해 추가 입금을 요구한 사기 의심 사건입니다.`,
    "로맨스스캠 사기": `${caseName} 관련 SNS 접근과 친분 형성 후 플랫폼 가입·환전·보증금 명목의 입금을 유도한 사건입니다.`,
    "환전 피싱": `${caseName}에서 출금을 조건으로 보증금·세금·인증비 등 추가 입금을 요구한 사기 의심 사건입니다.`,
    "투자 사기": `${caseName} 명칭을 이용해 투자금 입금·수익 실현·출금 수수료 등을 반복적으로 유도한 사기 의심 사건입니다.`,
    "형사대응": `${caseName} 관련 피해 정황을 바탕으로 입금 경위·대화 내용·계좌 정보를 정리해 형사대응이 필요한 사건입니다.`,
  };
  return map[category] || map["형사대응"];
}

function createTags(caseName, category) {
  const tokens = normalizeSpace(caseName).split(/[\s-]+/).filter((t) => t.length >= 2).slice(0, 4);
  return [...new Set([...tokens, category, "피해회복", "증거보존"])];
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

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

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalizeStringArray(value, fallback) {
  return Array.isArray(value) && value.length ? value.map(normalizeSpace).filter(Boolean) : fallback;
}

function normalizeFaq(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const faq = value.map((item) => ({
    question: normalizeSpace(item?.question),
    answer: normalizeSpace(item?.answer),
  })).filter((item) => item.question && item.answer);
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
    if (chunk.length <= 2) { grams.push(chunk); continue; }
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
    .replace(/사기|사칭|피해|투자|리딩방|거래소|증권|주식|코인/g, "")
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
  return /사기/.test(clean) ? `${clean} 사칭` : `${clean} 사칭 사기`;
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
