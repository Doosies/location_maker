---
prefix: LM-INPUT
target: src/ui/__tests__/AddressInput.test.tsx
---

# 주소 입력

사람들은 주소를 손으로 치지 않는다. 엑셀의 주소 열을 통째로 복사해 붙여넣는다.
그래서 여러 줄 textarea 하나가 입력의 전부이고, 화면이 해야 할 일은 **몇 줄이 조회될지
미리 보여 주는 것**뿐이다.

### UC-LM-INPUT-001 textarea 에 라벨이 붙어 있다

- **Given** 입력 컴포넌트를 렌더하고
- **When** 라벨 텍스트로 찾으면
- **Then** textarea 가 잡힌다

### UC-LM-INPUT-002 비어 있으면 표시 버튼이 비활성이다

- **Given** 입력이 비어 있고
- **When** 표시 버튼을 보면
- **Then** 비활성이다

### UC-LM-INPUT-003 빈 줄을 빼고 줄 수를 센다

- **Given** 주소 두 줄 사이에 빈 줄과 공백 줄이 섞여 있고
- **When** 줄 수 표시를 보면
- **Then** `2줄` 이다

파싱이 버리는 줄은 화면에서도 세지 않는다. 숫자가 다르면 사용자가 놀란다.

### UC-LM-INPUT-004 예시 넣어보기가 세 줄을 채운다

- **Given** 첫 진입 상태이고
- **When** `예시 넣어보기` 를 누르면
- **Then** 세 줄짜리 문자열로 `onChange` 가 불린다

첫 진입에서 바로 굴려 볼 수 있어야 한다.

### UC-LM-INPUT-005 비우기가 입력을 지운다

- **Given** 입력에 주소가 있고
- **When** `비우기` 를 누르면
- **Then** 빈 문자열로 `onChange` 가 불린다

### UC-LM-INPUT-006 표시 버튼이 onSubmit 을 부른다

- **Given** 입력에 주소가 한 줄 있고
- **When** `지도에 표시` 를 누르면
- **Then** `onSubmit` 이 한 번 불린다

### UC-LM-INPUT-007 조회 중에는 입력과 버튼이 잠긴다

- **Given** `disabled` 인 상태이고
- **When** 입력과 버튼 셋을 보면
- **Then** 전부 비활성이다

조회 도중에 입력이 바뀌면 목록과 입력이 어긋난다.
