import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Entry } from '../../domain/types';
import type { KakaoBounds, KakaoLatLng, KakaoMap, KakaoMapsNamespace, KakaoOverlay } from '../kakao-maps';
import { MapView } from '../MapView';

/** 가짜 SDK. 지도를 실제로 그리지 않고 무엇을 시켰는지만 기록한다. */
function stubSdk() {
  const calls = {
    overlays: [] as { content: string; lat: number; lng: number; onMap: boolean }[],
    center: [] as [number, number][],
    level: [] as number[],
    bounds: [] as [number, number][][],
    panTo: [] as [number, number][],
  };

  class LatLng implements KakaoLatLng {
    constructor(
      private readonly lat: number,
      private readonly lng: number,
    ) {}
    getLat(): number {
      return this.lat;
    }
    getLng(): number {
      return this.lng;
    }
  }

  const maps: KakaoMapsNamespace = {
    LatLng,
    LatLngBounds: class implements KakaoBounds {
      private readonly points: [number, number][] = [];
      constructor() {
        calls.bounds.push(this.points);
      }
      extend(latlng: KakaoLatLng): void {
        this.points.push([latlng.getLat(), latlng.getLng()]);
      }
    },
    Map: class implements KakaoMap {
      setBounds(): void {}
      setCenter(latlng: KakaoLatLng): void {
        calls.center.push([latlng.getLat(), latlng.getLng()]);
      }
      setLevel(level: number): void {
        calls.level.push(level);
      }
      panTo(latlng: KakaoLatLng): void {
        calls.panTo.push([latlng.getLat(), latlng.getLng()]);
      }
    },
    CustomOverlay: class implements KakaoOverlay {
      private readonly record: { content: string; lat: number; lng: number; onMap: boolean };
      constructor(options: { position: KakaoLatLng; content: string }) {
        this.record = {
          content: options.content,
          lat: options.position.getLat(),
          lng: options.position.getLng(),
          onMap: false,
        };
        calls.overlays.push(this.record);
      }
      setMap(map: KakaoMap | null): void {
        this.record.onMap = map !== null;
      }
      setPosition(latlng: KakaoLatLng): void {
        this.record.lat = latlng.getLat();
        this.record.lng = latlng.getLng();
      }
      setContent(content: string): void {
        this.record.content = content;
      }
    },
  };

  return { maps, calls };
}

/** 좌표가 없는 줄. `place` 를 undefined 로 덮어쓰면 exactOptionalPropertyTypes 에 걸린다. */
function missing(id: string, raw: string, status: Entry['status']): Entry {
  return { id, raw, normalized: raw, status };
}

function found(id: string, raw: string, lat: number, lng: number): Entry {
  return {
    id,
    raw,
    normalized: raw,
    status: 'found',
    place: { lat, lng, label: raw, matchedBy: 'address' },
  };
}

describe('지도 화면', () => {
  it('UC-LM-MAP-001: 찾은 항목마다 마커를 올린다', () => {
    const { maps, calls } = stubSdk();

    render(<MapView entries={[found('a', '가', 37.5, 127.0), missing('b', '나', 'notFound')]} maps={maps} />);

    expect(calls.overlays).toHaveLength(1);
    expect(calls.overlays[0]?.onMap).toBe(true);
  });

  it('UC-LM-MAP-002: 마커에 목록 자리 번호가 찍힌다', () => {
    const { maps, calls } = stubSdk();

    render(
      <MapView
        entries={[missing('a', '가', 'failed'), found('b', '나', 37.5, 127.0)]}
        maps={maps}
      />,
    );

    // 실패한 줄이 1번을 차지한다. 그래서 이 마커는 2번이다.
    expect(calls.overlays[0]?.content).toContain('>2<');
  });

  it('UC-LM-MAP-003: 마커가 하나면 범위 대신 중심과 고정 레벨을 쓴다', () => {
    const { maps, calls } = stubSdk();

    render(<MapView entries={[found('a', '가', 37.5, 127.0)]} maps={maps} />);

    expect(calls.center).toContainEqual([37.5, 127.0]);
    expect(calls.level.at(-1)).toBe(4);
  });

  it('UC-LM-MAP-004: 마커가 여럿이면 전부 담는 범위를 만든다', () => {
    const { maps, calls } = stubSdk();

    render(<MapView entries={[found('a', '가', 37.5, 127.0), found('b', '나', 35.1, 129.1)]} maps={maps} />);

    expect(calls.bounds.at(-1)).toEqual([
      [35.1, 127.0],
      [37.5, 129.1],
    ]);
  });

  it('UC-LM-MAP-005: 항목이 늘어도 기존 마커를 다시 만들지 않는다', () => {
    const { maps, calls } = stubSdk();
    const first = found('a', '가', 37.5, 127.0);

    const { rerender } = render(<MapView entries={[first]} maps={maps} />);
    rerender(<MapView entries={[first, found('b', '나', 35.1, 129.1)]} maps={maps} />);

    // 매번 다시 그리면 조회가 도는 동안 마커가 계속 깜빡인다.
    expect(calls.overlays).toHaveLength(2);
  });

  it('UC-LM-MAP-009: 마커가 그대로면 범위를 다시 맞추지 않는다', () => {
    const { maps, calls } = stubSdk();
    const first = found('a', '가', 37.5, 127.0);
    const second = found('b', '나', 35.1, 129.1);

    const { rerender } = render(<MapView entries={[first, second]} maps={maps} />);
    const before = calls.bounds.length;
    // 조회가 도는 동안 실패 줄의 상태만 바뀌는 흔한 경우다.
    rerender(<MapView entries={[first, second, missing('c', '다', 'notFound')]} maps={maps} />);

    // 다시 맞추면 사용자가 끌어 놓은 지도가 마커와 무관한 갱신에 원위치된다.
    expect(calls.bounds).toHaveLength(before);
  });

  it('UC-LM-MAP-006: 고른 항목의 마커로 지도를 옮긴다', () => {
    const { maps, calls } = stubSdk();
    const entries = [found('a', '가', 37.5, 127.0), found('b', '나', 35.1, 129.1)];

    const { rerender } = render(<MapView entries={entries} maps={maps} />);
    rerender(<MapView entries={entries} focusedId="b" maps={maps} />);

    expect(calls.panTo.at(-1)).toEqual([35.1, 129.1]);
  });

  it('UC-LM-MAP-007: 언마운트하면 마커를 걷어 낸다', () => {
    const { maps, calls } = stubSdk();

    const { unmount } = render(<MapView entries={[found('a', '가', 37.5, 127.0)]} maps={maps} />);
    unmount();

    // 남겨 두면 다음 지도에 유령 마커가 뜬다.
    expect(calls.overlays.every((o) => !o.onMap)).toBe(true);
  });

  it('UC-LM-MAP-008: 키가 없으면 지도 대신 안내를 띄운다', async () => {
    render(<MapView entries={[]} apiKey="" />);

    expect(await screen.findByText(/VITE_KAKAO_JS_KEY/)).toBeInTheDocument();
  });
  it('UC-LM-MAP-010: 마커를 누르면 그 줄의 id 로 onMarkerSelect 를 부른다', async () => {
    const { maps } = stubSdk();
    const onMarkerSelect = vi.fn();

    render(<MapView entries={[found('a', '가', 37.5, 127.0)]} maps={maps} onMarkerSelect={onMarkerSelect} />);

    // 실제 SDK 는 CustomOverlay 의 HTML 을 지도 컨테이너 안에 붙인다. 가짜 SDK 는
    // 그리지 않으므로, 컨테이너에 건 위임이 도는지를 같은 모양의 요소로 확인한다.
    const container = screen.getByRole('region', { name: '지도' });
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.entryId = 'a';
    container.appendChild(marker);

    await userEvent.click(marker);

    expect(onMarkerSelect).toHaveBeenCalledWith('a');
  });

  it('UC-LM-MAP-011: 고른 항목의 마커에만 테가 둘린다', () => {
    const { maps, calls } = stubSdk();

    const entries = [found('a', '가', 37.5, 127.0), found('b', '나', 37.6, 127.1)];
    const { rerender } = render(<MapView entries={entries} maps={maps} />);
    rerender(<MapView entries={entries} maps={maps} focusedId="b" />);

    // 어느 점을 고른 것인지 지도에서도 보여야 한다. 목록만 바뀌면 지도는 남의 일이 된다.
    expect(calls.overlays[0]?.content).not.toContain('marker--focused');
    expect(calls.overlays[1]?.content).toContain('marker--focused');
  });
});
