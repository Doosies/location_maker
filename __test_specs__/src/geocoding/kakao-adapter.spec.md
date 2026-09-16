---
prefix: LM-KAKAO
target: src/geocoding/__tests__/kakao-adapter.test.ts
---

# Kakao 어댑터

계약 자체는 [포트 계약 문서](port-contract.spec.md) 가 본다. 여기서는 **Kakao 특유의 것**만
본다 — 좌표 축, 콜백을 Promise 로 감싸는 층, 주소→키워드 순서, `status` 분류.

시그니처의 근거는 `docs/findings/kakao-sdk.md` 다. 설계 문서가 아니다.

### UC-LM-KAKAO-001 x 를 lng 로, y 를 lat 로 옮긴다

- **Given** SDK 가 `x: '127.036486'`, `y: '37.500713'` 을 돌려주고
- **When** `geocode` 를 부르면
- **Then** `lat` 이 37.500713, `lng` 이 127.036486 이다

이 프로젝트에서 가장 뒤집기 쉬운 자리다. `LatLng(위도, 경도)` 순서와 `x`=경도가 겹친다.
축을 옮기는 코드가 한 함수뿐인 것도 이 때문이다.

### UC-LM-KAKAO-002 문자열 좌표를 숫자로 바꾼다

- **Given** SDK 가 좌표를 문자열로 돌려주고
- **When** `geocode` 를 부르면
- **Then** `lat`·`lng` 의 타입이 `number` 다

`parseFloat` 없이 그대로 넘기면 지도 SDK 가 조용히 어긋난 위치를 찍는다.

### UC-LM-KAKAO-003 road_address 가 null 이면 roadAddress 를 비워 둔다

- **Given** SDK 응답의 `road_address` 가 `null` 이고
- **When** `geocode` 를 부르면
- **Then** `place.roadAddress` 가 `undefined` 다

도로명 주소가 없는 주소가 실제로 있다. 빈 문자열을 넣어 두면 화면이 빈 줄을 그린다.

### UC-LM-KAKAO-004 주소로 못 찾으면 키워드 검색으로 한 번 더 간다

- **Given** 주소 검색이 `ZERO_RESULT` 를 주고 키워드 검색이 장소를 주며
- **When** `geocode` 를 부르면
- **Then** 두 검색이 모두 불렸고 결과의 `matchedBy` 가 `keyword`, `label` 이 상호명이다

사람들은 "카카오판교오피스" 처럼 상호명을 붙여넣는다. 지번·도로명으로만 찾으면 그 줄은
전부 실패로 남는다.

### UC-LM-KAKAO-005 주소로 찾았으면 키워드 검색을 부르지 않는다

- **Given** 주소 검색이 `OK` 로 결과를 주고
- **When** `geocode` 를 부르면
- **Then** 키워드 검색은 한 번도 불리지 않는다

쿼터를 두 배로 쓰지 않기 위해서다.

### UC-LM-KAKAO-006 양쪽 다 결과가 없으면 zero_result 다

- **Given** 주소 검색과 키워드 검색이 모두 `ZERO_RESULT` 를 주고
- **When** `geocode` 를 부르면
- **Then** `failure.reason` 이 `zero_result` 다

### UC-LM-KAKAO-007 ERROR 는 sdk 실패로 분류한다 (쿼터로 추측하지 않는다)

- **Given** 주소 검색이 `ERROR` 를 주고
- **When** `geocode` 를 부르면
- **Then** `failure.reason` 이 `sdk` 다

**M3 에서 내린 결정이다.** SDK 는 쿼터 초과를 별도 코드로 알려 주지 않는다 —
서버 오류와 한도 초과가 `ERROR` 하나로 섞여 온다. `quota` 로 부르면 큐가 남은 항목을
통째로 멈추므로, 근거 없이 그렇게 부르면 멀쩡한 조회까지 죽는다. 그래서 어댑터는
`quota` 를 내지 않는다. `Failure` 타입과 큐의 `quota` 경로는 그대로 둔다 —
가짜 어댑터가 그 경로를 계속 검증하고, 나중에 쿼터를 알아볼 방법이 생기면 그때 쓴다.

### UC-LM-KAKAO-008 SDK 가 동기 예외를 던져도 값으로 답한다

- **Given** SDK 메서드가 콜백 대신 예외를 던지고
- **When** `geocode` 를 부르면
- **Then** reject 되지 않고 `failure.reason: 'sdk'` 와 예외 메시지가 담겨 돌아온다

스크립트가 아직 로드되지 않았을 때 실제로 이렇게 된다.

### UC-LM-KAKAO-009 좌표가 숫자로 파싱되지 않으면 결과로 치지 않는다

- **Given** SDK 가 `OK` 와 함께 빈 좌표 문자열을 주고
- **When** `geocode` 를 부르면
- **Then** `ok: false` 다

`NaN` 좌표를 지도에 넘기면 마커가 사라지거나 엉뚱한 곳에 생긴다.

### UC-LM-KAKAO-010 전역에 SDK 가 없으면 어댑터를 만들지 않는다

- **Given** 전역에 `kakao.maps.services` 가 없고
- **When** `createKakaoGeocoderFromGlobal` 을 부르면
- **Then** `null` 이 돌아온다 (있으면 어댑터가 돌아온다)

키가 없거나 스크립트가 막혔을 때 흰 화면 대신 안내를 띄우려면, 부르는 쪽이 이 구분을
값으로 볼 수 있어야 한다.
