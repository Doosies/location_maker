# UC ID PREFIX 레지스트리

테스트 제목은 `UC-<PREFIX>-<NNN>: ...` 으로 시작한다. PREFIX 는 저장소 전역에서 유일하고,
번호는 append-only 다 — 테스트를 지워도 번호를 재사용하지 않는다. 짝이 되는 스펙 문서는
`__test_specs__/` 아래에 테스트 경로를 미러링해 둔다 (`__tests__` 한 마디가 빠지고
`.test.ts` 가 `.spec.md` 가 된다).

이 표는 `@cas/spec-sync` 가 읽는다. 여기 없는 PREFIX 를 쓰면 테스트가 실패한다.
아래 표의 형식(`| PREFIX | 테스트 경로 |`)은 검증기가 파싱하는 형식이므로 바꾸지 않는다.

규약의 출처는 `common_agent_system` 의 UC ID 규약이다. 배경은
[설계 문서 §9](../design/02-architecture.md#9-테스트) 에 있다.

| PREFIX | 테스트 | 대상 |
| --- | --- | --- |
| `LM-SPEC-SYNC` | `src/__tests__/spec-sync.test.ts` | 스펙 ↔ 테스트 짝 검사 자체 |
| `LM-SHELL` | `src/ui/__tests__/MapPlaceholder.test.tsx` | 앱 껍데기, 키 없을 때의 안내 |
| `LM-PARSE` | `src/domain/__tests__/parse-addresses.test.ts` | 붙여넣은 텍스트를 주소 줄로 나누기 |
| `LM-QUEUE` | `src/domain/__tests__/geocode-queue.test.ts` | 지오코딩 큐 — 동시 실행·중단·쿼터 |
| `LM-BOUNDARY` | `src/domain/__tests__/boundary.test.ts` | `src/domain/` 이 바깥을 끌어오지 않는지 |
| `LM-PORT` | `src/geocoding/__tests__/port-contract.test.ts` | `GeocodePort` 계약 — 두 구현 공통 |
| `LM-KAKAO` | `src/geocoding/__tests__/kakao-adapter.test.ts` | Kakao 어댑터 — 좌표 축·콜백·status 분류 |
| `LM-STORE` | `src/state/__tests__/store.test.ts` | 항목 배열과 순서 불변식 |
| `LM-INPUT` | `src/ui/__tests__/AddressInput.test.tsx` | 주소 입력 — 줄 수·버튼 상태 |
| `LM-LIST` | `src/ui/__tests__/ResultList.test.tsx` | 결과 목록 — 실패 항목 자리 보존 |
| `LM-PROGRESS` | `src/ui/__tests__/ProgressBar.test.tsx` | 진행 표시와 중단 |
| `LM-APP` | `src/__tests__/App.test.tsx` | 파싱→큐→스토어→화면 연결 |

## 아직 쓰지 않은 PREFIX

다음 단계에서 쓸 자리다. 테스트를 만들 때 위 표로 옮긴다.

| PREFIX | 대상 | 단계 |
| --- | --- | --- |
| `LM-BOUNDS` | 지도 범위 계산 | M5 |
| `LM-URL` | 링크 공유용 해시 인코딩 | M6 |
| `LM-CSV` | CSV 내보내기 | M6 |
| `LME-PLOT` | E2E 저니 — 붙여넣기부터 CSV 까지 | M7 |
