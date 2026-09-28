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
3. 기본값은 두 속성 모두 **도메인** 속성(`sc-domain:호스트`)으로 가정합니다(gnlaw-criminal.co.kr은
   실제 화면으로 확인함). 만약 **URL 접두어** 방식으로 등록되어 있다면 아래처럼 재정의하세요:
   ```powershell
   setx GNLAW_SC_RESOURCE_GNLAW_RECOVERY_CO_KR "https://gnlaw-recovery.co.kr/"
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

실제 화면으로 확인된 것: `sc-domain:` 리소스 형식, "URL이 Google에 등록되어 있음" 문구,
"색인 생성 요청" 버튼 문구, URL 검사 결과 페이지의 `id=` 파라미터가 URL이 아니라 구글이
발급하는 불투명 토큰이라는 점(그래서 직접 링크 이동 대신 대시보드 상단 검색창에 URL을
입력하는 방식으로 동작합니다).

아직 검증 못 한 부분: 검색창을 클릭했을 때 실제로 포커스를 받는 입력 요소의 정확한
구조(`openUrlInspection()`의 후보 셀렉터들 중 어느 것이 맞는지). 실행 중 다음과 같은
오류가 나면 이 부분이 원인일 가능성이 높습니다:

- `서치콘솔 상단 URL 검사 검색창을 찾지 못했습니다`
- `URL 검사 결과가 시간 내에 표시되지 않았습니다`
- `색인 생성 요청 버튼을 찾지 못했습니다`

`cli.mjs`의 `openUrlInspection()` / `searchConsoleLocators()` 함수를 실제 화면 구조에 맞게
조정하면 됩니다. 처리할 때마다(및 오류 시) 스크린샷이
`%LOCALAPPDATA%\gnlaw-google-indexer\artifacts`에 저장되니 문제가 생기면 그 화면을 보고
알려주세요.
