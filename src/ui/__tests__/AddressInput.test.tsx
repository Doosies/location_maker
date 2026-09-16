import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AddressInput } from '../AddressInput';

type Overrides = { value?: string; disabled?: boolean };

function setup(overrides: Overrides = {}) {
  const onChange = vi.fn<(value: string) => void>();
  const onSubmit = vi.fn<() => void>();
  render(<AddressInput value="" {...overrides} onChange={onChange} onSubmit={onSubmit} />);
  return { onChange, onSubmit };
}

describe('주소 입력', () => {
  it('UC-LM-INPUT-001: textarea 에 라벨이 붙어 있다', () => {
    setup();

    expect(screen.getByLabelText('주소 입력')).toBeInTheDocument();
  });

  it('UC-LM-INPUT-002: 비어 있으면 표시 버튼이 비활성이다', () => {
    setup();

    expect(screen.getByRole('button', { name: '지도에 표시' })).toBeDisabled();
  });

  it('UC-LM-INPUT-003: 빈 줄을 빼고 줄 수를 센다', () => {
    setup({ value: '서울 강남구 테헤란로 152\n\n   \n서울 중구 을지로 65\n' });

    // 파싱이 버리는 줄은 화면에서도 세지 않는다. 숫자가 다르면 사용자가 놀란다.
    expect(screen.getByText('2줄')).toBeInTheDocument();
  });

  it('UC-LM-INPUT-004: 예시 넣어보기가 세 줄을 채운다', async () => {
    const { onChange } = setup();

    await userEvent.click(screen.getByRole('button', { name: '예시 넣어보기' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].split('\n')).toHaveLength(3);
  });

  it('UC-LM-INPUT-005: 비우기가 입력을 지운다', async () => {
    const { onChange } = setup({ value: '서울 강남구 테헤란로 152' });

    await userEvent.click(screen.getByRole('button', { name: '비우기' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('UC-LM-INPUT-006: 표시 버튼이 onSubmit 을 부른다', async () => {
    const { onSubmit } = setup({ value: '서울 강남구 테헤란로 152' });

    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('UC-LM-INPUT-007: 조회 중에는 입력과 버튼이 잠긴다', () => {
    setup({ value: '서울 강남구 테헤란로 152', disabled: true });

    expect(screen.getByLabelText('주소 입력')).toBeDisabled();
    for (const name of ['지도에 표시', '예시 넣어보기', '비우기']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
