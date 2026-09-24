# 네이버 카페 SmartEditor PC 업로드 러너

네이버 Open API 대신 회사 PC의 로그인된 Chrome을 이용해 SmartEditor ONE에 글·이미지·이미지 링크·릴스 영상을 입력합니다.

## 1. 최초 로그인

```powershell
npm install
npm run naver:cafe:login
```

열린 Chrome에서 네이버와 `gnlaw-criminal.co.kr` 관리자 로그인을 완료한 후 PowerShell에서 Enter를 누릅니다. 아이디·비밀번호는 프로그램이 저장하지 않고 Chrome 전용 프로필의 로그인 쿠키만 유지합니다.

## 2. 작업 대기열 사용

1. 관리자 대시보드에서 카페 원고를 생성하고 `SmartEditor PC 업로드 대기`를 누릅니다.
2. 회사 PC에서 다음 명령을 실행합니다.

```powershell
npm run naver:cafe:watch -- --publish
```

러너가 SmartEditor에 모든 내용을 준비한 뒤 실제 게시 여부를 묻습니다. 작업에 `videoUrl`이 저장되어 있으면 MP4/MOV 파일을 내려받아 이미지 다음에 함께 첨부합니다. 공개 글의 이미지 링크와 영상 존재까지 검증한 후 게시글 URL을 관리자 작업에 저장합니다.

### 완전 자동 게시

```powershell
npm run naver:cafe:watch -- --publish --yes
```

`--yes`는 공개 글 등록 직전의 사람 확인을 생략합니다. 초기 운영 기간에는 `--yes`를 빼고 사용하는 것을 권장합니다.

## 3. 개별 작업 실행

```powershell
# 등록하지 않고 작성·링크 검증까지만
npm run naver:cafe -- prepare --job-id <작업ID>

# 작성 후 실제 게시 확인
npm run naver:cafe -- publish --job-id <작업ID>
```

작업에 영상 URL이 있어도 카페 글에는 영상 없이 올려야 하는 예외 상황에서는 `--skip-video`를 덧붙입니다.

## 기본 링크

- 전화: `https://gnlaw-criminal.co.kr/call_redirect/`
- 카카오: `https://gnlaw-criminal.co.kr/kakao_redirect/`

필요하면 `--phone-link`, `--kakao-link` 옵션이나 `GNLAW_PHONE_LINK`, `GNLAW_KAKAO_LINK` 환경변수로 변경할 수 있습니다.

## 주의사항

- 러너는 로그인 전용 Chrome 프로필을 사용하므로 동일한 프로필을 두 프로세스에서 동시에 실행하지 마세요.
- 네이버 로그인 만료, 추가 보안 인증, SmartEditor UI 변경 시 사람의 확인이 필요합니다.
- 영상이 있는 작업은 SmartEditor의 영상 업로드·변환이 끝난 것을 확인한 뒤 등록합니다. 영상 처리 제한 시간은 5분입니다.
- 준비 스크린샷은 `%LOCALAPPDATA%\\gnlaw-smarteditor-runner\\artifacts`에 저장됩니다.

## Instagram 릴스 자동 업로드

1. Meta 개발자 앱에서 `Instagram API with Instagram Login`을 설정합니다.
2. 리디렉션 URI에 `https://gnlaw-criminal.co.kr/api/instagram-oauth/callback`을 등록합니다.
3. 관리자 `알림 / AI / 네이버 카페 / Instagram 설정`에서 **Instagram 앱 ID**와 **Instagram 앱 시크릿 코드**를 저장합니다.
4. `Instagram 권한 연결`을 눌러 게시 대상 프로페셔널 계정을 승인합니다.
5. `카페 원고·릴스` 화면에서 영상을 생성하거나 MP4/MOV 파일을 선택한 뒤 `Instagram 릴스 자동 업로드`를 누릅니다.

영상 파일은 먼저 공개 URL로 업로드됩니다. 이후 Instagram이 해당 URL의 영상을 가져가 처리하며, 화면은 처리 완료를 자동 확인한 뒤 릴스를 게시합니다. 비즈니스 또는 크리에이터 프로페셔널 계정이 필요하며, 앱 개발 모드에서는 게시 계정에 앱 역할이 있어야 합니다.
