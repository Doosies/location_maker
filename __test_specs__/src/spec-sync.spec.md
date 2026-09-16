---
prefix: LM-SPEC-SYNC
target: src/__tests__/spec-sync.test.ts
---

# 스펙 ↔ 테스트 짝 검사

"스펙 문서를 먼저 쓴다" 는 관습으로는 지켜지지 않는다. 바쁘면 건너뛰고, 건너뛴 것은
아무도 모른다. 그래서 검사를 테스트로 만들어 둔다 — 스펙 없이 테스트를 추가하면
그 자리에서 빨개진다.

검사는 `@cas/spec-sync` 가 한다. 이 파일은 그 검사기를 이 저장소에 겨눌 뿐이다.

### UC-LM-SPEC-SYNC-001

- **Given** `src/` 아래의 모든 테스트 파일과 `__test_specs__/` 의 스펙 문서들
- **When** `checkSpecSync` 를 등록된 PREFIX 목록과 함께 돌리면
- **Then** 위반이 하나도 없다
