import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  boardForJob,
  jobVideoUrl,
  orderedJobImages,
  parseArgs,
  parseLinkedImageData,
  reelJobImages,
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

test("desktop full automation renders ten-second Reels by default", () => {
  const source = fs.readFileSync(new URL("../tools/naver-cafe-smarteditor/cli.mjs", import.meta.url), "utf8");
  assert.match(source, /locator\("#duration"\)\.selectOption\("10"\)/);
});

test("full automation selects the first ten regular images for Reels", () => {
  const images = [
    ...Array.from({ length: 12 }, (_, index) => ({ slot: String(index + 1).padStart(2, "0"), url: `/assets/${index + 1}.jpg` })),
    { slot: "phone", url: "/phone.jpg" },
    { slot: "kakao", url: "/kakao.jpg" },
  ];
  const selected = reelJobImages({ images }, "https://gnlaw-criminal.co.kr");
  assert.equal(selected.length, 10);
  assert.deepEqual(selected.map((image) => image.slot), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
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
