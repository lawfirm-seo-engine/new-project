export const RECOVERY_BANKS = [
  { name: "KB국민은행", slug: "kb국민은행-계좌지급정지해제", aliases: ["KB국민은행", "국민은행"] },
  { name: "신한은행", slug: "신한은행-계좌지급정지해제", aliases: ["신한은행"] },
  { name: "우리은행", slug: "우리은행-계좌지급정지해제", aliases: ["우리은행"] },
  { name: "하나은행", slug: "하나은행-계좌지급정지해제", aliases: ["하나은행"] },
  { name: "NH농협은행", slug: "nh농협은행-계좌지급정지해제", aliases: ["NH농협은행", "NH농협", "농협은행", "농협"] },
  { name: "IBK기업은행", slug: "ibk기업은행-계좌지급정지해제", aliases: ["IBK기업은행", "기업은행"] },
  { name: "SC제일은행", slug: "sc제일은행-계좌지급정지해제", aliases: ["SC제일은행", "제일은행"] },
  { name: "한국산업은행", slug: "한국산업은행-계좌지급정지해제", aliases: ["한국산업은행", "산업은행"] },
  { name: "카카오뱅크", slug: "카카오뱅크-계좌지급정지해제", aliases: ["카카오뱅크"] },
  { name: "토스뱅크", slug: "토스뱅크-계좌지급정지해제", aliases: ["토스뱅크"] },
  { name: "케이뱅크", slug: "케이뱅크-계좌지급정지해제", aliases: ["케이뱅크", "K뱅크"] },
  { name: "한국씨티은행", slug: "한국씨티은행-계좌지급정지해제", aliases: ["한국씨티은행", "씨티은행", "시티은행"] },
  { name: "수협은행", slug: "수협은행-계좌지급정지해제", aliases: ["수협은행", "SH수협은행", "SH수협", "수협"] },
  { name: "부산은행", slug: "부산은행-계좌지급정지해제", aliases: ["부산은행", "BNK부산은행"] },
  { name: "IM뱅크", slug: "im뱅크-계좌지급정지해제", aliases: ["IM뱅크", "아이엠뱅크", "대구은행", "DGB대구은행"] },
  { name: "광주은행", slug: "광주은행-계좌지급정지해제", aliases: ["광주은행"] },
  { name: "전북은행", slug: "전북은행-계좌지급정지해제", aliases: ["전북은행"] },
  { name: "경남은행", slug: "경남은행-계좌지급정지해제", aliases: ["경남은행", "BNK경남은행"] },
  { name: "제주은행", slug: "제주은행-계좌지급정지해제", aliases: ["제주은행"] },
  { name: "새마을금고", slug: "새마을금고-계좌지급정지해제-지급정지-사실-통지서", aliases: ["새마을금고"] },
];

function compact(value = "") {
  return String(value).replace(/[\s_-]+/g, "").toLowerCase();
}

export function recoveryBankForCase(item = {}) {
  const text = compact(`${item.caseName || ""} ${item.slug || ""}`);
  return RECOVERY_BANKS.find((bank) => bank.aliases.some((alias) => text.includes(compact(alias)))) || null;
}

export function recoveryRepresentativeSlug(item = {}) {
  return recoveryBankForCase(item)?.slug || "";
}

export function isRecoveryRepresentative(item = {}) {
  const representative = recoveryRepresentativeSlug(item);
  return Boolean(representative && item.slug === representative);
}

export function shouldConsolidateRecoveryCase(item = {}) {
  return ["recovery-manual", "jipjeong-manual"].includes(item.createdBy) && Boolean(recoveryRepresentativeSlug(item));
}
