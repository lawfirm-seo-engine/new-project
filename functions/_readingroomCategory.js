// 리딩방피해회수센터.kr(ld) 전용 4개 서브카테고리 — 신규 케이스에만 적용 (기존 데이터 소급 적용 안 함)
export const LD_CATEGORY_OPTIONS = [
  { key: "stock-reading", label: "주식리딩방사기" },
  { key: "coin-reading", label: "코인리딩방사기" },
  { key: "institution-impersonation", label: "증권사·투자사·플랫폼 사칭 사기" },
  { key: "hts-mts-app", label: "HTS·MTS·어플 사기" },
];

const LD_CATEGORY_KEY_SET = new Set(LD_CATEGORY_OPTIONS.map((item) => item.key));

export function ldCategoryLabel(key = "") {
  return LD_CATEGORY_OPTIONS.find((item) => item.key === key)?.label || "";
}

export function isValidLdCategoryKey(key = "") {
  return LD_CATEGORY_KEY_SET.has(String(key || "").trim());
}

// title/summary 텍스트를 보고 4개 카테고리 중 가장 그럴듯한 값을 추천한다.
// 우선순위: 코인 신호 > 증권사·투자사·플랫폼 사칭 신호 > HTS·MTS·어플 신호 > 기본값(주식리딩방사기)
export function classifyLdCategory(text = "") {
  const value = String(text || "").toLowerCase();
  const hasCoin = /(코인|가상자산|가상화폐|거래소|지갑|usdt|btc|eth|coin|token|wallet)/i.test(value);
  const hasInstitutionImpersonation = /(증권사|은행|자산운용사|거래소\s*사칭|플랫폼\s*사칭|기관\s*사칭|사칭)/i.test(value);
  const hasHtsMtsApp = /(hts|mts|어플|앱|application|프로그램\s*설치|플랫폼\s*설치)/i.test(value);

  if (hasCoin) return "coin-reading";
  if (hasInstitutionImpersonation) return "institution-impersonation";
  if (hasHtsMtsApp) return "hts-mts-app";
  return "stock-reading";
}
