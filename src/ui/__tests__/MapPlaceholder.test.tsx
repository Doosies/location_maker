import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MapPlaceholder } from '../MapPlaceholder';

// 이 테스트는 키가 주입되지 않은 환경(=CI 기본)에서 도는 것을 전제로 한다.
describe('MapPlaceholder', () => {
  it('UC-LM-SHELL-001: 키가 없으면 안내 문구를 띄운다', () => {
    render(<MapPlaceholder />);

    expect(screen.getByText(/지도를 띄울 키가 없다/)).toBeInTheDocument();
    expect(screen.getByText('VITE_KAKAO_JS_KEY')).toBeInTheDocument();
  });

  it('UC-LM-SHELL-002: 지도 영역은 항상 존재한다', () => {
    render(<MapPlaceholder />);

    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument();
  });
});
