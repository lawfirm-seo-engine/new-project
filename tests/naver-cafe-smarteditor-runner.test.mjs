import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  articleBodyForJob,
  boardForJob,
  hasNaverSessionCookies,
  hasUnfinishedBatchJobs,
  jobVideoUrl,
  orderedJobImages,
  parseArgs,
  parseLinkedImageData,
} from "../tools/naver-cafe-smarteditor/cli.mjs";

test("SmartEditor runner parses publish and video options", () => {
  assert.deepEqual(
    parseArgs(["publish", "--job-id", "job-123", "--skip-video", "--yes"]),
    {
      command: "publish",
      options: { jobId: "job-123", skipVideo: true, yes: true },
    },
  );
});

test("SmartEditor runner maps jobs to the two Naver Cafe boards", () => {
  assert.deepEqual(boardForJob({ imageSetKey: "fraud" }), {
    menuId: "1",
    label: "사기피해진행사건정리",
  });
  assert.deepEqual(boardForJob({ fraudType: "payment-suspension-release" }), {
    menuId: "2",
    label: "계좌지급정지해제",
  });
});

test("SmartEditor runner sorts numbered images and keeps phone then Kakao last", () => {
  const images = orderedJobImages([
    { slot: "phone", url: "/phone.jpg" },
    { slot: "10", url: "/ten.jpg" },
    { slot: "02", url: "/two.jpg" },
    { slot: "kakao", url: "https://cdn.example/kakao.png" },
    { slot: "01", url: "/one.jpg" },
  ], "https://gnlaw-criminal.co.kr/");

  assert.deepEqual(images.map((image) => image.slot), ["01", "02", "10", "phone", "kakao"]);
  assert.equal(images[0].url, "https://gnlaw-criminal.co.kr/one.jpg");
  assert.equal(images[4].url, "https://cdn.example/kakao.png");
});

test("both Cafe image sets stay in filename order even when saved job data is shuffled", () => {
  const shuffledFraud = ["12", "03", "phone", "01", "11", "kakao", "02"]
    .map((slot) => ({ slot, url: `/assets/cafe-reels/fraud/${slot}.png` }));
  const shuffledPayment = ["10", "02", "kakao", "01", "09", "phone", "03"]
    .map((slot) => ({ slot, url: `/assets/cafe-reels/payment-suspension-release/${slot}.png` }));

  assert.deepEqual(
    orderedJobImages(shuffledFraud).map((image) => image.slot),
    ["01", "02", "03", "11", "12", "phone", "kakao"],
  );
  assert.deepEqual(
    orderedJobImages(shuffledPayment).map((image) => image.slot),
    ["01", "02", "03", "09", "10", "phone", "kakao"],
  );
});

test("legacy Instagram URL text is removed before SmartEditor creates a proper preview card", () => {
  const instagramPermalink = "https://www.instagram.com/reel/example/";
  assert.equal(articleBodyForJob({
    instagramPermalink,
    draft: { body: `첫 문단\n\nInstagram 릴스 영상\n${instagramPermalink}` },
  }), "첫 문단");
  assert.equal(articleBodyForJob({ draft: { body: "기존 본문" } }), "기존 본문");
});

test("desktop automation uses the Windows Chrome sandbox and opens the work screen", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /chromiumSandbox:\s*true/);
  assert.doesNotMatch(source, /["']--no-sandbox["']/);
  assert.match(source, /page\.goto\(`\$\{config\.siteOrigin\}\/admin\/cafe-reels`/);
  assert.match(source, /verifyLoginSessions\(context, monitorPage, config\)/);
  assert.match(source, /\[사전 확인\] 네이버 카페 로그인 확인 완료/);
  assert.match(source, /DEFAULT_CAFE_URL = "https:\/\/cafe\.naver\.com\/gnlawfintech"/);
  assert.match(source, /await naver\.goto\(config\.cafeUrl/);
  assert.match(source, /await page\.goto\(config\.cafeUrl/);
  assert.equal((source.match(/ca-fe\/cafes\/\$\{encodeURIComponent\(config\.clubId\)\}/g) || []).length, 1);
});

test("desktop automation pre-checks the persisted Naver login cookies", () => {
  assert.equal(hasNaverSessionCookies([{ name: "NID_AUT" }, { name: "NID_SES" }]), true);
  assert.equal(hasNaverSessionCookies([{ name: "NID_SES" }]), true);
  assert.equal(hasNaverSessionCookies([{ name: "NID_AUT" }]), true);
  assert.equal(hasNaverSessionCookies([]), false);
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /await restoreSessionState\(context, config\)/);
  assert.match(source, /context\.storageState\(\{ path: config\.sessionStatePath \}\)/);
  assert.match(source, /context\.addCookies\(cookies\)/);
  assert.match(source, /await page\.goto\(config\.cafeUrl[\s\S]*await assertSavedNaverSession\(context\)/);
});

test("a bulk batch waits for every case Reel before Cafe posting starts", () => {
  const queued = { id: "one", batchId: "batch-1", cafeStatus: "smarteditor-queued" };
  assert.equal(hasUnfinishedBatchJobs([
    queued,
    { id: "two", batchId: "batch-1", cafeStatus: "awaiting-reel" },
  ], queued), true);
  assert.equal(hasUnfinishedBatchJobs([
    queued,
    { id: "two", batchId: "batch-1", cafeStatus: "smarteditor-queued" },
  ], queued), false);
  assert.equal(hasUnfinishedBatchJobs([queued, { id: "other", batchId: "batch-2", cafeStatus: "awaiting-reel" }], queued), false);
});

test("desktop automation posts from the original work tab and never auto-selects Reel images", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /processJob\(context, config, job, options, monitorPage\)/);
  assert.doesNotMatch(source, /locator\("#localAssets"\)\.setInputFiles/);
  assert.doesNotMatch(source, /videoStatus === "render-queued"/);
  assert.doesNotMatch(source, /frameLocator\('iframe\[id\^="input_buffer"\]'\)/);
  assert.match(source, /locator\("p\.se-text-paragraph:visible"\)\.first\(\)/);
  assert.match(source, /page\.keyboard\.press\("Enter"\)/);
  assert.match(source, /split\(\/\\n\{2,\}\/\)/);
  assert.match(source, /paragraphs\[index\]/);
  assert.match(source, /카페 원고 본문 입력 검증 실패/);
  assert.match(source, /clearNaverDraftState\(page\)/);
  assert.match(source, /localStorage\.clear\(\)/);
  assert.match(source, /async function resetEditorForJob/);
  assert.match(source, /async function focusEditorParagraph/);
  assert.match(source, /page\.mouse\.click/);
  assert.match(source, /네이버가 복원한 이전 임시 원고를 초기화하지 못했습니다/);
  assert.match(source, /async function chooseImageFiles/);
  assert.match(source, /기본 이미지 파일 선택 실패 \(3회 재시도\)/);
  assert.match(source, /chooseIndividualPhotoMode\(page\)/);
  assert.match(source, /getByText\("개별사진", \{ exact: true \}\)\.last\(\)\.click\(\)/);
  assert.match(source, /await fillArticleTitle\(page, articleTitle\)/);
  assert.match(source, /await uploadVideo\(page, videoFile/);
  assert.match(source, /await insertInstagramReelPreview\(page, job\.instagramPermalink\)/);
  assert.doesNotMatch(source, /page\.keyboard\.insertText\("📌"\)/);
  assert.match(source, /page\.keyboard\.insertText\(url\.href\)/);
  assert.match(source, /typedUrl\.includes\(url\.href\)/);
  assert.match(source, /se-component\.se-oglink/);
  assert.match(source, /클릭 링크와 미리보기 카드 생성을 확인했습니다/);
  assert.match(source, /locator\("#video-uploader-wrap"\)/);
  assert.match(source, /button\[data-name="video"\]/);
  assert.match(source, /네이버 동영상 업로더를 열지 못했습니다/);
  assert.match(source, /button\.nvu_btn_append\.nvu_local/);
  assert.match(source, /async function chooseVideoFile/);
  assert.match(source, /attempt <= 3/);
  assert.match(source, /async function setFilesOnMatchingInput/);
  assert.match(source, /input\[type="file"\]/);
  assert.match(source, /릴스 영상 파일 선택 실패 \(3회 재시도\)/);
  assert.match(source, /getByText\("완료", \{ exact: true \}\)/);
  assert.match(source, /\/업로드 완료\/\.test\(uploaderText\)/);
  assert.match(source, /!\/업로드 진행중\|로딩중\/\.test\(uploaderText\)/);
  assert.match(source, /locator\("button:visible"\)\.filter/);
  assert.match(source, /await setImageLink\(page, phoneIndex, config\.phoneLink\)/);
  assert.match(source, /await setImageLink\(page, kakaoIndex, config\.kakaoLink\)/);
  assert.match(source, /verifyPublishedLinks\(page, \[config\.phoneLink, config\.kakaoLink\]\)/);
  assert.match(source, /if \(videoFile\) await verifyPublishedVideo\(page\)/);
  assert.match(source, /async function waitForPublishedArticleView/);
  assert.match(source, /articleIdFromNaverUrl/);
  assert.match(source, /\/gnlawfintech\\\/\(\\d\+\)/);
  assert.match(source, /async function canonicalCafeArticleUrl/);
});

test("SmartEditor accepts a board already selected by the menu URL", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /selectBoard\(page, board\)/);
  assert.match(source, /pathname\.includes\(`\/menus\/\$\{board\.menuId\}\/articles\/write`\)/);
  assert.match(source, /if \(!await empty\.isVisible\(\)\.catch\(\(\) => false\)\) return/);
  assert.doesNotMatch(source, /getByText\(boardLabel, \{ exact: true \}\)/);
});

test("Windows installer validates the packaged app and stops an old instance", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/windows/Install.cmd", import.meta.url), "utf8");
  assert.match(source, /app\\GNLAWSmartEditor\.exe/);
  assert.match(source, /taskkill\.exe \/F \/T \/IM GNLAWSmartEditor\.exe/);
});

test("SmartEditor runner resolves a saved Reels video URL", () => {
  assert.equal(
    jobVideoUrl({ videoUrl: "/media/reels.mp4" }, "https://gnlaw-criminal.co.kr"),
    "https://gnlaw-criminal.co.kr/media/reels.mp4",
  );
  assert.equal(jobVideoUrl({}, "https://gnlaw-criminal.co.kr"), "");
  assert.throws(
    () => jobVideoUrl({ videoUrl: "file:///C:/video.mp4" }),
    /HTTP 또는 HTTPS/,
  );
});

test("SmartEditor runner reads Naver linked-image metadata", () => {
  assert.deepEqual(
    parseLinkedImageData('{"id":"image-1","link":"https://example.test/","src":"https://img.test/a.jpg"}'),
    { id: "image-1", link: "https://example.test/", src: "https://img.test/a.jpg" },
  );
  assert.deepEqual(parseLinkedImageData("not-json"), { id: "", link: "", src: "" });
});
