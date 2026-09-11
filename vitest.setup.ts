import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// globals 를 켜지 않았으므로 Testing Library 의 자동 정리가 걸리지 않는다.
// 직접 붙여 주지 않으면 앞 테스트가 렌더한 DOM 이 남아 다음 테스트를 오염시킨다.
afterEach(cleanup);
