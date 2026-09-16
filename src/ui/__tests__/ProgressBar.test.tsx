import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProgressBar } from '../ProgressBar';

describe('진행 표시', () => {
  it('UC-LM-PROGRESS-001: 몇 건 중 몇 건인지 보여 준다', () => {
    render(<ProgressBar done={7} total={12} onAbort={vi.fn()} />);

    expect(screen.getByText('조회 중 7 / 12')).toBeInTheDocument();
  });

  it('UC-LM-PROGRESS-002: progressbar 가 현재 값과 최대값을 알린다', () => {
    render(<ProgressBar done={7} total={12} onAbort={vi.fn()} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '7');
    expect(bar).toHaveAttribute('aria-valuemax', '12');
  });

  it('UC-LM-PROGRESS-003: 중단 버튼이 onAbort 를 부른다', async () => {
    const onAbort = vi.fn();
    render(<ProgressBar done={1} total={3} onAbort={onAbort} />);

    await userEvent.click(screen.getByRole('button', { name: '중단' }));

    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('UC-LM-PROGRESS-004: total 이 0 이어도 0 으로 나누지 않는다', () => {
    render(<ProgressBar done={0} total={0} onAbort={vi.fn()} />);

    expect(screen.getByText('조회 중 0 / 0')).toBeInTheDocument();
  });
});
