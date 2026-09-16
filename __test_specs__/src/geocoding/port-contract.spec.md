---
prefix: LM-PORT
target: src/geocoding/__tests__/port-contract.test.ts
---

# GeocodePort 계약

지오코딩을 인터페이스 뒤에 가두는 이유는 하나다 — Kakao 를 아는 파일이 `kakao-adapter.ts`
하나로 끝나야 한다. 그러려면 가짜 어댑터와 진짜 어댑터가 **구별되지 않아야** 한다.
그래서 이 문서의 케이스는 두 구현에 똑같이 돌아간다 (`describe.each`).

계약의 핵심은 **성공도 실패도 값으로 돌려준다**는 것이다. 예외를 던지면 큐가 항목마다
상태를 기록하는 일이 try/catch 범벅이 되고, 중단과 진짜 오류를 구분하기 어려워진다.

Kakao 구현은 SDK 를 스텁으로 주입해 돌린다. 네트워크도 키도 쓰지 않는다.

### UC-LM-PORT-001 아는 주소는 한국 범위 안의 좌표로 돌아온다

- **Given** 두 구현 모두가 아는 주소(`서울 강남구 테헤란로 152`)가 있고
- **When** `geocode` 를 부르면
- **Then** `ok: true` 이고 위도가 33~39, 경도가 124~132 안에 들어오며 `label` 이 비어 있지 않다

경계값이 넉넉한 것은 정확한 좌표를 확인하려는 게 아니라 **축이 뒤집혔는지**를 잡으려는
것이기 때문이다. `x`/`y` 를 바꿔 넣으면 위도 127 이 되어 이 범위를 벗어난다.

### UC-LM-PORT-002 없는 주소는 zero_result 로 돌아온다

- **Given** 어느 표에도 없는 문자열이 있고
- **When** `geocode` 를 부르면
- **Then** `ok: false` 이고 `failure.reason` 이 `zero_result` 다

`zero_result` 와 나머지 실패를 나누는 이유는 사용자가 할 일이 다르기 때문이다 —
앞은 주소를 고치는 일이고 뒤는 다시 시도하는 일이다.

### UC-LM-PORT-003 빈 문자열은 실패로 돌아온다

- **Given** 공백만 있는 질의가 있고
- **When** `geocode` 를 부르면
- **Then** `ok: false` 다

SDK 를 실제로 부르는지는 계약이 정하지 않는다. 부르지 않는 편이 낫지만, 결과만 같으면 된다.

### UC-LM-PORT-004 이미 abort 된 signal 이면 즉시 끝난다

- **Given** 이미 `abort()` 된 `AbortSignal` 이 있고
- **When** 그 signal 과 함께 `geocode` 를 부르면
- **Then** 곧바로 `ok: false` 로 끝난다

이때의 실패는 큐가 `pending` 으로 되돌린다. 사용자가 멈춘 것을 "실패" 로 보여 주면
"내가 멈췄는데 왜 실패지" 가 된다.

### UC-LM-PORT-005 예외를 던지지 않고 값으로만 답한다

- **Given** 결과가 없는 질의와 빈 질의가 있고
- **When** `geocode` 를 부르면
- **Then** 어느 쪽도 reject 되지 않고 값으로 resolve 된다
