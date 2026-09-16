import { defineConfig } from '@playwright/test';

// 개발 서버가 아니라 preview(빌드 결과)를 대상으로 돌린다.
// base 경로와 번들 설정까지 실제 배포본과 같은 조건에서 검증하기 위해서다.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173/location_maker/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4173/location_maker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
