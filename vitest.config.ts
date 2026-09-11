import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 도메인 코드는 DOM 이 필요 없다. 브라우저 환경을 쓰는 곳과 나눠 두면
// 순수 로직이 DOM 에 기대는 순간 테스트가 먼저 알려 준다.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{domain,share,geocoding}/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/{ui,state,map}/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
