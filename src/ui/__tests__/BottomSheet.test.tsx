import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BottomSheet, type SheetSnap } from '../BottomSheet';

/** 실제 쓰임과 같게 제어 컴포넌트로 감싼다. 자리를 앱이 들고 있어야 하기 때문이다. */
function Harness({ initial = 'peek' as SheetSnap }) {
  const [snap, setSnap] = useState<SheetSnap>(initial);
  return (
    <BottomSheet snap={snap} onSnapChange={setSnap} head={<p>요약</p>} footer={<button type="button">CSV</button>}>
      <p>목록</p>
    </BottomSheet>
  );
}

/**
 * 포인터 이벤트 하나.
 *
 * jsdom 에는 `PointerEvent` 생성자가 없다. React 는 이름으로 이벤트를 받으므로
 * `MouseEvent` 에 이름만 맞춰 주면 같은 핸들러가 돈다.
 */
function pointer(type: string, clientY: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

function sheet(): HTMLElement {
  const node = document.querySelector('.sheet');
  if (node === null) throw new Error('시트를 찾지 못했다');
  return node as HTMLElement;
}

describe('바텀 시트', () => {
  it('UC-LM-SHEET-001: 손잡이를 누를 때마다 자리가 peek → half → full → peek 로 돈다', async () => {
    render(<Harness />);

    expect(sheet()).toHaveAttribute('data-snap', 'peek');

    await userEvent.click(screen.getByRole('button', { name: '목록 펼치기' }));
    expect(sheet()).toHaveAttribute('data-snap', 'half');

    await userEvent.click(screen.getByRole('button', { name: '목록 전체 보기' }));
    expect(sheet()).toHaveAttribute('data-snap', 'full');

    // 되돌아올 길이 있어야 막다른 골목이 없다.
    await userEvent.click(screen.getByRole('button', { name: '목록 접기' }));
    expect(sheet()).toHaveAttribute('data-snap', 'peek');
  });

  it('UC-LM-SHEET-002: 손잡이가 접힘 여부를 aria-expanded 로 알린다', async () => {
    render(<Harness />);

    // 손잡이는 그림이 아니라 버튼이다. 눈으로 보는 것과 같은 말을 스크린 리더에도 해야 한다.
    expect(screen.getByRole('button', { name: '목록 펼치기' })).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(screen.getByRole('button', { name: '목록 펼치기' }));
    expect(screen.getByRole('button', { name: '목록 전체 보기' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('UC-LM-SHEET-003: 어느 자리에서도 머리·내용·바닥이 DOM 에 남는다', () => {
    render(<Harness />);

    // 자리는 CSS 높이일 뿐이다. 내용을 지우면 좁은 화면에서만 사라지는 요소가 생기고,
    // 그러면 넓은 화면에서 도는 테스트가 좁은 화면의 고장을 못 잡는다.
    expect(screen.getByText('요약')).toBeInTheDocument();
    expect(screen.getByText('목록')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
  });

  it('UC-LM-SHEET-004: 끌어서 옮기면 놓은 높이에 가장 가까운 자리에 선다', async () => {
    const onSnapChange = vi.fn();
    render(
      <BottomSheet snap="peek" onSnapChange={onSnapChange}>
        <p>목록</p>
      </BottomSheet>,
    );

    // jsdom 은 배치를 하지 않아 높이가 0 이다. 끄는 시작 높이를 직접 세워 준다.
    const node = sheet();
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ height: 80 } as DOMRect);
    window.innerHeight = 800;

    const handle = screen.getByRole('button', { name: '목록 펼치기' });
    // jsdom 에는 포인터 캡처가 없다. 없는 것으로 두면 컴포넌트가 죽는다.
    handle.setPointerCapture = () => {};
    handle.hasPointerCapture = () => false;
    handle.releasePointerCapture = () => {};

    // 400px 위로 끌면 높이가 480 — 800 의 0.6 이라 `half`(0.48) 가 `full`(0.92) 보다 가깝다.
    act(() => {
      handle.dispatchEvent(pointer('pointerdown', 700));
      handle.dispatchEvent(pointer('pointermove', 300));
      handle.dispatchEvent(pointer('pointerup', 300));
    });

    expect(onSnapChange).toHaveBeenCalledWith('half');

    // 마우스는 끌었더라도 `pointerup` 뒤에 `click` 을 한 번 더 낸다. 그것까지 자리를
    // 옮기면 끌어서 세운 시트가 곧바로 다음 자리로 튄다.
    act(() => {
      handle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSnapChange).toHaveBeenCalledTimes(1);
  });
});
