# M5 — 지도

> 진짜 지도에 마커를 찍는다. **이 앱에서 유일하게 키가 필요한 단계다.**

- 선행: M4 머지됨
- 키 필요: **예**
- 사람 개입: **HOLD-5 · HOLD-6 · HOLD-7 · HOLD-8** ✅ 2026-09-16 완료. PR 은 Fable 리뷰 후 Claude 가 머지한다

## ⛔ 착수 전에 사람이 해야 할 네 가지

이 넷이 전부 끝나기 전에는 이 단계를 시작하지 않는다. 하나라도 빠지면 지도가 뜨지 않고,
무엇 때문에 안 뜨는지 구분하기 어려워진다.

### HOLD-5 — Kakao 앱 준비

1. [Kakao Developers](https://developers.kakao.com) 에서 애플리케이션 생성
2. **무료 쿼터가 이미 다른 앱에 붙어 있는지 확인한다.** 쿼터는 개발자 계정 기준
   **처음 카카오맵 API 를 활성화한 앱 하나**에만 붙는다. 기존 앱이 쓰고 있으면 그 앱을
   옮기거나 이 앱에 비즈월렛을 연결해야 한다
3. 카카오맵 API 활성화

### HOLD-6 — 키 발급과 주입

1. 콘솔에서 **JavaScript 키**를 확인한다 (REST API 키·Admin 키가 아니다)
2. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - 이름: `KAKAO_JS_KEY` — **`VITE_` 를 붙이지 않는다.** `deploy.yml` 이
     `VITE_KAKAO_JS_KEY: ${{ secrets.KAKAO_JS_KEY }}` 로 이어 준다
   - 값: JavaScript 키

> 키 값은 스레드·PR·이슈·커밋 어디에도 붙여넣지 않는다. 위 화면에 직접 입력한다.

### HOLD-7 — 도메인 등록

콘솔 **내 애플리케이션 → 앱 설정 → 플랫폼 → Web → 사이트 도메인**에 둘을 등록한다.

- `http://localhost:5173` — `pnpm dev`
- `http://localhost:4173` — `pnpm preview`. **Playwright E2E 가 이 포트를 쓴다** (M7). 빼면
  실연동 저니가 도메인 미등록으로 거부된다
- `https://doosies.github.io`

등록은 origin 단위다. 경로는 구분하지 않으므로 `https://doosies.github.io` 하나면
`/location_maker/` 도 통과한다. 앱당 10개까지 등록된다.

### HOLD-8 — 로컬 개발용 키

저장소 루트에 `.env.local` 을 만들고 `VITE_KAKAO_JS_KEY=` 뒤에 JavaScript 키를 적는다.
`.gitignore` 에 있으므로 커밋되지 않는다.

## 완료 조건

- [x] 코드상으로는 주소를 넣으면 실제 지도에 마커가 찍힌다 — 실제 키로 눈으로 보는 것은
      민형 님 몫이다 (작업 환경에 키가 없고 카카오 도메인도 막혀 있다)
- [x] 마커 전체가 들어오도록 지도 범위가 자동으로 맞춰진다 (UC-LM-BOUNDS-003, UC-LM-MAP-004)
- [x] 마커 하나뿐일 때 최대 배율로 튀지 않는다 (UC-LM-BOUNDS-002·004)
- [x] 마커에 목록 자리 번호가 찍히고 원문·도로명·좌표를 들고 있다 (UC-LM-MARKER-003)
- [x] 목록 항목을 고르면 그 마커로 지도가 옮겨진다 (UC-LM-MAP-006)
- [x] SDK 로드 실패·타임아웃·도메인 미등록·키 없음이 각각 다른 문구다 (UC-LM-SDK-009)
- [ ] 배포된 `https://doosies.github.io/location_maker/` 에서도 지도가 뜬다 — 머지 후 확인

### 계획에서 달라진 것

**인포윈도우 대신 마커 자체에 번호를 그렸다.** `CustomOverlay` 로 번호 배지를 만들고
`title` 속성에 라벨을 둔다. 스프라이트 이미지를 받아 오지 않아도 되고, 번호가 지도에
바로 보이는 편이 목록과 짝짓기 쉽다. 클릭 인포윈도우는 M7 실연동에서 실제 동작을 본 뒤
붙이는 것이 낫다 — 지금 붙이면 키 없이는 검증할 수 없는 코드만 늘어난다.

**`MapPlaceholder` 를 지웠다.** 키가 없을 때의 안내는 `MapView` 가 실패 사유별로
보여 준다. 두 곳에 두면 문구가 갈라진다. `LM-SHELL` PREFIX 는 레지스트리의
"물러난 PREFIX" 로 옮겼다.

**`LM-SDK` · `LM-MARKER` · `LM-MAP` PREFIX 를 새로 뒀다.** 원래 이 단계에 배정된 것은
`LM-BOUNDS` 하나였는데, 로더의 실패 구분과 마커 갱신 차이는 각각 따로 검증할 값어치가
있다.

## 작업

### 1. SDK 로더 — `src/map/load-kakao-sdk.ts`

- `autoload=false` 로 스크립트를 붙이고 `kakao.maps.load(cb)` 로 기다린다
- `libraries=services` 를 빼먹지 않는다. 빼면 `services.Geocoder` 가 없다
- 중복 로드 방지 (한 번만 붙인다)
- 타임아웃 — 일정 시간 안에 안 오면 실패로 처리
- 실패 원인을 구분해 돌려준다: 키 없음 / 스크립트 로드 실패 / 초기화 거부

### 2. 지도 — `src/map/MapView.tsx`

- 컨테이너에 `kakao.maps.Map` 을 만든다
- 언마운트 때 정리한다
- 키가 없으면 지도를 만들지 않고 안내 문구를 렌더한다

### 3. 마커

- `found` 인 항목마다 마커 하나. 번호는 배열 인덱스 + 1
- 항목이 바뀌면 마커를 갱신한다 (전부 지우고 다시 그리지 않는다)
- 마커 클릭 → 인포윈도우에 주소·건물명·좌표
- 목록 항목 클릭 → 해당 마커 강조

### 4. 범위 맞춤 — `src/map/use-fit-bounds.ts`

`prefix: LM-BOUNDS`. **좌표 계산은 순수 함수로 분리해 테스트한다.**

| 케이스 | 기대 |
| --- | --- |
| 마커 여럿 | 전부 포함하는 bounds |
| 마커 하나 | bounds 대신 center + 고정 레벨 (점 하나짜리 bounds 는 최대 배율로 끌어당긴다) |
| 마커 없음 | 아무것도 하지 않는다 |

### 5. 어댑터 교체

`App.tsx` 에 꽂던 가짜 어댑터를 Kakao 어댑터로 바꾼다.
테스트에서는 여전히 가짜를 쓴다.

### 6. PR

`feat: Kakao 지도와 마커 표시` 로 PR.
머지 후 **배포된 주소에서 지도가 실제로 뜨는지** 확인한다. 로컬에서 되고 배포에서 안 되면
도메인 등록(HOLD-7) 이나 Secrets(HOLD-6) 를 의심한다.

## 산출물

```
src/map/load-kakao-sdk.ts
src/map/MapView.tsx
src/map/use-fit-bounds.ts
src/map/markers.ts
src/map/kakao-maps.ts
src/map/__tests__/use-fit-bounds.test.ts
src/map/__tests__/load-kakao-sdk.test.ts
src/map/__tests__/markers.test.ts
src/map/__tests__/MapView.test.tsx
__test_specs__/src/map/use-fit-bounds.spec.md
__test_specs__/src/map/load-kakao-sdk.spec.md
__test_specs__/src/map/markers.spec.md
__test_specs__/src/map/MapView.spec.md
```

## 다음

[M6 — 가져가기](06-m6-share.md)
