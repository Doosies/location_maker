import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages 의 프로젝트 사이트는 /location_maker/ 아래에 놓인다.
// 이 값을 빼면 배포본에서 자산 경로가 전부 깨진다.
export default defineConfig({
  base: '/location_maker/',
  plugins: [react()],
});
