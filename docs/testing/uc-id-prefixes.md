# UC ID PREFIX 레지스트리

테스트 제목은 `UC-<PREFIX>-<NNN>: ...` 으로 시작한다. PREFIX 는 저장소 전역에서 유일하고,
번호는 append-only 다 — 테스트를 지워도 번호를 재사용하지 않는다. 짝이 되는 스펙 문서는
`__test_specs__/` 아래에 테스트 경로를 미러링해 둔다.

규약의 출처는 `common_agent_system` 의 UC ID 규약이다. 자세한 배경은
[설계 문서 §9](../design/02-architecture.md#9-테스트) 에 있다.

| PREFIX | 대상 | 단계 |
| --- | --- | --- |
| `LM-SHELL` | 앱 껍데기 — 키가 없을 때의 안내를 포함한다 | M1 |
| `LM-SPEC-SYNC` | 스펙 ↔ 테스트 짝 검사 자체 | M1 |
| `LM-PARSE` | 붙여넣은 텍스트를 주소 줄로 나누기 | M2 |
| `LM-QUEUE` | 지오코딩 큐 — 동시 실행, 중단, 쿼터 처리 | M2 |
| `LM-BOUNDARY` | `src/domain/` 이 바깥을 끌어오지 않는지 | M2 |
| `LM-PORT` | `GeocodePort` 계약 | M3 |
| `LM-KAKAO` | Kakao 어댑터 | M3 |
| `LM-STORE` | 상태 저장소와 순서 불변식 | M4 |
| `LM-INPUT` | 주소 입력 컴포넌트 | M4 |
| `LM-LIST` | 결과 목록 컴포넌트 | M4 |
| `LM-BOUNDS` | 지도 범위 계산 | M5 |
| `LM-URL` | 링크 공유용 해시 인코딩 | M6 |
| `LM-CSV` | CSV 내보내기 | M6 |
| `LME-PLOT` | E2E 저니 — 붙여넣기부터 CSV 까지 | M7 |
