import {
  FRAUD_TYPE_OPTIONS,
  fraudTypeLabel,
  normalizeFraudTypeKey,
  standardCaseKeyword,
  standardCoreSummary,
  standardIntroParagraphs,
  standardMethodTemplate,
  standardVictimCases,
} from "../_standardLanding.js";

const RELATED_READINGROOM_CTA = "다른 리딩방 사기 사건 보기는 이곳 📌 https://gnlaw-criminal.co.kr/prosecute/jusigridingbang-litigation/";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const rawCaseName = normalizeSpace(body.caseName);
    const fraudType = normalizeFraudTypeKey(body.fraudType, { caseName: rawCaseName });

    if (!rawCaseName) return json({ ok: false, message: "사건명을 입력해주세요." }, 400);
    if (!FRAUD_TYPE_OPTIONS.some((item) => item.key === body.fraudType)) {
      return json({ ok: false, message: "사건 유형을 선택해주세요." }, 400);
    }

    const caseName = normalizeCaseName(rawCaseName);
    const draft = createCafeDraft(caseName, fraudType);
    return json({ ok: true, draft });
  } catch (error) {
    return json({ ok: false, message: error.message || "원고 생성에 실패했습니다." }, 500);
  }
}

function createCafeDraft(caseName, fraudType) {
  const keyword = standardCaseKeyword(caseName);
  const typeLabel = fraudTypeLabel(fraudType);
  const method = standardMethodTemplate(fraudType);
  const intros = standardIntroParagraphs(fraudType, caseName);
  const victimCase = standardVictimCases(fraudType)[0]
    .replace(/^사례\s*1\s*/i, "")
    .trim();
  const title = `${keyword} 출금 거부·추가 입금 요구 피해 대응 방법`;

  const sections = [
    {
      heading: `${keyword} 피해가 의심된다면`,
      paragraphs: [
        standardCoreSummary(fraudType, caseName),
        ...intros,
        "※ 이 글은 특정 업체나 인물을 사기 주체로 단정하는 내용이 아닙니다. 제보·상담 과정에서 확인되는 사칭 및 유사 피해 정황을 바탕으로 주의사항과 대응 방법을 안내합니다.",
      ],
    },
    {
      heading: `${typeLabel} 주요 수법`,
      paragraphs: [],
      numbered: method.steps,
    },
    {
      heading: "이런 상황이라면 추가 입금을 중단해야 합니다",
      paragraphs: [],
      bullets: warningSigns(fraudType),
    },
    {
      heading: "유사 피해 진행 사례",
      paragraphs: [victimCase],
    },
    {
      heading: "피해를 인지한 직후 해야 할 일",
      paragraphs: [
        "출금을 위해 세금이나 보증금을 먼저 보내야 한다는 안내를 받았다면 추가 송금부터 중단해야 합니다. 이미 입금한 돈을 되찾기 위해 또 입금하는 행동은 피해 규모만 키울 수 있습니다.",
      ],
      numbered: [
        "상대방과의 카카오톡·텔레그램·문자 대화 전체를 삭제하지 말고 보존합니다.",
        "입금 계좌번호, 예금주, 송금 일시와 금액이 보이는 이체확인증을 확보합니다.",
        "사이트 주소, 앱 설치 파일·링크, 거래 화면과 출금 거부 화면을 캡처합니다.",
        "최초 접근부터 추가 입금 요구까지의 경위를 시간순으로 정리합니다.",
        "금융회사 지급정지 요청과 형사고소·민사상 보전조치 가능성을 신속히 검토합니다.",
      ],
    },
    {
      heading: "법무법인 선린의 대응 방향",
      paragraphs: [
        "법무법인 선린은 사건명이나 플랫폼 화면만으로 결론을 내리지 않고, 접근 경위·대화 내용·입금 계좌·출금 거부 사유·추가 송금 요구를 함께 검토합니다.",
        "확보된 자료를 토대로 사기죄 등 형사 책임, 계좌 명의자와 관련자에 대한 민사상 청구, 가압류 등 보전조치 가능성을 사건별로 검토합니다. 구체적인 절차와 결과는 증거 상태와 상대방 특정 여부에 따라 달라질 수 있습니다.",
      ],
    },
  ];

  const hashtags = createHashtags(caseName, fraudType);
  return {
    caseName,
    fraudType,
    typeLabel,
    title,
    sections,
    hashtags,
    body: renderPlainText(sections, hashtags),
  };
}

function warningSigns(fraudType) {
  const common = [
    "출금을 신청하자 세금·보증금·인증비·계정 해제비를 먼저 요구합니다.",
    "정상적인 금융회사 계좌가 아닌 개인 명의 계좌로 입금을 안내합니다.",
    "공식 고객센터가 아닌 카카오톡·텔레그램 등 비공식 채널로만 연락합니다.",
    "추가 입금을 하지 않으면 기존 투자금이나 수익금도 돌려받지 못한다고 압박합니다.",
  ];
  const first = {
    "stock-project": "교수·대표·증권사 관계자·투자 전문가를 사칭하며 고수익 프로젝트 참여를 권합니다.",
    "institution-exchange": "금융기관의 명칭과 로고를 사용한 별도 사이트·앱·특별계좌 이용을 요구합니다.",
    "team-mission": "소액 정산 후 고액 팀미션·VIP 미션·연속 주문 참여를 요구합니다.",
    "live-dating": "친분을 쌓은 뒤 후원·선물·포인트 충전·등급 승급 비용을 요구합니다.",
    "refund-reward": "환불이나 보상금을 받으려면 다른 사이트 가입과 선입금이 필요하다고 안내합니다.",
  };
  return [first[fraudType], ...common].filter(Boolean);
}

function createHashtags(caseName, fraudType) {
  const base = caseName.replace(/\s*(사칭\s*사기|사기)\s*$/i, "").replace(/\s+/g, "");
  const typeTags = {
    "stock-project": ["주식리딩방사기", "투자프로젝트사칭"],
    "institution-exchange": ["금융기관사칭", "가상자산사기"],
    "team-mission": ["팀미션사기", "부업사기"],
    "live-dating": ["라이브방송사기", "만남플랫폼사기"],
    "refund-reward": ["환불사기", "보상금사칭"],
  };
  return [...new Set([`${base}사기`, ...(typeTags[fraudType] || []), "출금거부", "사기피해대응", "법무법인선린"])];
}

function renderPlainText(sections, hashtags) {
  const blocks = [];
  sections.forEach((section) => {
    blocks.push(section.heading);
    (section.paragraphs || []).forEach((item) => blocks.push(item));
    (section.numbered || []).forEach((item, index) => blocks.push(`${index + 1}. ${item}`));
    (section.bullets || []).forEach((item) => blocks.push(`- ${item}`));
  });
  blocks.push(hashtags.map((tag) => `#${tag}`).join(" "));
  blocks.push(RELATED_READINGROOM_CTA);
  return blocks.join("\n\n");
}

function normalizeCaseName(name) {
  const value = normalizeSpace(name);
  if (/사기$/.test(value)) return value;
  return `${value.replace(/\s*(사칭|스캠|scam)\s*$/i, "").trim()} 사칭 사기`;
}

function normalizeSpace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
