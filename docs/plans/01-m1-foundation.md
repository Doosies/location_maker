# M1 — 바닥

> 테스트 게이트와 배포 파이프라인을 먼저 세운다. 빈 화면이라도 Pages 에 한 번 올려 둔다.
> **배포를 마지막에 붙이면 그때 터진다.**

- 선행: 없음
- 키 필요: 아니오
- 사람 개입: **HOLD-1**, **HOLD-2**, **HOLD-3**

## 완료 조건

- [ ] `pnpm dev` 로 빈 앱이 뜬다
- [ ] `pnpm test` 가 통과한다 (테스트가 `spec-sync` 하나뿐이어도)
- [ ] `pnpm type-check` 가 통과한다
- [ ] `pnpm build` 가 `dist/` 를 만든다
- [ ] main 에 머지되면 `https://doosies.github.io/location_maker/` 가 열린다
- [ ] `.env.example` 에 변수 이름만 있고 값은 없다

## 작업

### 1. 프로젝트 생성

- Vite + React + TypeScript 로 스캐폴드
- `tsconfig` 는 `strict: true`
- 패키지 매니저는 pnpm (`common_agent_system` 과 맞춘다)
- `vite.config.ts` 에 **`base: '/location_maker/'`** — 빠뜨리면 Pages 에서 자산이 전부 깨진다

### 2. 테스트 도구

- `vitest.config.ts` 에 프로젝트 둘
  - `node` — `src/domain`, `src/share`, `src/geocoding`
  - `jsdom` — `src/ui`, `src/state`, `src/map`
- `playwright.config.ts` — `baseURL` 은 `pnpm preview` 주소
- Testing Library 설치

### 3. ✅ HOLD-2 — spec-sync 반입 방식 (2026-09-16 결정: **git 의존성**)

민형 님이 복사(vendoring) 대신 **git 의존성**을 택했다. 상류의 수정이 이어지기를
원해서다. 그래서 `package.json` 에 이렇게 들어간다.

```
"@cas/spec-sync": "git+https://github.com/Doosies/common_agent_system.git#<커밋 SHA>&path:/packages/spec-sync"
```

커밋 SHA 로 고정한다. 브랜치로 걸면 상류가 바뀔 때 이 저장소의 빌드가 소리 없이
달라진다. 상류를 따라갈 때는 SHA 를 올리고 그것만으로 한 커밋을 만든다.

`common_agent_system` 이 **비공개**라 CI 와 로컬 양쪽에 인증이 필요하다.
읽기 전용 fine-grained PAT 를 저장소 Secret `CAS_READ_TOKEN` 에 두고, 워크플로의
`pnpm install` 앞에서 git credential helper 로 넘긴다. 토큰을 URL 에 박지 않는 이유는
그 URL 이 로그와 락파일로 새기 쉬워서다.

**부작용:** 포크에서 올라온 PR 은 시크릿을 받지 못하므로 `pnpm install` 에서 실패한다.
외부 기여를 받게 되면 그때 다시 본다.

### 4. 테스트 게이트 붙이기

- `src/__tests__/spec-sync.test.ts` 를 만들어 `checkSpecSync({packageRoot})` 를 호출
- PREFIX 레지스트리를 `docs/testing/uc-id-prefixes.md` 로 만들고 `knownPrefixes` 로 넘긴다
  (초안은 [02-architecture.md §9](../design/02-architecture.md#9-테스트))
- 이 테스트 자신의 스펙 문서 `__test_specs__/src/spec-sync.spec.md` 도 같이 만든다
  (`prefix: LM-SPEC-SYNC`, `UC-LM-SPEC-SYNC-001`)

### 5. 키 자리 만들기

```
# .env.example
# Kakao 개발자 콘솔 > 내 애플리케이션 > 앱 키 > JavaScript 키
VITE_KAKAO_JS_KEY=
```

- `.gitignore` 에 `.env.local`, `.env.*.local`, `dist`, `node_modules`, `playwright-report`,
  `test-results`
- **값은 쓰지 않는다.** 이 단계에서는 키가 필요 없다.

### 6. CI 와 배포 워크플로

- `.github/workflows/ci.yml` — PR 마다 `type-check` → `test` → `build`
- `.github/workflows/deploy.yml` — main 푸시마다 `test` → `build` → Pages 배포
  (전문은 [02-architecture.md §8](../design/02-architecture.md#8-배포))
- 빌드 스텝의 `env` 에 `VITE_KAKAO_JS_KEY: ${{ secrets.KAKAO_JS_KEY }}`
  시크릿이 아직 없어도 빌드는 성공한다. 값이 빈 문자열이 될 뿐이다.

### 7. 키 없을 때의 화면

- `VITE_KAKAO_JS_KEY` 가 비어 있으면 지도 자리에 **안내 문구**를 띄운다
- 흰 화면이 되면 안 된다. 설정이 빠진 것과 코드가 깨진 것을 구분할 수 있어야 한다
- M1 시점에는 지도 컴포넌트가 없으니, `App.tsx` 에 자리만 잡고 문구를 넣어 둔다

### 8. ⛔ HOLD-1 — GitHub Pages 활성화

저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꾼다.

이게 안 되어 있으면 `deploy.yml` 의 `actions/deploy-pages` 스텝이 실패한다.
에이전트는 저장소 설정을 바꿀 권한이 없다.

→ 여기서 멈추고 요청한다.

### 9. ⛔ HOLD-3 — PR

`chore: 프로젝트 바닥과 배포 파이프라인 구성` 으로 PR 을 올린다.
머지 후 배포된 주소가 실제로 열리는지 확인한다.

## 산출물

```
vite.config.ts  vitest.config.ts  playwright.config.ts  tsconfig.json
package.json  .env.example  .gitignore
.github/workflows/ci.yml  .github/workflows/deploy.yml
docs/testing/uc-id-prefixes.md
tools/spec-sync/…                        (HOLD-2 승인 시)
src/main.tsx  src/App.tsx
src/__tests__/spec-sync.test.ts
__test_specs__/src/spec-sync.spec.md
```

## 다음

[M2 — 도메인](02-m2-domain.md)
