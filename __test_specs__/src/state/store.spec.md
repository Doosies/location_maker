---
prefix: LM-STORE
target: src/state/__tests__/store.test.ts
---

# 항목 배열 하나와 그 순서

이 앱의 상태는 "줄 목록" 하나다. 상태 라이브러리를 쓰지 않고 `useSyncExternalStore` 로
구독한다. 지켜야 할 규칙은 하나뿐이고, 그것이 이 문서의 전부다.

**배열 순서 = 입력 줄 순서 = 마커 번호.** 조회가 끝나는 순서는 제멋대로지만 목록은 절대
흐트러지지 않는다. 그래서 갱신은 항상 `id` 로 제자리 교체다.

### UC-LM-STORE-001 setEntries 는 배열을 통째로 교체한다

- **Given** 새 항목 세 개가 있고
- **When** `setEntries` 를 부르면
- **Then** 스냅샷의 `entries` 가 그 배열이다

### UC-LM-STORE-002 updateEntry 는 그 항목만 바꾼다

- **Given** 항목 세 개가 들어 있고
- **When** 가운데 항목을 `found` 로 갱신하면
- **Then** 그 항목만 바뀌고 길이와 순서는 그대로다

### UC-LM-STORE-003 갱신이 아무 순서로 와도 목록 순서는 그대로다

- **Given** 항목 세 개가 들어 있고
- **When** 세 번째 → 첫 번째 → 두 번째 순서로 갱신하면
- **Then** 목록의 `id` 순서와 원문이 입력 순서 그대로다

이 앱에서 가장 중요한 불변식이다. 목록이 흔들리면 마커 번호가 어긋난다.

### UC-LM-STORE-004 없는 id 로 갱신하면 아무 일도 없다

- **Given** 항목 세 개가 들어 있고
- **When** 없는 `id` 로 갱신하면
- **Then** 스냅샷이 **같은 객체 그대로**다

새 객체를 만들면 화면이 이유 없이 다시 그려진다.

### UC-LM-STORE-005 원본 배열과 원본 항목을 건드리지 않는다

- **Given** 바깥에서 만든 배열을 넣어 두고
- **When** 한 항목을 갱신하면
- **Then** 바깥 배열의 그 항목은 그대로다

### UC-LM-STORE-006 구독자는 바뀔 때만 불린다

- **Given** 구독자가 하나 붙어 있고
- **When** 값이 바뀌지 않는 호출(`setRunning(false)` → 이미 false)을 섞어 부르면
- **Then** 실제로 바뀐 횟수만큼만 불리고, 구독 해제 뒤에는 불리지 않는다

`useSyncExternalStore` 는 매 렌더에서 `getSnapshot` 을 부르고 `Object.is` 로 비교한다.
매번 새 객체를 돌려주면 무한 루프가 난다.

### UC-LM-STORE-007 reset 은 빈 상태로 돌아간다

- **Given** 항목이 들어 있고 조회가 돌고 있으며
- **When** `reset` 을 부르면
- **Then** `entries` 가 비고 `running` 이 false 다

### UC-LM-STORE-008 countByStatus 는 못 찾음·오류·건너뜀을 함께 센다

- **Given** `found` · `notFound` · `failed` · `skipped` · `loading` 이 하나씩 있고
- **When** `countByStatus` 를 부르면
- **Then** 찾음 1, 실패 3, 끝난 것 4, 전체 5 다

사용자에게는 "못 찾음" 과 "오류" 와 "건너뜀" 이 똑같이 안 된 줄이다. 요약 칩에서는 한
숫자로 센다. 건너뛴 줄을 빼면 `찾음 + 실패` 가 전체와 맞지 않아 숫자가 이상해진다.
