import { describe, expect, it } from 'vitest';

import type { Place } from '../../domain/types';
import { computeView, SINGLE_MARKER_LEVEL } from '../use-fit-bounds';

function place(lat: number, lng: number): Place {
  return { lat, lng, label: `${lat},${lng}`, matchedBy: 'address' };
}

describe('지도 범위 계산', () => {
  it('UC-LM-BOUNDS-001: 마커가 없으면 아무것도 하지 않는다', () => {
    expect(computeView([])).toEqual({ kind: 'none' });
  });

  it('UC-LM-BOUNDS-002: 마커가 하나면 중심과 고정 레벨을 쓴다', () => {
    expect(computeView([place(37.5, 127.03)])).toEqual({
      kind: 'center',
      lat: 37.5,
      lng: 127.03,
      level: SINGLE_MARKER_LEVEL,
    });
  });

  it('UC-LM-BOUNDS-003: 마커가 여럿이면 전부 포함하는 범위를 낸다', () => {
    const view = computeView([place(37.5, 127.03), place(35.15, 129.16), place(37.56, 126.97)]);

    expect(view).toEqual({
      kind: 'bounds',
      south: 35.15,
      west: 126.97,
      north: 37.56,
      east: 129.16,
    });
  });

  it('UC-LM-BOUNDS-004: 좌표가 전부 같으면 마커가 여럿이어도 중심을 쓴다', () => {
    // 같은 건물을 두 줄로 적은 경우다. 폭이 0 인 bounds 는 최대 배율로 끌어당긴다.
    const view = computeView([place(37.5, 127.03), place(37.5, 127.03)]);

    expect(view).toEqual({ kind: 'center', lat: 37.5, lng: 127.03, level: SINGLE_MARKER_LEVEL });
  });

  it('UC-LM-BOUNDS-005: 위도만 같고 경도가 다르면 범위를 쓴다', () => {
    const view = computeView([place(37.5, 126.9), place(37.5, 127.1)]);

    expect(view).toEqual({ kind: 'bounds', south: 37.5, west: 126.9, north: 37.5, east: 127.1 });
  });
});
