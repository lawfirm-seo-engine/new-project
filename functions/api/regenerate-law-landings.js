// Batch endpoint: adds la~le manuscripts to all existing cases in KV + GitHub
// POST /api/regenerate-law-landings  — no request body required

import { caseOgImageUrl } from "../_seo.js";

const LAW_GROUPS = [
  {
    key: "la",
    siteUrl: "https://금융사기대응센터.kr",
    pathPrefix: "criminal",
    intent: "형사고소, 금융피해 신고, 계좌 추적, 지급정지",
  },
  {
    key: "lb",
    siteUrl: "https://금융피해대응센터.kr",
    pathPrefix: "litigation",
    intent: "피해금 회수, 민사소송, 가압류, 부당이득반환, 회수 전략",
  },
  {
    key: "lc",
    siteUrl: "https://사기피해구제센터.kr",
    pathPrefix: "results",
    intent: "실제 회수 사례, 아카이브, 대응 흐름, 회수율",
  },
  {
    key: "ld",
    siteUrl: "https://리딩방피해회수센터.kr",
    pathPrefix: "insights",
    intent: "AI 분석, 금융사기 패턴, 즉시 대응, 증거 보존",
  },
  {
    key: "le",
    siteUrl: "https://투자사기대응센터.kr",
    pathPrefix: "incidents",
    intent: "금융사기 허브, 형사고소, 피해금 회수, 사례 아카이브, AI 브리핑",
  },
];

export async function onRequestPost(context) {
  const { env } = context;

  try {
    if (!env.CASES) {
      return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    }

    // 1. KV 인덱스에서 전체 slug 목록 조회
    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];

    if (idx.length === 0) {
      return json({ ok: false, message: "등록된 사건이 없습니다." });
    }

    let updatedKV = 0;
    let alreadyDone = 0;
    const errors = [];

    // 2. 각 사건에 la-le 원고 생성 후 KV 업데이트
    for (const entry of idx) {
      try {
        const caseRaw = await env.CASES.get(`case:${entry.slug}`);
        if (!caseRaw) continue;

        const caseData = JSON.parse(caseRaw);

        // 이미 la-le가 있는 경우 건너뜀
        if (caseData.landings?.la) {
          alreadyDone++;
          continue;
        }

        const newLandings = {};
        for (const group of LAW_GROUPS) {
          newLandings[group.key] = createLandingData({ caseName: caseData.caseName, slug: caseData.slug, group });
        }

        caseData.landings = { ...(caseData.landings || {}), ...newLandings };
        caseData.updatedAt = today();

        await env.CASES.put(`case:${entry.slug}`, JSON.stringify(caseData));
        updatedKV++;
      } catch (e) {
        errors.push({ slug: entry.slug, error: e.message });
      }
    }

    // 3. GitHub cases.json도 일괄 업데이트
    const {
      GITHUB_REPO_OWNER: owner,
      GITHUB_REPO_NAME: repo,
      GITHUB_BRANCH: branch = "main",
      GITHUB_TOKEN: token,
    } = env;

    let githubUpdated = 0;

    if (owner && repo && token) {
      try {
        const filePath = "data/cases.json";
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(apiUrl, { headers: githubHeaders(token) });

        if (res.ok) {
          const file = await res.json();
          const raw = await readFileContent(file, token);
          const cases = raw ? JSON.parse(raw) : [];

          for (const c of cases) {
            if (!c.landings?.la) {
              const newLandings = {};
              for (const group of LAW_GROUPS) {
                newLandings[group.key] = createLandingData({
                  caseName: c.caseName,
                  slug: c.slug,
                  group,
                });
              }
              c.landings = { ...(c.landings || {}), ...newLandings };
              c.updatedAt = today();
              githubUpdated++;
            }
          }

          if (githubUpdated > 0) {
            const newContent = JSON.stringify(cases, null, 2);
            await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
              method: "PUT",
              headers: githubHeaders(token),
              body: JSON.stringify({
                message: `Add la-le landings to ${githubUpdated} cases`,
                content: encodeBase64(newContent),
                sha: file.sha,
                branch,
              }),
            });
          }
        }
      } catch (e) {
        errors.push({ slug: "github", error: e.message });
      }
    }

    return json({
      ok: true,
      total: idx.length,
      updatedKV,
      alreadyDone,
      githubUpdated,
      errors,
    });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

// ─── 원고 생성 함수 ──────────────────────────────────────────────────────────────

function createLandingData({ caseName, slug, group }) {
  const base = primaryCaseKeyword(caseName);
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(slug)}/`;
  const title = groupPageTitle(caseName, group.key);
  const descByType = {
    la: `금융피해 신고 절차, 형사고소, 계좌 추적, 지급정지 방법을 금융피해 사례 기준으로 정리합니다.`,
    lb: `피해금 회수 전략, 민사소송, 가압류, 부당이득반환 절차와 단계별 회수 경로를 정리합니다.`,
    lc: `실제 회수 사례 아카이브에서 유사 사건의 대응 흐름, 회수 결과, 증거 활용 방식을 비교합니다.`,
    ld: `AI 분석 기반 금융사기 패턴, 즉시 대응 방법, 증거 보존 순서를 브리핑 형식으로 정리합니다.`,
    le: `금융사기 사건 허브에서 형사, 민사, 사례, AI 브리핑을 사건별로 연결하고 대응 경로를 통합합니다.`,
  };
  const description = descByType[group.key] || `${group.intent} 관련 피해 구조와 대응 절차를 정리합니다.`;
  const faqContext = createContextTermState();
  const faq = makeFaq({ caseName, base, group }).map((item) => ({
    ...item,
    question: softenRepeatedContextTerms(item.question || "", faqContext),
    answer: softenRepeatedContextTerms(item.answer || "", faqContext),
  }));
  const body = softenRepeatedContextList(makeBody({ caseName, base, group }));
  const victimCases = softenRepeatedContextList(makeVictimCases({ base, group }));

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: caseOgImageUrl(slug || "landing", group.siteUrl),
    h1: groupPageH1(caseName, group.key),
    body,
    victimCases,
    suspiciousCompanies: makeSuspiciousCompanies({ caseName }),
    faq,
    schema: createSchemaData({ title, description, canonical, caseName, faq }),
  };
}

function makeBody({ caseName, base, group }) {
  const displayName = base || primaryCaseKeyword(caseName);
  const typeCopy = {
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
      `${displayName} 사건에서 나타나는 금융사기 패턴은 어떻게 분석되나요? AI 브리핑은 유사 사건의 자금 흐름, 접근 채널, 담당자 교체 시점, 출금 거부 패턴을 구조화해 현재 상황과 비교합니다.`,
      `금융사기는 단계별 설계가 치밀합니다. 신뢰 구축 단계에서는 소액 수익을 지급해 실제 서비스처럼 보이고, 전환 단계에서는 고액 유도 후 출금을 차단합니다. 이 구조를 인식하면 2차 입금을 막을 수 있습니다.`,
      `AI 분석에서 주목하는 경고 지표는 무엇인가요? 출금 신청 후 반복되는 심사 지연, 세금·보증금·인증비 명목의 조건부 요구, 담당자 교체 및 연락 차단이 대표 지표입니다.`,
      `증거 보존은 어떤 순서로 해야 하나요? 대화 전체 캡처 → 입금 영수증 저장 → 플랫폼 도메인 기록 → 담당자 프로필 보존 순서로 진행하세요. 앱 설치 파일이 있다면 삭제 전에 저장해 두는 것이 좋습니다.`,
      `금융감독원·경찰청 사이버수사대에 동시 신고하면 어떤 효과가 있나요? 금융당국의 계좌 추적과 수사기관의 형사 수사가 병행되면 자금 흐름 파악이 빨라지고 관련 계좌 동결 가능성이 높아집니다.`,
      `2차 금융사기는 어떻게 접근하나요? 피해를 당한 뒤 금융피해 전담팀, 법원 판결 대행, 피해금 회수 보장을 제시하며 다시 접근하는 사례가 많습니다. 선입금·수수료 요구가 있다면 반드시 기존 사건과 함께 확인해야 합니다.`,
      `브리핑으로 사건 구조를 확인한 뒤 증거를 보존한 상태로 상담 접수나 전화 문의로 다음 절차를 잡으세요. 자료가 부족하더라도 현재 남아 있는 증거로 방향 설정이 가능합니다.`,
    ],
    le: [
      `${displayName} 금융사기 허브에서는 형사고소, 피해금 회수, 실제 회수 사례, AI 브리핑을 사건별로 연결해 확인할 수 있습니다. 어떤 대응 경로가 필요한지 파악하는 데 도움이 됩니다.`,
      `금융피해 대응센터 페이지에서는 형사고소 절차와 계좌 추적 방법을 확인하세요. 입금 내역과 대화 기록을 기준으로 고소장 작성과 수사 연계 방향을 정리합니다.`,
      `피해금 회수 전략센터 페이지에서는 민사소송, 가압류, 부당이득반환 경로를 살펴볼 수 있습니다. 상대방 재산 파악과 보전처분 가능성을 함께 검토합니다.`,
      `실제 회수 사례 아카이브에서는 유사한 금융사기 사건의 대응 흐름과 회수 결과를 비교할 수 있습니다. 증거 상태와 피해 규모가 비슷한 케이스를 참고하면 절차 선택에 도움이 됩니다.`,
      `AI 금융사기 브리핑 페이지에서 사건 구조와 즉시 대응 순서를 확인하세요. 어떤 증거를 어떻게 보존해야 하는지, 어떤 신호가 금융사기의 전형적인 패턴인지 구체적으로 설명합니다.`,
      `금융사기는 동일 조직이 여러 이름으로 운영되는 경우가 많습니다. 계좌 명의, 도메인 패턴, 담당자 연락처를 허브에서 비교하면 동일 조직 연결 여부를 확인하는 데 도움이 됩니다.`,
      `피해 자료를 정리했다면 상담 접수, 전화 문의, 카톡 상담 중 편한 방식으로 현재 상황을 확인해 보세요. 금융사기 피해 유형에 맞는 대응 경로를 함께 검토합니다.`,
    ],
  };
  return typeCopy[group.key] || typeCopy.la;
}

function makeVictimCases({ base, group }) {
  const common = [
    `카카오톡 채널에서 주식 단기 수익을 보장한다며 소액 입금을 유도했고, 출금 신청 직후 인증비 명목으로 추가 입금을 요구받았습니다. 대화방 캡처, 입금 내역, 계좌번호를 즉시 저장해 수사기관 제출 자료로 보존했습니다.`,
    `텔레그램 투자 리딩방에서 며칠간 수익 화면을 보여준 뒤 VIP 전환을 권유하며 고액 입금을 안내했고, 입금 직후 담당자 계정이 차단되며 연락이 끊겼습니다. 통화 녹음, 그룹방 화면 캡처, 입금 영수증을 삭제 전에 보존했습니다.`,
    `처음에는 소액 수익을 실제로 지급해 신뢰를 형성한 뒤 고액 입금을 유도했고, 출금 시도 직후 세금 처리 비용을 먼저 보내야 한다는 요구가 반복됐습니다. 요구 메시지 캡처와 이체 내역을 시간순으로 정리해 사기 구조를 문서화했습니다.`,
    `앱 설치 후 수익금 화면이 표시됐지만 출금 버튼을 누를 때마다 심사 중 또는 계정 제한 안내가 이어졌습니다. 앱 화면 녹화, 설치 링크, 담당자 대화 내용을 삭제 전에 확보해 피해 구조 설명 자료로 활용했습니다.`,
  ];
  const extra = {
    la: `금융피해 신고 후 금융감독원 민원을 함께 제출한 케이스에서 해당 계좌의 금융서비스 이용이 제한되며 추가 피해 확산이 차단됐습니다. 입금 계좌와 수취 금융기관 정보를 정리해 형사고소 자료와 함께 제출했습니다.`,
    lb: `피해금 입금 계좌의 예금주가 법인으로 확인되어 법인 재산에 대한 가압류를 먼저 검토했습니다. 회수 전략 수립 과정에서 법인 등기부 열람과 자산 현황 파악이 핵심 단서가 됐습니다.`,
    lc: `피해자 세 명이 동일 업체 아카이브를 통해 연결되었고, 각자의 대화 캡처와 입금 내역을 공유해 동일 계좌 패턴을 입증했습니다. 집단 자료 정리 이후 합의 협상이 진행되어 피해 금액의 일부를 회수했습니다.`,
    ld: `AI 브리핑 분석에서 해당 사건의 자금 흐름이 4단계(접촉→신뢰→고액유도→출금차단) 구조와 일치함이 확인됐습니다. 이 구조를 수사기관 제출 자료에 시각화해 피해 패턴 입증에 활용했습니다.`,
    le: `금융사기 허브에서 같은 플랫폼 도메인과 계좌 명의로 연결된 다른 피해자 사례를 확인했습니다. 유형별 대응 페이지를 비교한 뒤 형사고소와 민사 가압류를 동시에 접수하는 경로를 선택했습니다.`,
  };
  return [...common, extra[group.key] || common[0]];
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

  const byType = {
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
      { question: "AI 브리핑은 무엇을 기준으로 분석하나요?", answer: "유사 금융사기 사건의 접근 채널, 자금 흐름, 출금 거부 패턴, 담당자 교체 시점을 비교 분석합니다. 현재 상황과 일치하는 패턴이 있다면 사기 정황으로 판단할 근거가 됩니다." },
      { question: "금융사기와 단순 투자 실패는 어떻게 구분하나요?", answer: "출금 거부, 추가 입금 요구, 담당자 연락 차단이 있다면 사기 정황입니다. 수익 보장 표현이나 원금 보전 약속도 불법 투자 권유의 지표가 됩니다. 대화 내용을 보존하면 구분이 명확해집니다." },
      { question: "신고 전에 어떤 정보를 준비해야 하나요?", answer: "입금 계좌번호, 예금주, 금융기관명, 대화 캡처, 수익 안내 화면, 플랫폼 도메인, 담당자 연락처를 준비하세요. 자료가 많을수록 사건 구조 분석과 신고 방향 설정이 빨라집니다." },
      { question: "금융사기 앱은 어떻게 증거로 남기나요?", answer: "앱 화면을 스크린 녹화로 캡처하고 설치 링크와 APK 파일을 삭제하지 마세요. 스크린샷에 시간 정보가 포함되도록 설정하면 피해 시점 입증에 도움이 됩니다." },
    ],
    le: [
      { question: "금융사기 허브는 어떤 정보를 제공하나요?", answer: "금융피해 대응센터(형사고소), 피해금 회수 전략센터(민사소송), 실제 회수 사례 아카이브, AI 금융사기 브리핑 페이지를 연결합니다. 사건별로 필요한 대응 경로를 한 곳에서 비교할 수 있습니다." },
      { question: "금융사기 피해인지 먼저 확인하려면 어떻게 하나요?", answer: "출금 거부, 추가 조건부 입금 요구, 담당자 연락 차단이 있다면 즉시 AI 브리핑 페이지에서 사건 구조를 확인하세요. 유사 패턴과 비교해 빠르게 정황을 파악할 수 있습니다." },
      { question: "어느 페이지부터 봐야 효과적인가요?", answer: "피해를 이제 인지했다면 AI 브리핑 → 금융피해 대응센터 순서로 보세요. 이미 증거를 보존했다면 회수 전략센터와 실제 사례 아카이브를 함께 참고하는 것이 좋습니다." },
      { question: "동일 금융사기 조직이 이름을 바꿔 재접근하는 경우는 어떻게 하나요?", answer: "계좌 명의와 담당자 연락처가 동일하거나 플랫폼 구조가 같다면 동일 조직으로 의심해야 합니다. 기존 자료와 새로운 접촉 내용을 모두 보존해 상담 시 함께 제출하면 됩니다." },
    ],
  };
  return [...shared, ...(byType[group.key] || byType.la)];
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

// ─── 텍스트 헬퍼 ─────────────────────────────────────────────────────────────────

function groupPageTitle(name, groupKey) {
  const base = primaryCaseKeyword(name);
  const secondary = secondaryCaseKeyword(name);
  const suffixes = {
    la: "법적조치",
    lb: "피해회복",
    lc: "해결사례",
    ld: "피해정보",
    le: "진행현황",
  };
  return `${base} ${suffixes[groupKey] || "법적조치"}${secondary ? ` | ${secondary}` : ""}`;
}

function groupPageH1(name, groupKey) {
  const base = primaryCaseKeyword(name);
  const suffixes = {
    la: "법적조치",
    lb: "피해회복",
    lc: "해결사례",
    ld: "피해정보",
    le: "진행현황",
  };
  return `${base} ${suffixes[groupKey] || "법적조치"}`;
}

function primaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const match = clean.match(/^(.+?사기)(?:\s+.+)?$/i);
  if (match) return match[1].trim();
  return clean ? `${clean} 사기` : "";
}

function secondaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const primary = primaryCaseKeyword(name);
  let tail = clean.slice(primary.length).trim();
  tail = tail.replace(/db증권/ig, "DB증권");
  if (!tail) return "";
  return /사칭|피해/.test(tail) ? `${tail} 피해 대응` : `${tail} 사칭 피해 대응`;
}

function baseCaseName(name) {
  return String(name || "").trim().replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)$/i, "").trim();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CONTEXT_TERM_LIMITS = [
  { term: "해당 사건", limit: 1, replacements: ["접수 기록", "상담 기록", "문제 정황", "검토 대상", "관련 자료"] },
  { term: "이 사안", limit: 1, replacements: ["이 기록", "접수 내용", "거래 흐름", "검토 대상"] },
  { term: "해당 플랫폼", limit: 1, replacements: ["문제 사이트", "거래 화면", "접속 페이지", "운영 계정"] },
  { term: "유사 피해", limit: 1, replacements: ["같은 유형의 사례", "비슷한 접수", "관련 상담 기록"] },
  { term: "출금 거부", limit: 2, replacements: ["출금 제한", "지급 보류", "환급 지연", "인출 제한"] },
  { term: "추가 입금 요구", limit: 2, replacements: ["추가 송금 요청", "보증금 안내", "인증비 요청", "추가 비용 안내"] },
];

function createContextTermState() {
  return { counts: Object.create(null) };
}

function softenRepeatedContextTerms(value = "", state = null) {
  let text = String(value || "");
  CONTEXT_TERM_LIMITS.forEach(({ term, limit, replacements }) => {
    let count = state?.counts ? (state.counts[term] || 0) : 0;
    text = text.replace(new RegExp(escapeRegex(term), "g"), () => {
      count += 1;
      if (count <= limit) return term;
      return replacements[(count - limit - 1) % replacements.length];
    });
    if (state?.counts) state.counts[term] = count;
  });
  return text;
}

function softenRepeatedContextList(items = []) {
  const state = createContextTermState();
  return items.map((item) => softenRepeatedContextTerms(item, state));
}

function normalizeSpace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── GitHub 헬퍼 ─────────────────────────────────────────────────────────────────

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
    const r = await fetch(file.download_url, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "static-landing-generator-admin" },
    });
    return r.ok ? (await r.text()).trim() : null;
  }
  return null;
}

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64(str) {
  const clean = str.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
