# 작업 인수인계

마지막 작업 PC: 집 PC
마지막 확인일: 2026-05-26
브랜치: `main`

## 회사 PC에서 시작 방법

```powershell
cd C:\Users\이병권\new-project
git pull origin main
git log --oneline -5
```

최신 커밋이 아래 순서로 보이면 집 PC 작업분과 이후 반영분이 모두 포함된 상태입니다.

```text
ef3bd91 Add handoff notes for next workstation
fb915c1 style: 랜딩 h1 중앙 정렬, 실시간 접수 스크롤 속도 2배 느리게 (160s→320s)
bc12236 seo: 랜딩 페이지 SEO 개선 (published_time, title 브랜드, summary, h2 사건명)
98b5e5a Add landing receipt status widgets
bc167c7 Refine landing SEO copy and rendering
```

## 최근 반영 내용

- OpenAI 모델명을 `gpt-5.4-mini`로 변경했습니다.
- AI 원고 생성 가이드를 네이버 SEO 중심으로 강화했습니다.
- A~E 랜딩의 유형별 원고 방향을 분리했습니다.
  - A: 형사고소, 형법 제347조 사기죄, 기망/착오/처분행위/재산상 이익
  - B: 민사소송, 가압류, 손해배상, 부당이득반환
  - C: 성공사례, 일부 회수/합의/반환 협의 흐름
  - D: 네이버 AI 브리핑형 정보 구조
  - E: 전체 허브형 균형 안내
- 랜딩 하단 도메인별 카드형 캡쳐 영역을 제거했습니다.
- 문장 뒤 줄바꿈 처리를 추가했습니다.
- FAQ 사건명 반복을 3개 질문까지만 남기도록 렌더링 단계에서 제어했습니다.
- title 하단 설명에서 사건명을 제거하고, `상담 접수 n건+ (YYYY-M-D 기준)` 박스형 배지를 추가했습니다.
- `실시간 접수 현황` 50건 자동 스크롤 영역을 추가했습니다.
  - 생성일 기준 최근 7일 내 날짜
  - 피해금액은 1,600만원 이상 랜덤
  - 일반 문의 문구도 섞임
- 실시간 접수 현황 스크롤 속도는 이후 추가 커밋에서 `320s`로 더 늦춰졌습니다.
- 하단 sticky 상담 폼 간격을 넓혔고, `긴급상담 ｜ 02-6952-3695` 문구를 오른쪽으로 이동했습니다.
- c형 허브의 회수율 문구가 생성 때마다 흔들리지 않도록 slug 기준 고정값으로 바꿨습니다.

## 주요 파일

- 동적 랜딩 렌더러: `functions/[[path]].js`
- 관리자 AI 원고 생성 API: `functions/api/generate-draft.js`
- 정적 생성 스크립트: `scripts/generate.js`
- 공통 스타일 원본: `public/style.css`
- 배포 산출물 스타일: `dist-a/assets/style.css` ~ `dist-e/assets/style.css`
- 템플릿: `templates/group-a.html` ~ `templates/group-e.html`
- 케이스 데이터: `data/cases.json`

## 검증했던 항목

```powershell
node --check "functions\[[path]].js"
node --check scripts\generate.js
npm.cmd run generate
```

동적 랜딩 샘플에서 확인한 상태:

- FAQ 7개
- 사건명 포함 FAQ 3개
- 접수 배지 표시
- title 하단 설명에 사건명 미포함
- 실시간 접수 현황 50건 표시
- 실시간 접수 스크롤 `320s`

## 다음 작업 시 주의

- 현재 랜딩은 개별 HTML 파일을 모두 굽는 방식이 아니라 `functions/[[path]].js`에서 동적으로 렌더링하는 구조입니다.
- `scripts/generate.js`는 허브, sitemap, rss, dist 산출물을 갱신합니다.
- `npm.cmd run generate`를 실행하면 `dist-*` 파일이 함께 바뀔 수 있으니, 변경 범위를 `git diff --stat`으로 확인한 뒤 커밋하세요.
- FAQ 질문은 AI가 사건명을 많이 넣어도 렌더링 단계에서 3개까지만 남기도록 되어 있습니다.
