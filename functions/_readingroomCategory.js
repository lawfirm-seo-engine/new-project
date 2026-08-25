// 리딩방피해회수센터.kr(ld) 전용 서브카테고리.
// 기존 키는 보존하고, 검색 의도가 분명한 공모주/AI/법적대응 허브를 추가한다.
export const LD_CATEGORY_OPTIONS = [
  { key: "stock-reading", label: "주식리딩방사기" },
  { key: "coin-reading", label: "코인리딩방사기" },
  { key: "institution-impersonation", label: "증권사·투자사·플랫폼 사칭 사기" },
  { key: "hts-mts-app", label: "HTS·MTS·어플 사기" },
  { key: "ipo-reading", label: "공모주 리딩방 사기" },
  { key: "ai-auto-trading", label: "AI 자동매매 사기" },
  { key: "legal-response", label: "주식리딩방 피해 대응" },
];

export const LD_CAROUSEL_ITEMS = [
  {
    key: "hts-mts-app",
    label: "가짜 HTS·MTS 사기",
    description: "허위 거래 화면과 조작된 수익을 보여준 뒤 출금을 막는 수법",
    image: "/assets/readingroom-carousel/fake-hts-mts.webp",
  },
  {
    key: "ipo-reading",
    label: "공모주 리딩방 사기",
    description: "기관 물량과 특별배정을 내세워 청약금·예치금을 요구하는 수법",
    image: "/assets/readingroom-carousel/ipo-reading-room.webp",
  },
  {
    key: "institution-impersonation",
    label: "증권사·전문가 사칭",
    description: "금융회사 임직원·교수·전문가의 명칭과 신분을 도용하는 수법",
    image: "/assets/readingroom-carousel/institution-impersonation.webp",
  },
  {
    key: "ai-auto-trading",
    label: "AI 자동매매 사기",
    description: "알고리즘과 자동매매 수익을 내세워 투자금 증액을 유도하는 수법",
    image: "/assets/readingroom-carousel/ai-auto-trading.webp",
  },
  {
    key: "coin-reading",
    label: "코인 리딩방 사기",
    description: "가짜 거래소·지갑 화면을 이용해 출금 비용을 추가 요구하는 수법",
    image: "/assets/readingroom-carousel/coin-reading-room.webp",
  },
  {
    key: "legal-response",
    label: "주식리딩방 피해 대응",
    description: "입금·대화·거래 화면을 보존하고 민형사 절차를 검토하는 방법",
    image: "/assets/readingroom-carousel/legal-response.webp",
  },
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
  const hasIpo = /(공모주|ipo|특별\s*배정|기관\s*물량|청약)/i.test(value);
  const hasAiAutoTrading = /(ai|인공지능|자동\s*매매|알고리즘|로보\s*어드바이저)/i.test(value);
  const hasInstitutionImpersonation = /(증권사|은행|자산운용사|거래소\s*사칭|플랫폼\s*사칭|기관\s*사칭|사칭)/i.test(value);
  const hasHtsMtsApp = /(hts|mts|어플|앱|application|프로그램\s*설치|플랫폼\s*설치)/i.test(value);

  if (hasCoin) return "coin-reading";
  if (hasIpo) return "ipo-reading";
  if (hasAiAutoTrading) return "ai-auto-trading";
  if (hasHtsMtsApp) return "hts-mts-app";
  if (hasInstitutionImpersonation) return "institution-impersonation";
  return "stock-reading";
}
