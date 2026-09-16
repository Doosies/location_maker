import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../App';
import type { GeocodePort, GeocodeResult } from '../domain/types';
import { decodeAddresses, encodeAddresses } from '../share/url-state';
import { createStore } from '../state/store';

/**
 * 파싱 → 큐 → 스토어 → 화면이 실제로 이어지는지 본다. 부분이 다 맞는데
 * 연결이 틀린 경우를 잡는 것이 이 파일의 유일한 목적이다.
 */

const TWO_LINES = '서울 강남구 테헤란로 152\n있을 리 없는 주소';

function port(overrides: (query: string) => GeocodeResult | undefined = () => undefined): GeocodePort {
  return {
    async geocode(query): Promise<GeocodeResult> {
      const forced = overrides(query);
      if (forced !== undefined) return forced;
      if (query.includes('테헤란로')) {
        return {
          ok: true,
          place: { lat: 37.5, lng: 127.03, label: '서울 강남구 역삼동 737', matchedBy: 'address' },
        };
      }
      return { ok: false, failure: { reason: 'zero_result', message: '검색 결과가 없다' } };
    },
  };
}

describe('앱 조립', () => {
  it('UC-LM-APP-001: 붙여넣고 누르면 목록이 채워진다', async () => {
    render(<App port={port()} store={createStore()} />);

    await userEvent.type(screen.getByLabelText('주소 입력'), TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));

    await waitFor(() => {
      expect(screen.getByText('찾음 1')).toBeInTheDocument();
    });
    expect(screen.getByText('실패 1')).toBeInTheDocument();
  });

  it('UC-LM-APP-002: 실패한 줄이 입력 순서 자리에 원문 그대로 남는다', async () => {
    render(<App port={port()} store={createStore()} />);

    await userEvent.type(screen.getByLabelText('주소 입력'), TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
    const items = screen.getAllByRole('listitem');
    expect(within(items[0] as HTMLElement).getByText('서울 강남구 테헤란로 152')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('있을 리 없는 주소')).toBeInTheDocument();
  });

  it('UC-LM-APP-003: 건너뛰기를 누르면 그 줄이 건너뜀으로 남는다', async () => {
    render(<App port={port()} store={createStore()} />);

    await userEvent.type(screen.getByLabelText('주소 입력'), TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '건너뛰기' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: '건너뛰기' }));

    expect(screen.getByText('건너뜀')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('UC-LM-APP-004: 고쳐서 다시는 원문을 입력창으로 되돌린다', async () => {
    render(<App port={port()} store={createStore()} />);

    const field = screen.getByLabelText('주소 입력');
    await userEvent.type(field, TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '고쳐서 다시' })).toBeInTheDocument();
    });

    await userEvent.clear(field);
    await userEvent.click(screen.getByRole('button', { name: '고쳐서 다시' }));

    expect(field).toHaveValue('있을 리 없는 주소');
    expect(field).toHaveFocus();
  });

  it('UC-LM-APP-006: 고쳐서 다시는 이미 있는 줄을 골라 보여 준다', async () => {
    render(<App port={port()} store={createStore()} />);

    const field = screen.getByLabelText('주소 입력') as HTMLTextAreaElement;
    await userEvent.type(field, TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '고쳐서 다시' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: '고쳐서 다시' }));

    // 줄이 서른 개일 때 포커스만 끝으로 가면 어느 줄을 고칠지 알 수 없다.
    expect(field.value).toBe(TWO_LINES);
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe('있을 리 없는 주소');
  });

  it('UC-LM-APP-007: 번호가 붙은 줄도 같은 줄로 알아본다', async () => {
    render(<App port={port()} store={createStore()} />);

    const field = screen.getByLabelText('주소 입력') as HTMLTextAreaElement;
    await userEvent.type(field, '1. 서울 강남구 테헤란로 152\n2. 있을 리 없는 주소');
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '고쳐서 다시' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: '고쳐서 다시' }));

    // `raw` 는 번호가 떼인 값이다. `trim()` 으로 비교하면 같은 주소가 한 줄 더 붙는다.
    expect(field.value.split('\n')).toHaveLength(2);
  });

  it('UC-LM-APP-005: 중단을 누르면 조회가 멈추고 남은 줄이 대기로 남는다', async () => {
    // 첫 줄에서 멈춰 서서 중단 버튼을 누를 틈을 만든다.
    let release: (() => void) | undefined;
    const slow: GeocodePort = {
      async geocode(query, signal) {
        if (query.includes('테헤란로')) {
          await new Promise<void>((resolve) => {
            release = resolve;
            signal?.addEventListener('abort', () => resolve(), { once: true });
          });
        }
        return { ok: false, failure: { reason: 'zero_result', message: '검색 결과가 없다' } };
      },
    };
    render(<App port={slow} store={createStore()} />);

    await userEvent.type(screen.getByLabelText('주소 입력'), TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));
    const abortButton = await screen.findByRole('button', { name: '중단' });

    await userEvent.click(abortButton);
    release?.();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '중단' })).not.toBeInTheDocument();
    });
    // 멈춘 것은 실패가 아니다. 다시 눌러 이어 할 수 있어야 한다.
    expect(screen.getByRole('button', { name: '지도에 표시' })).toBeEnabled();
  });

  it('UC-LM-APP-008: 링크로 받은 주소를 복원하고 바로 조회한다', async () => {
    const encoded = encodeAddresses(['서울 강남구 테헤란로 152']);
    render(<App port={port()} store={createStore()} hash={encoded.ok ? encoded.hash : ''} />);

    // 받은 쪽에 버튼을 한 번 더 누르게 하지 않는다.
    expect(screen.getByLabelText('주소 입력')).toHaveValue('서울 강남구 테헤란로 152');
    await waitFor(() => {
      expect(screen.getByText('찾음 1')).toBeInTheDocument();
    });
  });

  it('UC-LM-APP-009: 망가진 해시로 열어도 빈 화면으로 시작한다', () => {
    render(<App port={port()} store={createStore()} hash="#a=!!!망가진!!!" />);

    // 링크는 손으로 잘리고 붙는 물건이다. 던지면 사용자가 고칠 수 없는 고장이 된다.
    expect(screen.getByLabelText('주소 입력')).toHaveValue('');
    expect(screen.getByText(/아직 표시할 주소가 없다/)).toBeInTheDocument();
  });

  it('UC-LM-APP-010: 링크 복사는 입력창의 주소를 담은 주소를 클립보드에 넣는다', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    render(<App port={port()} store={createStore()} clipboard={{ writeText }} />);

    await userEvent.type(screen.getByLabelText('주소 입력'), '서울 중구 을지로 65');
    await userEvent.click(screen.getByRole('button', { name: '링크 복사' }));

    // 조회 전에도 링크를 보낼 수 있어야 하므로 목록이 아니라 입력창에서 만든다.
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(decodeAddresses(new URL(writeText.mock.calls[0]?.[0] ?? '').hash)).toEqual(['서울 중구 을지로 65']);
  });

  it('UC-LM-APP-011: CSV 내려받기는 조회 결과를 파일로 건넨다', async () => {
    const download = vi.fn<(content: string, fileName: string) => void>();
    render(<App port={port()} store={createStore()} download={download} />);

    expect(screen.getByRole('button', { name: 'CSV 내려받기' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('주소 입력'), TWO_LINES);
    await userEvent.click(screen.getByRole('button', { name: '지도에 표시' }));
    await waitFor(() => {
      expect(screen.getByText('찾음 1')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'CSV 내려받기' }));

    const [content, fileName] = download.mock.calls[0] ?? [];
    // 실패한 줄도 빠지지 않는다. 화면과 같은 원칙이다.
    expect(content).toContain('있을 리 없는 주소');
    expect(fileName).toMatch(/^location-maker-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
