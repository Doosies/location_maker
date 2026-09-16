import { defineConfig } from '@playwright/test';

/**
 * 개발 서버가 아니라 preview(빌드 결과)를 대상으로 돌린다.
 * base 경로와 번들 설정까지 실제 배포본과 같은 조건에서 검증하기 위해서다.
 *
 * 서버가 셋인 이유는 **키 주입 시점이 빌드 타임**이기 때문이다. 키가 있는 화면과 없는
 * 화면은 서로 다른 번들이라 한 서버로는 둘 다 볼 수 없다.
 *
 * | 언제 | 포트 | 빌드 | 무엇을 보나 |
 * | --- | --- | --- | --- |
 * | 기본 | 4173 | 스텁용 키 | 저니 전체. SDK 요청은 가로채므로 키 값은 쓰이지 않는다 |
 * | 기본 | 4174 | 키 없음 | 키가 없을 때의 안내와, 그래도 입력이 도는지 |
 * | 실연동 | 4173 | 진짜 키(`VITE_KAKAO_JS_KEY`) | 실연동. 스텁 서버와 같은 포트를 **번갈아** 쓴다 |
 *
 * 4173 의 키 값은 **자리를 채우는 문자열**이다. 비밀이 아니고, 그 요청은 네트워크로
 * 나가기 전에 스텁이 가로챈다. 키가 빈 문자열이면 로더가 아예 스크립트를 붙이지 않아
 * 가로챌 것도 없어지므로 값이 필요하다.
 */
const STUB_KEY = 'e2e-stub-key';

/**
 * 실연동은 따로 돌린다(`pnpm test:e2e:live`). 세 서버를 늘 띄우면 저니 한 번에 빌드가
 * 셋이라 느려지고, CI 는 실연동 서버를 쓰지도 않는다.
 *
 * 인자 철자(`--project=live`)가 아니라 **환경변수**로 고른다. `--project live` 처럼 띄어
 * 쓰거나 인자 없이 치면 철자 검사는 빗나가는데, 그때 서버와 프로젝트가 어긋나 엉뚱한
 * `ECONNREFUSED` 로 죽는다. 여기서는 켜진 쪽의 프로젝트만 아예 존재하게 둔다.
 */
const LIVE = process.env.E2E_LIVE === '1';

const STUB_SERVER = {
  command: `VITE_KAKAO_JS_KEY=${STUB_KEY} pnpm build --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port 4173`,
  url: 'http://localhost:4173/location_maker/',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const NO_KEY_SERVER = {
  // 빈 값을 **인라인으로** 준다. Vite 는 빌드에서도 `.env.local` 을 읽으므로, 그냥 두면
  // 키를 넣어 둔 개발 머신에서 이 번들이 '키 있는 번들' 이 된다 — 키 없는 배포를 보려고
  // 만든 저니가 정반대를 보게 된다. 인라인 값이 `.env.local` 을 이긴다.
  command:
    'VITE_KAKAO_JS_KEY= pnpm build --outDir dist-e2e-no-key && pnpm exec vite preview --outDir dist-e2e-no-key --port 4174',
  url: 'http://localhost:4174/location_maker/',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const LIVE_SERVER = {
  // 키는 환경에서만 온다. 없으면 빈 문자열로 빌드되고 실연동 테스트가 실패한다 —
  // 조용히 건너뛰면 초록이 신호가 아니게 된다.
  //
  // 포트가 스텁과 같은 4173 인 것은 일부러다. Kakao 는 origin 을 **포트까지** 비교하고,
  // 콘솔에 등록한 것은 5173·4173·github.io 셋이다. 4175 에서 붙으면 키가 맞아도
  // `401 domain mismatched` 로 거부된다. 실연동일 때는 스텁 서버를 띄우지 않으므로 겹치지 않는다.
  command: 'pnpm build --outDir dist-e2e-live && pnpm exec vite preview --outDir dist-e2e-live --port 4173',
  url: 'http://localhost:4173/location_maker/',
  // 이쪽만 재사용하지 않는다. 4173 에 스텁 서버가 남아 있으면 그걸 실연동으로 착각해
  // 스텁 번들을 보게 된다 — 가짜를 보고 "진짜에 붙었다" 고 말하는 셈이다.
  reuseExistingServer: false,
  timeout: 120_000,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    // 브라우저가 미리 깔린 환경(작업용 컨테이너 등)에서는 그 실행 파일을 그대로 쓴다.
    // CI 는 `playwright install` 로 받으므로 이 변수를 두지 않는다.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH === undefined
      ? {}
      : { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }),
  },
  // 프로젝트와 서버를 한 쌍으로 켠다. 한쪽만 있는 상태를 만들지 않는 편이 덜 부서진다.
  projects: LIVE
    ? [
        {
          name: 'live',
          testMatch: /live-kakao\.test\.ts/,
          use: { baseURL: 'http://localhost:4173/location_maker/' },
        },
      ]
    : [
        {
          name: 'stub',
          testMatch: /paste-and-plot\.test\.ts/,
          use: { baseURL: 'http://localhost:4173/location_maker/' },
        },
        {
          // 좁은 화면은 **폭을 실제로 좁혀야** 보인다. 1280px 저니는 모바일
          // 레이아웃을 한 번도 그리지 않으므로 그쪽 고장을 영영 못 잡는다.
          name: 'mobile',
          testMatch: /mobile-layout\.test\.ts/,
          use: {
            baseURL: 'http://localhost:4173/location_maker/',
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          },
        },
        {
          name: 'no-key',
          testMatch: /no-key\.test\.ts/,
          use: { baseURL: 'http://localhost:4174/location_maker/' },
        },
      ],
  webServer: LIVE ? [LIVE_SERVER] : [STUB_SERVER, NO_KEY_SERVER],
});
