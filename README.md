# location maker

주소를 여러 개 붙여넣으면 지도에 마커로 찍어 주는 웹 앱.

엑셀에서 주소 열을 통째로 복사해 넣으면, 한 줄씩 좌표를 찾아 지도에 번호 붙은 마커로
표시한다. 못 찾은 주소는 버리지 않고 원래 자리에 남겨 고쳐서 다시 시도할 수 있게 한다.
결과는 링크로 공유하거나 CSV 로 내려받는다.

> **현재 상태: 설계 완료, 구현 전.** 아직 코드가 없다.

## 기술 선택

| 항목 | 선택 |
| --- | --- |
| 지도 · 지오코딩 | Kakao Maps JS SDK (+ services) |
| 언어 · 프레임워크 | TypeScript (strict) + React |
| 번들러 · 테스트 | Vite · Vitest · Playwright |
| 백엔드 | 없음 |
| 배포 | GitHub Pages + GitHub Actions |

백엔드가 없는 것은 Kakao JS SDK 의 지오코딩이 브라우저에서 그대로 동작하기 때문이다.
근거는 [설계 문서](docs/design/02-architecture.md#백엔드를-두지-않는-근거) 에 있다.

## 문서

### 설계

| 문서 | 내용 |
| --- | --- |
| [00-map-api.md](docs/design/00-map-api.md) | 지도 API 5종 비교와 Kakao 선택 근거 |
| [01-ui-ux.md](docs/design/01-ui-ux.md) | 화면 구성, 상태 5종, 핵심 사용자 흐름 |
| [02-architecture.md](docs/design/02-architecture.md) | 모듈 경계, 디렉터리, 데이터 모델·흐름, 실패 처리, 키, 배포, 테스트 |
| [03-deployment.md](docs/design/03-deployment.md) | 정적 호스팅 5종 비교와 GitHub Pages 선택 근거 |

### 계획

| 문서 | 내용 |
| --- | --- |
| [00-master-plan.md](docs/plans/00-master-plan.md) | 단계 개요, **사람이 개입해야 하는 지점 9곳**, 진행 규칙 |
| [TODO.md](docs/plans/TODO.md) | 44줄 실행 체크리스트 |
| `01-m1` ~ `07-m7` | 단계별 상세 |

## 키 취급 규칙

1. **키 값은 코드·커밋·문서·PR·이슈 어디에도 적지 않는다.** 저장소에 들어가는 것은 변수
   이름뿐이다 (`.env.example` 의 `VITE_KAKAO_JS_KEY=`).
2. 값이 필요해지면 그 자리에서 멈추고 요청한다. 지어내지 않는다.
3. 주입은 두 곳뿐이다 — 로컬 `.env.local` (커밋 금지) 와 GitHub Actions Secrets.
4. **Kakao REST API 키와 Admin 키는 이 앱에 넣지 않는다.**
5. JavaScript 앱키가 빌드된 JS 에 평문으로 보이는 것은 정상이다. 이 키의 보호 장치는 비밀
   유지가 아니라 Kakao 콘솔의 도메인 등록이다.

## 테스트 규약

`common_agent_system` 의 **UC ID 규약**을 그대로 쓴다. `__test_specs__/` 에 Given-When-Then
스펙을 두고, `@cas/spec-sync` 가 테스트와 1:1 대응을 강제한다. 스펙 문서 없이 테스트를
추가하면 그 자리에서 실패하므로, "스펙 먼저" 가 관습이 아니라 게이트가 된다.

자세한 내용은 [02-architecture.md §9](docs/design/02-architecture.md#9-테스트).
