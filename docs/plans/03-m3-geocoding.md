# M3 — 어댑터

> 지오코딩을 인터페이스 뒤에 가둔다. 이 단계가 잘 되면 Kakao 를 아는 파일이
> `kakao-adapter.ts` 하나로 끝난다.

- 선행: M2 머지됨
- 키 필요: 아니오 (코드를 쓰는 데는 필요 없다. 실제로 불러 보는 것은 M5)
- 사람 개입: **HOLD-4** (착수 전), **HOLD-3** (PR 머지)

## ⛔ HOLD-4 — 착수 전에 SDK 문서를 대조한다

설계 문서에 적힌 Kakao SDK 시그니처는 **기억에 기대 쓴 것**이다. 설계 세션이 네트워크
정책상 Kakao 문서에 접속하지 못했다. 아래를 공식 문서와 타입 정의로 확인하기 전에는
어댑터 코드를 쓰지 않는다.

- `kakao.maps.services.Geocoder` 의 `addressSearch(query, callback, options?)` 시그니처
- 콜백 인자 `(result, status)` 구조, `kakao.maps.services.Status` 상수 이름
  (`OK` / `ZERO_RESULT` / `ERROR` 로 알고 있으나 확인 필요)
- 결과 항목의 좌표 필드 — **`x` 가 경도, `y` 가 위도**인지.
  뒤집혀 있으면 마커가 전부 바다로 간다
- 결과 항목의 `address_name` / `road_address` / `address` 구조
- `kakao.maps.services.Places().keywordSearch(query, callback, options?)` 시그니처
- SDK 로드 URL 의 `libraries=services`, `autoload=false` + `kakao.maps.load(cb)` 패턴

문서에 접속 가능한 환경에서 에이전트가 직접 확인할 수 있으면 그렇게 해도 된다.
확인 결과는 `docs/findings/kakao-sdk.md` 에 남긴다 — 다음 사람이 또 찾지 않도록.

## 완료 조건

- [ ] `GeocodePort` 인터페이스가 정의돼 있다
- [ ] 가짜 어댑터와 Kakao 어댑터가 **같은 계약 테스트**를 통과한다
- [ ] Kakao 어댑터 밖의 어떤 파일도 `kakao` 전역을 쓰지 않는다
- [ ] SDK 대조 결과가 `docs/findings/kakao-sdk.md` 에 기록돼 있다

## 작업

### 1. 인터페이스 — `src/geocoding/port.ts`

```ts
export type GeocodeResult =
  | { ok: true; place: NonNullable<Entry['place']> }
  | { ok: false; failure: NonNullable<Entry['failure']> };

export interface GeocodePort {
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult>;
}
```

성공/실패를 예외가 아니라 값으로 돌려준다. 큐가 항목마다 상태를 기록해야 하고,
예외는 동시성 코드에서 다루기 번거롭다.

### 2. 가짜 어댑터 — `src/geocoding/fake-adapter.ts`

- 고정 주소 테이블을 들고 있다 (`테헤란로 152` → 좌표 등)
- 테이블에 없으면 `zero_result`
- 특정 문자열을 넣으면 `network` / `quota` 를 내도록 해서 실패 경로를 테스트한다
- 응답 지연을 흉내 내는 옵션 — 큐의 동시성 테스트에 필요하다

### 3. 계약 테스트 — `src/geocoding/__tests__/port-contract.test.ts`

`prefix: LM-PORT`. **두 구현 모두에 같은 테스트를 돌린다.**

| 케이스 | 기대 |
| --- | --- |
| 존재하는 주소 | `ok: true`, `lat`/`lng` 가 한국 범위 안 |
| 없는 주소 | `ok: false`, `reason: 'zero_result'` |
| 빈 문자열 | `ok: false` (호출 자체를 안 해도 된다) |
| `signal` 이 이미 abort 됨 | 즉시 끝난다 |

Kakao 구현은 SDK 를 스텁으로 주입해 돌린다. 실제 네트워크를 쓰지 않는다.

### 4. Kakao 어댑터 — `src/geocoding/kakao-adapter.ts`

`prefix: LM-KAKAO`.

- **콜백 API 를 Promise 로 감싸는 층은 이 파일 하나뿐이다.**
- 순서: `Geocoder.addressSearch` → 결과 없으면 `Places.keywordSearch` 로 한 번 더
- 어느 쪽으로 찾았는지 `matchedBy: 'address' | 'keyword'` 에 남긴다
- 좌표 변환: SDK 의 `x`/`y` 를 `lng`/`lat` 로 **명시적으로** 옮긴다.
  이 한 줄에 주석을 단다 — 가장 헷갈리는 지점이다
- 실패 분류: `ZERO_RESULT` → `zero_result`, HTTP 429 → `quota`, 그 외 → `network` / `sdk`
- SDK 는 생성자 인자로 주입받는다. 전역을 직접 읽지 않는다 (테스트 때문에)

### 5. 타입 정의 방식 결정

| 방법 | 장점 | 단점 |
| --- | --- | --- |
| **쓰는 범위만 직접 선언 (권장)** | 어댑터 한 파일에 갇힌다. 의존성 없음 | 직접 써야 한다 (양은 적다) |
| 커뮤니티 패키지 (`kakao.maps.d.ts` 계열) | 전체가 덮인다 | 버전 추종 문제. 실제 SDK 와 어긋날 수 있다 |

HOLD-4 에서 확인한 실제 시그니처로 직접 선언하는 쪽을 권한다.

### 6. ⛔ HOLD-3 — PR

`feat: 지오코딩 포트와 Kakao 어댑터` 로 PR.

## 산출물

```
src/geocoding/port.ts
src/geocoding/fake-adapter.ts
src/geocoding/kakao-adapter.ts
src/geocoding/__tests__/port-contract.test.ts
src/geocoding/__tests__/kakao-adapter.test.ts
__test_specs__/src/geocoding/port-contract.spec.md
__test_specs__/src/geocoding/kakao-adapter.spec.md
docs/findings/kakao-sdk.md
```

## 다음

[M4 — 화면](04-m4-ui.md)
