import type { Place } from '../domain/types';

/**
 * 지도를 어디에 맞출지. **좌표 계산은 SDK 를 모른다** — 그래야 테스트할 수 있다.
 * SDK 를 부르는 일은 이 파일 아래쪽 훅이 한다.
 */
export type MapView =
  | { kind: 'none' }
  | { kind: 'center'; lat: number; lng: number; level: number }
  | { kind: 'bounds'; south: number; west: number; north: number; east: number };

/**
 * 마커 하나짜리 bounds 는 폭이 0 이라 SDK 가 최대 배율까지 끌어당긴다.
 * 건물 한 채가 화면을 가득 채우면 그게 어디인지 알 수 없다. 그래서 하나일 때는
 * bounds 대신 중심과 고정 레벨을 쓴다.
 */
export const SINGLE_MARKER_LEVEL = 4;

export function computeView(places: Place[]): MapView {
  if (places.length === 0) return { kind: 'none' };

  const first = places[0];
  if (first === undefined) return { kind: 'none' };

  if (places.length === 1) {
    return { kind: 'center', lat: first.lat, lng: first.lng, level: SINGLE_MARKER_LEVEL };
  }

  let south = first.lat;
  let north = first.lat;
  let west = first.lng;
  let east = first.lng;

  for (const place of places) {
    if (place.lat < south) south = place.lat;
    if (place.lat > north) north = place.lat;
    if (place.lng < west) west = place.lng;
    if (place.lng > east) east = place.lng;
  }

  // 좌표가 전부 같은 경우도 폭이 0 이다. 마커가 여럿이어도 같은 문제가 생긴다.
  if (south === north && west === east) {
    return { kind: 'center', lat: south, lng: west, level: SINGLE_MARKER_LEVEL };
  }

  return { kind: 'bounds', south, west, north, east };
}
