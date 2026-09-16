---
prefix: LM-SDK
target: src/map/__tests__/load-kakao-sdk.test.ts
---

# Kakao SDK 로더

이 파일의 핵심은 스크립트를 붙이는 것이 아니라 **실패 원인을 구분하는 것**이다.
화면에서는 전부 "지도가 안 뜬다" 로 같아 보이지만 사람이 할 일이 다르다.

다만 **잘못된 키와 미등록 도메인은 `init` 이 아니라 `script` 로 온다.** `dapi.kakao.com`
이 JS 대신 4xx JSON 을 돌려주고, 브라우저는 2xx 가 아닌 응답에 `load` 가 아니라 `error`
를 쏘기 때문이다. 브라우저에서는 `<script>` 의 응답 코드를 읽을 수 없어 이보다 잘게
가를 수 없다 — 그래서 `script` 문구가 네트워크·키·도메인 셋을 함께 가리킨다.

테스트는 가짜 `document` 와 가짜 전역을 주입해 돈다. 네트워크도 키도 쓰지 않는다.

### UC-LM-SDK-001 키가 없으면 스크립트를 붙이지 않는다

- **Given** 키가 빈 문자열이고
- **When** 로더를 부르면
- **Then** `reason: 'no-key'` 이고 스크립트가 붙지 않는다

키 없이 요청을 보내 봐야 거부당할 뿐이다.

### UC-LM-SDK-002 services 라이브러리와 autoload=false 로 붙인다

- **Given** 키가 있고
- **When** 로더를 부르면
- **Then** `src` 에 `libraries=services` · `autoload=false` · 그 키가 들어 있다

`libraries=services` 를 빼면 `services.Geocoder` 가 없어 어댑터가 통째로 죽는다.

### UC-LM-SDK-003 kakao.maps.load 가 끝나야 성공이다

- **Given** 전역에 `kakao.maps.load` 가 있고
- **When** 스크립트 `load` 이벤트 뒤 그 콜백이 불리면
- **Then** `ok: true` 다

`autoload=false` 라 스크립트가 왔다고 끝이 아니다. 여기서 명시적으로 부른다.

### UC-LM-SDK-004 스크립트를 못 받으면 script 실패다

- **Given** 로딩이 진행 중이고
- **When** `error` 이벤트가 오면
- **Then** `reason: 'script'` 다

### UC-LM-SDK-005 스크립트는 왔는데 전역이 없으면 init 실패다

- **Given** 전역에 `kakao` 가 없고
- **When** `load` 이벤트가 오면
- **Then** `reason: 'init'` 이다

2xx 로 받았는데 전역이 없는 드문 경우다. 키·도메인 문제는 여기까지 오지 않고 `error`
로 끝난다.

### UC-LM-SDK-006 응답이 없으면 타임아웃으로 끝난다

- **Given** 스크립트가 아무 이벤트도 내지 않고
- **When** 타임아웃이 지나면
- **Then** `reason: 'timeout'` 이다

영영 기다리면 화면이 "불러오는 중" 에 고정된다.

### UC-LM-SDK-007 두 번 불러도 스크립트는 하나다

- **Given** 로딩이 진행 중이고
- **When** 다시 부르면
- **Then** 스크립트가 하나뿐이고 같은 약속을 돌려준다

두 번 붙이면 SDK 가 두 번 초기화된다.

### UC-LM-SDK-008 실패한 뒤에는 스크립트를 새로 붙여 다시 시도한다

- **Given** 앞선 시도가 실패로 끝났고
- **When** 다시 부르면
- **Then** 새 약속이 나오고 스크립트가 새로 붙어, 그 시도도 제 사유로 끝난다

네트워크가 잠깐 끊긴 경우, 새로고침 없이 다시 붙일 수 있어야 한다. 실패한 요소를
재사용하면 그 요소의 `load`·`error` 는 이미 발화한 뒤라 두 번째 시도가 언제나
타임아웃으로 끝난다.

### UC-LM-SDK-009 실패 사유마다 할 일이 다른 문구를 준다

- **Given** 실패 문구 표가 있고
- **When** 값들을 보면
- **Then** 넷이 서로 다르고, `no-key` 는 변수 이름을, `script` 는 네트워크·키·도메인
  셋을 함께 가리킨다
