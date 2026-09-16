import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

/** 시트가 설 수 있는 자리. 값은 CSS 가 높이로 옮긴다. */
export type SheetSnap = 'peek' | 'half' | 'full';

/** 손잡이를 누를 때마다 도는 차례. 되돌아올 길이 있어야 막다른 골목이 없다. */
const NEXT: Record<SheetSnap, SheetSnap> = { peek: 'half', half: 'full', full: 'peek' };

const HANDLE_LABEL: Record<SheetSnap, string> = {
  peek: '목록 펼치기',
  half: '목록 전체 보기',
  full: '목록 접기',
};

/** 드래그를 놓았을 때 어디에 설지 고를 기준. 화면 높이에 대한 비율이다. */
const SNAP_RATIO: Record<SheetSnap, number> = { peek: 0.08, half: 0.48, full: 0.92 };

export type BottomSheetProps = {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** 어느 자리에서도 보이는 머리. 모바일에서 `peek` 일 때 남는 것이 이것뿐이다. */
  head?: ReactNode;
  /** 시트 바닥에 붙는 띠. 엄지가 닿는 자리라 여기에 마무리 동작을 둔다. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * 지도 위에 얹히는 바텀 시트.
 *
 * **탭이 먼저다.** 드래그는 기기와 브라우저마다 어긋나지만 손잡이를 누르는 것은
 * 어디서나 같고 테스트로 고정할 수 있다. 그래서 손잡이는 진짜 `button` 이고,
 * 포인터 드래그는 그 위에 얹는다 — 드래그가 안 먹는 환경에서도 탭이 남는다.
 *
 * 넓은 화면에서는 CSS 가 이것을 그냥 왼쪽 칸으로 만든다. 그때 `data-snap` 은
 * 아무 높이도 뜻하지 않는다. 컴포넌트가 화면 폭을 묻지 않는 이유다 — 폭을 재기
 * 시작하면 같은 결정이 CSS 와 JS 두 곳에 생긴다.
 */
export function BottomSheet({ snap, onSnapChange, head, footer, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  /** 끄는 동안의 실제 높이(px). 놓으면 null 로 돌아가 CSS 가 다시 높이를 정한다. */
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  /**
   * 끄는 동안의 상태. 높이를 여기에도 들고 있는 것은 일부러다.
   *
   * `dragHeight` 만 두면 놓는 순간의 핸들러가 **리렌더를 거친 뒤에야** 새 높이를 본다.
   * 끌자마자 놓으면(플릭) 그 리렌더가 아직 없어 놓은 자리를 모른 채 끝난다.
   */
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean; height: number } | null>(null);
  /**
   * 방금 끝난 드래그가 클릭 하나를 물고 있다는 표시.
   *
   * 마우스는 `pointerdown` 과 `pointerup` 이 같은 요소에서 나면 **이동 거리와 무관하게**
   * `click` 을 낸다. 포인터 캡처 때문에 그 요소는 항상 손잡이다. 그래서 끌어서 자리를
   * 옮긴 직후 클릭이 이어져 시트가 한 번 더 움직인다 — `full` 에서 절반으로 끌면
   * 그대로 `full` 로 되돌아간다. 드래그 상태를 보고 거르려 해도 `pointerup` 이 이미
   * 지운 뒤라 소용없으므로, 끈 사실을 클릭까지 살려 둔다.
   */
  const swallowClick = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    // 마우스 오른쪽 버튼이나 보조 포인터로는 끌지 않는다.
    if (event.button !== 0) return;
    const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
    if (height === 0) return;
    drag.current = { startY: event.clientY, startHeight: height, moved: false, height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (state === null) return;

    const delta = state.startY - event.clientY;
    // 손가락이 몇 px 떨리는 것은 탭이다. 그것까지 드래그로 받으면 탭이 사라진다.
    if (!state.moved && Math.abs(delta) < 6) return;
    state.moved = true;
    state.height = Math.min(Math.max(state.startHeight + delta, 56), window.innerHeight);
    setDragHeight(state.height);
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = drag.current;
      drag.current = null;
      if (state === null) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      setDragHeight(null);
      // 끌지 않았으면 클릭이 이어서 들어온다. 여기서 자리를 정하면 두 번 움직인다.
      if (!state.moved) return;
      // 취소(`pointercancel`) 뒤에는 클릭이 오지 않지만, 세워 둬도 다음 클릭 한 번을
      // 흘릴 뿐이라 해롭지 않다. 경로마다 다르게 두면 그 차이가 버그가 된다.
      swallowClick.current = true;

      const ratio = state.height / window.innerHeight;
      const nearest = (Object.keys(SNAP_RATIO) as SheetSnap[]).reduce((best, candidate) =>
        Math.abs(SNAP_RATIO[candidate] - ratio) < Math.abs(SNAP_RATIO[best] - ratio) ? candidate : best,
      );
      if (nearest !== snap) onSnapChange(nearest);
    },
    [onSnapChange, snap],
  );

  const onClick = useCallback(() => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    onSnapChange(NEXT[snap]);
  }, [onSnapChange, snap]);

  return (
    <section
      className="sheet"
      ref={sheetRef}
      /* 지도가 범위를 맞출 때 이만큼을 가린 것으로 친다. 넓은 화면에서는 지도와
         가로로 겹치지 않으므로 지도 쪽이 알아서 0 으로 본다. */
      data-map-overlay="bottom"
      data-snap={snap}
      data-dragging={dragHeight === null ? undefined : 'true'}
      style={dragHeight === null ? undefined : { height: `${dragHeight}px` }}
    >
      <button
        type="button"
        className="sheet__handle"
        aria-label={HANDLE_LABEL[snap]}
        aria-expanded={snap !== 'peek'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      >
        <span className="sheet__grip" aria-hidden="true" />
      </button>
      {head !== undefined && <div className="sheet__head">{head}</div>}
      <div className="sheet__scroll">{children}</div>
      {footer !== undefined && <div className="sheet__footer">{footer}</div>}
    </section>
  );
}
