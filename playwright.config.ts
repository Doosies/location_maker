import { defineConfig } from '@playwright/test';

/**
 * 개발 서버가 아니라 preview(빌드 결과)를 대상으로 돌린다.
 * base 경로와 번들 설정까지 실제 배포본과 같은 조건에서 검증하기 위해서다.
 *
 * 서버가 셋인 이유는 **키 주입 시점이 빌드 타임**이기 때문이다. 키가 있는 화면과 없는
 * 화면은 서로 다른 번들이라 한 서버로는 둘 다 볼 수 없다.
 *
 * | 포트 | 빌드 | 무엇을 보나 |
 * | --- | --- | --- |
 * | 4173 | 스텁용 키 | 저니 전체. SDK 요청은 가로채므로 키 값은 쓰이지 않는다 |
 * | 4174 | 키 없음 | 키가 없을 때의 안내와, 그래도 입력이 도는지 |
 * | 4175 | 진짜 키(`VITE_KAKAO_JS_KEY`) | 실연동. 키가 없으면 실패한다 |
 *
 * 4173 의 키 값은 **자리를 채우는 문자열**이다. 비밀이 아니고, 그 요청은 네트워크로
 * 나가기 전에 스텁이 가로챈다. 키가 빈 문자열이면 로더가 아예 스크립트를 붙이지 않아
 * 가로챌 것도 없어지므로 값이 필요하다.
 */
const STUB_KEY = 'e2e-stub-key';

/**
 * 실연동은 따로 돌린다. 세 서버를 늘 띄우면 저니 한 번에 빌드가 셋이라 느려지고, CI 는
 * 실연동 서버를 쓰지도 않는다. 그래서 무엇을 띄울지 고른 프로젝트를 보고 정한다.
 */
const LIVE_ONLY = process.argv.includes('--project=live');

const STUB_SERVER = {
  command: `VITE_KAKAO_JS_KEY=${STUB_KEY} pnpm build --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port 4173`,
  url: 'http://localhost:4173/location_maker/',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const NO_KEY_SERVER = {
  command: 'pnpm build --outDir dist-e2e-no-key && pnpm exec vite preview --outDir dist-e2e-no-key --port 4174',
  url: 'http://localhost:4174/location_maker/',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const LIVE_SERVER = {
  // 키는 환경에서만 온다. 없으면 빈 문자열로 빌드되고 실연동 테스트가 실패한다 —
  // 조용히 건너뛰면 초록이 신호가 아니게 된다.
  command: 'pnpm build --outDir dist-e2e-live && pnpm exec vite preview --outDir dist-e2e-live --port 4175',
  url: 'http://localhost:4175/location_maker/',
  reuseExistingServer: !process.env.CI,
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
  projects: [
    {
      name: 'stub',
      testMatch: /paste-and-plot\.test\.ts/,
      use: { baseURL: 'http://localhost:4173/location_maker/' },
    },
    {
      name: 'no-key',
      testMatch: /no-key\.test\.ts/,
      use: { baseURL: 'http://localhost:4174/location_maker/' },
    },
    {
      name: 'live',
      testMatch: /live-kakao\.test\.ts/,
      use: { baseURL: 'http://localhost:4175/location_maker/' },
    },
  ],
  webServer: LIVE_ONLY ? [LIVE_SERVER] : [STUB_SERVER, NO_KEY_SERVER],
});
