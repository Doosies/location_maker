---
prefix: LM-BOUNDARY
target: src/domain
---

# 도메인 경계

`src/domain/` 은 순수 로직만 둔다. 여기서 React 나 브라우저 전역이나 Kakao SDK 를
끌어오는 순간, 가짜 어댑터로 전부 테스트한다는 M3 의 전제가 무너진다. 그 경계는
사람이 지켜 주기를 바라는 것보다 테스트로 막는 편이 싸다.

## UC-LM-BOUNDARY-001: 도메인은 같은 폴더 밖을 import 하지 않는다

- **Given** `src/domain/` 의 소스 파일들이 있고 (테스트 파일은 제외)
- **When** import 구문을 모두 모으면
- **Then** 전부 같은 폴더를 가리키는 상대 경로다

## UC-LM-BOUNDARY-002: 도메인은 브라우저 전역을 쓰지 않는다

- **Given** `src/domain/` 의 소스 파일들이 있고
- **When** 본문을 훑으면
- **Then** `window` · `document` · `kakao` 가 나오지 않는다
