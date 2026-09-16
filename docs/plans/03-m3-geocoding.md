# M3 — 어댑터

> 지오코딩을 인터페이스 뒤에 가둔다. 이 단계가 잘 되면 Kakao 를 아는 파일이
> `kakao-adapter.ts` 하나로 끝난다.

- 선행: M2 머지됨
- 키 필요: 아니오 (코드를 쓰는 데는 필요 없다. 실제로 불러 보는 것은 M5)
- 사람 개입: **HOLD-4** (착수 전), **HOLD-3** (PR 머지)

## ~~⛔ HOLD-4~~ — 완료 (2026-09-16)

민형 님이 카카오 Web API 문서를 붙여넣어 주셨고, 대조 결과는
[`docs/findings/kakao-sdk.md`](../findings/kakao-sdk.md) 에 있다. **어댑터를 고칠 때는
아래 목록이 아니라 그 문서를 본다.** 아래는 무엇을 확인했는지의 기록으로 남긴다.

<details>
<summary>대조 항목 (완료)</summary>

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

</details>

## 완료 조건

- [x] `GeocodePort` 인터페이스가 정의돼 있다 (`domain/types.ts`, `geocoding/port.ts` 가 re-export)
- [x] 가짜 어댑터와 Kakao 어댑터가 **같은 계약 테스트**를 통과한다 (`describe.each`, UC-LM-PORT-001~005)
- [x] Kakao 어댑터 밖의 어떤 파일도 `kakao` 전역을 쓰지 않는다
- [x] SDK 대조 결과가 `docs/findings/kakao-sdk.md` 에 기록돼 있다

### 쿼터를 어떻게 볼지 — M3 에서 내린 결정 (2026-09-16 민형 님 승인)

설계는 `reason: 'quota'` 를 만나면 큐 전체를 멈추기로 했는데, SDK 는 쿼터 초과를 별도
status 로 알려 주지 않는다. 서버 오류와 한도 초과가 `ERROR` 하나로 섞여 온다.

**Kakao 어댑터는 `quota` 를 내지 않는다.** `ERROR` 는 전부 `sdk` 로 분류한다. 근거 없이
`quota` 로 부르면 일시적인 서버 오류 한 번에 남은 항목이 통째로 멈춘다. 거꾸로 진짜
한도 초과였다면 나머지도 어차피 `ERROR` 로 실패하므로, 실패 항목이 제자리에 남는다는
점은 같다 — 차이는 "다시 시도하면 될까" 뿐인데 그건 사용자가 판단하는 편이 낫다.

`Failure` 타입과 큐의 `quota` 경로는 **그대로 둔다.** 가짜 어댑터가 그 경로를 계속
검증하고, 쿼터를 알아볼 방법이 생기면(예: REST 로 가면 HTTP 429 가 보인다) 그때 쓴다.

## 작업

### 1. 인터페이스 — `src/geocoding/port.ts`

**계약 자체는 M2 에서 `src/domain/types.ts` 로 들어갔다.** 도메인이 바깥을 import 하지
않아야 해서, 큐가 쓰는 타입이 도메인 안에 있어야 했기 때문이다. 그러니 `port.ts` 는
정의하지 않고 **re-export 한다.** 같은 계약을 두 군데에 두면 반드시 어긋난다.

```ts
export type { GeocodePort, GeocodeResult } from '../domain/types';
```

계약의 모양은 이렇다.

```ts
export type GeocodeResult =
  | { ok: true; place: Place }
  | { ok: false; failure: Failure };

export interface GeocodePort {
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult>;
}
```

성공/실패를 예외가 아니라 값으로 돌려준다. 큐가 항목마다 상태를 기록해야 하고,
예외는 동시성 코드에서 다루기 번거롭다.

어댑터를 쓰기 전에 [Kakao SDK 실제 시그니처](../findings/kakao-sdk.md) 를 먼저 읽는다.

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
