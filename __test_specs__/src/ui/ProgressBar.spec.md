---
prefix: LM-PROGRESS
target: src/ui/__tests__/ProgressBar.test.tsx
---

# 진행 표시

오래 걸리는 동안 화면이 아무 말도 하지 않으면 사용자는 앱이 멈췄다고 본다. 그래서 몇 건
중 몇 건인지와 **멈추는 방법**을 항상 같이 보여 준다.

### UC-LM-PROGRESS-001 몇 건 중 몇 건인지 보여 준다

- **Given** 12건 중 7건이 끝났고
- **When** 진행 표시를 렌더하면
- **Then** `조회 중 7 / 12` 가 보인다

### UC-LM-PROGRESS-002 progressbar 가 현재 값과 최대값을 알린다

- **Given** 12건 중 7건이 끝났고
- **When** `progressbar` 역할을 찾으면
- **Then** `aria-valuenow` 가 7, `aria-valuemax` 가 12 다

막대는 그림이라 스크린 리더에는 이 값이 전부다.

### UC-LM-PROGRESS-003 중단 버튼이 onAbort 를 부른다

- **Given** 조회가 돌고 있고
- **When** `중단` 을 누르면
- **Then** `onAbort` 가 한 번 불린다

### UC-LM-PROGRESS-004 total 이 0 이어도 0 으로 나누지 않는다

- **Given** 전체가 0건이고
- **When** 진행 표시를 렌더하면
- **Then** `조회 중 0 / 0` 이 보이고 깨지지 않는다
