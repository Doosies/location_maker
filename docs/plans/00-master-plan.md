# 마스터플랜

주소를 여러 개 붙여넣으면 지도에 마커로 찍어 주는 앱을 만든다.
설계는 [`docs/design/`](../design/) 에 끝나 있고, 이 문서는 **그 설계를 어떤 순서로
구현하고 어디서 사람을 기다리는지**를 정한다.

- 설계 전체: [02-architecture.md](../design/02-architecture.md)
- 단계별 상세: 이 폴더의 `01-m1-…` ~ `07-m7-…`
- 실행 체크리스트: [TODO.md](TODO.md)

## 확정된 전제

| 항목 | 값 |
| --- | --- |
| 지도 · 지오코딩 | Kakao Maps JS SDK (+ services) |
| 언어 · 프레임워크 | TypeScript (strict) + React |
| 번들러 · 테스트 | Vite · Vitest · Playwright |
| 백엔드 | 없음 |
| 배포 | GitHub Pages + GitHub Actions |
| 테스트 규약 | UC ID + `__test_specs__` (`@cas/spec-sync`) |
| 작업 브랜치 | `claude/location-maker-research-design-ffkneq` |

## 단계 개요

| 단계 | 이름 | 끝나면 무엇이 되나 | 키 필요 | 상세 |
| --- | --- | --- | --- | --- |
| M1 | 바닥 | 빈 화면이 Pages 에 올라가고 테스트 게이트가 돈다 | 아니오 | [01](01-m1-foundation.md) |
| M2 | 도메인 | 파싱과 큐가 순수 로직으로 완성된다 | 아니오 | [02](02-m2-domain.md) |
| M3 | 어댑터 | `GeocodePort` 와 두 구현이 계약 테스트를 통과한다 | 아니오 | [03](03-m3-geocoding.md) |
| M4 | 화면 | 가짜 어댑터로 동작하는 앱이 된다 (지도 없음) | 아니오 | [04](04-m4-ui.md) |
| M5 | 지도 | 진짜 지도에 마커가 찍힌다 | **예** | [05](05-m5-map.md) |
| M6 | 가져가기 | 링크 공유와 CSV 내려받기가 된다 | 아니오 | [06](06-m6-share.md) |
| M7 | E2E | 전 구간이 자동 검증된다 | 실연동만 | [07](07-m7-e2e.md) |

**M4 까지는 Kakao 계정이 하나도 없어도 끝난다.** 계정 설정이 늦어져도 개발이 멈추지 않도록
짠 순서다. M5 가 키 대기로 막히면 **M6 을 먼저 진행한다** — M6 은 지도에 의존하지 않는다.

## 사람이 개입해야 하는 지점

아래 `HOLD-n` 에 도달하면 **에이전트는 그 자리에서 멈추고 대기한다.** 우회하지 않는다.

| ID | 시점 | 사람이 할 일 | 왜 사람인가 | 안 하면 |
| --- | --- | --- | --- | --- |
| **HOLD-1** | M1 중 | 저장소 Settings → Pages → Source 를 **GitHub Actions** 로 변경 | 저장소 설정 권한은 소유자만 | deploy 잡이 실패한다 |
| **HOLD-2** | M1 중 | `@cas/spec-sync` 반입 방식 승인 (**vendoring 권장**) | 다른 저장소(비공개) 코드를 복사하는 결정 | 테스트 게이트를 못 만든다 |
| **HOLD-3** | 각 단계 종료 | PR 리뷰 · 머지 | 승인 권한 | 다음 단계 진행 불가 |
| **HOLD-4** | M3 착수 전 | Kakao SDK 공식 문서로 시그니처 대조 (아래 상세) | 설계 세션이 네트워크 차단으로 문서를 못 열었다 | 어댑터가 추측 코드가 된다 |
| **HOLD-5** | M5 착수 전 | Kakao 개발자 앱 생성 + **무료 쿼터가 다른 앱에 이미 붙어 있는지 확인** | 계정 소유자만 가능 | 쿼터 없이 개발하게 된다 |
| **HOLD-6** | M5 착수 전 | JavaScript 앱키 발급 → 저장소 Secrets 에 `KAKAO_JS_KEY` 등록 | **키 값은 사람이 주입한다** (아래 규칙) | 빌드는 되나 지도가 안 뜬다 |
| **HOLD-7** | M5 착수 전 | Kakao 콘솔에 도메인 2개 등록 — 로컬 개발 주소, `https://doosies.github.io` | 계정 소유자만 가능 | SDK 초기화가 거부된다 |
| **HOLD-8** | M5 로컬 작업 시 | 로컬에 `.env.local` 작성 (`VITE_KAKAO_JS_KEY=…`) | 키 값은 사람이 주입한다 | 로컬에서 지도가 안 뜬다 |
| **HOLD-9** | M7 종료 후 | 실연동 E2E 수동 실행 + 배포된 사이트 육안 확인 | 실제 키·실제 쿼터를 쓴다 | 배포 검증이 없다 |

### HOLD-4 에서 대조할 것

설계 문서의 아래 항목은 **기억에 기대 쓴 것**이다. 공식 문서·타입 정의로 확인한다.

- `kakao.maps.services.Geocoder` 의 `addressSearch(query, callback, options?)` 시그니처
- 콜백 인자 `(result, status)` 의 구조와 `kakao.maps.services.Status` 상수 이름
- 결과 항목의 좌표 필드 — **`x` 가 경도, `y` 가 위도**인지 (뒤집혀 있으면 마커가 바다로 간다)
- `kakao.maps.services.Places().keywordSearch(...)` 시그니처
- `kakao.maps.LatLngBounds` / `map.setBounds(bounds)` 사용법
- SDK 로드 URL 의 `libraries=services` 와 `autoload=false` + `kakao.maps.load(cb)` 패턴

문서에 접속 가능한 환경(로컬 등)에서 에이전트가 직접 확인할 수 있다면 그렇게 해도 된다.
**이 확인 없이 M3 어댑터 코드를 쓰지 않는다.**

## 키 취급 규칙

이 프로젝트의 고정 규칙이다. 단계와 무관하게 항상 적용된다.

1. **키 값은 코드·커밋·문서·PR·이슈 어디에도 적지 않는다.** 저장소에 들어가는 것은 변수
   이름뿐이다 (`.env.example` 의 `VITE_KAKAO_JS_KEY=`).
2. 값이 필요해지면 **그 자리에서 멈추고 요청한다.** 지어내거나 더미로 채우지 않는다.
3. 주입은 두 곳뿐이다 — 로컬 `.env.local` (커밋 금지) 와 GitHub Actions Secrets.
4. **Kakao REST API 키와 Admin 키는 이 앱에 넣지 않는다.** 도메인 제한이 없어 노출되면 도용된다.
5. JavaScript 앱키가 빌드된 JS 파일에 평문으로 보이는 것은 **정상이다.** 이 키의 보호 장치는
   비밀 유지가 아니라 콘솔의 도메인 등록이다.

## 진행 규칙

### 테스트를 쓰는 순서

모든 단계에서 **스펙 문서 → 테스트 코드 → 구현** 순서를 지킨다. 관습이 아니라 게이트다 —
`__test_specs__/` 에 짝이 없는 테스트는 `spec-sync` 가 실패시킨다.

1. `__test_specs__/<미러 경로>.spec.md` 에 frontmatter(`prefix`, `target`) 와
   `### UC-<PREFIX>-<NNN>` + Given/When/Then 을 쓴다.
2. 같은 UC ID 로 `it('UC-…: …')` 테스트를 쓴다. 이 시점에 실패해야 정상이다.
3. 통과시키는 구현을 쓴다.
4. `pnpm test` 로 게이트를 확인한다.

UC 번호는 append-only 다. 중간에 끼워 넣어도 재부여하지 않는다.
PREFIX 목록은 [02-architecture.md §9](../design/02-architecture.md#9-테스트) 에 있다.

### 단계 완료 판정

각 단계는 아래를 모두 만족해야 끝난 것이다.

- 그 단계의 세부플랜에 적힌 **완료 조건**을 전부 충족
- `pnpm test` 통과 (`spec-sync` 포함)
- `pnpm type-check` 통과
- CI 초록
- PR 이 머지됨 (**HOLD-3**)

### 커밋과 PR

- 작업 브랜치: `claude/location-maker-research-design-ffkneq`
- Conventional Commits. 메시지는 한글로 쓴다.
- 단계 하나 = PR 하나. PR 본문은 Before / After 문단으로 시작한다.
- 테스트가 깨진 채로 PR 을 올리지 않는다.

### 멈춤 규칙

`HOLD-n` 에 도달하면:

1. 그 단계에서 **더 진행할 수 있는 작업이 있으면 먼저 끝낸다.**
2. 남은 작업은 멈춘다.
3. 무엇이 필요한지 **정확히** (어느 화면의 어느 메뉴에서 무엇을 하는지) 적어 요청한다.
4. 대기한다. 우회하거나 값을 지어내지 않는다.
5. HOLD 가 다른 단계를 막지 않으면 그 단계로 넘어간다 (예: M5 가 막히면 M6).

## 이번 범위 밖

아래는 이번 플랜에 없다. 필요해지면 별도로 계획한다.

- 백엔드 서버 (판단 근거는 [02-architecture.md §1](../design/02-architecture.md#1-확정-사항))
- 로그인 · 사용자별 저장
- VWorld 2차 폴백 어댑터
- 커스텀 도메인 · Cloudflare Pages 이전
- 유료 쿼터 전환
