import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
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

test("SmartEditor runner keeps contact images last and resolves local URLs", () => {
  const images = orderedJobImages([
    { slot: "phone", url: "/phone.jpg" },
    { slot: "02", url: "/two.jpg" },
    { slot: "kakao", url: "https://cdn.example/kakao.png" },
    { slot: "01", url: "/one.jpg" },
  ], "https://gnlaw-criminal.co.kr/");

  assert.deepEqual(images.map((image) => image.slot), ["02", "01", "phone", "kakao"]);
  assert.equal(images[0].url, "https://gnlaw-criminal.co.kr/two.jpg");
  assert.equal(images[3].url, "https://cdn.example/kakao.png");
});

test("desktop automation uses the Windows Chrome sandbox and opens the work screen", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /chromiumSandbox:\s*true/);
  assert.doesNotMatch(source, /["']--no-sandbox["']/);
  assert.match(source, /page\.goto\(`\$\{config\.siteOrigin\}\/admin\/cafe-reels`/);
  assert.match(source, /verifyLoginSessions\(context, monitorPage, config\)/);
  assert.match(source, /\[사전 확인\] 네이버 카페 로그인 확인 완료/);
});

test("desktop automation pre-checks the persisted Naver login cookies", () => {
  assert.equal(hasNaverSessionCookies([{ name: "NID_AUT" }, { name: "NID_SES" }]), true);
  assert.equal(hasNaverSessionCookies([{ name: "NID_SES" }]), true);
  assert.equal(hasNaverSessionCookies([{ name: "NID_AUT" }]), false);
  assert.equal(hasNaverSessionCookies([]), false);
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
});

test("SmartEditor accepts a board already selected by the menu URL", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /selectBoard\(page, board\)/);
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
