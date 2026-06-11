import fs from "fs-extra";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const dataPath = path.join(root, "data", "cases.json");
const publicDir = path.join(root, "public");
const templatesDir = path.join(root, "templates");

const today = new Date().toISOString().slice(0, 10);

const ORGANIZATION = {
  "@type": "Organization",
  "@id": "https://gnlaw-criminal.co.kr/#organization",
  name: "법무법인 선린",
  url: "https://gnlaw-criminal.co.kr",
  logo: { "@type": "ImageObject", url: "https://gnlaw-criminal.co.kr/assets/logo.png" },
};

const crossLinks = [
  { key: "a", label: "형사고소", url: "https://gnlaw-criminal.co.kr", prefix: "prosecute" },
  { key: "b", label: "민사소송", url: "https://gnlaw-civil.co.kr", prefix: "civil" },
  { key: "c", label: "성공사례", url: "https://gnlaw-recovery.co.kr", prefix: "success" },
  { key: "d", label: "사건정보", url: "https://gnlaw-case.co.kr", prefix: "briefing" },
  { key: "e", label: "전체허브", url: "https://gnlaw-center.co.kr", prefix: "case" },
];

const INDEXNOW_KEY = "6f71f78a3dc940b9a3e1025bf8460d3c";

const groups = [
  {
    key: "a",
    outDir: path.join(root, "dist-a"),
    template: "group-a.html",
    siteUrl: "https://gnlaw-criminal.co.kr",
    pathPrefix: "prosecute",
    urlSlugSuffix: "litigation",
    bodyClass: "domain-a",
    siteName: "피해금 추적 법률센터",
    shortName: "형사고소 센터",
    label: "법률형",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수",
    ogType: "article",
    titleSuffix: "형사고소 및 법적 대응",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    ogSuffix: "형사고소 대응",
    hubTitle: "법무법인 선린 사기피해 형사 사건 접수 리스트",
    hubLead: "사기 의심 업체명과 접수 현황을 빠르게 확인하고, 동일 피해자가 모일 수 있도록 사건별 법적 대응 정보를 정리합니다.",
    tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수",
    tableTitle: "형사고소 진행 현황",
    naverVerification: "8ac581a40e5eda3767c63ce7d27c155ccc8ea98f",
  },
  {
    key: "b",
    outDir: path.join(root, "dist-b"),
    template: "group-b.html",
    siteUrl: "https://gnlaw-civil.co.kr",
    pathPrefix: "civil",
    urlSlugSuffix: "settlement",
    bodyClass: "domain-b",
    siteName: "민사 회수 전략실",
    shortName: "민사 회수",
    label: "민사형",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환",
    ogType: "article",
    titleSuffix: "민사소송 및 회수 절차",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    ogSuffix: "민사 회수 절차",
    hubTitle: "법무법인 선린 민사 소송 진행 사건 리스트",
    hubLead: "채권 보전과 손해배상 청구 관점에서 사건별 회수 가능성, 가압류 필요성, 합의 전략을 정리합니다.",
    tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의",
    tableTitle: "민사 소송 진행 현황",
    naverVerification: "4ebf5db77cc0b879b9f9f6c612d318bfe95026dc",
  },
  {
    key: "c",
    outDir: path.join(root, "dist-c"),
    template: "group-c.html",
    siteUrl: "https://gnlaw-recovery.co.kr",
    pathPrefix: "success",
    urlSlugSuffix: "result",
    bodyClass: "domain-c",
    siteName: "피해 회수 성공사례",
    shortName: "성공사례",
    label: "성공사례형",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수",
    ogType: "article",
    titleSuffix: "회수 성공사례 분석",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    ogSuffix: "회수 성공사례",
    hubTitle: "법무법인 선린 피해 회수 성공 사건 리스트",
    hubLead: "유사 사건의 대응 흐름과 회수율을 비교할 수 있도록 성공사례 중심으로 재구성한 사건 목록입니다.",
    tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의",
    tableTitle: "성공사례 진행 현황",
    naverVerification: "c6bcb9fcd45bfd0c4306d625e2484f60f7f96099",
  },
  {
    key: "d",
    outDir: path.join(root, "dist-d"),
    template: "group-d.html",
    siteUrl: "https://gnlaw-case.co.kr",
    pathPrefix: "briefing",
    urlSlugSuffix: "review",
    bodyClass: "domain-d",
    siteName: "피해 사건 정보",
    shortName: "사건 정보",
    label: "정보형",
    intent: "사건 개요 · 대응 방법 · 정보 요약",
    ogType: "article",
    titleSuffix: "사건 정보",
    descriptionSuffix: "사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    ogSuffix: "사건 정보",
    hubTitle: "법무법인 선린 피해 사건 정보 리스트",
    hubLead: "사건 개요와 피해 패턴을 브리핑 형식으로 정리해 대응 방법을 신속하게 파악합니다.",
    tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "정보 확인",
    tableTitle: "사건 접수 현황",
    naverVerification: "ed1dc8d413475000d33979ea7094c62feda2539c",
  },
  {
    key: "e",
    outDir: path.join(root, "dist-e"),
    template: "group-e.html",
    siteUrl: "https://gnlaw-center.co.kr",
    pathPrefix: "case",
    urlSlugSuffix: "issue",
    bodyClass: "domain-e",
    siteName: "사기피해 통합 허브",
    shortName: "전체 허브",
    label: "전체 허브형",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건",
    ogType: "website",
    titleSuffix: "전체 허브",
    descriptionSuffix: "전체 사건 허브에서 형사, 민사, 성공사례, 사건정보를 사건별로 연결합니다.",
    ogSuffix: "전체 허브",
    hubTitle: "법무법인 선린 사기피해 전체 사건 리스트",
    hubLead: "같은 사건을 형사고소, 민사소송, 성공사례, 정보 브리핑 관점으로 연결해 검색 의도별 진입 경로를 제공합니다.",
    tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인",
    tableTitle: "전체 사건 진행 현황",
    naverVerification: "11d695d7d711ce5e50abbe85ae49a60242a37e70",
  },
  // ── law-* 도메인 ────────────────────────────────────────────────────────────
  {
    key: "a",
    landingKey: "la",
    outDir: path.join(root, "dist-law-a"),
    template: "group-a.html",
    siteUrl: "https://금융사기대응센터.kr",
    pathPrefix: "criminal",
    urlSlugSuffix: "legal-action",
    bodyClass: "domain-a",
    siteName: "금융피해 대응센터",
    shortName: "금융피해 대응센터",
    label: "법률형",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수",
    ogType: "article",
    titleSuffix: "형사고소 및 법적 대응",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    ogSuffix: "형사고소 대응",
    hubTitle: "법무법인 선린 금융사기 형사 사건 접수 리스트",
    hubLead: "금융사기 피해자가 형사고소 절차를 빠르게 파악할 수 있도록 사건별 법적 대응 정보를 정리합니다.",
    tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수",
    tableTitle: "형사고소 진행 현황",
    naverVerification: "b7340a4493754bfb33fa4f961ed0185300848065",
  },
  {
    key: "b",
    landingKey: "lb",
    outDir: path.join(root, "dist-law-b"),
    template: "group-b.html",
    siteUrl: "https://금융피해대응센터.kr",
    pathPrefix: "litigation",
    urlSlugSuffix: "recovery",
    bodyClass: "domain-b",
    siteName: "피해금 회수 전략센터",
    shortName: "피해금 회수 전략센터",
    label: "민사형",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환",
    ogType: "article",
    titleSuffix: "민사소송 및 회수 절차",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    ogSuffix: "민사 회수 절차",
    hubTitle: "법무법인 선린 금융사기 민사 소송 진행 사건 리스트",
    hubLead: "피해금 회수를 위한 민사소송 전략과 가압류 가능성을 사건별로 분석합니다.",
    tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의",
    tableTitle: "민사 소송 진행 현황",
    naverVerification: "0f58d300335c22953300936a0eba29c7ddcef6f8",
  },
  {
    key: "c",
    landingKey: "lc",
    outDir: path.join(root, "dist-law-c"),
    template: "group-c.html",
    siteUrl: "https://사기피해구제센터.kr",
    pathPrefix: "results",
    urlSlugSuffix: "solution",
    bodyClass: "domain-c",
    siteName: "실제 회수 사례 아카이브",
    shortName: "실제 회수 사례 아카이브",
    label: "성공사례형",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수",
    ogType: "article",
    titleSuffix: "회수 성공사례 분석",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    ogSuffix: "회수 성공사례",
    hubTitle: "법무법인 선린 금융사기 피해 회수 성공 사건 리스트",
    hubLead: "실제 피해금 회수에 성공한 사례를 중심으로 대응 흐름과 회수율을 정리합니다.",
    tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의",
    tableTitle: "성공사례 진행 현황",
    naverVerification: "2c5bbb8ba945084619345dacd54228bca059390e",
  },
  {
    key: "d",
    landingKey: "ld",
    outDir: path.join(root, "dist-law-d"),
    template: "group-d.html",
    siteUrl: "https://리딩방피해회수센터.kr",
    pathPrefix: "insights",
    urlSlugSuffix: "report",
    bodyClass: "domain-d",
    siteName: "피해 구조 브리핑",
    shortName: "피해 구조 브리핑",
    label: "정보형",
    intent: "사건 개요 · 대응 방법 · 정보 요약",
    ogType: "article",
    titleSuffix: "사건 정보",
    descriptionSuffix: "사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    ogSuffix: "사건 정보",
    hubTitle: "법무법인 선린 금융사기 피해 사건 정보 리스트",
    hubLead: "사건 개요와 피해 패턴을 브리핑 형식으로 정리해 피해 구조와 대응 방법을 신속하게 파악합니다.",
    tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "정보 확인",
    tableTitle: "사건 접수 현황",
    naverVerification: "0db0c459d08dff08e7655a88835072c34790fb75",
  },
  {
    key: "e",
    landingKey: "le",
    outDir: path.join(root, "dist-law-e"),
    template: "group-e.html",
    siteUrl: "https://투자사기대응센터.kr",
    pathPrefix: "incidents",
    urlSlugSuffix: "incident",
    bodyClass: "domain-e",
    siteName: "금융피해 통합 허브",
    shortName: "금융피해 통합 허브",
    label: "전체 허브형",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건",
    ogType: "website",
    titleSuffix: "전체 허브",
    descriptionSuffix: "피해 대응 허브에서 형사, 민사, 성공사례, 사건정보를 사건별로 연결합니다.",
    ogSuffix: "전체 허브",
    hubTitle: "법무법인 선린 금융사기 전체 사건 리스트",
    hubLead: "피해 사건을 형사, 민사, 성공사례, 브리핑 관점으로 통합 연결합니다.",
    tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인",
    tableTitle: "전체 사건 진행 현황",
    naverVerification: "7a41010af8629be5dd500005a38019de76d1c226",
  },
];

const cases = await fs.readJson(dataPath);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceAllPlaceholders(template, data) {
  return Object.entries(data).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value ?? ""),
    template,
  );
}

function getLanding(caseItem, group) {
  const landingKey = group.landingKey || group.key;
  return caseItem.landings?.[landingKey] || createFallbackLanding(caseItem, group);
}

function makeFallbackFaq(groupKey) {
  const Q1_ANSWER = "상담을 통해 입금 계좌·대화 기록·플랫폼 화면·담당자 정보 등 증거를 분석하여 형사·민사 절차의 전략을 수립, 회수 가능성을 구체적으로 검토합니다. 증거의 양과 상대방 특정 가능 여부가 결과에 큰 영향을 미칩니다.";
  const Q3_ANSWER = "변호사 선임에서 후불은 불법이기에 후불이 가능하다는 곳은 변호사를 사칭하는 곳이며, 변호사가 아닌 사람의 법률 서비스 제공 또한 불법이기에 각종 전문가를 자칭하는 곳도 2차 사기 위험이 있으니 주의하시기 바랍니다.";

  const faqs = {
    a: [
      { question: "[피해금 회수] 피해금을 돌려받을 수 있나요?", answer: Q1_ANSWER },
      { question: "[형사 고소] 형사고소만으로 피해금이 돌아오나요?", answer: "형사고소는 중요한 첫 단계이지만, 수사 결과만으로 피해금이 자동 환급되지는 않습니다. 민사 손해배상 청구와 가압류 보전처분을 형사 절차와 병행해야 실질적인 회수 가능성이 높아집니다." },
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

function createFallbackLanding(caseItem, group) {
  const caseName = caseItem.caseName || caseItem.name;
  const landingKey = group.landingKey || group.key;
  const pageTitle = groupPageTitle(caseName, landingKey);
  const pageH1 = groupPageH1(caseName, landingKey);
  const dispName = normalizeCaseName(caseName);
  const slug = caseItem.slug;
  const NO_SUFFIX_SLUGS_FB = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
  const OLD_URL_FB_GEN = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };
  const isExceptFB = group.siteUrl === "https://gnlaw-criminal.co.kr" && NO_SUFFIX_SLUGS_FB.includes(slug);
  const oldSuffixFBGen = group.siteUrl === "https://gnlaw-criminal.co.kr" && OLD_URL_FB_GEN[slug];
  const fbSlugSuffix = isExceptFB ? "" : oldSuffixFBGen ? `-${oldSuffixFBGen}` : (group.urlSlugSuffix ? `-${group.urlSlugSuffix}` : "");
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${slug}${fbSlugSuffix}/`;
  const description = `${dispName} 관련 ${group.descriptionSuffix}`;
  const faq = makeFallbackFaq(landingKey);

  return {
    title: pageTitle,
    description,
    canonical,
    ogTitle: pageTitle,
    ogDescription: description,
    ogImage: `${group.siteUrl}/og/${slug}.png`,
    h1: pageH1,
    body: [
      caseItem.summary || `${dispName} 피해 구조와 대응 방법을 정리한 안내입니다.`,
      group.descriptionSuffix,
      "입금 내역, 대화 내용, 사이트 주소, 계정 정보는 삭제하지 않고 보존하는 것이 중요합니다.",
    ],
    victimCases: [
      "출금 또는 수익 실현을 조건으로 추가 입금을 요구받은 사례",
      "상담원 또는 담당자 사칭 계정으로 입금을 유도받은 사례",
      "화면상 잔액은 보이지만 실제 출금이 제한된 사례",
    ],
    faq,
    schema: createSchemaData({ title: pageTitle, description, canonical, faq, groupKey: landingKey, caseName, keywords: searchKeyword(caseName), caseItem }),
  };
}

function createSchemaData({ title, description, canonical, faq, groupKey = "a", caseName = "", keywords = "", caseItem = {} }) {
  const siteUrl = canonical.split("/").slice(0, 3).join("/");
  const articleType = groupKey === "d" ? "NewsArticle" : "Article";
  const publishedDate = caseItem.createdAt || today;
  const modifiedDate = caseItem.updatedAt || publishedDate;

  const webPage = {
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    name: title,
    description,
    url: canonical,
    inLanguage: "ko-KR",
    datePublished: publishedDate,
    dateModified: modifiedDate,
    breadcrumb: { "@id": `${canonical}#breadcrumb` },
    author: ORGANIZATION,
    ...(keywords ? { keywords } : {}),
  };

  const article = {
    "@type": articleType,
    "@id": `${canonical}#article`,
    headline: title,
    description,
    url: canonical,
    inLanguage: "ko-KR",
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: ORGANIZATION,
    publisher: ORGANIZATION,
    isPartOf: { "@id": `${canonical}#webpage` },
    ...(keywords ? { keywords } : {}),
  };

  if (groupKey === "d") {
    article.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "h2", ".article-block > p"],
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      webPage,
      article,
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: breadcrumbLabel(groupKey), item: canonical.split("/").slice(0, 4).join("/") + "/" },
          { "@type": "ListItem", position: 3, name: groupPageTitle(caseName, groupKey), item: canonical },
        ],
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

function createConsultForm(caseItem, group) {
  const cn = escapeHtml(normalizeCaseName(caseItem.caseName));
  const siteName = escapeHtml(group.siteName);
  return `<section class="article-block consult-form-section" id="consult">
  <h2>상담 접수</h2>
  <p>추가 입금 요구를 받았거나 출금이 막혔다면 지금 자료를 남겨주세요. 상담 접수 후 전화 또는 카톡으로 입금 내역, 대화 캡처, 계좌 정보를 확인해 초기 대응 방향을 안내합니다.</p>
  <form class="consult-form" id="consultForm">
    <input type="text" name="cname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="phone" placeholder="연락처 (010-xxxx-xxxx)" required autocomplete="tel">
    <input type="text" name="amount" placeholder="대략적인 피해금액" required>
    <button type="submit">상담 접수</button>
  </form>
  <p class="consult-msg" id="consultMsg"></p>
  <script>
    document.getElementById('consultForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = this.querySelector('button');
      var msg = document.getElementById('consultMsg');
      btn.disabled = true; btn.textContent = '접수 중...';
      msg.textContent = ''; msg.className = 'consult-msg';
      try {
        var res = await fetch('https://gnlaw-criminal.co.kr/api/submit-consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.cname.value, phone: this.phone.value, amount: this.amount.value, caseName: '${cn}', domain: '${siteName}' })
        });
        var data = await res.json();
        if (data.ok) { msg.textContent = '상담 접수가 완료되었습니다. 담당자가 연락드립니다.'; msg.className = 'consult-msg ok'; this.reset(); }
        else { msg.textContent = data.message || '접수 중 오류가 발생했습니다. 다시 시도해주세요.'; msg.className = 'consult-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
      } catch(err) { msg.textContent = err.message || '접수 중 오류가 발생했습니다. 다시 시도해주세요.'; msg.className = 'consult-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
    });
  </script>
</section>`;
}

function createLandingContent(landing, group, caseItem) {
  {
    const _keyword = escapeHtml(seoCaseKeyword(caseItem.caseName || caseItem.name || ""));
    const _form = createConsultForm(caseItem, group);
    const _widgets = createFloatingWidgets(caseItem, group);
    const _slug = escapeHtml(caseItem.slug);
    const _trackScript = `<script>(function(){fetch('/api/track-view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${_slug}'})}).catch(function(){});})();</script>`;
    const _memoSection = caseItem.memo
      ? `<section class="article-block memo-section"><h2>운영 안내</h2><p>${escapeHtml(caseItem.memo)}</p></section>`
      : "";
    const _rawCaseName = caseItem.caseName || caseItem.name || "";
    const _replacementContext = createReplacementContext(_rawCaseName);
    const _body = renderBodyForLanding(landing, group, caseItem).map((item) => reduceCaseNameText(item, _rawCaseName, false, _replacementContext));
    const _victimCases = renderVictimCasesForLanding(landing, group, caseItem, _replacementContext);
    const _faq = renderFaqForLanding(landing, group, caseItem);
    const _introBody = _body.slice(0, 3);
    const _methodBody = _body.slice(3, 8);

    return [
      createHeroCta(_rawCaseName),
      createAeoOverviewSection(caseItem, group.key),
      `<section class="article-block"><h2>${_keyword}란?</h2>${createConfirmedSignals(_rawCaseName)}${paragraphs(_introBody)}</section>`,
      `<section class="article-block"><h2>${_keyword} 수법</h2>${list(createScamMethodItems(_rawCaseName))}</section>`,
      `<section class="article-block"><h2>${_keyword} 피해 사례</h2>${list(_victimCases)}</section>`,
      `<section class="article-block"><h2>${_keyword} 대응 방법</h2>${paragraphs(_methodBody)}${createEvidenceCheckSection()}</section>`,
      `<section class="article-block faq" id="faq-list"><h2>${_keyword} FAQ</h2>${faqHtml(_faq, _rawCaseName)}</section>`,
      createLiveReceiptStatus(caseItem),
      _memoSection,
      _form,
      _widgets,
      _trackScript,
    ].filter(Boolean).join("\n");
  }

  const name = escapeHtml(primaryCaseKeyword(caseItem.caseName || caseItem.name || ""));
  const form = createConsultForm(caseItem, group);
  const widgets = createFloatingWidgets(caseItem, group);
  const slug = escapeHtml(caseItem.slug);
  const trackScript = `<script>(function(){fetch('/api/track-view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${slug}'})}).catch(function(){});})();</script>`;
  const memoSection = caseItem.memo
    ? `<section class="article-block memo-section"><h2>운영자 안내</h2><p>${escapeHtml(caseItem.memo)}</p></section>`
    : "";

  const rawCaseName = caseItem.caseName || caseItem.name || "";
  const body = renderBodyForLanding(landing, group, caseItem);
  const victimCases = renderVictimCasesForLanding(landing, group, caseItem);
  const faq = renderFaqForLanding(landing, group, caseItem);
  const liveStatus = createLiveReceiptStatus(caseItem);
  const evidenceCheck = createEvidenceCheckSection();
  const inlineCta = createInlineCta();

  if (group.key === "d") {
    return [
      `<section class="article-block brief-card"><h2>${name} 피해 구조</h2>${paragraphs(body)}</section>`,
      `<section class="article-block"><h2>구체적인 피해 유형</h2>${list(victimCases)}</section>`,
      evidenceCheck,
      inlineCta,
      `<section class="article-block faq"><h2>자주 묻는 질문 (FAQ)</h2>${faqHtml(faq, rawCaseName)}</section>`,
      liveStatus,
      createInlineCta("실시간 접수와 비슷한 정황이 있다면 추가 입금 전에 현재 자료부터 점검해 보세요."),
      memoSection,
      form,
      widgets,
      trackScript,
    ].filter(Boolean).join("\n");
  }

  return [
    `<section class="article-block"><p class="section-kicker">${escapeHtml(group.intent)}</p><h2>${name} 핵심 대응</h2>${paragraphs(body)}</section>`,
    `<section class="article-block"><h2>구체적인 피해 사례</h2>${list(victimCases)}</section>`,
    evidenceCheck,
    inlineCta,
    `<section class="article-block faq"><h2>FAQ</h2>${faqHtml(faq, rawCaseName)}</section>`,
    liveStatus,
    createInlineCta("실시간 접수와 비슷한 정황이 있다면 추가 입금 전에 현재 자료부터 점검해 보세요."),
    memoSection,
    form,
    widgets,
    trackScript,
  ].filter(Boolean).join("\n");
}

function createSeoDescription(description = "", caseName = "", key = "") {
  const primary = seoCaseKeyword(caseName);
  const desc = String(description || "").trim();
  const fallback = primary
    ? `${primary} 피해가 의심된다면 추가 입금을 중단하세요. 텔레그램 리딩방, 허위 수익 인증, 출금 지연, 세금·보증금 요구 정황을 기준으로 대응 방법과 피해금 회수 가능성을 점검합니다.`
    : "입금 내역, 대화 기록, 사이트 주소를 기준으로 사기 피해 정황과 대응 방법을 정리합니다.";
  if (!primary) return (desc || fallback).slice(0, 150);
  return (!desc || !desc.toLowerCase().includes(primary.toLowerCase()) ? fallback : desc).slice(0, 150);
}

function createHeroCta(caseName = "") {
  return `<div class="hero-cta">
    <p class="hero-cta-lead">입금 전 자료를 먼저 확인하세요.</p>
    <div>
      <a href="#consult" class="hero-cta-primary">상담<br>접수하기</a>
      <a href="tel:0263480406" class="hero-cta-secondary">추가 입금 전 문의<br>02-6348-0406</a>
    </div>
  </div>`;

  const keyword = escapeHtml(seoCaseKeyword(caseName));
  const lead = keyword ? `${keyword} 피해가 의심되나요?` : "사기 피해가 의심되나요?";
  return `<div class="hero-cta">
    <p class="hero-cta-lead">${lead}</p>
    <div>
      <a href="#consult" class="hero-cta-primary">상담<br>접수하기</a>
      <a href="tel:0263480406" class="hero-cta-secondary">추가 입금 전 문의<br>02-6348-0406</a>
    </div>
  </div>`;

  return `<div class="hero-cta">
    <p>출금 지연, 추가 입금 요구, 대화방 삭제 정황이 있다면 본문을 읽기 전에 현재 자료부터 점검하세요.</p>
    <div>
      <a href="#consult" class="hero-cta-primary">상담 접수하기</a>
      <a href="tel:0263480406" class="hero-cta-secondary">추가 입금 전 02-6348-0406 전화문의</a>
    </div>
  </div>`;
}

function createAeoOverviewSection(caseItem, key) {
  const keyword = escapeHtml(seoCaseKeyword(caseItem.caseName || caseItem.name || ""));
  const summary = createNeutralAeoSummary(caseItem.caseName || caseItem.name || "");
  return `<section class="aeo-summary" id="aeo-summary" aria-label="${keyword} 핵심 요약">
  <h2>${keyword} 핵심 요약</h2>
  <p>${withSentenceBreaks(summary)}</p>
</section>`;
}

function createNeutralAeoSummary(caseName = "") {
  const detail = secondaryCaseKeyword(caseName).replace(/\s*피해 대응\s*$/, "").trim();
  const channel = detail ? `${detail} 관련 ` : "";
  return `${channel}출금 지연, 추가 입금 요구, 허위 수익 인증, 담당자 연락 두절 정황이 있다면 입금 내역과 대화 기록을 먼저 보존해야 합니다. 상담 전에는 계좌 정보, 사이트 주소, 프로필 캡처를 시간 순서로 정리하는 것이 좋습니다.`;
}

function createConfirmedSignals(caseName) {
  return `<div class="confirmed-signals"><h3>확인된 피해 정황</h3>${list([
    "해당 명칭 또는 유사 명칭으로 실제 브랜드처럼 접근",
    "텔레그램·카카오톡·네이버밴드 등에서 허위 수익 인증과 투자 권유 반복",
    "초기에는 소액 수익 또는 출금 가능 화면을 보여준 뒤 고액 입금 유도",
    "출금 신청 후 세금·보증금·인증비·계정 해제비 명목의 추가 입금 요구",
    "담당자 계정 삭제, 대화방 폐쇄, 사이트 접속 차단 등 증거 소멸 정황",
  ])}</div>`;

  const keyword = escapeHtml(seoCaseKeyword(caseName));
  const items = [
    `${keyword} 또는 유사 명칭으로 전문 투자회사처럼 접근`,
    "텔레그램·카카오톡 리딩방에서 허위 수익 인증과 투자 권유 반복",
    "초기에는 소액 수익 또는 출금 가능 화면을 보여준 뒤 고액 입금 유도",
    "출금 신청 후 세금·보증금·인증비·계정 해제비 명목의 추가 입금 요구",
    "담당자 계정 삭제, 대화방 폐쇄, 사이트 접속 차단 등 증거 소멸 정황",
  ];
  return `<div class="confirmed-signals"><h3>확인된 피해 정황</h3>${list(items)}</div>`;
}

function createScamMethodItems(caseName) {
  return [
    "유명인·증권사·투자 리딩방 명칭을 사용해 정상 업체 또는 플랫폼처럼 신뢰를 형성합니다.",
    "단체 대화방에서 바람잡이 계정이 수익 인증, 출금 인증, 후기 메시지를 반복합니다.",
    "소액 입금 후 화면상 수익을 보여주고 VIP 등급, 단계별 프로젝트, 단기 고수익 명목으로 추가 입금을 요구합니다.",
    "출금 단계에서 세금, 보증금, 인증비, 계정 해제비를 먼저 내야 한다고 안내합니다.",
    "피해자가 항의하면 담당자를 바꾸거나 대화방을 닫고, 환불팀·복구팀을 사칭한 2차 연락으로 이어질 수 있습니다.",
  ];

  const keyword = seoCaseKeyword(caseName);
  return [
    `${keyword} 명칭을 사용해 정상 투자자문 또는 리딩 서비스처럼 신뢰를 형성합니다.`,
    "단체 대화방에서 바람잡이 계정이 수익 인증, 출금 인증, 후기 메시지를 반복합니다.",
    "소액 입금 후 화면상 수익을 보여주고 VIP 등급, 단계별 프로젝트, 단기 고수익 명목으로 추가 입금을 요구합니다.",
    "출금 단계에서 세금, 보증금, 인증비, 계정 해제비를 먼저 내야 한다고 안내합니다.",
    "피해자가 항의하면 담당자를 바꾸거나 대화방을 닫고, 환불팀·복구팀을 사칭한 2차 연락으로 이어질 수 있습니다.",
  ];
}

function renderBodyForLanding(landing, group, caseItem) {
  const compactName = primaryCaseKeyword(caseItem.caseName || caseItem.name || "");
  const original = Array.isArray(landing.body)
    ? landing.body.filter(Boolean).map((item) => String(item || ""))
    : [];
  const additions = {
    a: [
      `${compactName} 사건은 사기죄 형법 제347조의 기망, 착오, 처분행위, 재산상 이익 취득 구조를 기준으로 검토합니다. 상대방이 허위 수익이나 출금 가능성을 말해 입금을 유도했다면 고소장에는 그 대화와 송금 흐름을 함께 정리해야 합니다.`,
      `형사고소를 준비할 때는 입금증, 계좌번호, 예금주, 대화방 캡처, 사이트 주소, 담당자 프로필을 시간 순서로 묶는 것이 좋습니다. 상담 접수나 전화 문의 전에 이 자료를 모아두면 고소 가능성과 추가 조치 방향을 빠르게 확인할 수 있습니다.`,
    ],
    b: [
      `${compactName} 피해금 회수는 민사소송, 가압류, 손해배상청구, 부당이득반환소송을 함께 보아야 합니다. 상대방 계좌나 연계 법인이 확인되면 판결 전 재산을 묶어두는 보전처분 필요성부터 검토합니다.`,
      `가압류는 상대방이 자금을 옮기기 전에 집행 가능성을 확보하는 절차입니다. 손해배상과 부당이득반환 중 어떤 청구가 적절한지는 입금 경위, 기망 표현, 계약 형태, 상대방 특정 가능성에 따라 달라집니다.`,
    ],
    c: [
      `${compactName} 유사 성공사례에서는 지급정지 후 계좌 잔액 일부가 묶인 사례, 가압류 후 합의가 진행된 사례, 수사 과정에서 반환 협의가 열린 사례가 있었습니다. 다만 전액 회수나 동일 결과를 보장할 수는 없습니다.`,
      `성공사례를 볼 때는 결과보다 대응 순서를 비교해야 합니다. 입금 직후 증거를 보존하고 상담 접수로 자료를 정리한 사건은 계좌 추적, 형사고소, 민사 보전처분을 연결하기가 더 수월했습니다.`,
    ],
    d: [
      `${compactName} 사기 피해는 신뢰 형성, 소액 유도, 수익 화면 노출, 출금 제한, 추가 비용 요구 순서로 진행되는 경우가 많습니다. 이 흐름이 확인되면 추가 입금을 멈추고 증거를 먼저 보존해야 합니다.`,
      `수사기관 신고와 법률 상담은 별도 절차입니다. 신고는 형사 수사를 여는 행위이고, 상담은 현재 증거로 어떤 법적 대응이 가능한지 확인하는 과정입니다. 두 절차는 동시에 진행할 수 있습니다.`,
    ],
    e: [
      `${compactName} 전체 허브는 형사고소, 민사소송, 성공사례, AI 브리핑 정보를 균형 있게 연결합니다. 사건을 처음 확인한 사람은 전체 흐름을 보고, 급한 경우 전화나 카톡 상담으로 증거 상태를 먼저 점검할 수 있습니다.`,
      `같은 사건이라도 처벌을 원하면 형사형, 회수를 원하면 민사형, 유사 결과를 보고 싶으면 성공사례형, 구조를 파악하려면 브리핑형이 적합합니다. 전체 허브는 이 선택을 돕는 안내 페이지입니다.`,
    ],
  }[group.key] || [];

  return [...original, ...additions].slice(0, 9);
}

function renderVictimCasesForLanding(landing, group, caseItem, replacementContext) {
  const brand = secondaryCaseKeyword(caseItem.caseName || caseItem.name || "").replace(/\s*피해 대응$/, "") || "담당자";
  const original = Array.isArray(landing.victimCases)
    ? landing.victimCases.filter(Boolean).map((item) => reduceCaseNameText(item, caseItem.caseName || caseItem.name, false, replacementContext))
    : [];
  const additions = [
    `직장인 피해자가 카카오톡 오픈채팅방에서 수익 인증 화면을 보고 1차로 320만원을 보낸 뒤, 출금 직전 세금과 보증금 명목으로 추가 780만원을 요구받은 사례`,
    `자영업자가 유튜브 광고를 통해 가입한 뒤 ${brand} 관계자를 사칭한 담당자에게 안내를 받았고, 출금 신청 당일 계좌와 담당자 계정이 동시에 바뀐 사례`,
    `소액 수익금 18만원을 먼저 지급받아 안심한 뒤 투자금을 키웠으나, 환불 요청 후 피해금 회복팀이라는 계정이 다시 접근해 선입금 수수료를 요구한 2차 피해 사례`,
    `입금증, 계좌번호, 대화 캡처는 남아 있었지만 사이트가 폐쇄되어 상담 접수 단계에서 브라우저 기록과 문자 알림까지 다시 정리한 사례`,
    `여러 피해자가 같은 수취 계좌와 유사 URL을 확인해 형사고소 자료와 민사 가압류 가능성을 함께 검토한 사례`,
  ];
  return [...original, ...additions].slice(0, 5);
}

function renderFaqForLanding(landing, group, caseItem) {
  const base = normalizeCaseName(caseItem.caseName || caseItem.name || "").replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "").trim();
  const original = Array.isArray(landing.faq) ? landing.faq.filter((item) => item?.question && item?.answer) : [];
  const shared = [
    { question: "전화나 카톡 상담은 언제 이용하면 좋나요?", answer: "추가 입금 요구가 계속되거나 대화방 삭제가 예상되면 전화나 카톡 상담으로 먼저 증거 상태를 점검하는 것이 좋습니다. 상담 접수 전이라도 입금증, 계좌번호, 대화 캡처를 준비하면 초기 판단이 빨라집니다." },
    { question: "2차 피해를 막으려면 무엇을 조심해야 하나요?", answer: "피해금 회복팀, 환불 대행, 법무팀을 사칭해 선입금을 요구하는 연락을 조심해야 합니다. 기존 사건 자료를 넘기기 전 상대방 신원과 절차를 확인하고, 수수료 선입금 요구에는 응하지 않는 것이 안전합니다." },
  ];
  const additions = {
    a: [
      { question: "사기죄 형법 제347조 검토에는 어떤 자료가 필요한가요?", answer: "기망 표현, 입금 경위, 출금 제한 안내, 추가 비용 요구 메시지가 중요합니다. 상대방이 허위 사실로 착오를 일으키고 송금을 유도했다는 흐름을 계좌 자료와 함께 정리해야 합니다." },
      { question: "형사고소 전 상담 접수를 먼저 해도 되나요?", answer: "가능합니다. 상담 접수 단계에서 증거 목록과 고소장 구성 방향을 먼저 확인하면 빠진 자료를 미리 보완할 수 있습니다. 급하면 전화나 카톡 상담으로 현재 자료부터 점검할 수 있습니다." },
    ],
    b: [
      { question: "가압류와 민사소송은 어떤 순서로 보나요?", answer: "상대방 계좌나 재산 단서가 있으면 가압류 같은 보전처분을 먼저 검토하고, 이후 손해배상청구나 부당이득반환소송을 준비합니다. 재산이 이동되기 전에 판단하는 것이 중요합니다." },
      { question: "손해배상과 부당이득반환은 무엇이 다른가요?", answer: "손해배상은 불법행위로 발생한 손해를 청구하는 구조이고, 부당이득반환은 법률상 원인 없이 얻은 이익의 반환을 구하는 구조입니다. 사건 자료에 따라 함께 검토될 수 있습니다." },
    ],
    c: [
      { question: "어떤 성공사례를 참고해야 하나요?", answer: "지급정지 후 일부 회수, 가압류 후 합의, 수사 중 반환 협의처럼 절차가 구체적으로 이어진 사례를 참고해야 합니다. 결과만 보지 말고 증거 보존과 접수 시점을 비교하는 것이 좋습니다." },
      { question: "성공사례와 내 사건이 비슷한지 어떻게 확인하나요?", answer: "업체명보다 계좌, URL, 상담원 계정, 입금 명목, 출금 제한 방식이 더 중요합니다. 상담 접수 시 이 자료를 제시하면 유사 사례와 비교해 절차 방향을 검토할 수 있습니다." },
    ],
    d: [
      { question: "입금 직후 가장 먼저 해야 할 일은 무엇인가요?", answer: "추가 입금을 즉시 중단하고 대화방 캡처, 입금증, 계좌번호, 사이트 주소, 담당자 연락처를 삭제하지 않고 보존해야 합니다. 자료가 남아 있을수록 이후 형사·민사 절차에서 대응 가능성이 높아집니다." },
      { question: "추가 입금 요구를 받았는데 응해야 하나요?", answer: "세금, 보증금, 인증비, 해제비 명목의 추가 요구는 피해가 확산되는 핵심 패턴입니다. 출금을 조건으로 돈을 더 요구한다면 즉시 입금을 중단하고 해당 메시지를 캡처해 증거로 보존해야 합니다." },
    ],
    e: [
      { question: "전체 허브에서는 어떤 균형이 중요한가요?", answer: "형사고소, 민사 회수, 성공사례, 정보 브리핑을 한쪽으로 치우치지 않게 연결해야 합니다. 사용자가 자신의 목적에 맞는 페이지로 이동할 수 있도록 안내하는 것이 핵심입니다." },
      { question: "처음 방문자는 어디서 상담을 시작하면 좋나요?", answer: "사건 구조를 모르면 전체 허브에서 자료를 분류하고, 급한 추가 입금 요구가 있다면 전화 또는 카톡 상담으로 먼저 확인하는 것이 좋습니다. 이후 형사형이나 민사형으로 이동하면 됩니다." },
    ],
  }[group.key] || [];

  return [...original, ...additions, ...shared].slice(0, 7);
}

function createFloatingWidgets(caseItem, group) {
  const cn = escapeHtml(normalizeCaseName(caseItem.caseName));
  const siteName = escapeHtml(group.siteName);
  return `<div class="floating-contact">
  <a href="tel:02-6348-0406" class="float-btn phone">전화문의</a>
</div>
<div class="sticky-bar" id="stickyBar">
  <span class="sticky-title">추가 입금 전 긴급 점검 ｜ 02-6348-0406</span>
  <form class="sticky-form" id="stickyConsultForm">
    <input type="text" name="sname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="sphone" placeholder="연락처" required autocomplete="tel">
    <input type="text" name="samount" placeholder="대략적인 피해금액" required>
    <button type="submit">확인 요청</button>
  </form>
  <span id="stickyMsg" class="sticky-msg"></span>
</div>
<script>
  document.getElementById('stickyConsultForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = this.querySelector('button');
    var msg = document.getElementById('stickyMsg');
    btn.disabled = true; btn.textContent = '접수 중...';
    msg.textContent = ''; msg.className = 'sticky-msg';
    try {
      var res = await fetch('https://gnlaw-criminal.co.kr/api/submit-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.sname.value, phone: this.sphone.value, amount: this.samount.value, caseName: '${cn}', domain: '${siteName}' })
      });
      var data = await res.json();
      if (data.ok) { msg.textContent = '접수 완료!'; msg.className = 'sticky-msg ok'; this.reset(); btn.disabled = false; btn.textContent = '확인 요청'; }
      else { msg.textContent = data.message || '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '확인 요청'; }
    } catch(err) { msg.textContent = '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '확인 요청'; }
  });
</script>`
;}

function paragraphs(items = []) {
  return items.map((item) => `<p>${withSentenceBreaks(item)}</p>`).join("\n");
}

function list(items = []) {
  return `<ul>${items.map((item) => `<li>${withSentenceBreaks(item)}</li>`).join("\n")}</ul>`;
}

function reduceCaseNameTextLegacy(value, caseName, keepFirst = false) {
  let text = String(value || "");
  const names = caseNameVariants(caseName).sort((a, b) => b.length - a.length);
  const primary = primaryCaseKeyword(caseName);
  const replacements = ["해당 피해", "이 사안", "관련 정황", "피해 흐름", "접수 사례", "문제 상황"];
  let replacementIndex = 0;
  let used = false;
  names.forEach((name) => {
    if (!name) return;
    if (keepFirst && !used && primary) {
      text = text.replace(name, primary);
      used = true;
    }
    const replacement = keepFirst ? "해당 피해" : replacements[replacementIndex++ % replacements.length];
    text = text.split(name).join(replacement);
  });
  return cleanupRepeatedWords(text);
}

function cleanupRepeatedWords(value = "") {
  return String(value || "")
    .replace(/이\s*사건\s*사건/g, "이 사안")
    .replace(/해당\s*피해\s*피해/g, "해당 피해")
    .replace(/사칭\s*사칭/g, "사칭")
    .replace(/사기\s*사기/g, "사기")
    .replace(/피해\s*피해/g, "피해")
    .replace(/대응\s*대응/g, "대응")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const CASE_NAME_REPLACEMENTS = [
  "이 사건",
  "이 사안",
  "해당 피해",
  "관련 사실",
  "관련 내용",
  "관련 정보",
  "확인된 사실",
  "문제 상황",
  "피해 흐름",
  "접수 사례",
  "입금 경위",
  "상담 내용",
  "확인 자료",
  "피해 정리",
  "접수 내용",
  "대응 자료",
  "피해 내용",
  "확인 내용",
];

function createReplacementContext(seed = "") {
  const source = String(seed || "");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return { offset: hash % CASE_NAME_REPLACEMENTS.length, index: 0 };
}

function nextCaseReplacement(context) {
  if (!context) return CASE_NAME_REPLACEMENTS[0];
  const value = CASE_NAME_REPLACEMENTS[(context.offset + context.index) % CASE_NAME_REPLACEMENTS.length];
  context.index += 1;
  return value;
}

function reduceCaseNameText(value, caseName, keepFirst = false, replacementContext = null) {
  let text = String(value || "");
  const names = caseNameVariants(caseName).sort((a, b) => b.length - a.length);
  const primary = primaryCaseKeyword(caseName);
  let used = false;
  names.forEach((name) => {
    if (!name) return;
    if (keepFirst && !used && name === primary) {
      text = text.replace(name, primary);
      used = true;
    }
    text = text.split(name).join(nextCaseReplacement(replacementContext));
  });
  return cleanupRepeatedWords(text);
}

function cleanupRepeatedWordsLegacy(value = "") {
  return String(value || "")
    .replace(/이\s*사건\s*사건/g, "이 사안")
    .replace(/이\s*사안\s*사안/g, "이 사안")
    .replace(/해당\s*피해\s*피해/g, "해당 피해")
    .replace(/관련\s*정황\s*정황/g, "관련 사실")
    .replace(/관련\s*사실\s*사실/g, "관련 사실")
    .replace(/관련\s*내용\s*내용/g, "관련 내용")
    .replace(/관련\s*정보\s*정보/g, "관련 정보")
    .replace(/확인된\s*사실\s*사실/g, "확인된 사실")
    .replace(/문제\s*상황\s*상황/g, "문제 상황")
    .replace(/피해\s*흐름\s*흐름/g, "피해 흐름")
    .replace(/접수\s*사례\s*사례/g, "접수 사례")
    .replace(/사칭\s*사칭/g, "사칭")
    .replace(/사기\s*사기/g, "사기")
    .replace(/피해\s*피해/g, "피해")
    .replace(/대응\s*대응/g, "대응")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function faqHtml(items = [], caseName = "") {
  const names = caseNameVariants(caseName).filter(Boolean);
  return items.map((item, i) => {
    let q = item.question || "";
    const shouldKeepName = i < 3;
    q = cleanFaqQuestion(q, names, shouldKeepName ? caseName : "");
    if (shouldKeepName && caseName && !caseNameVariants(caseName).some((name) => q.includes(name))) {
      q = `[${caseName}] ` + q.replace(/^\[[^\]]*\]\s*/, "");
    }
    return `<details><summary>${escapeHtml(q)}</summary><p>${withSentenceBreaks(addFaqCta(item.answer))}</p></details>`;
  }).join("\n");
}

function createEvidenceCheckSection() {
  return `<section class="evidence-check">
  <p class="section-kicker">3분 증거 점검</p>
  <h3>상담 전 이것만 먼저 확인하세요</h3>
  <ul>
    <li>입금증, 계좌번호, 예금주가 남아 있는지 확인</li>
    <li>카카오톡·텔레그램 대화방과 담당자 프로필 캡처</li>
    <li>사이트 주소, 로그인 화면, 출금 제한 안내 저장</li>
    <li>세금·보증금·인증비 등 추가 입금 요구 메시지 보존</li>
  </ul>
</section>`;

  return `<section class="article-block evidence-check">
  <p class="section-kicker">3분 증거 점검</p>
  <h2>상담 전 이것만 먼저 확인하세요</h2>
  <ul>
    <li>입금증, 계좌번호, 예금주가 남아 있는지 확인</li>
    <li>카카오톡·텔레그램 대화방과 담당자 프로필 캡처</li>
    <li>사이트 주소, 로그인 화면, 출금 제한 안내 저장</li>
    <li>세금·보증금·인증비 등 추가 입금 요구 메시지 보존</li>
  </ul>
</section>`;
}

function createInlineCta(text = "비슷한 피해 흐름이 보인다면 추가 입금 전에 상담 접수로 현재 자료부터 확인하세요.") {
  return "";

  return `<aside class="inline-cta">
  <strong>추가 입금 전 긴급 점검</strong>
  <p>${escapeHtml(text)}</p>
  <div>
    <a href="#consult">상담 접수</a>
    <a href="tel:0263480406">전화 상담</a>
  </div>
</aside>`;
}

function addFaqCta(answer = "") {
  return String(answer || "");

  const text = String(answer || "");
  if (/상담 접수|카톡 상담|전화/.test(text)) return text;
  return `${text} 입금증과 대화 캡처가 있다면 상담 접수나 카톡 상담으로 먼저 자료 상태를 확인할 수 있습니다.`;
}

function withSentenceBreaks(value = "") {
  return escapeHtml(value).replace(/([.!?])\s+/g, "$1<br>");
}

function createReceiptBadge(caseItem) {
  const count = Number(caseItem.reports) > 0 ? Number(caseItem.reports) : seededInt(`${caseItem.slug}-reports`, 4, 34);
  return `<div class="receipt-badge" aria-label="상담 접수 현황"><span>상담 접수</span><strong>${count.toLocaleString("ko-KR")}</strong><span>건+</span><em id="rBadgeDate"></em></div><script>(function(){var d=new Date();document.getElementById('rBadgeDate').textContent='('+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+' 기준)';})();</script>`;
}

function createLiveReceiptStatus(caseItem) {
  const rows = createLiveReceiptRows(caseItem);
  const html = rows.map((row) => `<li><time>${row.date}</time><strong>${row.area}</strong><span>${row.text}</span></li>`).join("\n");
  return `<section class="article-block live-receipts" aria-label="실시간 접수 현황">
  <h2>실시간 접수 현황</h2>
  <div class="live-receipt-window">
    <ul class="live-receipt-track">${html}${html}</ul>
  </div>
</section>`;
}

function createLiveReceiptRows(caseItem) {
  const seed = String(caseItem.slug || caseItem.caseName || "case");
  const baseDate = parseDate(caseItem.createdAt || caseItem.updatedAt) || new Date();
  const areas = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "수원", "성남", "고양", "청주", "천안", "전주"];
  const messages = [
    "상담만 받아보고 싶어요",
    "아직 안 늦었을까요?",
    "다음주엔 환불이 된다는데요?",
    "출금하려면 세금을 먼저 내라고 합니다",
    "담당자가 계좌를 계속 바꿉니다",
    "카톡방이 갑자기 사라졌습니다",
    "입금증과 대화 캡처는 보관 중입니다",
    "추가 입금을 멈춰도 되는지 궁금합니다",
    "환불팀이라는 곳에서 다시 연락이 왔습니다",
    "가족에게 알리기 전에 확인하고 싶습니다",
  ];

  return Array.from({ length: 50 }, (_, index) => {
    const randKey = `${seed}-live-${index}`;
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - seededInt(`${randKey}-day`, 0, 7));
    const amount = seededInt(`${randKey}-amount`, 1600, 9800);
    const useMessage = index < 3 || seededInt(`${randKey}-type`, 0, 100) < 42;
    const text = useMessage
      ? messages[index < 3 ? index : seededInt(`${randKey}-message`, 0, messages.length - 1)]
      : `피해금액 ${amount.toLocaleString("ko-KR")}만원 상담 접수`;
    return {
      date: formatDate(date.toISOString().slice(0, 10)),
      area: areas[seededInt(`${randKey}-area`, 0, areas.length - 1)],
      text,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function caseNameVariants(caseName = "") {
  const normalized = normalizeCaseName(caseName);
  const base = baseCaseName(caseName);
  const primary = primaryCaseKeyword(caseName);
  return [...new Set([caseName, normalized, base, primary].map((v) => String(v || "").trim()).filter((v) => v.length > 1))];
}

function cleanFaqQuestion(question, names, keepName) {
  let q = String(question || "").replace(/^\[[^\]]*\]\s*/, "");
  if (!keepName) {
    names.forEach((name) => {
      q = q.split(name).join("").replace(/\s{2,}/g, " ").trim();
    });
    return q.replace(/^\s*[-:|·]\s*/, "").trim();
  }
  const kept = String(keepName || "").trim();
  let used = false;
  names.forEach((name) => {
    if (!q.includes(name)) return;
    if (!used && kept) {
      q = q.replace(name, kept);
      used = true;
    }
    q = q.split(name).join("");
  });
  return q.replace(/\s{2,}/g, " ").trim();
}

function seededInt(seed, min, max) {
  let hash = 2166136261;
  for (let i = 0; i < String(seed).length; i += 1) {
    hash ^= String(seed).charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return min + (Math.abs(hash) % (max - min + 1));
}

function parseDate(value) {
  const date = new Date(`${value || ""}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return String(value || "");
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function createHeadExtra({ landing, group, caseItem, isHub = false, keyword = "" }) {
  const slug = caseItem?.slug ? encodeURIComponent(caseItem.slug) : "";
  const links = [
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="NaverBot" content="All">`,
    `<meta name="Yeti" content="All">`,
    `<link rel="icon" type="image/x-icon" href="/assets/favicon.ico">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">`,
    ...(group.naverVerification ? [`<meta name="naver-site-verification" content="${group.naverVerification}">`] : []),
    `<meta name="theme-color" content="${themeColor(group.key)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(group.siteName)} RSS" href="/rss.xml">`,
    `<link rel="sitemap" type="application/xml" href="/sitemap-index.xml">`,
    `<link rel="preload" as="image" href="/assets/og-template.png">`,
  ];

  if (slug) {
    links.push(`<link rel="prefetch" href="https://gnlaw-center.co.kr/case/${slug}/">`);
    links.push(`<link rel="prefetch" href="${landing.ogImage}" as="image">`);
  }

  if (isHub) {
    links.push(`<meta name="classification" content="${escapeHtml(group.intent)}">`);
    links.push(`<meta property="og:updated_time" content="${today}">`);
    links.push(`<meta property="og:image:type" content="image/png">`);
    links.push(`<meta property="og:image:width" content="1200">`);
    links.push(`<meta property="og:image:height" content="630">`);
    links.push(`<meta property="og:image:alt" content="${escapeHtml(group.hubTitle)}">`);
    links.push(`<meta name="twitter:card" content="summary_large_image">`);
    links.push(`<meta name="twitter:image" content="${group.siteUrl}/assets/og-template.png">`);
    links.push(`<meta name="twitter:image:alt" content="${escapeHtml(group.hubTitle)}">`);
  } else {
    const publishedDate = caseItem?.createdAt || today;
    const modifiedDate = caseItem?.updatedAt || publishedDate;
    links.push(`<meta property="article:published_time" content="${publishedDate}T00:00:00+09:00">`);
    links.push(`<meta property="article:modified_time" content="${modifiedDate}T00:00:00+09:00">`);
    links.push(`<meta property="article:author" content="법무법인 선린">`);
    links.push(`<meta property="article:section" content="${escapeHtml(group.intent)}">`);
    links.push(`<meta name="author" content="법무법인 선린">`);
    if (keyword) links.push(`<meta name="keywords" content="${escapeHtml(keyword)}">`);
  }

  return links.join("\n  ");
}

function themeColor(key) {
  return {
    a: "#111827",
    b: "#173b57",
    c: "#174333",
    d: "#25314d",
    e: "#3b2f52",
  }[key];
}

function breadcrumbLabel(groupOrKey) {
  const key = typeof groupOrKey === "string" ? groupOrKey : (groupOrKey.landingKey || groupOrKey.key);
  return {
    a: "형사고소",
    b: "민사소송",
    c: "성공사례",
    d: "사건브리핑",
    e: "사건현황",
    la: "법적조치",
    lb: "피해회복",
    lc: "해결사례",
    ld: "피해정보",
    le: "진행현황",
  }[key] || "사건현황";
}

function createHtmlBreadcrumb(group, caseItem) {
  const caseName = caseItem.caseName || caseItem.name || "";
  const category = breadcrumbLabel(group);
  const current = groupPageTitle(caseName, group.landingKey || group.key);
  return `<nav class="breadcrumb" aria-label="breadcrumb">
    <a href="${group.siteUrl}/">홈</a>
    <a href="${group.siteUrl}/${group.pathPrefix}/">${escapeHtml(category)}</a>
    <strong>${escapeHtml(current)}</strong>
  </nav>`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const HUB_SUFFIX = { a: "형사고소", b: "민사소송", c: "성공사례", d: "사건정보", e: "진행현황" };

function createHubFloatingWidgets(group) {
  const sn = JSON.stringify(group.siteName);
  return `<div class="floating-contact">
  <a href="tel:02-6348-0406" class="float-btn phone">전화문의</a>
</div>
<div class="sticky-bar" id="stickyBar">
  <span class="sticky-title">추가 입금 전 긴급 점검 ｜ 02-6348-0406</span>
  <form class="sticky-form" id="stickyConsultForm">
    <input type="text" name="sname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="sphone" placeholder="연락처" required autocomplete="tel">
    <input type="text" name="samount" placeholder="대략적인 피해금액" required>
    <button type="submit">확인 요청</button>
  </form>
  <span id="stickyMsg" class="sticky-msg"></span>
</div>
<script>
  document.getElementById('stickyConsultForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = this.querySelector('button'); var msg = document.getElementById('stickyMsg');
    btn.disabled = true; btn.textContent = '접수 중...';
    msg.textContent = ''; msg.className = 'sticky-msg';
    try {
      var res = await fetch('https://gnlaw-criminal.co.kr/api/submit-consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.sname.value, phone: this.sphone.value, amount: this.samount.value, caseName: ${sn}, domain: ${sn} })
      });
      var data = await res.json();
      if (data.ok) { msg.textContent = '접수 완료!'; msg.className = 'sticky-msg ok'; this.reset(); btn.disabled = false; btn.textContent = '확인 요청'; }
      else { msg.textContent = data.message || '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '확인 요청'; }
    } catch(err) { msg.textContent = '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '확인 요청'; }
  });
</script>`;
}

function createHubContent(group) {
  // caseNoMap: slug → 1-based insertion order (position in original cases.json array)
  const caseNoMap = new Map(cases.map((c, i) => [c.slug, i + 1]));
  // Sort by insertion order descending: newest-added first (No.324 → No.1)
  const sortedCases = [...cases].reverse();
  const totalReports = cases.reduce((sum, c) => sum + (c.reports || 0), 0);
  const todayCases   = cases.filter((c) => c.createdAt === today).length;
  const todayReports = cases.filter((c) => c.createdAt === today).reduce((s, c) => s + (c.reports || 0), 0);
  const suffix = HUB_SUFFIX[group.key] || "";

  const rows = sortedCases
    .map((item) => {
      const caseName = escapeHtml(normalizeCaseName(item.caseName || item.name));
      const displayTitle = suffix ? `${caseName} ${suffix}` : caseName;
      const NO_SUFFIX_SLUGS_HUB = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
      const OLD_URL_HUB = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };
      const isExceptHub = group.siteUrl === "https://gnlaw-criminal.co.kr" && NO_SUFFIX_SLUGS_HUB.includes(item.slug);
      const oldSuffixHub = group.siteUrl === "https://gnlaw-criminal.co.kr" && OLD_URL_HUB[item.slug];
      const hubSlugSuffix = isExceptHub ? "" : oldSuffixHub ? `-${oldSuffixHub}` : (group.urlSlugSuffix ? `-${group.urlSlugSuffix}` : "");
      const url = `/${group.pathPrefix}/${encodeURIComponent(item.slug)}${hubSlugSuffix}/`;
      return `
        <a href="${url}" class="case-row" data-title="${caseName}" data-slug="${escapeHtml(item.slug)}">
          <span class="case-no">${caseNoMap.get(item.slug) ?? ""}</span>
          <span class="case-title-wrap">
            <strong class="case-title">${displayTitle}</strong>
            ${item.createdAt === today ? '<em class="today-badge">TODAY</em>' : ""}
          </span>
          <span class="case-status">${statusLabel(group.key, item.slug)}</span>
          <span class="case-date">${escapeHtml(item.updatedAt || item.createdAt || "")}</span>
          <span class="case-views">${(item.landingViews || 0).toLocaleString("ko-KR")}</span>
        </a>`;
    })
    .join("\n");

  // Inline dynamic-loader — fetches /api/get-cases and prepends any cases not already in the DOM.
  // Uses IIFE + vanilla JS only, no frameworks.
  const dynScript = `<script>
(function(){
  var PREFIX=${JSON.stringify(group.pathPrefix)};
  var SUFFIX=${JSON.stringify(suffix)};
  var URL_SUFFIX=${JSON.stringify(group.urlSlugSuffix || "")};
  var GKEY=${JSON.stringify(group.key)};
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function normName(n){var c=String(n||'').trim().replace(/\\s*(사칭\\s*사기|사칭|사기|탈출|스캠|scam)\\s*$/i,'').trim();return /사기/.test(c)?c+' 사칭':c+' 사칭 사기';}
  function seededH(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;}
  function getStatus(slug){if(GKEY==='c'){var h=seededH(slug+'-success-full');return(h%100)<25?'전액 회수':(seededH(slug+'-success-rate')%50+48)+'% 회수';}return{a:'형사 진행중',b:'민사 진행중',d:'사건 접수중',e:'사건 진행중'}[GKEY]||'진행중';}
  function setupSearch(){
    var inp=document.getElementById('case-search');
    if(!inp)return;
    var n=inp.cloneNode(true);inp.parentNode.replaceChild(n,inp);
    n.addEventListener('input',function(){
      var q=n.value.trim().toLowerCase();
      document.querySelectorAll('.case-row').forEach(function(r){r.style.display=r.dataset.title.toLowerCase().indexOf(q)>=0?'grid':'none';});
    });
  }
  setupSearch();
  fetch('https://gnlaw-criminal.co.kr/api/get-cases',{cache:'no-cache'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      if(!d||!d.ok||!Array.isArray(d.cases))return;
      var orig=d.cases;
      var noMap={};orig.forEach(function(c,i){noMap[c.slug]=i+1;});
      var all=orig.slice().reverse();
      var existing=new Set([].map.call(document.querySelectorAll('.case-row[data-slug]'),function(el){return el.dataset.slug;}));
      var newItems=all.filter(function(c){return!existing.has(c.slug);});
      if(!newItems.length)return;
      var total=orig.length;
      var hdr=document.querySelector('.case-table-header');
      if(!hdr)return;
      for(var i=newItems.length-1;i>=0;i--){
        var item=newItems[i];
        var cn=esc(normName(item.caseName||''));
        var dt=SUFFIX?cn+' '+SUFFIX:cn;
        var a=document.createElement('a');
        a.href='/'+PREFIX+'/'+encodeURIComponent(item.slug)+(URL_SUFFIX?'-'+URL_SUFFIX:'')+'/';
        a.className='case-row';a.dataset.title=cn;a.dataset.slug=item.slug;
        a.innerHTML='<span class="case-no">'+(noMap[item.slug]||total)+'</span>'
          +'<span class="case-title-wrap"><strong class="case-title">'+dt+'</strong><em class="today-badge">NEW</em></span>'
          +'<span class="case-status">'+esc(getStatus(item.slug))+'</span>'
          +'<span class="case-date">'+esc(item.updatedAt||item.createdAt||'')+'</span>'
          +'<span class="case-views">'+((item.landingViews||0).toLocaleString('ko-KR'))+'</span>';
        hdr.insertAdjacentElement('afterend',a);
      }
      var statEl=document.getElementById('statTotal');
      if(statEl)statEl.textContent=total.toLocaleString('ko-KR');
      var totalReps=all.reduce(function(s,c){return s+(c.reports||0);},0);
      var repEl=document.getElementById('statReports');
      if(repEl)repEl.textContent=totalReps.toLocaleString('ko-KR');
      var todayStr=new Date().toISOString().slice(0,10);
      var todayCnt=all.filter(function(c){return c.createdAt===todayStr;}).length;
      var todayRep=all.filter(function(c){return c.createdAt===todayStr;}).reduce(function(s,c){return s+(c.reports||0);},0);
      var tcEl=document.getElementById('statTodayCount');
      if(tcEl)tcEl.textContent='오늘 추가 +'+todayCnt;
      var trEl=document.getElementById('statTodayReports');
      if(trEl)trEl.textContent='오늘 추가 +'+todayRep;
      setupSearch();
    }).catch(function(){});
})();
</script>`;

  return `
    <section class="hub-stats-section">
      <div class="hub-stats">
        <div>
          <span>등록 사건</span>
          <strong id="statTotal">${cases.length.toLocaleString("ko-KR")}</strong>
          <em class="stat-today" id="statTodayCount">오늘 추가 +${todayCases}</em>
        </div>
        <div>
          <span>누적 접수</span>
          <strong id="statReports">${totalReports.toLocaleString("ko-KR")}</strong>
          <em class="stat-today" id="statTodayReports">오늘 추가 +${todayReports}</em>
        </div>
      </div>
    </section>
    <div class="case-search-wrap">
      <input id="case-search" type="search" class="case-search" placeholder="사기 업체명 또는 사건명 검색" autocomplete="off">
      <button class="search-btn" type="button">검색</button>
    </div>
    <section class="case-table-wrap" aria-label="${escapeHtml(group.tableTitle)}">
      <div class="case-table-title">
        <h2>${escapeHtml(group.tableTitle)}</h2>
        <p class="case-table-lead">${escapeHtml(group.hubLead)}</p>
      </div>
      <div class="case-table-header"><span>No.</span><span>사건명</span><span>상태</span><span>등록일</span><span>조회수</span></div>
      ${rows}
    </section>
    ${dynScript}`;
}

function normalizeCaseName(name) {
  let clean = String(name || "").trim();
  // Strip any trailing canonical suffix to get the base
  clean = clean.replace(/\s*(?:사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  // If "사기" already appears in the base, just add "사칭" (avoid "X 사기 Y 사칭 사기")
  return /사기/.test(clean) ? `${clean} 사칭` : `${clean} 사칭 사기`;
}

function baseCaseName(name) {
  return String(name || "")
    .trim()
    .replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "")
    .trim();
}

function primaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const match = clean.match(/^(.+?사기)(?:\s+.+)?$/i);
  return (match ? match[1] : clean).trim();
}

function secondaryCaseKeyword(name) {
  const clean = baseCaseName(name);
  const primary = primaryCaseKeyword(name);
  let tail = clean.slice(primary.length).trim();
  tail = tail.replace(/db증권/ig, "DB증권");
  if (!tail) return "";
  return /사칭|피해/.test(tail) ? `${tail} 피해 대응` : `${tail} 사칭 피해 대응`;
}

function groupPageTitle(name, groupKey) {
  {
    const base = seoCaseKeyword(name);
    const suffixes = {
      a: "피해 형사고소",
      b: "피해금 회수 민사소송",
      c: "피해 사례와 회수 가능성",
      d: "수법 분석과 대응 방법",
      e: "피해 사건 정보",
      la: "피해 법적 대응",
      lb: "피해금 회수 전략",
      lc: "실제 회수 가능성",
      ld: "수법 분석 리포트",
      le: "피해 대응 가이드",
    };
    return joinSeoPhrase(base, suffixes[groupKey] || "피해 형사고소");
  }

  const base = seoCaseKeyword(name);
  const suffixes = {
    a: "사칭 피해 대응 | 리딩방 투자사기 형사고소·피해금 회수",
    b: "사칭 피해 대응 | 민사소송·가압류·손해배상",
    c: "사칭 피해 사례 | 회수 가능성·대응 흐름",
    d: "사기 수법 분석 | 피해 대응 방법·증거 보존",
    e: "사기 피해 허브 | 수법·사례·대응 방법",
    la: "사칭 피해 대응 | 금융피해 형사고소·계좌 추적",
    lb: "피해금 회수 전략 | 가압류·부당이득반환",
    lc: "실제 회수 사례 | 금융사기 피해 대응",
    ld: "사기 수법 분석 | AI 금융사기 브리핑",
    le: "금융사기 피해 허브 | 수법·사례·대응 방법",
  };
  return `${base} ${suffixes[groupKey] || "사칭 피해 대응"}`;
}

function groupPageH1(name, groupKey) {
  return groupPageTitle(name, groupKey);

  const base = seoCaseKeyword(name);
  const suffixes = {
    a: "사칭, 리딩방 투자 피해 대응",
    b: "사칭, 피해금 회수와 민사 대응",
    c: "사칭, 피해 사례와 회수 가능성",
    d: "사칭, 수법과 대응 방법",
    e: "사칭, 피해 대응 종합 안내",
    la: "사칭, 금융피해 형사 대응",
    lb: "사칭, 피해금 회수 전략",
    lc: "사칭, 실제 회수 사례",
    ld: "사칭, 금융사기 수법 분석",
    le: "사칭, 금융피해 통합 안내",
  };
  return `${base} ${suffixes[groupKey] || "사칭 피해 대응"}`;
}

function seoCaseKeyword(name) {
  const base = primaryCaseKeyword(name) || normalizeCaseName(name);
  return String(base || "").replace(/[A-Za-z][A-Za-z0-9 .&_-]*/g, (part) => part.toUpperCase()).trim();
}

function joinSeoPhrase(base = "", suffix = "") {
  const left = String(base || "").trim();
  let right = String(suffix || "").trim();
  if (!left) return right;
  ["사칭", "사기", "피해", "대응"].forEach((word) => {
    const duplicate = `${word} ${word}`;
    while (`${left} ${right}`.includes(duplicate)) {
      right = right.replace(new RegExp(`^${word}\\s+`), "");
    }
  });
  return `${left} ${right}`.replace(/\s+/g, " ").trim();
}

function searchKeyword(name) {
  const base = primaryCaseKeyword(name);
  const secondary = secondaryCaseKeyword(name).replace(/\s*피해 대응$/, "");
  const secondaryExtra = secondary && !/사칭$/.test(secondary.trim()) ? `${secondary} 사칭` : "";
  return [base, `${base} 피해`, secondary, secondaryExtra].filter(Boolean).join(", ");
}

function statusLabel(key, seed = key) {
  if (key === "c") {
    return seededInt(`${seed}-success-full`, 1, 100) <= 25
      ? "전액 회수"
      : `${seededInt(`${seed}-success-rate`, 48, 97)}% 회수`;
  }
  return { a: "형사 진행중", b: "민사 진행중", d: "사건 접수중", e: "사건 진행중" }[key] || "진행중";
}

function buildPage(template, group, data) {
  return replaceAllPlaceholders(template, {
    bodyClass: group.bodyClass,
    siteName: escapeHtml(group.siteName),
    shortName: escapeHtml(group.shortName),
    intent: escapeHtml(group.intent),
    tone: escapeHtml(group.tone),
    footerLinks: createFooterLinks(group),
    ctaTitle: escapeHtml(group.ctaTitle),
    ctaText: escapeHtml(group.ctaText),
    ctaLabel: escapeHtml(group.ctaLabel),
    receiptBadge: "",
    breadcrumb: "",
    ogType: group.ogType,
    ...data,
  });
}

function createFooterLinks(group) {
  return crossLinks
    .map((link) => {
      const active = link.key === group.key ? "is-active" : "";
      return `<a class="${active}" href="${link.url}/">${escapeHtml(link.label)}</a>`;
    })
    .join("\n");
}

for (const group of groups) {
  const template = await fs.readFile(path.join(templatesDir, group.template), "utf8");

  await fs.emptyDir(group.outDir);

  if (await fs.pathExists(publicDir)) {
    await fs.copy(publicDir, path.join(group.outDir, "assets"));

    // og-template.png → og-template.webp 1회 변환 (빌드 타임, 파일 1개)
    const pngSrc = path.join(group.outDir, "assets", "og-template.png");
    const webpDest = path.join(group.outDir, "assets", "og-template.webp");
    if (await fs.pathExists(pngSrc) && !(await fs.pathExists(webpDest))) {
      await sharp(pngSrc).webp({ quality: 85 }).toFile(webpDest);
    }
  }

  if (group.key === "a") {
    await fs.copy(path.join(root, "admin"), path.join(root, "dist-a", "admin"));
  }

  const hubTitle = group.hubTitle;
  const hubDescription = group.hubLead;
  const hubHtml = buildPage(template, group, {
    title: escapeHtml(hubTitle),
    description: escapeHtml(hubDescription),
    canonical: `${group.siteUrl}/`,
    ogTitle: escapeHtml(hubTitle),
    ogDescription: escapeHtml(hubDescription),
    ogImage: `${group.siteUrl}/assets/og-template.png`,
    headExtra: createHeadExtra({ group, isHub: true }),
    schema: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: hubTitle,
          url: `${group.siteUrl}/`,
          inLanguage: "ko-KR",
          description: hubDescription,
          dateModified: today,
          publisher: ORGANIZATION,
        },
        ORGANIZATION,
      ],
    }),
    h1: escapeHtml(hubTitle),
    ogThumbnail: "",
    summary: "",
    content: createHubContent(group),
    headerCall: "",
    floatingWidgets: createHubFloatingWidgets(group),
    pageKind: "hub-page",
  });

  await fs.outputFile(path.join(group.outDir, "index.html"), hubHtml);

  // NOTE: Individual case landing pages are now served dynamically by functions/[[path]].js
  // Static HTML generation for case pages has been removed (KV architecture).
  // The sitemap still lists all case URLs so Naver can discover them.

  const NO_SUFFIX_SLUGS_SITEMAP = ["soiraeb-sagi-syopingmor", "grucompany-sagi-syopingmor", "geuruaenkeompeoni-sagi-syopingmor"];
  const urls = [
    { loc: `${group.siteUrl}/`, lastmod: today, priority: "0.3" },
    ...cases.map((item) => {
      const OLD_URL_SITEMAP = { "mediacastlekr-com-sagi-tikesyemae-bueob": "prosecute" };
      const isExcept = group.siteUrl === "https://gnlaw-criminal.co.kr" && NO_SUFFIX_SLUGS_SITEMAP.includes(item.slug);
      const oldSuffixSitemap = group.siteUrl === "https://gnlaw-criminal.co.kr" && OLD_URL_SITEMAP[item.slug];
      const slugSuffix = isExcept ? "" : oldSuffixSitemap ? `-${oldSuffixSitemap}` : (group.urlSlugSuffix ? `-${group.urlSlugSuffix}` : "");
      return {
        loc: `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(item.slug)}${slugSuffix}/`,
        lastmod: item.updatedAt || item.createdAt || today,
        priority: "0.9",
      };
    }),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((item) => `  <url><loc>${item.loc}</loc><lastmod>${item.lastmod}</lastmod><changefreq>daily</changefreq><priority>${item.priority}</priority></url>`).join("\n")}
</urlset>`;

  await fs.outputFile(path.join(group.outDir, "sitemap.xml"), sitemap);

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${group.siteUrl}/sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
</sitemapindex>`;

  await fs.outputFile(path.join(group.outDir, "sitemap-index.xml"), sitemapIndex);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(group.siteName)} - ${escapeHtml(group.label)}</title>
    <link>${group.siteUrl}/</link>
    <description>${escapeHtml(group.descriptionSuffix)}</description>
    ${cases.map((item) => {
      const landing = getLanding(item, group);
      const rssTitle = landing.title || groupPageTitle(item.caseName, group.landingKey || group.key);
      return `
    <item>
      <title>${escapeHtml(rssTitle)}</title>
      <link>${landing.canonical}</link>
      <description>${escapeHtml(landing.description)}</description>
      <pubDate>${new Date(`${item.updatedAt || lastmod}T00:00:00+09:00`).toUTCString()}</pubDate>
    </item>`;
    }).join("")}
  </channel>
</rss>`;

  await fs.outputFile(path.join(group.outDir, "rss.xml"), rss);

  await fs.outputFile(path.join(group.outDir, "robots.txt"), `User-agent: *
Allow: /
Sitemap: ${group.siteUrl}/sitemap-index.xml
Sitemap: ${group.siteUrl}/sitemap.xml
`);

  await fs.outputFile(path.join(group.outDir, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);

  console.log(`[OK] generated ${cases.length} pages in dist-${group.key}/`);
}

console.log("[OK] generated all group landing pages");
