export const STANDARD_LANDING_KEY = "a";
export const STANDARD_LANDING_REFRESHED_AT = "2026-07-11";

export const FRAUD_TYPE_OPTIONS = [
  { key: "stock-project", label: "주식 리딩방 사기·투자 프로젝트 사칭형" },
  { key: "institution-exchange", label: "증권사·은행·거래소 사기 사칭형" },
  { key: "team-mission", label: "팀미션 사기(쇼핑몰 구매대행·공동구매·부업·영상 시청)형" },
  { key: "live-dating", label: "라이브 방송·만남 플랫폼 사칭형" },
  { key: "refund-reward", label: "환불·보상금 지급 사칭형" },
];

const FRAUD_TYPE_KEY_SET = new Set(FRAUD_TYPE_OPTIONS.map((item) => item.key));

export function isStandardLandingCase(item = {}) {
  return !String(item.createdBy || "").trim();
}

export function isStandardLandingAllowedForGroup(item = {}, group = {}) {
  if (!isStandardLandingCase(item)) return true;
  return (group.landingKey || group.key) === STANDARD_LANDING_KEY;
}

export function standardCaseKeyword(caseName = "") {
  const base = standardCaseBase(caseName);
  return base ? `${base} 사칭 사기` : "사칭 사기";
}

export function standardPageTitle(caseName = "") {
  return `${standardCaseKeyword(caseName)}, 출금 불가 피해 회복 방법`;
}

export function standardSubtitle(caseName = "") {
  return `${standardCaseKeyword(caseName)} 피해가 의심된다면 추가 입금을 즉시 중단하세요.`;
}

export function standardMetaDescription(caseName = "") {
  const keyword = standardCaseKeyword(caseName);
  return `${keyword} 출금 거부 및 추가 입금 요구로 피해가 의심되나요? ${keyword}의 주요 수법과 피해금을 돌려받을 수 있는지? 형사고소 및 민사 대응 절차, 초기 대응 방법까지 실제 상담 사례를 바탕으로 안내합니다.`;
}

export function normalizeFraudTypeKey(value = "", fallbackSource = {}) {
  const direct = String(value || "").trim();
  if (FRAUD_TYPE_KEY_SET.has(direct)) return direct;

  const option = FRAUD_TYPE_OPTIONS.find((item) => item.label === direct || direct.includes(item.label));
  if (option) return option.key;

  const text = [
    direct,
    fallbackSource.slug,
    fallbackSource.caseName,
    fallbackSource.name,
    fallbackSource.summary,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/(환불|환급|보상|보상금|로또|토토|프로토|복구|환불센터|피해구제|refund|reward|hwanbul|bosang|lotto|roddo|toto|proto)/i.test(text)) return "refund-reward";
  if (/(라이브|방송|만남|채팅|데이트|로맨스|환전|포인트|카지노|도박|선물하기|등급\s*승급|live|dating|romance|broadcast|hwanjeon|point|casino)/i.test(text)) return "live-dating";
  if (/(팀미션|미션|쇼핑몰|구매대행|공동구매|부업|영상|리뷰|좋아요|알바|체험단|상품평|주문|정산|쿠폰|마켓|마트|스토어|티켓|예매|몰(?:\s|$)|shop|shopping|mission|review|alba|bueob|market|mart|store|mall|ticket|tikes|gumae|syoping|syopingmor|ribyu)/i.test(text)) return "team-mission";
  if (/(거래소|은행|가상자산|가상화폐|코인|스테이킹|프라이빗|해외선물|선물\s*거래|hts|mts|ipo|공모주|상장|exchange|coin|token|staking|future|futures)/i.test(text)) return "institution-exchange";
  return "stock-project";
}

export function fraudTypeLabel(typeKey = "") {
  return FRAUD_TYPE_OPTIONS.find((item) => item.key === typeKey)?.label || FRAUD_TYPE_OPTIONS[0].label;
}

export function standardHeroText(typeKey = "") {
  const copy = {
    "stock-project": "교수, 대표, 증권사 이사, 자산운용사 관계자, 애널리스트 등을 사칭하며 접근한 뒤 무료 종목 추천, VIP 투자방, 공모주 특별배정, 기관계좌 운용, AI 투자 시스템, 고수익 프로젝트 등을 제안 받았는지 점검하기 바랍니다.",
    "institution-exchange": "대표, 증권사 관계자, 자산운용사 매니저, 애널리스트, 투자 전문가 등을 사칭하며 접근하여 VIP방, 공모주, 투자 프로젝트, AI 자동매매, 프라이빗 세일, 해외 선물, 스테이킹 등을 제안 받았는지 점검하기 바랍니다.",
    "team-mission": "쇼핑몰 구매대행, 공동구매, 상품 리뷰, 체험단 활동, 영상 시청, SNS 홍보, 좋아요 클릭 등의 간단한 미션을 수행하면 수익을 지급한다고 안내 받았는지 점검하기 바랍니다.",
    "live-dating": "채팅 애플리케이션 등에서 친분을 형성한 후 라이브 방송 플랫폼으로 유입시켜 포인트 충전, 환전, 선물하기, 등급 승급 등을 이유로 지속적인 입금을 요구 받았는지 점검하기 바랍니다.",
    "refund-reward": "로또 추천 사이트, 스포츠토토 정보 제공 사이트 등에 가입했던 이용자에게 개인정보 유출, 서비스 종료, 환불 대상 선정, 보상금 지급 대상이 되었다고 접근하였는지 점검하기 바랍니다.",
  };
  return copy[typeKey] || copy["stock-project"];
}

export function standardIntroParagraphs(typeKey = "", caseName = "") {
  const keyword = standardCaseKeyword(caseName);
  const copy = {
    "stock-project": [
      `${keyword}는 교수, 대표, 증권사 이사, 자산운용사 관계자, 애널리스트, 투자 전문가 등을 사칭하며 투자자를 모집한 뒤 주식 투자금을 유도하는 대표적인 투자사기 유형입니다. 2025년도 경찰청 발표 자료에 따르면 투자리딩방 피해 건수는 6,853건, 피해액은 6,581억 원으로 집계될 만큼 피해가 지속적으로 발생하고 있습니다.`,
      "범죄 조직은 무료 종목 추천, VIP 투자방 초대, 공모주 특별배정, 기관 투자 프로젝트, AI 자동매매 시스템 등을 제안하며 신뢰를 형성합니다. 이후 가짜 HTS·MTS 설치를 유도하거나 높은 수익률을 보장하고, 조작된 수익 화면을 보여주며 투자금을 계속 늘리도록 유도하는 사례가 반복적으로 확인되고 있습니다.",
      "그러나 실제 출금을 요청하는 단계에서는 세금, 보증금, 인증비, 계좌 활성화 비용, 출금 승인 비용 등의 명목으로 추가 입금을 요구하거나 출금을 지연시키는 경우가 많습니다. 투자 프로젝트명이나 담당자의 직함보다 실제 금융회사와의 관계, 투자 권유 방식, 출금 과정에서 추가 입금을 요구하는지 여부를 먼저 확인하는 것이 중요합니다.",
    ],
    "institution-exchange": [
      `${keyword}에서는 증권사, 은행, 자산운용사, 가상자산 거래소를 사칭해 신뢰를 얻은 뒤 투자금을 유도하는 사례가 지속적으로 확인되고 있습니다. 2025년도 경찰청 발표 자료에 따르면 투자리딩방 피해 건수는 6,853건, 피해액은 6,581억 원으로 집계되었습니다.`,
      "범죄 조직은 교수, 대표, 증권사 관계자, 자산운용사 관계자, 애널리스트, 투자 전문가 등을 사칭하며 VIP 투자방, 공모주 특별배정, 투자 프로젝트, AI 자동매매 등을 제안하는 방식으로 접근합니다. 이후 가짜 HTS·MTS 설치를 유도하거나 높은 수익률을 보장하고, 조작된 수익 화면을 보여주며 투자금을 늘리도록 유도합니다.",
      "하지만 실제 출금을 요청하는 단계에서는 세금, 보증금, 인증비, 출금 승인 비용 등의 명목으로 추가 입금을 요구하는 사례가 반복적으로 확인되고 있습니다.",
    ],
    "team-mission": [
      `${keyword}는 쇼핑몰 구매대행, 공동구매, 상품 리뷰, 부업, 영상 시청, SNS 좋아요·구독 등의 간단한 미션을 수행하면 수익을 지급한다고 안내하며 접근하는 사기 유형입니다. 최근에는 쇼핑몰 운영이나 공동구매 대행을 명목으로 접근하는 사례가 증가하고 있으며, 초기에는 실제 소액 정산을 진행해 신뢰를 형성한 뒤 점차 고액 미션 참여를 유도하는 방식이 반복적으로 확인되고 있습니다.`,
      "범죄 조직은 \"마지막 미션만 완료하면 환급된다\", \"회원 등급을 올려야 출금이 가능하다\", \"공동구매 금액을 먼저 결제해야 한다\" 등의 이유로 지속적인 추가 입금을 요구합니다. 그러나 실제 환급이나 정산은 이루어지지 않거나, 출금을 요청하는 단계에서 보증금, 인증비, 수수료, 세금 등의 명목으로 추가 송금을 요구하는 사례가 반복적으로 확인되고 있습니다.",
      "특히 카카오톡, 텔레그램 등을 통해 팀 단위로 미션을 진행하거나 쇼핑몰 판매 실적을 조작하는 방식으로 신뢰를 형성하는 경우가 많습니다. 단순 부업이나 구매대행이라고 안내하더라도 지속적으로 입금을 요구하거나 환급을 조건으로 추가 결제를 요구한다면 신중하게 판단하는 것이 중요합니다.",
    ],
    "live-dating": [
      `${keyword}는 채팅 애플리케이션이나 SNS를 통해 친분을 형성한 뒤 라이브 방송 플랫폼이나 만남 플랫폼으로 유입시켜 투자금이나 충전금을 요구하는 사기 유형입니다. 범죄 조직은 일상적인 대화를 이어가며 신뢰를 쌓은 후 라이브 방송 시청, 선물하기, 포인트 충전, 환전, 회원 등급 승급 등을 권유하는 방식으로 접근합니다.`,
      "처음에는 실제 수익이나 환전이 가능한 것처럼 안내하지만, 이후 포인트 충전, VIP 회원 승급, 환전 수수료, 인증비, 보증금 등의 명목으로 지속적인 추가 입금을 요구합니다. 특히 일정 금액 이상을 충전해야 출금이나 환전이 가능하다고 안내하거나, 이벤트 참여를 이유로 반복적인 송금을 유도하는 사례가 확인되고 있어 각별한 주의가 필요합니다.",
    ],
    "refund-reward": [
      `${keyword}는 로또 번호 추천 사이트, 스포츠토토 정보 제공 사이트 등을 이용했던 사람에게 개인정보 유출, 서비스 종료, 환불 대상 선정, 보상금 지급 대상이 되었다고 안내하며 접근하는 사기 유형입니다. 최근에는 환불센터나 피해구제 담당자, 고객센터를 사칭하며 접근하는 사례도 반복적으로 확인되고 있습니다.`,
      "범죄 조직은 환불 절차를 진행하기 위해 특정 게임 사이트나 가상자산 거래소 가입을 유도하거나, 환불금을 지급하기 위해 충전금, 인증비, 수수료, 보증금, 세금 등을 먼저 납부해야 한다고 안내합니다. 그러나 추가 입금을 완료해도 환불은 이루어지지 않고 또 다른 비용을 요구하는 사례가 반복적으로 확인되고 있어 각별한 주의가 필요합니다.",
    ],
  };
  return copy[typeKey] || copy["stock-project"];
}

export function standardCoreSummary(typeKey = "", caseName = "") {
  const keyword = standardCaseKeyword(caseName);
  const copy = {
    "stock-project": `${keyword}는 투자 전문가나 증권사·자산운용사를 사칭해 밴드, 텔레그램, 카카오톡 등 비공식 채널로 접근하는 유형입니다. 고수익 보장, 허위 수익 인증, 출금 지연, 세금·보증금 명목의 추가 입금 요구가 있었다면 피해 여부를 즉시 확인해야 합니다. 법무법인 선린은 사건 경위 분석부터 형사고소, 민사상 피해 회복 절차까지 맞춤형 법률 대응을 통해 피해 회복을 지원합니다.`,
    "institution-exchange": `${keyword}는 실제 금융기관이나 임직원을 사칭해 투자상품 가입, 특별계좌 개설, 공모주 배정, 가상자산 거래 등을 명목으로 입금을 유도하는 경우가 많습니다. 금융기관 명칭과 로고를 사용한 허위 사이트, 조작된 거래 화면, 출금 지연, 세금·보증금·인증비 명목의 추가 입금 요구가 있었다면 피해 여부를 즉시 확인해야 합니다. 법무법인 선린은 사건 경위 분석부터 형사고소, 민사상 피해 회복 절차까지 맞춤형 법률 대응을 통해 피해 회복을 지원합니다.`,
    "team-mission": `${keyword}는 쇼핑몰 구매대행, 공동구매, 재택 부업, 영상 시청 등 간단한 활동으로 수익을 얻을 수 있다고 접근한 뒤 단계적으로 고액 결제와 추가 입금을 유도하는 경우가 많습니다. 미션 완료를 위한 선결제, 주문 오류·미션 실패·정산 조건을 이유로 한 추가 충전, 수익금 출금 지연이 있었다면 피해 여부를 즉시 확인해야 합니다. 법무법인 선린은 사건 경위 분석부터 형사고소, 민사상 피해 회복 절차까지 맞춤형 법률 대응을 통해 피해 회복을 지원합니다.`,
    "live-dating": `${keyword}는 방송 진행자나 이성 회원을 가장해 친밀감과 신뢰를 형성한 뒤 후원, 환전, 등급 인증, 만남 비용 등의 명목으로 반복적인 송금을 유도하는 경우가 많습니다. 환전이나 출금을 위한 수수료·보증금 요구, 만남 조건의 반복적인 변경, 추가 결제 후 연락 두절 정황이 있었다면 피해 여부를 즉시 확인해야 합니다. 법무법인 선린은 사건 경위 분석부터 형사고소, 민사상 피해 회복 절차까지 맞춤형 법률 대응을 통해 피해 회복을 지원합니다.`,
    "refund-reward": `${keyword}는 기존 사기 피해금이나 결제대금을 돌려주겠다고 접근한 뒤 환불 수수료, 세금, 보증금, 전산 처리비 등의 명목으로 추가 입금을 유도하는 경우가 많습니다. 피해 회복 기관이나 담당자를 사칭하거나 특정 사이트 가입과 선입금을 요구하고, 지급을 계속 미루는 정황이 있었다면 2차 피해 여부를 즉시 확인해야 합니다. 법무법인 선린은 사건 경위 분석부터 형사고소, 민사상 피해 회복 절차까지 맞춤형 법률 대응을 통해 피해 회복을 지원합니다.`,
  };
  return copy[typeKey] || copy["stock-project"];
}

export function standardMethodTemplate(typeKey = "") {
  const copy = {
    "stock-project": {
      title: "① 주식 리딩방·투자 프로젝트 사칭형 사기 수법",
      bullets: [
        "언론 기사·방송 출연 장면 등을 위조해 신뢰성을 높입니다.",
        "SNS 광고, 유튜브 영상을 통해 투자방을 소개합니다.",
        "매니저, 비서 등이 맞춤형 포트폴리오 설계를 제안합니다.",
        "이탈 시도 시 위약금·계약 위반·법적 조치를 내세우며 추가 납입을 강요합니다.",
        "환불, 환급, 정산 등에서 진위를 의심하면 번거로운 확인 절차를 역이용해 시간을 끕니다.",
      ],
      steps: ["투자 전문가·증권사·자산운용사 관계자 사칭", "밴드·텔레그램·카카오톡 등 비공식 채널 초대", "종목 추천과 허위 수익 인증으로 신뢰 형성", "고수익 투자 프로젝트 또는 특별 배정 상품 제안", "가짜 거래 화면을 통한 수익금 표시", "출금 신청 시 세금·보증금·인증비 추가 요구", "출금 거부, 계정 정지 또는 담당자 연락 두절"],
    },
    "institution-exchange": {
      title: "② 증권사·은행·거래소 사칭형 사기 수법",
      bullets: [
        "공식 기관이나 유명인과의 협약 체결을 허위로 주장합니다.",
        "위조 투자 허가서·사업자등록증 등 공문서 형식의 자료를 제공합니다.",
        "전문 투자 상담사를 사칭하며 1:1 맞춤형 포트폴리오 설계를 제안합니다.",
        "해외 거래소·비공개 프리미엄 계좌 등 복잡한 구조를 내세워 자금을 이동시킵니다.",
        "사기를 의심하는 순간 모든 채팅방과 사이트, 어플의 이용이 정지됩니다.",
      ],
      steps: ["실제 증권사·은행·거래소 명칭과 로고 도용", "임직원 또는 투자 담당자를 사칭해 접근", "밴드·텔레그램·카카오톡 등 비공식 채널 초대", "허위 홈페이지·앱·거래 계정 가입 유도", "특별상품·공모주·기관 전용 투자 기회 제안", "출금 시 세금·보증금·계정 해제비 요구", "반복 입금 후 출금 거부 또는 사이트 폐쇄"],
    },
    "team-mission": {
      title: "③ 팀미션 사기(쇼핑몰 구매대행·공동구매·부업·영상 시청)형 사기 수법",
      bullets: [
        "단순 클릭, 영상 시청, 상품 구매대행만으로 높은 수익을 얻을 수 있다고 홍보합니다.",
        "초반에는 소액 미션 수익을 실제 지급해 신뢰를 형성합니다.",
        "고수익 팀미션, VIP 미션, 공동구매 프로젝트 참여를 제안하며 고액 입금을 유도합니다.",
        "주문 오류, 미션 실패, 시스템 오류, 신용점수 부족 등을 이유로 반복적인 추가 충전을 요구합니다.",
        "출금이나 정산 단계에서는 세금, 보증금, 계정 복구비, 정산 수수료 등을 요구하며 지급을 지연합니다.",
      ],
      steps: ["재택 부업·쇼핑몰 구매대행·영상 시청 등으로 접근", "카카오톡·텔레그램 등 비공식 채널 초대", "소액 미션 수행 후 일부 수익 지급으로 신뢰 형성", "고수익 팀미션·VIP 미션 참여 유도", "주문 오류·미션 실패 등을 이유로 추가 충전 요구", "정산·출금 시 세금·보증금·수수료 요구", "출금 거부, 단체방 강제 퇴장 또는 운영자 연락 두절"],
    },
    "live-dating": {
      title: "④ 라이브 방송·만남 플랫폼 사칭형 사기 수법",
      bullets: [
        "라이브 방송 진행자나 이성 회원을 사칭해 지속적으로 친밀감을 형성합니다.",
        "방송 후원, 선물 보내기, 포인트 충전 시 더 가까워질 수 있다고 유도합니다.",
        "만남 예약, 회원 등급 상승, 환전 등을 이유로 반복적인 결제를 요구합니다.",
        "플랫폼 내 적립금이나 수익금이 표시되는 허위 화면으로 출금이 가능한 것처럼 속입니다.",
        "환전 수수료, 보증금, 인증비 등을 요구한 뒤 출금을 거부하거나 연락을 끊습니다.",
      ],
      steps: ["SNS·라이브 방송·만남 플랫폼에서 접근", "방송 진행자·이성 회원 등을 사칭해 친밀감 형성", "후원·선물·포인트 충전 또는 등급 상승 유도", "만남 예약 또는 환전을 이유로 결제 요구", "허위 적립금·수익 화면 제공", "환전 수수료·보증금·인증비 추가 요구", "출금 거부, 만남 취소 또는 담당자 연락 두절"],
    },
    "refund-reward": {
      title: "⑤ 환불·보상금 지급 사칭형 사기 수법",
      bullets: [
        "로또 번호 추천·스포츠토토 정보 제공 사이트 이용자에게 환불·보상 대상이라고 접근합니다.",
        "개인정보 유출, 서비스 종료 등을 이유로 신뢰를 형성합니다.",
        "환급 절차를 위해 특정 게임 사이트나 가상자산 거래소 가입을 유도합니다.",
        "본인 인증, 계좌 등록, 세금·보증금 등의 명목으로 선입금을 요구합니다.",
        "전산 오류나 추가 심사를 이유로 반복 입금을 요구한 뒤 연락을 끊습니다.",
      ],
      steps: ["기존 사이트 이용자에게 환불·보상 대상이라고 접근", "개인정보 유출·서비스 종료 등을 이유로 신뢰 형성", "특정 게임 사이트 또는 가상자산 거래소 가입 유도", "본인 인증, 계좌 등록, 세금·보증금 명목의 선입금 요구", "전산 오류·추가 심사를 이유로 반복 입금 요구", "보상금·입금액·수익금 등 지급을 계속 지연", "회원 강제 탈퇴·사이트 폐쇄, 또는 담당자 연락 두절"],
    },
  };
  return copy[typeKey] || copy["stock-project"];
}

export function standardResponseSections() {
  return [
    {
      title: "형사 절차 - 단순 경찰 신고만으로 해결되지 않습니다.",
      bullets: [
        "형법 제347조의 '사기죄'는 기망, 착오, 처분행위, 재산상 이익 취득 구조를 기준으로 검토합니다.",
        "위조 투자 허가서·사업자등록증 등 공문서 형식의 자료를 제공하는 행위는 제347조의2 '컴퓨터등 사용사기죄'에 해당 할 수 있습니다.",
        "실제 거래가 없는 허위 어플, 조작된 수익 화면으로 실제 매매 시장으로 인식할 기망행위 등은 통신사기피해환급법 제2조 '전기통신금융사기'와 자본시장법 제8조의 2 ‘무허가 금융투자상품시장 개설죄' 여부까지 경합범으로의 처벌 전략을 수립합니다.",
      ],
    },
    {
      title: "민사 절차 - 민사 가압류, 손해배상 소송, 부당이득반환 소송 가능성을 동시에 검토해야 회수 경로가 넓어집니다.",
      bullets: [
        "채권 가압류는 상대방이 소송 중 자금을 은닉하지 못하도록 신속히 진행하는 것이 중요합니다.",
        "계좌 명의자들은 피해자에 있어 사기 및 사기 방조, 또는 전자금융거래법의 위반에 따른 공동불법행위의 책임이 있습니다.",
        "계좌 명의자들은 사기 조직에 송금의 대가로 부당한 이득을 취하였는지를 확인하여 다양한 소송 경로를 점검해봐야 피해 회복의 가능과 회수율이 증가 합니다.",
      ],
    },
  ];
}

export function standardLastModified(item = {}) {
  return maxDate(item.updatedAt, item.createdAt, STANDARD_LANDING_REFRESHED_AT);
}

function standardCaseBase(caseName = "") {
  const value = String(caseName || "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  const marker = value.search(/\s*사기(?:\s|$)/);
  const beforeSagi = marker > 0 ? value.slice(0, marker).trim() : value;
  return beforeSagi
    .replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "")
    .trim();
}

function maxDate(...values) {
  const dates = values
    .map((value) => String(value || "").trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
  return dates[dates.length - 1] || STANDARD_LANDING_REFRESHED_AT;
}
