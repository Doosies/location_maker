# M2 — 도메인

> 주소를 다루는 순수 로직. 브라우저도 SDK 도 Kakao 계정도 없이 여기까지 끝난다.
> 이 단계가 끝나면 이 앱의 머리는 전부 테스트로 돌아간다.

- 선행: M1 머지됨
- 키 필요: 아니오
- 사람 개입: **HOLD-3** (PR 머지)

## 완료 조건

- [ ] `parseAddresses` 가 스펙의 모든 케이스를 통과한다
- [ ] `runGeocodeQueue` 가 동시 3건 제한과 중단을 지킨다
- [ ] `src/domain/` 이 같은 폴더 밖을 import 하지 않는다 (React·DOM·SDK 전부)
- [ ] 모든 테스트에 UC ID 가 있고 스펙 문서와 1:1 이다

## 작업

### 1. 타입 — `src/domain/types.ts`

[02-architecture.md §4](../design/02-architecture.md#4-데이터-모델) 의 `Entry`,
`EntryStatus` 를 그대로 옮긴다. 여기서 `raw` 는 **절대 덮어쓰지 않는 필드**라는 주석을 단다.

### 2. 파싱 — `src/domain/parse-addresses.ts`

스펙 문서 `__test_specs__/src/domain/parse-addresses.spec.md` (`prefix: LM-PARSE`) 를 먼저 쓴다.
다뤄야 할 케이스:

| 상황 | 기대 |
| --- | --- |
| 줄바꿈으로 구분된 주소들 | 줄마다 `Entry` 하나 |
| 빈 줄, 공백만 있는 줄 | 버린다 |
| 앞뒤 공백 | 트림한다. `raw` 에는 트림된 값 |
| 엑셀에서 온 `"서울 …"` 큰따옴표 | 뗀다 |
| `1. 서울 …`, `1) 서울 …` 번호 접두사 | 뗀다 |
| CRLF (`\r\n`) | LF 와 같게 다룬다 |
| 정규화하면 같아지는 두 줄 | 항목은 둘로 남고 `normalized` 가 같다. 접기는 큐가 한다 |
| 전부 빈 입력 | 빈 배열 |

반환은 `Entry[]`, 전부 `status: 'pending'`.
`id` 는 줄 순서가 같아도 유일해야 한다 (원문이 같은 줄이 둘일 수 있다).

### 3. 큐 — `src/domain/geocode-queue.ts`

스펙 문서 `__test_specs__/src/domain/geocode-queue.spec.md` (`prefix: LM-QUEUE`).

```ts
type RunOptions = {
  entries: Entry[];
  port: GeocodePort;          // M3 에서 정의. 여기서는 최소 인터페이스만 선언해 두고
  concurrency?: number;       // 기본 3
  signal?: AbortSignal;
  onResult: (entry: Entry) => void;
};
```

다뤄야 할 케이스:

| 상황 | 기대 |
| --- | --- |
| 항목 10개, 동시 3 | 동시에 도는 요청이 3을 넘지 않는다 |
| 한 건이 끝날 때마다 | `onResult` 가 즉시 불린다 (전부 끝날 때까지 기다리지 않는다) |
| 한 건이 실패 | 나머지는 계속 돈다 |
| `reason: 'quota'` 가 나오면 | **전체를 멈춘다.** 남은 항목은 `pending` 으로 남는다 |
| `signal.abort()` | 진행 중인 것만 끝내고 새로 시작하지 않는다 |
| 빈 배열 | 아무것도 안 하고 즉시 끝난다 |

`port` 만 받는 순수 함수다. 이 파일에서 `window`, `document`, `kakao` 를 쓰지 않는다.

### 4. 경계 지키기

`src/domain/` 안에서 바깥을 import 하지 않는지 확인하는 테스트나 lint 규칙을 하나 둔다.
이 경계가 무너지면 M3 의 가짜 어댑터 전략이 통째로 의미를 잃는다.

### 5. ⛔ HOLD-3 — PR

`feat: 주소 파싱과 지오코딩 큐` 로 PR.

## 산출물

```
src/domain/types.ts
src/domain/parse-addresses.ts
src/domain/geocode-queue.ts
src/domain/__tests__/parse-addresses.test.ts
src/domain/__tests__/geocode-queue.test.ts
__test_specs__/src/domain/parse-addresses.spec.md
__test_specs__/src/domain/geocode-queue.spec.md
```

## 다음

[M3 — 어댑터](03-m3-geocoding.md)
