export const RECOVERY_DEBT_REPRESENTATIVE_SLUG = "계좌지급정지-채무부존재확인소송";

export const RECOVERY_INTENTS = [
  { key: "objection_rejected", label: "계좌지급정지 이의신청 불수용", suffix: "계좌지급정지이의신청-불수용", test: (text) => /이의신청.*불수용|불수용.*이의신청/.test(text) },
  { key: "notice", label: "지급정지 사실 통지서", suffix: "계좌지급정지해제-지급정지-사실-통지서", test: (text) => /지급정지.*사실.*통지서|사실.*통지서/.test(text) },
  { key: "non_face_to_face", label: "비대면거래제한 해제", suffix: "계좌지급정지해제-비대면거래제한-해제", test: (text) => /비대면거래제한/.test(text) },
  { key: "telecom_fraud", label: "전기통신금융사기 계좌지급정지", suffix: "계좌지급정지해제-전기통신금융사기", test: (text) => /전기통신금융사기/.test(text) },
  { key: "objection", label: "계좌지급정지 이의신청", suffix: "계좌지급정지-이의신청", test: (text) => /이의신청|이의제기/.test(text) },
];

export const RECOVERY_BANKS = [
  { name: "KB국민은행", slugBase: "kb국민은행", officialUrl: "https://www.kbstar.com/", aliases: ["KB국민은행", "국민은행"] },
  { name: "신한은행", slugBase: "신한은행", officialUrl: "https://bank.shinhan.com/", aliases: ["신한은행"] },
  { name: "우리은행", slugBase: "우리은행", officialUrl: "https://spot.wooribank.com/", aliases: ["우리은행"] },
  { name: "하나은행", slugBase: "하나은행", officialUrl: "https://www.kebhana.com/", aliases: ["하나은행"] },
  { name: "NH농협은행", slugBase: "nh농협은행", officialUrl: "https://banking.nonghyup.com/", aliases: ["NH농협은행", "NH농협", "농협은행", "농협"] },
  { name: "IBK기업은행", slugBase: "ibk기업은행", officialUrl: "https://www.ibk.co.kr/", aliases: ["IBK기업은행", "기업은행"] },
  { name: "SC제일은행", slugBase: "sc제일은행", officialUrl: "https://www.standardchartered.co.kr/", aliases: ["SC제일은행", "제일은행"] },
  { name: "한국산업은행", slugBase: "한국산업은행", officialUrl: "https://www.kdb.co.kr/", aliases: ["한국산업은행", "산업은행"] },
  { name: "카카오뱅크", slugBase: "카카오뱅크", officialUrl: "https://www.kakaobank.com/", aliases: ["카카오뱅크"] },
  { name: "토스뱅크", slugBase: "토스뱅크", officialUrl: "https://www.tossbank.com/", aliases: ["토스뱅크"] },
  { name: "케이뱅크", slugBase: "케이뱅크", officialUrl: "https://www.kbanknow.com/", aliases: ["케이뱅크", "K뱅크"] },
  { name: "한국씨티은행", slugBase: "한국씨티은행", officialUrl: "https://www.citibank.co.kr/", aliases: ["한국씨티은행", "씨티은행", "시티은행"] },
  { name: "SH수협은행", slugBase: "sh수협은행", officialUrl: "https://www.suhyup-bank.com/", aliases: ["SH수협은행", "SH수협", "수협은행", "수협"] },
  { name: "BNK부산은행", slugBase: "bnk부산은행", officialUrl: "https://www.busanbank.co.kr/", aliases: ["BNK부산은행", "부산은행"] },
  { name: "IM뱅크", slugBase: "im뱅크", officialUrl: "https://www.imbank.co.kr/", aliases: ["IM뱅크", "아이엠뱅크", "대구은행", "DGB대구은행"] },
  { name: "광주은행", slugBase: "광주은행", officialUrl: "https://www.kjbank.com/", aliases: ["광주은행"] },
  { name: "전북은행", slugBase: "전북은행", officialUrl: "https://www.jbbank.co.kr/", aliases: ["전북은행"] },
  { name: "BNK경남은행", slugBase: "bnk경남은행", officialUrl: "https://www.knbank.co.kr/", aliases: ["BNK경남은행", "경남은행"] },
  { name: "제주은행", slugBase: "제주은행", officialUrl: "https://www.jejubank.co.kr/", aliases: ["제주은행"] },
  { name: "새마을금고", slugBase: "새마을금고", officialUrl: "https://www.kfcc.co.kr/", hubSlug: "새마을금고-계좌지급정지해제-지급정지-사실-통지서", aliases: ["새마을금고"] },
].map((bank) => ({ ...bank, slug: bank.hubSlug || `${bank.slugBase}-계좌지급정지해제` }));

function compact(value = "") {
  return String(value).replace(/[\s_-]+/g, "").toLowerCase();
}

function recoveryText(item = {}) {
  return compact(`${item.caseName || ""} ${item.slug || ""}`);
}

export function isRecoveryDebtCase(item = {}) {
  return /채무부존재(?:확인)?소송|채무부존재소송/.test(recoveryText(item));
}

export function recoveryBankForCase(item = {}) {
  const text = recoveryText(item);
  return RECOVERY_BANKS.find((bank) => bank.aliases.some((alias) => text.includes(compact(alias)))) || null;
}

export function recoveryIntentForCase(item = {}) {
  if (isRecoveryDebtCase(item)) return { key: "debt_nonexistence", label: "채무부존재확인소송" };
  const text = recoveryText(item);
  return RECOVERY_INTENTS.find((intent) => intent.test(text)) || { key: "release", label: "계좌지급정지 해제" };
}

export function recoveryRepresentativeSlug(item = {}) {
  if (isRecoveryDebtCase(item)) return RECOVERY_DEBT_REPRESENTATIVE_SLUG;
  const bank = recoveryBankForCase(item);
  if (!bank) return "";
  const intent = recoveryIntentForCase(item);
  if (intent.key === "release") return bank.slug;
  const definition = RECOVERY_INTENTS.find((entry) => entry.key === intent.key);
  return definition ? `${bank.slugBase}-${definition.suffix}` : bank.slug;
}

export function recoveryRepresentativeTitle(item = {}) {
  const intent = recoveryIntentForCase(item);
  if (intent.key === "debt_nonexistence") return "계좌지급정지 채무부존재확인소송 대응 방법·준비자료";
  const bank = recoveryBankForCase(item);
  if (!bank) return "";
  const suffix = {
    release: "계좌지급정지 해제 방법·준비자료",
    objection: "계좌지급정지 이의신청 방법·준비자료",
    objection_rejected: "계좌지급정지 이의신청 불수용 대응 방법",
    notice: "지급정지 사실 통지서 확인·대응 방법",
    non_face_to_face: "비대면거래제한 해제 방법·준비자료",
    telecom_fraud: "전기통신금융사기 계좌지급정지 대응 방법",
  }[intent.key];
  return suffix ? `${bank.name} ${suffix}` : "";
}

export function recoveryListingDescription(item = {}) {
  const intent = recoveryIntentForCase(item);
  if (intent.key === "debt_nonexistence") {
    return "계좌 지급정지와 관련된 채무부존재확인소송의 검토 요건, 입증자료, 진행 절차와 대응 시 유의사항을 안내합니다.";
  }

  const bank = recoveryBankForCase(item);
  const bankName = bank?.name || "금융기관";
  const descriptions = {
    release: `${bankName} 계좌 지급정지 사유 확인부터 해제 신청, 소명자료 준비와 처리 절차까지 안내합니다.`,
    objection: `${bankName} 계좌지급정지 이의신청의 제출 요건, 거래 경위 소명자료와 접수 후 절차를 안내합니다.`,
    objection_rejected: `${bankName} 계좌지급정지 이의신청이 불수용된 경우 확인할 사유, 보완자료와 후속 대응 절차를 안내합니다.`,
    notice: `${bankName} 지급정지 사실 통지서의 확인 항목, 이의제기 기한과 준비해야 할 소명자료를 안내합니다.`,
    non_face_to_face: `${bankName} 비대면거래제한의 적용 사유, 해제 신청 방법과 본인·거래 확인자료를 안내합니다.`,
    telecom_fraud: `${bankName} 전기통신금융사기 관련 계좌지급정지의 법적 절차, 이의신청 요건과 대응자료를 안내합니다.`,
  };
  return descriptions[intent.key] || `${bankName} 계좌 지급정지의 원인 확인, 이의신청과 해제 절차에 필요한 자료를 안내합니다.`;
}

export function isRecoveryRepresentative(item = {}) {
  const representative = recoveryRepresentativeSlug(item);
  return Boolean(representative && item.slug === representative);
}

export function shouldConsolidateRecoveryCase(item = {}) {
  if (!["recovery-manual", "jipjeong-manual"].includes(item.createdBy)) return false;
  return Boolean(recoveryRepresentativeSlug(item));
}
