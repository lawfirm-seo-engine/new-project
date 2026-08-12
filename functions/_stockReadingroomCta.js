export const STOCK_READINGROOM_CTA_URL = "https://gnlaw-criminal.co.kr/prosecute/jusigridingbang-litigation/";
export const STOCK_READINGROOM_CTA_TEXT = `주식리딩방 사기 피해를 입으셨다면 바로 확인해보세요 ${STOCK_READINGROOM_CTA_URL}`;

const STOCK_READINGROOM_CTA_CREATED_BY = new Set([
  "voicephishing-manual",
  "jipjeong-manual",
  "recovery-manual",
  "tujasagi-manual",
  "chaemubu-manual",
]);

export function appendStockReadingroomCta(body = []) {
  const items = normalizeBodyItems(body).filter((item) => !item.includes(STOCK_READINGROOM_CTA_URL));
  return [...items, STOCK_READINGROOM_CTA_TEXT];
}

export function shouldAppendStockReadingroomCta(item = {}) {
  const createdBy = String(item.createdBy || "").trim();
  if (STOCK_READINGROOM_CTA_CREATED_BY.has(createdBy)) return true;
  if (!createdBy) {
    const targetGroups = Array.isArray(item.targetGroups) ? item.targetGroups : [];
    return targetGroups.length === 0 || targetGroups.includes("a");
  }
  return false;
}

function normalizeBodyItems(body = []) {
  if (Array.isArray(body)) {
    return body.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const text = String(body || "").trim();
  if (!text) return [];
  return text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}
