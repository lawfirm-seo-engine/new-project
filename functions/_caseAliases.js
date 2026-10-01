export const CASE_SLUG_REDIRECTS = Object.freeze({
  "erriteupeuraim-peurojegteu": "erriteupeuraimpeurojegteu",
  "boxtk4-5": "boxtk-4-5",
  "mtzmax": "mtz-max",
  "김현유-대표": "gimhyeonyu-daepyo",
  "ideun-eses": "ideuneses-saching",
  "mogpyo-jihyangreo-moim": "mogpyojihyangreomoim",
  "chaeseongugyosu": "chaeseongu-gyosu-saching",
  "ganghannamaenijeo-saching": "ganghannamaenijeo",
  "gordeurokeukaepiteorgeurub-saching": "gordeurokeukaepiteorgeurub",
  "gordeumansagseukoria-saching": "gordeumansagseukoria",
  "gimjianmaenijeo-saching": "gimjianmaenijeo",
  "gimhyeonjungyosu-saching": "gimhyeonjungyosu",
  "gimhyerimaenijeo-saching": "gimhyerimaenijeo",
  "noseuseuta": "noseu-seuta",
  "rendeoworres-saching": "rendeoworres",
  "mericheukaepitarpateuneoseu-saching": "mericheukaepitarpateuneoseu",
  "miraedaesinjeunggwon-saching": "miraedaesinjeunggwon",
  "miraeeseskwonteusiseutem-saching": "miraeeseskwonteusiseutem",
  "miraejasankeurreobv62-saching": "miraejasankeurreobv62",
  "baropam-saching": "baropam",
  "baibaegpeurojegteu-saching": "baibaegpeurojegteu",
  "baeggeummakes-saching": "baeggeummakes",
  "ansimtemwon-saching": "ansimtemwon",
  "ogomakes-saching": "ogomakes",
  "oneuruiswimteo-saching": "oneuruiswimteo",
  "idohyeongyosu-saching": "idohyeongyosu",
  "isuyeonmaenijeo-saching": "isuyeonmaenijeo",
  "imteumakes-saching": "imteumakes",
  "je9gi-raijingerriteu-peurojegteu": "je9giraijingerriteupeurojegteu",
  "jeimakes-saching": "jeimakes",
  "juryeogdeiteureiding-saching": "juryeogdeiteureiding",
  "juhuichangyosu-saching": "juhuichangyosu",
  "jyukeumakes-saching": "jyukeumakes",
  "jinryangmakes-saching": "jinryangmakes",
  "tabseuta-jusiggeurub-h-10": "tabseutajusiggeurubh10",
  "tenmoamor-saching": "tenmoamor",
  "pandatem-saching": "pandatem",
  "peopeurregsitiro-saching": "peopeurregsitiro",
  "peongkipeurri-saching": "peongkipeurri",
  "한국산업은행-지급정지-법무법인선린-변호사": "한국산업은행-지급정지-법무법인-선린-변호사",
  "hongkonghangsengjisu": "hongkong-hangseng-jisu",
  "ansimtemone-com-saching": "ansimtemone-com",
  "apextrade-saching": "apextrade",
  "backgummarket-shop-saching": "backgummarket-shop",
  "baropam-net-saching": "baropam-net",
  "cjlogisticsaa-top-saching": "cjlogisticsaa-top",
  "hanypor-saching": "hanypor",
  "imtmarket-shop-saching": "imtmarket-shop",
  "jayeemarket-shop-saching": "jayeemarket-shop",
  "jinryangmarkets-shop-saching": "jinryangmarkets-shop",
  "jyoukemarket-shop-saching": "jyoukemarket-shop",
  "khinbeseuteumeonteu-saching": "khinbeseuteumeonteu",
  "khjeunggwon-saching": "khjeunggwon",
  "lumiamall": "lumia-mall",
  "mymeriment-com-saching": "mymeriment-com",
  "nextmall-saching": "nextmall",
  "ogo-market-com-saching": "ogo-market-com",
  "pandatem-com-saching": "pandatem-com",
  "sosintujageurub": "sosin-tujageurub",
  "tenmoamall-com-saching": "tenmoamall-com",
  "vipgijeogeurmandeuneuntaim-saching": "vipgijeogeurmandeuneuntaim",
  "woodpay-saching": "woodpay",
});

export function canonicalCaseSlug(slug = "") {
  let current = String(slug || "").trim();
  const seen = new Set();
  while (CASE_SLUG_REDIRECTS[current] && !seen.has(current)) {
    seen.add(current);
    current = CASE_SLUG_REDIRECTS[current];
  }
  return current;
}

export function isRedirectedCaseSlug(slug = "") {
  const clean = String(slug || "").trim();
  return Boolean(clean && canonicalCaseSlug(clean) !== clean);
}

export function duplicateCaseSlugsFor(slug = "") {
  const canonical = canonicalCaseSlug(slug);
  if (!canonical) return [];
  return Object.entries(CASE_SLUG_REDIRECTS)
    .filter(([, winner]) => canonicalCaseSlug(winner) === canonical)
    .map(([duplicate]) => duplicate);
}
