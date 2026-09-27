import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  articleBodyForJob,
  articleBodyPartsForJob,
  boardForJob,
  hasNaverSessionCookies,
  isBrowserClosedError,
  isTransientNetworkError,
  jobVideoUrl,
  manuscriptBatches,
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

test("SmartEditor runner follows the original fraud image-set order", () => {
  const images = orderedJobImages([
    { slot: "phone", url: "/phone.jpg" },
    { slot: "10", url: "/ten.jpg" },
    { slot: "02", url: "/two.jpg" },
    { slot: "kakao", url: "https://cdn.example/kakao.png" },
    { slot: "01", url: "/one.jpg" },
  ], "https://gnlaw-criminal.co.kr/");

  assert.deepEqual(images.map((image) => image.slot), ["01", "02", "10", "kakao", "phone"]);
  assert.equal(images[0].url, "https://gnlaw-criminal.co.kr/one.jpg");
  assert.equal(images[3].url, "https://cdn.example/kakao.png");
});

test("both Cafe image sets stay in filename order even when saved job data is shuffled", () => {
  const shuffledFraud = ["12", "03", "phone", "01", "11", "kakao", "02"]
    .map((slot) => ({ slot, url: `/assets/cafe-reels/fraud/${slot}.png` }));
  const shuffledPayment = ["10", "02", "kakao", "01", "09", "phone", "03"]
    .map((slot) => ({ slot, url: `/assets/cafe-reels/payment-suspension-release/${slot}.png` }));

  assert.deepEqual(
    orderedJobImages(shuffledFraud).map((image) => image.slot),
    ["01", "02", "03", "11", "12", "kakao", "phone"],
  );
  assert.deepEqual(
    orderedJobImages(shuffledPayment).map((image) => image.slot),
    ["01", "02", "03", "09", "10", "kakao", "phone"],
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

test("Cafe manuscript stays before landing links", () => {
  assert.deepEqual(articleBodyPartsForJob({
    draft: {
      body: "첫 문단\n\n둘째 문단\n\n관련 랜딩페이지\nhttps://gnlaw-recovery.co.kr/success/example/",
    },
  }), {
    manuscript: "첫 문단\n\n둘째 문단",
    links: "관련 랜딩페이지\nhttps://gnlaw-recovery.co.kr/success/example/",
  });
});

test("Cafe manuscripts are separated into paragraph-sized batches", () => {
  const batches = manuscriptBatches([
    "첫 문단 ".repeat(100),
    "둘째 문단 ".repeat(100),
    "셋째 문단 ".repeat(100),
  ].join("\n\n"));
  assert.equal(batches.length, 3);
  assert.match(batches[0], /^첫 문단/);
  assert.match(batches[2], /^셋째 문단/);
  assert.deepEqual(manuscriptBatches("첫 문단\n\n둘째 문단"), ["첫 문단", "둘째 문단"]);
});

test("desktop automation uses the Windows Chrome sandbox and opens the work screen", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /chromiumSandbox:\s*true/);
  assert.doesNotMatch(source, /["']--no-sandbox["']/);
  assert.match(source, /page\.goto\(`\$\{config\.siteOrigin\}\/admin\/cafe-reels`/);
  assert.match(source, /verifyLoginSessions\(context, monitorPage, apiContext, config\)/);
  assert.match(source, /\[사전 확인\] 네이버 카페 로그인 확인 완료/);
  assert.match(source, /DEFAULT_CAFE_URL = "https:\/\/cafe\.naver\.com\/gnlawfintech"/);
  assert.match(source, /await naver\.goto\(config\.cafeUrl/);
  assert.match(source, /await page\.goto\(config\.cafeUrl/);
  assert.equal((source.match(/ca-fe\/cafes\/\$\{encodeURIComponent\(config\.clubId\)\}/g) || []).length, 2);
  assert.match(source, /articles\/\$\{editArticleId\}\/modify/);
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

test("desktop automation posts from the original work tab and never auto-selects Reel images", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /processJob\(context, apiContext, config, job, options, monitorPage\)/);
  assert.doesNotMatch(source, /locator\("#localAssets"\)\.setInputFiles/);
  assert.doesNotMatch(source, /videoStatus === "render-queued"/);
  assert.doesNotMatch(source, /frameLocator\('iframe\[id\^="input_buffer"\]'\)/);
  assert.match(source, /locator\("p\.se-text-paragraph:visible"\)\.first\(\)/);
  assert.match(source, /page\.keyboard\.press\("Enter"\)/);
  assert.match(source, /split\(\/\\n\{2,\}\/\)/);
  assert.match(source, /manuscriptBatches\(normalizedContent\)/);
  assert.match(source, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(source, /page\.keyboard\.press\("Control\+V"\)/);
  assert.match(source, /page\.keyboard\.insertText\(normalizedContent\)/);
  assert.match(source, /p\.se-text-paragraph:visible/);
  assert.match(source, /a\[href\]:visible/);
  assert.match(source, /카페 원고 일괄 입력 검증 실패/);
  assert.match(source, /한 번에 붙여넣고/);
  assert.doesNotMatch(source, /async function activeEditorParagraphText/);
  assert.doesNotMatch(source, /\.se-component-content"\)\.allInnerTexts/);
  assert.match(source, /clearNaverDraftState\(page\)/);
  assert.match(source, /localStorage\.clear\(\)/);
  assert.match(source, /async function resetEditorForJob/);
  assert.match(source, /async function focusEditorParagraph/);
  assert.match(source, /page\.mouse\.click/);
  assert.match(source, /네이버가 복원한 이전 임시 원고를 초기화하지 못했습니다/);
  assert.match(source, /async function chooseImageFiles/);
  assert.match(source, /async function uploadImagesInOrder/);
  assert.match(source, /await chooseImageFiles\(page, \[file\.path\], \{ preferExistingInput: index > 0 \}\)/);
  assert.match(source, /기존 파일 입력기를 재사용했습니다/);
  assert.match(source, /await waitForImageCount\(page, index \+ 1\)/);
  assert.match(source, /await verifyEditorImageSequence\(page, files\.slice\(0, index \+ 1\)\)/);
  assert.match(source, /이미지 실제 배치 순서 검증 실패/);
  assert.match(source, /image\.complete && image\.naturalWidth > 0/);
  assert.match(source, /전송중\|업로드 준비 중\|업로드 중/);
  assert.match(source, /state\.ready >= expected && !uploadBusy/);
  assert.match(source, /await uploadImagesInOrder\(page, files\)/);
  const manuscriptIndex = source.indexOf("insertArticleBody(page, articleParts.manuscript, { append: true })");
  const linksIndex = source.indexOf("insertArticleBody(page, articleParts.links, { append: true })");
  const videoIndex = source.indexOf("uploadVideo(page, videoFile");
  assert.ok(manuscriptIndex > 0 && linksIndex > manuscriptIndex && videoIndex > linksIndex);
  assert.match(source, /기본 이미지 파일 선택 실패 \(3회 재시도\)/);
  assert.doesNotMatch(source, /chooseImageFiles\(page, \[file\.path\][\s\S]{0,180}chooseIndividualPhotoMode\(page\)/);
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
  assert.match(source, /openPublishedArticleForVerification\(page, cafeUrl\)/);
  assert.match(source, /공개 글 화면을 안정적으로 불러왔습니다/);
  assert.match(source, /execution context was destroyed\|navigation/);
  assert.match(source, /expectedLinks\.every\(\(expected\) => links\.includes\(expected\)\)/);
  assert.match(source, /async function waitForPublishedArticleView/);
  assert.match(source, /articleIdFromNaverUrl/);
  assert.match(source, /\/gnlawfintech\\\/\(\\d\+\)/);
  assert.match(source, /async function canonicalCafeArticleUrl/);
  assert.match(source, /filter\(\(job\) => job\.cafeStatus === "smarteditor-queued"\)[\s\S]*\.at\(0\)/);
  assert.doesNotMatch(source, /hasUnfinishedBatchJobs/);
});

test("SmartEditor runner recovers a crashed Chrome without losing a queued job", () => {
  assert.equal(isBrowserClosedError(new Error("apiRequestContext.get: Target page, context or browser has been closed")), true);
  assert.equal(isBrowserClosedError(new Error("Browser has been closed")), true);
  assert.equal(isBrowserClosedError(new Error("HTTP 500")), false);
  assert.equal(isTransientNetworkError(new Error("apiRequestContext.get: read ECONNRESET")), true);
  assert.equal(isTransientNetworkError(new Error("socket hang up")), true);
  assert.equal(isTransientNetworkError(new Error("HTTP 400")), false);

  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /request\.newContext\(\{ storageState: await context\.storageState\(\) \}\)/);
  assert.match(source, /watchWithBrowserRecovery\(config, chromePath, runOptions\)/);
  assert.match(source, /Chrome 재실행 완료/);
  assert.match(source, /API 연결이 끊겨 재시도합니다/);
  assert.match(source, /function safeErrorMessage/);
  assert.match(source, /Call log:/);
  assert.match(source, /queueSmartEditor\(apiContext, config, job\.id\)/);
  assert.match(source, /게시 요청 이후 Chrome이 종료되었습니다\. 중복 방지를 위해 자동 재시도하지 않습니다/);
  assert.doesNotMatch(source, /context\.request\.(?:get|post)/);
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
  assert.match(source, /v1\.64\.0/);

  const gui = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/windows/GNLAWSmartEditor.cs", import.meta.url), "utf8");
  assert.match(gui, /StopStaleAutomationProcesses\(nodePath, cliPath\)/);
  assert.match(gui, /ManagementObjectSearcher\("SELECT ProcessId, Name, CommandLine FROM Win32_Process"\)/);
  assert.match(gui, /commandLine\.IndexOf\(profilePath/);
  assert.match(gui, /기존 자동화 프로세스/);
  assert.match(gui, /v1\.64\.0 · 수정 64차/);
  assert.match(gui, /gui\.log/);
  assert.match(gui, /File\.AppendAllText/);
});

test("automation surfaces expose the same revision version", () => {
  const cli = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../admin/cafe-reels.html", import.meta.url), "utf8");
  const version = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/VERSION.txt", import.meta.url), "utf8").trim();
  assert.equal(version, "v1.64.0 · 수정 64차");
  assert.match(cli, /v1\.64\.0 · 수정 64차/);
  assert.match(page, /v1\.64\.0 · 수정 64차/);
  assert.match(page, /gnlaw-smarteditor-windows\.zip\?v=1\.64\.0/);
});

test("queue watcher relaunches Chrome after a renderer crash", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /--disable-accelerated-video-encode/);
  assert.match(source, /--disable-accelerated-video-decode/);
  assert.match(source, /--disable-accelerated-2d-canvas/);
  assert.match(source, /monitorPage\.isClosed\(\) \|\| context\.pages\(\)\.length === 0/);
  assert.match(source, /Browser has been closed while the queue watcher was running/);
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
