// 리딩방(ld) 랜딩 본문/메타 자동 생성 공유 로직 — create-readingroom-landing.js(관리자 수동 생성)와
// create-case.js(신규 케이스 자동 감지 생성) 양쪽에서 재사용한다.

const TPL_TITLE = "TITLE";
const TPL_CASE = "CASE";
const TPL_CHANNEL = "CHANNEL";
const TPL_CENTER = "주식리딩방사기 센터";

export const TEMPLATE_BODY = [
  TPL_TITLE,
  `## ${TPL_CASE} 핵심 요약`,
  `${TPL_CASE} 피해가 의심되는 상황이라면 먼저 추가 입금을 멈추고, 리딩방 대화 내용과 입금 내역, 출금 거부 화면을 원본 그대로 보존해야 합니다. ${TPL_CHANNEL} 사건은 단순 투자 손실이 아니라 허위 수익 화면, 바람잡이 계정, 가짜 HTS·거래소, 추가 입금 요구가 결합된 사기 구조인지 확인하는 것이 중요합니다.`,
  `${TPL_CENTER}에서는 ${TPL_CASE} 관련 상담에서 계좌 흐름, 지갑 주소, 대화방 운영자, 출금 조건 변경 시점을 함께 검토해 형사고소와 민사상 피해금 회수 가능성을 나누어 안내합니다.`,
  `## 상황별 빠른 답변`,
  `### 출금이 막혔을 때 먼저 할 일`,
  `세금, 보증금, 인증비, AML 비용, 지갑 활성화 비용을 먼저 내야 출금된다는 안내를 받았다면 추가 송금 전에 자료를 정리해야 합니다. 정상 투자 서비스에서는 개인 계좌나 지정 계좌로 추가 비용을 반복 송금하라고 요구하는 구조가 일반적이지 않습니다.`,
  `### 계좌·지갑 추적에서 필요한 자료`,
  `입금 계좌번호, 예금주, 송금 시간, 가상자산 지갑 주소, 거래소 화면, 담당자 프로필, 단체방 초대 링크, 출금 거부 메시지를 시간순으로 묶어야 합니다. 자료가 많을수록 수사기관 접수와 민사 보전처분 검토가 빨라질 수 있습니다.`,
  `### 형사고소와 민사 회수 병행 기준`,
  `상대방이 허위 수익과 출금 가능성을 말해 입금을 유도했다면 형사고소를 검토하고, 수취 계좌나 관련 법인이 특정된다면 가압류, 손해배상청구, 부당이득반환청구 등 민사 절차를 함께 살펴볼 수 있습니다.`,
  `## 주식·코인 리딩방 사기 주요 수법`,
  `### 무료 종목 추천에서 VIP방 전환`,
  `처음에는 무료 종목 추천, 시장 분석, 수익 인증을 제공하며 신뢰를 만들고 이후 VIP방, 기관 물량, 블록딜, 공모주 특별 배정, 선물 옵션 프로젝트 등으로 고액 입금을 유도하는 방식이 반복됩니다.`,
  `### 가짜 HTS·거래소·코인 지갑 유도`,
  `정상 금융회사처럼 보이는 사이트나 앱을 안내하지만, 실제로는 수익 화면만 조작되거나 출금 권한이 운영자에게 묶여 있는 경우가 있습니다. 앱 설치 파일, 접속 주소, 로그인 화면, 고객센터 대화까지 함께 보관해야 합니다.`,
  `### 세금·보증금·AML 비용 명목 추가 입금`,
  `출금 신청 단계에서 세금, 보증금, 계좌 인증비, 수수료, 자금세탁방지 심사비, 지갑 활성화 비용을 요구한다면 2차 피해 가능성을 우선 의심해야 합니다.`,
  `## 피해 직후 증거 보존 체크리스트`,
  `- 입금증과 전체 거래내역`,
  `- 카카오톡·텔레그램·네이버 밴드 대화 캡처`,
  `- 단체방 공지, 수익 인증, 출금 인증 게시물`,
  `- 투자 사이트 주소와 앱 설치 파일명`,
  `- 출금 거부 화면과 추가 입금 요구 메시지`,
  `- 상대방 계좌번호, 예금주, 지갑 주소, 담당자 프로필`,
  `## 피해금 회수 검토 절차`,
  `### 1단계 자료 정리`,
  `피해 경위를 날짜별로 정리하고, 입금 내역과 대화 내용을 연결합니다. 같은 담당자나 같은 계좌가 여러 번 등장하는지 확인합니다.`,
  `### 2단계 형사 절차 검토`,
  `기망 표현, 허위 수익 화면, 출금 제한, 추가 입금 요구가 확인되면 사기죄 고소장 구성 방향을 검토합니다.`,
  `### 3단계 민사 회수 절차 검토`,
  `수취 계좌, 법인 계좌, 계좌 명의자, 자금 이동 경로가 특정될 경우 가압류와 손해배상청구 가능성을 살펴봅니다.`,
  `## 유사 사례로 보는 대응 흐름`,
  `${TPL_CASE}와 유사한 사건에서는 피해자가 단체방의 수익 인증을 믿고 1차 입금을 한 뒤, 출금 신청 단계에서 세금과 보증금을 요구받는 흐름이 자주 확인됩니다. 또 다른 사례에서는 코인 지갑 인증비를 납부하면 원금과 수익금을 한 번에 돌려준다는 안내를 받았지만, 추가 입금 이후 담당자 계정과 사이트가 동시에 사라진 경우도 있습니다.`,
  `중요한 것은 피해 사실을 늦게 알았더라도 자료를 삭제하지 않는 것입니다. 방을 나가기 전 화면을 캡처하고, 앱을 삭제하기 전 접속 화면과 출금 제한 문구를 남겨두면 이후 대응에 도움이 됩니다.`,
  `## 자주 묻는 질문`,
  `### Q1. 리딩방에서 손실이 난 것과 사기는 어떻게 구분하나요?`,
  `정상 투자 손실과 달리 허위 수익 화면, 원금 보장 표현, 출금 거부, 추가 입금 요구, 담당자 연락 두절이 결합되어 있다면 사기 구조를 검토할 수 있습니다.`,
  `### Q2. 이미 세금이나 보증금을 추가로 냈다면 어떻게 해야 하나요?`,
  `더 이상의 추가 송금을 멈추고 기존 입금 내역과 추가 요구 메시지를 모두 보존해야 합니다. 추가 입금 경위는 피해금 산정과 기망 구조 입증에 중요한 자료가 됩니다.`,
  `### Q3. 코인 지갑으로 보낸 돈도 추적할 수 있나요?`,
  `블록체인 거래는 기록이 남기 때문에 지갑 주소와 전송 내역을 기준으로 흐름을 확인할 수 있습니다. 다만 회수 가능성은 거래소 경유 여부와 상대방 특정 가능성에 따라 달라집니다.`,
  `### Q4. 형사고소만 하면 피해금이 바로 돌아오나요?`,
  `형사고소는 처벌과 수사를 위한 절차이고, 피해금 회수를 위해서는 민사상 가압류, 손해배상청구, 부당이득반환청구를 함께 검토해야 하는 경우가 많습니다.`,
  `### Q5. 상담 전 무엇을 준비하면 좋나요?`,
  `입금증, 계좌정보, 대화 캡처, 사이트 주소, 출금 거부 화면, 담당자 프로필을 준비하면 초기 검토가 빨라집니다.`,
];

export function buildFromTemplate(title, caseKeyword, channelType) {
  return TEMPLATE_BODY.map((para) =>
    String(para || "")
      .split(TPL_TITLE).join(title)
      .split(TPL_CASE).join(caseKeyword)
      .split(TPL_CHANNEL).join(channelType)
  );
}

export function generateReadingroomMeta(caseKeyword, channelType) {
  const summary = `${caseKeyword} 피해가 의심되나요? ${channelType} 출금거부, 추가입금 요구, 가짜 HTS·거래소 정황과 피해금 회수 가능성, 형사고소 및 민사 대응 절차를 02-6348-0406 24시간 안내합니다.`.slice(0, 180);
  const imageAlt = `${caseKeyword} 피해 회수 대응`;
  const imageCaption = `주식리딩방사기 센터가 안내하는 ${caseKeyword} 출금거부 및 피해금 회수 대응`;
  const imageDescription = `${caseKeyword} 상담을 통해 리딩방 피해 직후 필요한 증거 보존, 형사고소, 계좌·지갑 추적, 민사 회수 가능성을 정리한 법률 정보 이미지입니다.`;
  return { summary, imageAlt, imageCaption, imageDescription };
}

export function parseReadingroomTitleParts(title) {
  const source = normalizeSpace(title);
  const channelType = detectChannelType(source);
  let subject = source
    .replace(/\s*(출금\s*거부|출금거부|피해금\s*회수|피해\s*회수|회수\s*대응|대응\s*방법|상담|변호사|센터).*$/i, "")
    .replace(/\s*(사칭\s*)?사기.*$/i, "")
    .trim();

  if (!subject) subject = channelType;
  subject = subject.replace(/\s+/g, " ").slice(0, 40);
  const caseKeyword = /사기/.test(subject) ? subject : `${subject} 사기`;
  return { subject, caseKeyword, channelType };
}

export function detectChannelType(value = "") {
  const text = String(value || "").toLowerCase();
  const hasCoin = /(코인|가상자산|거래소|usdt|btc|eth|coin|token|wallet|지갑)/i.test(text);
  const hasStock = /(주식|공모주|증권|선물|옵션|hts|mts|stock|ipo)/i.test(text);
  if (hasCoin && hasStock) return "주식·코인 리딩방";
  if (hasCoin) return "코인 리딩방";
  return hasStock ? "주식 리딩방" : "주식 리딩방";
}

// ld(리딩방피해회수센터.kr) 전용 페이지 제목/H1/이미지 제목 생성 — 다른 그룹의 groupPageTitle과 별도로 유지한다.
// H1/이미지 제목: "사건명 + 사칭 사기" (짧고 명확), <title> 태그: 검색 노출용으로 채널·행동 문구를 덧붙인 긴 버전.
const LD_TITLE_CHANNEL_SUFFIX = {
  "stock-reading": "주식 리딩방",
  "coin-reading": "코인 리딩방",
  "institution-impersonation": "증권사·투자사 사칭 리딩방",
  "hts-mts-app": "HTS·MTS 리딩방",
};

export function ldCleanBaseName(name = "") {
  const str = String(name || "").trim();
  const stripped = str.replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  return stripped || str;
}

export function ldPageH1(name = "") {
  const base = ldCleanBaseName(name);
  return base ? `${base} 사칭 사기` : "사칭 사기";
}

export function ldPageTitle(name = "", ldCategory = "") {
  const channel = LD_TITLE_CHANNEL_SUFFIX[ldCategory] || "주식·코인·투자 리딩방";
  return `${ldPageH1(name)} ${channel} 피해회복 안내`;
}

// 신규 케이스(caseName/summary/tags/memo)가 리딩방사기 신호를 담고 있는지 판정한다.
// caseName+tags+memo만 검사 — summary는 정형 boilerplate가 섞여 있어 오탐을 유발하므로 제외한다.
const READINGROOM_SIGNAL_TERMS = [
  "리딩방", "리딩", "종목 추천", "종목추천", "VIP 투자방", "VIP투자방",
  "공모주 특별배정", "기관 투자 프로젝트", "기관투자 프로젝트",
  "AI 자동매매", "자동매매", "HTS", "MTS", "교수",
  "증권사", "자산운용사", "애널리스트", "대표",
];

export function hasReadingroomSignal(item = {}) {
  const text = [item.caseName, ...(Array.isArray(item.tags) ? item.tags : []), item.memo]
    .filter(Boolean).join(" ");
  return READINGROOM_SIGNAL_TERMS.some((term) => text.includes(term));
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}
