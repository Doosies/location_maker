import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Entry } from '../../domain/types';
import { ResultList } from '../ResultList';

function entry(id: string, raw: string, patch: Partial<Entry> = {}): Entry {
  return { id, raw, normalized: raw.toLowerCase(), status: 'pending', ...patch };
}

const MIXED: Entry[] = [
  entry('a', '서울 강남구 테헤란로 152', {
    status: 'found',
    place: { lat: 37.5, lng: 127.03, label: '서울 강남구 역삼동 737', matchedBy: 'address' },
  }),
  entry('b', '있을 리 없는 주소', {
    status: 'notFound',
    failure: { reason: 'zero_result', message: '검색 결과가 없다' },
  }),
  entry('c', '서울 중구 을지로 65', {
    status: 'found',
    place: { lat: 37.56, lng: 126.98, label: '서울 중구 을지로2가', matchedBy: 'address' },
  }),
];

function render리스트(entries: Entry[]) {
  const onRetry = vi.fn();
  const onSkip = vi.fn();
  render(<ResultList entries={entries} onRetry={onRetry} onSkip={onSkip} />);
  return { onRetry, onSkip };
}

describe('결과 목록', () => {
  it('UC-LM-LIST-001: 비어 있으면 안내 문구를 띄운다', () => {
    render리스트([]);

    expect(screen.getByText(/아직 표시할 주소가 없다/)).toBeInTheDocument();
  });

  it('UC-LM-LIST-002: 실패 항목이 원래 자리에 원문 그대로 남는다', () => {
    render리스트(MIXED);

    // 이 앱에서 가장 중요한 규칙이다. 실패를 빼면 마커 수가 왜 다른지 알 수 없다.
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[1] as HTMLElement).getByText('있을 리 없는 주소')).toBeInTheDocument();
  });

  it('UC-LM-LIST-003: 요약 칩이 찾음과 실패를 센다', () => {
    render리스트(MIXED);

    expect(screen.getByText('찾음 2')).toBeInTheDocument();
    expect(screen.getByText('실패 1')).toBeInTheDocument();
  });

  it('UC-LM-LIST-004: 찾은 항목에는 목록 자리와 같은 번호가 붙는다', () => {
    render리스트(MIXED);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0] as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(items[2] as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('UC-LM-LIST-005: 실패 항목에만 고쳐서 다시·건너뛰기가 붙는다', async () => {
    const { onRetry, onSkip } = render리스트(MIXED);

    expect(screen.getAllByRole('button', { name: '고쳐서 다시' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: '고쳐서 다시' }));
    await userEvent.click(screen.getByRole('button', { name: '건너뛰기' }));

    expect(onRetry).toHaveBeenCalledWith(MIXED[1]);
    expect(onSkip).toHaveBeenCalledWith(MIXED[1]);
  });

  it('UC-LM-LIST-006: 건너뛴 항목은 자리에 남되 더 권하지 않는다', () => {
    render리스트([entry('a', '있을 리 없는 주소', { status: 'skipped' })]);

    expect(screen.getByText('있을 리 없는 주소')).toBeInTheDocument();
    expect(screen.getByText('건너뜀')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '고쳐서 다시' })).not.toBeInTheDocument();
  });

  it('UC-LM-LIST-007: 장소명으로 찾은 항목은 그렇다고 표시한다', () => {
    render리스트([
      entry('a', '카카오판교오피스', {
        status: 'found',
        place: { lat: 37.4, lng: 127.1, label: '카카오판교오피스', matchedBy: 'keyword' },
      }),
    ]);

    // 지번으로 찾은 것과 상호로 찾은 것은 정확도가 다르다. 사용자가 구분할 수 있어야 한다.
    expect(screen.getByText('장소명으로 찾음')).toBeInTheDocument();
  });

  it('UC-LM-LIST-008: 조회 중 항목은 조회 중으로 보인다', () => {
    render리스트([entry('a', '서울 강남구 테헤란로 152', { status: 'loading' })]);

    expect(screen.getByText('조회 중')).toBeInTheDocument();
  });
});
