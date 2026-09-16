# 전체 설계

지도 API 는 **Kakao** 로 확정했다. 그 결정이 이 설계의 가장 큰 제약을 하나 없앤다 —
**서버가 없다.** 정적 파일 몇 개를 올리면 끝나는 앱이고, 그래서 배포·비밀키·CORS·세션이
전부 설계에서 빠진다.

## 1. 확정 사항

| 항목 | 선택 | 비고 |
| --- | --- | --- |
| 지도 · 지오코딩 | Kakao Maps JS SDK + services 라이브러리 | |
| 언어 | TypeScript | strict |
| 프레임워크 | React | 상태가 단순해 상태 라이브러리 없음 |
| 번들러 | Vite | |
| 단위 · 컴포넌트 | Vitest | node + jsdom 두 프로젝트 |
| E2E | Playwright | |
| 백엔드 | 없음 | Kakao JS 앱키로 브라우저 직접 호출 |
| 배포 | GitHub Pages + GitHub Actions | |
| 테스트 규약 | UC ID | `@cas/spec-sync` 재사용 |

### 백엔드를 두지 않는 근거

Kakao JS SDK 의 `services.Geocoder` 는 **JavaScript 앱키**로 브라우저에서 직접 동작한다.
JavaScript 앱키는 Kakao 개발자 콘솔에 등록한 웹 도메인에서만 통하는 공개키라, 번들에 박혀
노출되는 것이 설계상 정상이다. 감출 비밀이 없으니 프록시 서버도 필요 없다.

프록시를 둬도 실제로는 막히지 않는다는 점이 더 중요하다. 백엔드를 세우면 키는 숨겨지지만
그 백엔드 주소는 브라우저가 호출해야 하니 여전히 공개된다. 남이 그 서버로 직접 요청을 쏘면
그대로 쿼터가 나간다. 진짜로 막으려면 로그인·호출 제한·도메인 확인을 다시 붙여야 하는데,
그건 Kakao 가 도메인 등록으로 이미 해주는 일이다.

**생각이 바뀌어야 하는 시점:** 유료 전환을 해서 실제로 돈이 나가기 시작할 때, 또는 주소
목록을 서버에 저장하는 기능이 생길 때. 그때는 프록시가 아니라 제대로 된 백엔드를 설계한다.
`GeocodePort` 인터페이스가 그 교체를 어댑터 한 장으로 만들어 둔다.

## 2. 모듈 경계

설계에서 지킬 규칙은 하나다. **주소를 다루는 로직은 Kakao 를 모른다.** 지오코딩은
`GeocodePort` 인터페이스 뒤에 있고, Kakao 어댑터와 테스트용 가짜 어댑터가 같은 인터페이스를
구현한다. 덕분에 도메인 로직 전체가 브라우저도 SDK 도 없이 테스트되고, 나중에 쿼터 정책이
바뀌어 VWorld 를 덧대야 해도 어댑터 한 장만 늘어난다.

```
브라우저 의존 ─────────────────────────────────────────
  ui/              map/              geocoding/kakao
  입력·목록·진행    SDK 로드·마커      어댑터
      │                │                    │
      ▼                ▼                    │ implements
순수 TypeScript ───────────────────────      │
  state/  항목 배열 하나 · 구독        geocoding/port
      │                             ↑ 인터페이스
      ▼                             │ implements
  domain/  파싱·중복 제거·동시성 큐   geocoding/fake
  의존성 0                            테스트용
```

화살표는 의존 방향이다. 위층은 아래층을 알지만 아래층은 위층을 모른다.
`state` 는 `port` 인터페이스만 알고 구현체는 모른다.

## 3. 디렉터리

```
location_maker/
├─ index.html
├─ vite.config.ts
├─ vitest.config.ts          // node·jsdom 두 프로젝트
├─ playwright.config.ts
├─ .env.example              // VITE_KAKAO_JS_KEY=
├─ docs/
│  ├─ design/                // 이 문서들
│  └─ plans/                 // 마스터플랜·세부플랜·TODO
├─ __test_specs__/           // 테스트 스펙, src/ 경로를 미러링
│  ├─ src/domain/parse-addresses.spec.md
│  ├─ src/domain/geocode-queue.spec.md
│  └─ …
├─ e2e/
│  ├─ __test_specs__/paste-and-plot.spec.md
│  ├─ fixtures/kakao-sdk-stub.ts
│  └─ paste-and-plot.spec.ts
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ domain/                // 순수 TS. import 는 같은 폴더뿐
   │  ├─ types.ts
   │  ├─ parse-addresses.ts
   │  ├─ geocode-queue.ts
   │  └─ __tests__/
   ├─ geocoding/
   │  ├─ port.ts             // GeocodePort
   │  ├─ kakao-adapter.ts
   │  ├─ fake-adapter.ts
   │  └─ __tests__/
   ├─ map/
   │  ├─ load-kakao-sdk.ts
   │  ├─ MapView.tsx
   │  ├─ use-fit-bounds.ts
   │  └─ __tests__/
   ├─ state/
   │  ├─ store.ts            // useSyncExternalStore
   │  └─ __tests__/
   ├─ share/
   │  ├─ url-state.ts        // 주소 목록 ↔ 주소창
   │  ├─ to-csv.ts
   │  └─ __tests__/
   └─ ui/
      ├─ AddressInput.tsx
      ├─ ResultList.tsx
      ├─ ResultItem.tsx
      └─ __tests__/
```

`__test_specs__/` 가 `src/` 경로를 그대로 미러링하는 것은 임의 규칙이 아니라
`@cas/spec-sync` 가 짝을 찾는 방식이다. `src/domain/__tests__/parse-addresses.test.ts` 는
`__test_specs__/src/domain/parse-addresses.spec.md` 와 짝이고, 둘 중 하나가 없으면 테스트가
실패한다.

## 4. 데이터 모델

모델은 배열 하나다. **배열 순서 = 사용자가 입력한 줄 순서 = 지도 마커 번호**이고,
이 셋이 끝까지 어긋나지 않는 것이 이 앱의 유일한 불변식이다.

```ts
export type EntryStatus =
  | 'pending'    // 아직 조회 안 함
  | 'loading'    // 조회 중
  | 'found'      // 좌표 있음
  | 'notFound'   // 조회했지만 결과 없음
  | 'failed';    // 네트워크·쿼터·SDK 오류

export type Entry = {
  id: string;           // 안정적 key. 원문이 같아도 줄마다 다름
  raw: string;          // 사용자가 친 원문. 절대 덮어쓰지 않음
  normalized: string;   // 조회 키. 같으면 같은 곳이므로 한 번만 조회한다
  status: EntryStatus;
  place?: {
    lat: number;
    lng: number;
    label: string;      // 지도·목록에 보여 줄 이름
    roadAddress?: string;
    matchedBy: 'address' | 'keyword';
  };
  failure?: {
    reason: 'zero_result' | 'network' | 'quota' | 'sdk';
    message: string;    // 사용자에게 그대로 보여 줄 한 줄
  };
};
```

**왜 `raw` 를 남기나** — 실패한 항목은 사용자가 고쳐서 다시 시도해야 한다. 그때 입력창에
되돌려 놓을 문자열은 정규화된 값이 아니라 사용자가 실제로 친 문장이어야 한다. 정규화 결과만
들고 있으면 "내가 쓴 게 이게 아닌데" 하는 순간이 온다.

## 5. 데이터 흐름

1. **파싱** (`domain/parse-addresses.ts`) — 줄바꿈으로 자르고, 앞뒤 공백과 빈 줄을 버리고,
   엑셀에서 딸려온 따옴표와 번호 접두사를 뗀다. **줄 하나가 항목 하나다** — 정규화하면
   같아지는 줄이 둘이어도 목록에서 지우지 않는다. 배열 순서 = 입력 줄 순서 = 마커 번호라는
   불변식이 먼저이고, CSV 줄 수도 입력 줄 수와 같아야 하기 때문이다. 중복은 목록이 아니라
   **큐에서** 접는다 — `normalized` 가 같으면 조회를 한 번만 하고 결과를 나눠 쓴다.
   반환값은 `Entry[]` 이고 전부 `pending`.
2. **큐** (`domain/geocode-queue.ts`) — 동시 3건으로 제한해 순서대로 흘려보낸다.
   `GeocodePort` 만 받는 순수 함수라 가짜 어댑터로 전부 테스트된다. 한 건이 끝날 때마다
   콜백으로 결과를 올려 보내, 화면이 끝까지 기다리지 않고 마커를 하나씩 찍는다.
   `AbortSignal` 로 중단을 받는다.
3. **조회** (`geocoding/kakao-adapter.ts`) — 먼저 `Geocoder.addressSearch` 로 주소를 찾고,
   결과가 없으면 `Places.keywordSearch` 로 건물명·상호를 한 번 더 시도한다. 어느 쪽으로
   찾았는지는 `matchedBy` 에 남겨 목록에 표시한다. 콜백 API 를 Promise 로 감싸는 층은
   여기 한 곳뿐이다.
4. **반영** (`state/store.ts`) — `id` 로 해당 항목만 교체한다. 배열 길이와 순서는 조회 중에
   절대 변하지 않는다.
5. **표시** (`map/`) — `found` 인 항목마다 마커를 하나 놓고, 큐가 끝나면 `LatLngBounds` 로
   전체를 담는 범위를 잡는다. 마커가 하나뿐이면 `setBounds` 대신 `setCenter` 와 고정 레벨을
   쓴다. 점 하나짜리 bounds 는 최대 배율까지 끌어당긴다.
6. **가져가기** (`share/`) — 주소 원문 목록만 URL 해시에 담는다. 좌표는 넣지 않는다.
   링크를 연 쪽이 다시 조회하면 되고, URL 이 짧아야 어디든 붙는다. CSV 는 좌표까지 포함한다.

## 6. 실패 처리

| 상황 | 감지 | 화면 | 복구 |
| --- | --- | --- | --- |
| 주소를 못 찾음 | `ZERO_RESULT` | `notFound` — 원문 그대로, 원래 자리에 | 고쳐서 다시 · 건너뛰기 |
| 네트워크 끊김 | 요청 거부 · 타임아웃 | `failed` — 그 항목만 실패 | 항목별 재시도 버튼 |
| 쿼터 초과 | HTTP 429 | **전체 중단** + 상단 안내 | 남은 항목은 `pending` 으로 보존 |
| SDK 로드 실패 | 스크립트 onerror · 타임아웃 | 지도 자리에 안내. 입력은 살아 있음 | 새로고침 안내 |
| 도메인 미등록 | SDK 초기화 거부 | 개발자용 메시지를 그대로 노출 | 콘솔에 도메인 등록 |

**쿼터 초과만 전체를 멈추는 이유** — 한 건이 429 를 받았다면 나머지도 받는다. 계속 쏘면
실패 목록만 길어지고 쿼터는 더 깎인다. 남은 항목을 `pending` 으로 남겨 두면 사용자가 내일
같은 링크를 열어 이어서 할 수 있다.

## 7. 키와 환경변수

> **키 값은 코드에도 문서에도 들어가지 않는다.** 저장소에 들어가는 것은 변수 이름뿐이다.
> 실제 값은 필요한 시점에 담당자에게 요청하고, 담당자가 환경에 주입한다. 값을 지어내거나
> 추측해 채우지 않는다. 값이 필요한 시점은 M5 이며, 그전까지는 가짜 어댑터로 개발이 진행된다.

| 어디 | 무엇이 들어가나 | 누가 넣나 | 커밋 |
| --- | --- | --- | --- |
| 저장소 | `.env.example` — 변수 이름과 빈 값, 발급처 한 줄 | 코드 작성자 | 함 |
| 로컬 개발 | `.env.local` — 실제 값 | 담당자 (직접) | 안 함 (`.gitignore`) |
| 배포 · CI | GitHub Actions Secrets | 담당자 (저장소 설정) | 안 함 |

```
# .env.example — 저장소에 들어가는 파일 전체
# Kakao 개발자 콘솔 > 내 애플리케이션 > 앱 키 > JavaScript 키
VITE_KAKAO_JS_KEY=
```

### 알고 있어야 할 것

- **`VITE_` 변수는 런타임이 아니라 빌드 시점에 치환된다.** 배포 플랫폼에서도 *런타임* 이
  아니라 **빌드** 환경변수로 넣어야 하고, 값을 바꾸면 다시 빌드해야 반영된다.
- 빌드된 JS 파일에는 값이 **평문으로 들어 있고, 사이트를 연 누구나 읽을 수 있다.**
  브라우저가 읽어야 동작하니 다른 방법이 없다. 배포처를 바꿔도 마찬가지다.
- Kakao 공식 예제부터가 SDK 주소 뒤에 `?appkey=…` 를 붙여 페이지에 키를 적는다.
  Google Maps·Mapbox·Firebase 웹 설정·Stripe 공개키도 같은 구조다.
- 그래서 이 값을 지키는 것은 **비밀 유지가 아니라 도메인 제한**이다. Kakao 가 요청 도메인을
  콘솔 등록 목록과 대조하므로, 키를 복사해 남의 사이트에 붙여도 거부된다.
- **Kakao REST API 키와 Admin 키는 이 앱 어디에도 넣지 않는다.** 도메인 제한이 없어 노출되면
  남이 그대로 쓴다. 브라우저에서 도는 코드에 들어갈 자리가 없다.
- 쿼터는 개발자 계정에서 **처음 활성화한 앱 하나**에만 붙는다.
- 키가 없을 때 앱은 **흰 화면이 아니라 안내 문구**를 띄운다. 설정이 빠진 것과 코드가 깨진
  것을 구분할 수 있어야 한다.
- 잔여 위험: 브라우저가 아닌 서버에서 도메인 정보를 위조하는 것은 기술적으로 가능하다
  (Google Maps 키도 같은 구조인 업계 공통 약점). 현실적 대비는 콘솔에서 사용량을 가끔 보는
  것이고, 유료 전환을 켜지 않으면 쿼터 초과 요청은 실패할 뿐 과금되지 않는다.

## 8. 배포

**GitHub Pages + GitHub Actions.** `Doosies/location_maker` 가 공개 저장소라 무료이고,
계정을 더 만들지 않으며, 테스트·빌드·배포가 워크플로 하나에 들어간다.
주소는 `https://doosies.github.io/location_maker/` 다.

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: pnpm}
      - run: pnpm install --frozen-lockfile
      - run: pnpm test            # 깨지면 배포가 안 나갑니다
      - run: pnpm build
        env:
          VITE_KAKAO_JS_KEY: ${{ secrets.KAKAO_JS_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: {path: dist}

  deploy:
    needs: build
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

- Vite 에 `base: '/location_maker/'` 를 넣어야 한다. 프로젝트 사이트는 하위 경로로
  서비스되므로, 빠뜨리면 자산 경로가 전부 깨진다.
- Kakao 콘솔에 등록할 도메인은 둘이다 — 로컬 개발 주소와 `https://doosies.github.io`.
  등록은 origin 단위라 같은 주소에 올린 다른 본인 프로젝트도 이 키로 통과하게 된다.
- **미리보기 배포는 쓰지 않는다.** Kakao 는 와일드카드 도메인을 비즈 앱에만 열어 주므로,
  커밋마다 주소가 바뀌는 미리보기에서는 등록이 불가능해 지도가 뜨지 않는다. Pages 에는
  미리보기가 없어 이 문제를 만나지 않는다. 사이트 도메인은 앱당 10개까지 등록된다.
- 전용 도메인이나 브랜치 미리보기가 필요해지면 **Cloudflare Pages** 로 옮긴다. 옮기는 비용은
  워크플로 파일 하나와 Kakao 콘솔 도메인 한 줄이다. 상세 비교는
  [03-deployment.md](03-deployment.md).

## 9. 테스트

"테스트 스펙 먼저, 테스트 코드 나중" 순서를 관습이 아니라 **게이트**로 둔다.
`@cas/spec-sync` 는 의존성이 없는 검증기라 그대로 가져다 쓸 수 있고, 스펙 문서 없이 테스트를
추가하면 그 자리에서 실패한다.

| 계층 | 도구 | 대상 | 지도 SDK |
| --- | --- | --- | --- |
| 단위 | vitest · node | `domain/` `share/` | 안 씀 |
| 계약 | vitest · node | 두 어댑터가 같은 `GeocodePort` 계약 테스트를 통과 | 가짜 어댑터 |
| 컴포넌트 | vitest · jsdom | `ui/` `state/` | 가짜 어댑터 |
| E2E | playwright | 붙여넣기 → 마커 → CSV 전 구간 | 라우트 가로채 스텁 |
| 실연동 | playwright · 수동 | 실제 Kakao SDK 한 바퀴 | 진짜 |

E2E 에서 실제 Kakao SDK 를 쓰지 않는 이유는 CI 가 네트워크와 쿼터에 묶이기 때문이다.
`page.route` 로 SDK 요청을 가로채 고정 응답을 주면 결과가 결정적이 된다. 대신 **진짜로
붙는지 확인하는 실연동 테스트를 하나 따로** 두고 수동으로 돌린다. 스텁만 있으면 "우리 코드는
맞는데 SDK 계약이 바뀐" 경우를 영영 못 잡는다.

### UC ID

```ts
// src/domain/__tests__/parse-addresses.test.ts
it('UC-LM-PARSE-003: 엑셀에서 온 따옴표를 떼어낸다', () => { … });
```

```markdown
<!-- __test_specs__/src/domain/parse-addresses.spec.md -->
---
prefix: LM-PARSE
target: src/domain/__tests__/parse-addresses.test.ts
---

### UC-LM-PARSE-003 `strips quotes pasted from a spreadsheet`

- **Given** 각 줄이 큰따옴표로 감싸인 입력을 붙여넣는다
- **When** `parseAddresses(input)` 을 호출한다
- **Then** 따옴표가 제거된 주소가 나오고 raw 에는 원문이 남는다
```

### PREFIX 레지스트리 초안

| PREFIX | 테스트 파일 |
| --- | --- |
| `LM-PARSE` | `src/domain/__tests__/parse-addresses.test.ts` |
| `LM-QUEUE` | `src/domain/__tests__/geocode-queue.test.ts` |
| `LM-PORT` | `src/geocoding/__tests__/port-contract.test.ts` |
| `LM-KAKAO` | `src/geocoding/__tests__/kakao-adapter.test.ts` |
| `LM-STORE` | `src/state/__tests__/store.test.ts` |
| `LM-URL` | `src/share/__tests__/url-state.test.ts` |
| `LM-CSV` | `src/share/__tests__/to-csv.test.ts` |
| `LM-BOUNDS` | `src/map/__tests__/use-fit-bounds.test.ts` |
| `LM-INPUT` | `src/ui/__tests__/AddressInput.test.tsx` |
| `LM-LIST` | `src/ui/__tests__/ResultList.test.tsx` |
| `LM-SPEC-SYNC` | `src/__tests__/spec-sync.test.ts` |
| `LME-PLOT` | `e2e/paste-and-plot.spec.ts` |

## 10. 구현 순서

| 단계 | 내용 |
| --- | --- |
| M1 | **바닥** — Vite · TypeScript · Vitest · Playwright · `spec-sync` 게이트. 배포 워크플로도 여기서 붙여 빈 화면이라도 Pages 에 한 번 올려 둔다. 배포를 마지막에 붙이면 그때 터진다. |
| M2 | **도메인** — 파싱과 큐. 스펙 → 테스트 → 구현. 화면 없이 여기까지 끝난다. |
| M3 | **어댑터** — `GeocodePort` 와 가짜 어댑터를 먼저, Kakao 어댑터를 나중에. 계약 테스트를 두 구현에 함께 돌린다. |
| M4 | **화면** — 입력 · 목록 · 진행 표시. 아직 지도는 없고, 가짜 어댑터로 동작하는 앱이 된다. |
| M5 | **지도** — SDK 로드, 마커, 범위 맞춤. 여기서 처음으로 실제 키가 필요하다. |
| M6 | **가져가기** — URL 상태와 CSV. |
| M7 | **E2E** — 스텁 저니 하나와 실연동 하나. |

M2 까지 끝나면 **Kakao 계정 없이도** 이 앱의 핵심 로직이 전부 테스트로 돌아간다. 계정 설정이
늦어져도 개발이 멈추지 않는 순서로 짰다.

단계별 상세와 사람이 개입해야 하는 지점은 [../plans/00-master-plan.md](../plans/00-master-plan.md) 를 본다.

## 11. 구현 전에 확인할 것

> **SDK 시그니처는 문서로 대조해야 한다.** 이 문서의 `addressSearch` · `keywordSearch` ·
> `LatLngBounds` 는 기억에 기대 쓴 것이다. 설계 세션이 네트워크 정책상 Kakao 문서에 접속하지
> 못했다. M3 · M5 착수 시점에 공식 문서와 타입 정의로 대조할 것 — 콜백 인자 이름, 응답 필드
> (`x` 가 경도이고 `y` 가 위도인 점 포함), 상태 상수 이름이 특히 어긋나기 쉽다.

- TypeScript 타입은 커뮤니티 정의(`kakao.maps.d.ts` 계열)를 쓸지, 쓰는 범위만 직접 선언할지
  M3 에서 정한다. 후자가 어댑터 한 파일에 갇혀 있어 더 안전하다.
- `@cas/spec-sync` 를 어떻게 끌어올지 M1 에서 정한다. `common_agent_system` 은 비공개
  저장소라 git 의존성으로 걸면 CI 에 PAT 가 필요하다. 파일 수가 적으니 복사(vendoring) 를
  권한다.
- Kakao 개발자 계정에서 **무료 쿼터가 이미 다른 앱에 붙어 있는지** 확인이 필요하다.
  계정당 첫 활성화 앱 하나뿐이다.
