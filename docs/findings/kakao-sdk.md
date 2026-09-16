# Kakao 지도 SDK — 실제 시그니처

> HOLD-4 의 결과다. 설계 문서의 SDK 관련 서술은 네트워크가 막힌 상태에서 기억에 기대
> 작성됐다. 이 문서가 그 자리를 대신한다. **어댑터를 쓸 때는 설계 문서가 아니라 이 문서를 본다.**

확인일: 2026-09-16

## 무엇으로 확인했나

| 출처 | 확인한 것 | 신뢰도 |
| --- | --- | --- |
| 카카오 Web API 문서 (민형 님이 붙여넣어 주심) | 메서드 시그니처, 옵션, 콜백 인자 | **공식** |
| 같은 문서의 `keywordSearch` 옵션 표 | `x` = longitude, `y` = latitude | **공식** |
| npm `kakao.maps.d.ts@0.1.40` 타입 정의 | 결과 항목의 필드 이름과 타입 | 커뮤니티 (공식 아님) |

결과 항목의 **필드 이름**은 공식 Web API 문서가 "로컬 REST API 응답결과 참고" 로 넘기고,
그 페이지(`developers.kakao.com`)는 이 세션의 네트워크 정책에 막혀 열 수 없었다.
그래서 타입 정의 패키지로 채웠고, 좌표 축의 의미만은 공식 옵션 표로 교차 확인했다.
**M7 의 실연동 테스트(HOLD-9)에서 실제 응답으로 한 번 더 확인해야 한다.**

## 핵심 — 여기서 틀리면 마커가 바다로 간다

```
x = 경도 (longitude)   // 한국이면 대략 126~130
y = 위도 (latitude)    // 한국이면 대략 33~39
```

그리고 **둘 다 `string` 이다.** 숫자가 아니다. `parseFloat` 없이 `kakao.maps.LatLng` 에
넣으면 조용히 어긋난다. `LatLng(위도, 경도)` 순서라는 점과 겹쳐서, 어댑터에서 뒤집기
가장 쉬운 자리다.

```ts
// 안전한 변환 — 위도·경도 순서와 문자열 파싱을 한 곳에서만 한다
const lat = Number.parseFloat(item.y);
const lng = Number.parseFloat(item.x);
```

## 주소 검색 — `kakao.maps.services.Geocoder`

```ts
geocoder.addressSearch(addr, callback, options?)
```

- `addr`: 변환할 주소명
- `options`: `page` (기본 1), `size` (기본 10, 1~30), `analyze_type` (`SIMILAR` 기본 | `EXACT`)
- `callback(result, status, pagination)`

`result` 항목:

| 필드 | 타입 | 내용 |
| --- | --- | --- |
| `address_name` | string | 전체 지번 또는 도로명 주소. 입력에 따라 결정된다 |
| `address_type` | string | `REGION` · `ROAD` · `REGION_ADDR` · `ROAD_ADDR` |
| `x` | **string** | 경도 |
| `y` | **string** | 위도 |
| `address` | object | 지번 주소 상세 |
| `road_address` | object \| null | 도로명 주소 상세. **없을 수 있다** |

`road_address` 안에 `address_name`, `road_name`, `building_name`, `zone_no`, `x`, `y` 등이 있다.
`building_name` 은 목록에 보여 줄 이름으로 쓸 만하지만 빈 문자열인 경우가 흔하다.

## 키워드 검색 — `kakao.maps.services.Places`

**`Geocoder` 가 아니다.** 인스턴스를 따로 만들어야 한다.

```ts
const places = new kakao.maps.services.Places();
places.keywordSearch(keyword, callback, options?)
```

- `options` 중 우리가 쓸 만한 것: `size` (기본 15, 1~15), `page`, `location`/`x`,`y` + `radius`,
  `bounds`, `sort` (`ACCURACY` 기본 | `DISTANCE`)
- `callback(result, status, pagination)`

`result` 항목:

| 필드 | 타입 | 내용 |
| --- | --- | --- |
| `id` | string | 장소 ID |
| `place_name` | string | 장소명·상호 |
| `address_name` | string | 지번 주소 |
| `road_address_name` | string | 도로명 주소 |
| `x` | **string** | 경도 |
| `y` | **string** | 위도 |
| `phone` | string | 전화번호 |
| `place_url` | string | 상세페이지 URL |
| `category_group_name` | string | 카테고리 |

## 응답 코드 — `kakao.maps.services.Status`

| 값 | 뜻 | 우리 쪽 처리 |
| --- | --- | --- |
| `OK` | 결과 있음 | `found` |
| `ZERO_RESULT` | 정상 응답, 결과 없음 | `notFound` (`reason: 'zero_result'`) |
| `ERROR` | 서버 응답에 문제 | `failed` (`reason: 'sdk'`) |

**`network` 도 쓰이지 않는다.** SDK 는 네트워크 실패를 따로 알려 주지 않고 `ERROR` 에
섞어 보낸다. 그래서 Kakao 어댑터가 내는 실패 사유는 `zero_result` 와 `sdk` 둘뿐이다.
설계 §6 이 네트워크 실패와 SDK 실패의 복구 안내를 다르게 두고 있으므로, M4 에서 문구를
정할 때 이 점을 본다.

`status` 는 문자열이다 (`'OK'` 등). `kakao.maps.services.Status.OK` 와 비교하면 된다.

**쿼터 초과가 별도 코드로 오지 않는다.** 설계에서 `reason: 'quota'` 를 두고 큐 전체를
멈추기로 했는데, 이 콜백만으로는 쿼터인지 일반 오류인지 구분되지 않는다.

**M3 결정: Kakao 어댑터는 `quota` 를 내지 않는다.** `ERROR` 는 전부 `sdk` 로 분류한다.
서버 오류 한 번에 남은 항목을 통째로 멈추는 쪽이 더 나쁘기 때문이다. 큐의 `quota`
경로는 그대로 두고 가짜 어댑터가 계속 검증한다. 근거는
[M3 플랜](../plans/03-m3-geocoding.md#쿼터를-어떻게-볼지--m3-에서-내린-결정) 에 있다.

## 콜백을 Promise 로 감싸는 자리

SDK 는 콜백 API 다. 이것을 Promise 로 바꾸는 층은 `kakao-adapter.ts` **한 곳뿐**이어야 한다.
`GeocodePort` 는 성공·실패를 예외가 아니라 값으로 돌려주므로, 어댑터 안에서 `status` 를
읽어 `{ ok: true | false }` 로 바꾼다.

## 남은 확인거리

- [ ] 실제 응답으로 `x`/`y` 확인 (HOLD-9, M7)
- [ ] `road_address` 가 `null` 인 주소로 한 번 돌려보기
- [ ] 쿼터 초과 시 실제로 오는 `status` 값 — 확인되면 위 결정을 다시 볼 것
