# GNLAW Google Indexer

gnlaw-criminal.co.kr / gnlaw-recovery.co.kr 랜딩페이지를 구글에 색인 요청하는 로컬 PC 도구입니다.
구글 공식 Indexing API는 채용공고·라이브방송 전용이라, 대신 사람이 서치콘솔에서 하던
**URL 검사 → 색인 생성 요청** 클릭을 로그인된 Chrome으로 그대로 수행합니다.

네이버는 이 도구와 무관합니다 — `scripts/scan-index-queue.js`가 새 랜딩페이지를 찾아 큐에
등록하는 시점에 서버에서 IndexNow로 바로 제출됩니다. 이 도구는 큐에서 **구글 처리분**만 가져갑니다.

## 1. 사전 준비

1. `functions/api/index-queue.js`가 참조하는 `INDEX_QUEUE_TOKEN`과 같은 값을 이 PC의 환경변수로 설정합니다.
   ```powershell
   setx INDEX_QUEUE_TOKEN "운영자에게 받은 토큰"
   ```
2. gnlaw-criminal.co.kr, gnlaw-recovery.co.kr 두 속성 모두 구글 서치콘솔에서 색인 생성 요청 권한이
   있는 구글 계정이 필요합니다(소유자 또는 전체 권한).
3. 두 속성이 **URL 접두어** 방식이 아니라 **도메인** 속성으로 등록되어 있다면, 아래 환경변수로
   재정의해야 합니다(기본값은 URL 접두어 `https://호스트/`로 가정):
   ```powershell
   setx GNLAW_SC_RESOURCE_GNLAW_CRIMINAL_CO_KR "sc-domain:gnlaw-criminal.co.kr"
   setx GNLAW_SC_RESOURCE_GNLAW_RECOVERY_CO_KR "sc-domain:gnlaw-recovery.co.kr"
   ```

## 2. 최초 로그인

```powershell
npm run google-indexer:login
```

열린 Chrome(평소 쓰는 Chrome과 분리된 전용 프로필)에서 구글 서치콘솔에 로그인하고,
좌측 속성 목록에 두 사이트가 보이는지 확인한 뒤 터미널에서 Enter를 누릅니다.
로그인 정보는 이 전용 Chrome 프로필에만 저장되며, 이후 실행부터는 다시 로그인할 필요가 없습니다.

## 3. 자동화 시작

```powershell
npm run google-indexer
```

5분(기본값) 간격으로 색인 큐를 확인해, 대기 중인 URL이 있으면 서치콘솔 URL 검사를 열어
이미 색인되어 있는지 확인하고, 아니면 색인 생성 요청을 클릭합니다. 처리 결과는 매번
`/api/index-queue`에 저장되어 관리자 쪽에서 조회할 수 있습니다. 구글의 일일 색인 생성 요청
한도에 걸리면(할당량 초과) 자동으로 몇 시간 쉬었다가 다시 시도합니다.

간격을 바꾸려면 `--poll-seconds` 또는 `GNLAW_INDEXER_POLL_SECONDS` 환경변수를 사용합니다.

## ⚠️ 알려진 한계

이 도구가 찾는 화면 문구·버튼(`색인 생성 요청`, `URL이 Google에 등록되어 있습니다` 등)은
실제 로그인된 서치콘솔 화면으로 검증하지 못한 상태로 작성되었습니다. 실행 중 다음과 같은
오류가 나면:

- `색인 생성 요청 버튼을 찾지 못했습니다`
- `URL 검사 결과가 시간 내에 표시되지 않았습니다`

`cli.mjs`의 `searchConsoleLocators()` 함수에서 텍스트 패턴을 실제 화면 문구에 맞게 조정해야
합니다. 처리할 때마다 스크린샷이 `%LOCALAPPDATA%\gnlaw-google-indexer\artifacts`에 저장되니
문제가 생기면 그 화면을 보고 알려주세요.
