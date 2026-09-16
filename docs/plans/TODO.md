# TODO

[마스터플랜](00-master-plan.md) 의 실행 체크리스트다.
`담당` 이 **사람** 인 줄은 에이전트가 할 수 없다. 그 줄에 도달하면 **멈추고 대기한다.**

- 분류: Feature / 규모 Large / 위임 티어 Full
- 진행 표기: `[ ]` 대기 · `[~]` 진행 중 · `[x]` 완료 · `[!]` 막힘
- 한 번에 하나만 `[~]` 로 둔다

## 작업 분해 및 실행 계획 (7컬럼 TODO 테이블)

| # | 작업 | 담당 | Step | 순서 | 의존성 | 스킬 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | **HOLD-0** 저장소 Settings → General → Default branch = `main` | **사람** | M1 | 0 (직렬) | 없음 | — |
| 1 | Vite + React + TS 스캐폴드, `base: '/location_maker/'` | 에이전트 | M1 | 1 (직렬) | 없음 | — |
| 2 | Vitest(node·jsdom) · Playwright 설정 | 에이전트 | M1 | 2 (직렬) | 1 | — |
| 3 | ~~**HOLD-2** `@cas/spec-sync` 반입 방식 승인~~ → **git 의존성**으로 결정 (2026-09-16) | **사람** | M1 | 3 (직렬) | 2 | — |
| 4 | spec-sync 반입 + 테스트 게이트 + PREFIX 레지스트리 | 에이전트 | M1 | 4 (직렬) | 3 | tdd-gate-workflow |
| 4b | **HOLD-2b** 읽기 전용 PAT → Secret `CAS_READ_TOKEN` | **사람** | M1 | 4 (직렬) | 3 | — |
| 5 | `.env.example`(이름만) · `.gitignore` · 키 없을 때 안내 문구 | 에이전트 | M1 | 5 (병렬) | 1 | — |
| 6 | `ci.yml` · `deploy.yml` 작성 | 에이전트 | M1 | 5 (병렬) | 1 | — |
| 7 | **HOLD-1** 저장소 Settings → Pages → Source = GitHub Actions | **사람** | M1 | 6 (직렬) | 6 | — |
| 8 | ~~M1 PR 리뷰·머지 + 배포 주소 확인~~ → 완료 (2026-09-16) | **사람** | M1 | 7 (직렬) | 4,5,7 | git-commit-workflow |
| 9 | `domain/types.ts` — Entry · EntryStatus | 에이전트 | M2 | 8 (직렬) | 8 | — |
| 10 | 파싱 스펙 → 테스트 → `parse-addresses.ts` | 에이전트 | M2 | 9 (병렬) | 9 | tdd-gate-workflow |
| 11 | 큐 스펙 → 테스트 → `geocode-queue.ts` (동시 3 · 중단 · 쿼터 전체중단) | 에이전트 | M2 | 9 (병렬) | 9 | tdd-gate-workflow |
| 12 | `domain/` 경계 검사 (바깥 import 금지) | 에이전트 | M2 | 10 (직렬) | 10,11 | — |
| 13 | ~~M2 PR 리뷰·머지~~ → 완료 (2026-09-16) | **사람** | M2 | 11 (직렬) | 12 | git-commit-workflow |
| 14 | **HOLD-4** Kakao SDK 공식 문서로 시그니처 대조 (`x`=경도 여부 포함) | **사람** | M3 | 12 (직렬) | 13 | external-library-usage |
| 15 | ~~대조 결과를 `docs/findings/kakao-sdk.md` 에 기록~~ → 완료 | 에이전트 | M3 | 13 (직렬) | 14 | dev-findings |
| 16 | ~~`geocoding/port.ts`~~ → 완료. 계약은 `domain/types.ts` 에 있고 여기서 re-export 한다 | 에이전트 | M3 | 14 (직렬) | 15 | architecture-design |
| 17 | ~~`fake-adapter.ts` + 계약 테스트~~ → 완료. 계약 테스트는 두 구현에 함께 돈다 | 에이전트 | M3 | 15 (직렬) | 16 | tdd-gate-workflow |
| 18 | ~~`kakao-adapter.ts` (addressSearch → keywordSearch 폴백)~~ → 완료 | 에이전트 | M3 | 16 (직렬) | 17 | external-library-usage |
| 19 | \1 PR 리뷰·머지 — Fable 에이전트 리뷰 → 승인 시 Claude 머지 | 에이전트 | M3 | 17 (직렬) | 18 | git-commit-workflow |
| 20 | ~~`state/store.ts` — 순서 불변식 테스트 포함~~ → 완료 | 에이전트 | M4 | 18 (직렬) | 19 | tdd-gate-workflow |
| 21 | ~~`AddressInput.tsx`~~ → 완료 | 에이전트 | M4 | 19 (병렬) | 20 | design-system |
| 22 | ~~`ResultList.tsx` · `ResultItem.tsx` (실패 항목 자리 보존)~~ → 완료 | 에이전트 | M4 | 19 (병렬) | 20 | design-system |
| 23 | ~~진행 표시 · 중단 버튼~~ → 완료 (`ProgressBar.tsx`) | 에이전트 | M4 | 19 (병렬) | 20 | — |
| 24 | ~~`App.tsx` 조립 (가짜 어댑터 주입) · 반응형 · 접근성~~ → 완료 | 에이전트 | M4 | 20 (직렬) | 21,22,23 | design-system |
| 25 | \1 PR 리뷰·머지 — Fable 에이전트 리뷰 → 승인 시 Claude 머지 | 에이전트 | M4 | 21 (직렬) | 24 | git-commit-workflow |
| 26 | ~~**HOLD-5** Kakao 앱 생성 + 쿼터 확인~~ → 완료 (2026-09-16) | **사람** | M5 | 22 (직렬) | 25 | — |
| 27 | ~~**HOLD-6** JavaScript 앱키 → Secret `KAKAO_JS_KEY`~~ → 완료 (2026-09-16) | **사람** | M5 | 23 (직렬) | 26 | — |
| 28 | ~~**HOLD-7** 도메인 등록~~ → 완료 (2026-09-16). 5173 · 4173 · `https://doosies.github.io` 셋 | **사람** | M5 | 24 (직렬) | 26 | — |
| 29 | ~~**HOLD-8** 로컬 `.env.local` 작성~~ → 완료 (2026-09-16) | **사람** | M5 | 25 (직렬) | 27 | — |
| 30 | ~~`load-kakao-sdk.ts` (autoload=false · libraries=services · 실패 원인 구분)~~ → 완료 | 에이전트 | M5 | 26 (직렬) | 29 | external-library-usage |
| 31 | ~~`MapView.tsx` + 마커 관리~~ → 완료 (`markers.ts` 로 차이 계산 분리) | 에이전트 | M5 | 27 (직렬) | 30 | — |
| 32 | ~~`use-fit-bounds.ts` (마커 1개 예외 포함)~~ → 완료. 좌표가 전부 같은 경우도 같이 막았다 | 에이전트 | M5 | 28 (직렬) | 31 | tdd-gate-workflow |
| 33 | ~~어댑터를 Kakao 로 교체~~ → 완료. 키가 있으면 Kakao, 없으면 가짜로 떨어진다 | 에이전트 | M5 | 29 (직렬) | 32 | — |
| 34 | M5 PR 리뷰·머지 — Fable 리뷰 → 승인 시 Claude 머지. **배포 주소에서 지도 확인은 사람** | 에이전트 + 사람 | M5 | 30 (직렬) | 33 | git-commit-workflow |
| 35 | `url-state.ts` — 해시 인코딩·복원·자동 재조회 | 에이전트 | M6 | 31 (병렬) | 25 | tdd-gate-workflow |
| 36 | `to-csv.ts` — 이스케이프 · BOM · 실패 항목 포함 | 에이전트 | M6 | 31 (병렬) | 25 | tdd-gate-workflow |
| 37 | `download.ts` + 파일명에 날짜 | 에이전트 | M6 | 32 (직렬) | 35,36 | — |
| 38 | \1 PR 리뷰·머지 — Fable 에이전트 리뷰 → 승인 시 Claude 머지 | 에이전트 | M6 | 33 (직렬) | 37 | git-commit-workflow |
| 39 | `kakao-sdk-stub.ts` — SDK 라우트 가로채기 | 에이전트 | M7 | 34 (직렬) | 34,38 | journey-testing |
| 40 | 저니 스펙 → `paste-and-plot.spec.ts` (7개 시나리오) | 에이전트 | M7 | 35 (직렬) | 39 | journey-testing |
| 41 | `live-kakao.spec.ts` — `@live` 태그, 키 없으면 실패 | 에이전트 | M7 | 36 (직렬) | 39 | journey-testing |
| 42 | CI 에 저니 추가 · 실연동은 `workflow_dispatch` | 에이전트 | M7 | 37 (직렬) | 40,41 | — |
| 43 | **HOLD-9** 실연동 수동 실행 + 배포 사이트 육안 검증 | **사람** | M7 | 38 (직렬) | 42 | — |
| 44 | \1 PR 리뷰·머지 — Fable 에이전트 리뷰 → 승인 시 Claude 머지 | 에이전트 | M7 | 39 (직렬) | 43 | git-commit-workflow |

## 사람이 할 일만 모아 보기

순서대로 열 번이다.

| # | 무엇 | 어디서 | 언제 |
| --- | --- | --- | --- |
| ~~0~~ | ~~기본 브랜치를 `main` 으로~~ → 완료 (2026-09-11) | 저장소 Settings → General | 지금 |
| 3 | spec-sync 반입 방식 승인 | 스레드에서 한마디 | M1 중 |
| ~~7~~ | ~~Pages Source 를 GitHub Actions 로~~ → 완료 (2026-09-16) | 저장소 Settings → Pages | M1 중 |
| ~~14~~ | ~~Kakao SDK 시그니처 대조~~ → 완료 (2026-09-16) | Kakao 공식 문서 | M3 착수 전 |
| ~~26~~ | ~~앱 생성 + 쿼터 확인~~ → 완료 (2026-09-16) | Kakao Developers 콘솔 | M5 착수 전 |
| ~~27~~ | ~~JS 앱키 → Secret `KAKAO_JS_KEY`~~ → 완료 (2026-09-16) | 저장소 Settings → Secrets | M5 착수 전 |
| ~~28~~ | ~~도메인 3개 등록 (5173 · 4173 · doosies.github.io)~~ → 완료 (2026-09-16) | Kakao 콘솔 → 플랫폼 → Web | M5 착수 전 |
| ~~29~~ | ~~`.env.local` 작성~~ → 완료 (2026-09-16) | 로컬 파일 | M5 착수 전 |
| 43 | 실연동 검증 | 브라우저 · 로컬 터미널 | M7 후 |
| ~~8·13·19·25·34·38·44~~ | ~~단계별 PR 리뷰·머지~~ → 2026-09-16 지시로 사람 개입 없음 (Fable 리뷰 → Claude 머지) | GitHub | 각 단계 끝 |

## 막혔을 때 우회 경로

- **M5 가 키 대기로 막히면 M6 을 먼저 한다.** M6 은 지도에 의존하지 않는다 (의존성 열 참조).
- HOLD-4 를 문서 접속 가능한 환경에서 에이전트가 직접 확인할 수 있으면 그렇게 해도 된다.
- 그 외의 HOLD 는 우회하지 않는다. 특히 키 값은 어떤 경우에도 지어내지 않는다.
