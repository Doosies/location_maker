---
prefix: LM-SHELL
target: src/ui/__tests__/MapPlaceholder.test.tsx
---

# 지도 자리 안내

키가 없을 때 앱이 흰 화면이 되면, 설정이 빠진 것인지 코드가 깨진 것인지 사용자도
개발자도 구분할 수 없다. 그래서 지도 자리는 어떤 경우에도 비어 있지 않다.

### UC-LM-SHELL-001 키가 없으면 안내 문구를 띄운다

- **Given** `VITE_KAKAO_JS_KEY` 가 비어 있고
- **When** 앱을 렌더하면
- **Then** 지도 영역에 키가 없다는 안내와 넣어야 할 변수 이름이 보인다

### UC-LM-SHELL-002 지도 영역은 항상 존재한다

- **Given** 키가 있든 없든
- **When** 앱을 렌더하면
- **Then** `지도` 라는 이름의 영역이 문서에 있다
