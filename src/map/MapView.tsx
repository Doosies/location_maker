import { useEffect, useRef, useState } from 'react';

import type { Entry } from '../domain/types';
import type { KakaoMap, KakaoMapsNamespace, KakaoOverlay } from './kakao-maps';
import { loadKakaoSdk, LOAD_FAILURE_MESSAGE, type LoadFailure } from './load-kakao-sdk';
import { diffMarkers, toMarkerSpecs, type MarkerSpec } from './markers';
import { computeView } from './use-fit-bounds';

/** 지도가 없을 때 처음 보여 줄 자리. 마커가 생기면 곧바로 옮겨진다. */
const SEOUL = { lat: 37.5665, lng: 126.978, level: 8 };

export type MapViewProps = {
  entries: Entry[];
  /** 목록에서 고른 항목. 그 마커로 지도를 옮긴다. */
  focusedId?: string | null;
  /** 마커를 눌렀을 때. 목록 → 지도만 되던 길을 양방향으로 만든다. */
  onMarkerSelect?: (id: string) => void;
  /** 테스트가 가짜 SDK 를 넣는다. 주면 로더를 건너뛴다. */
  maps?: KakaoMapsNamespace;
  apiKey?: string;
};

/**
 * 마커 하나를 **요소로** 만든다. HTML 문자열이 아니다.
 *
 * `CustomOverlay` 는 `content` 로 요소를 받는다. 요소를 주면 우리가 그 요소를 계속
 * 들고 있을 수 있어, 클릭 리스너를 직접 걸고 테도 클래스 하나로 갈아 끼울 수 있다.
 * 문자열을 주면 오버레이가 만든 DOM 에 닿을 길이 없어, 클릭이 지도 컨테이너까지
 * 버블되기를 기대하는 수밖에 없다 — SDK 가 `clickable` 오버레이의 이벤트를 어떻게
 * 다루는지에 앱이 매달리게 된다.
 */
function createMarker(spec: MarkerSpec, onSelect: () => void): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'marker';
  element.dataset.entryId = spec.id;
  element.addEventListener('click', onSelect);
  paintMarker(element, spec, false);
  return element;
}

/** 번호·제목·테를 지금 값으로 맞춘다. 요소는 그대로 두고 속성만 바꾼다. */
function paintMarker(element: HTMLDivElement, spec: MarkerSpec, focused: boolean): void {
  // 번호는 목록 자리 번호다. 사용자가 목록과 지도를 눈으로 짝지을 유일한 단서다.
  element.textContent = String(spec.number);
  element.title = spec.title;
  element.classList.toggle('marker--focused', focused);
}

/**
 * 지도 컨테이너 위를 덮고 있는 것만큼의 여백.
 *
 * 좁은 화면에서 지도는 화면 전체이고 앱바와 시트가 그 위에 얹힌다. 여백 없이 범위를
 * 맞추면 마커 절반이 시트 뒤에 숨는다 — "마커가 찍히는 것을 보면서" 가 이 화면의
 * 요점인데 정작 절반을 못 보게 된다.
 *
 * 덮개를 이름으로 찾지 않고 **겹치는지 재서** 정한다. 넓은 화면에서는 같은 요소들이
 * 지도와 가로로 겹치지 않으므로 저절로 0 이 된다 — 폭을 묻는 분기가 필요 없다.
 */
function overlayPadding(container: HTMLElement): { top: number; bottom: number } {
  const box = container.getBoundingClientRect();
  if (box.height === 0) return { top: 0, bottom: 0 };

  let top = 0;
  let bottom = 0;
  for (const node of document.querySelectorAll('[data-map-overlay]')) {
    const rect = node.getBoundingClientRect();
    // 가로로 안 겹치면 지도를 가리지 않는다. 넓은 화면의 왼쪽 패널이 그렇다.
    if (rect.width === 0 || rect.right <= box.left || rect.left >= box.right) continue;
    if (node.getAttribute('data-map-overlay') === 'top') {
      top = Math.max(top, rect.bottom - box.top);
    } else {
      bottom = Math.max(bottom, box.bottom - rect.top);
    }
  }

  top = Math.max(0, Math.round(top));
  bottom = Math.max(0, Math.round(bottom));
  // 남는 자리가 없으면 여백을 접는다. 높이보다 큰 여백을 주면 SDK 가 무엇을 할지 모른다.
  if (top + bottom > box.height * 0.7) return { top: 0, bottom: 0 };
  return { top, bottom };
}

export function MapView({ entries, focusedId = null, onMarkerSelect, maps, apiKey }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef(
    new Map<string, { overlay: KakaoOverlay; spec: MarkerSpec; element: HTMLDivElement }>(),
  );
  const [sdk, setSdk] = useState<KakaoMapsNamespace | null>(maps ?? null);
  const [failure, setFailure] = useState<LoadFailure | null>(null);

  const key = apiKey ?? import.meta.env.VITE_KAKAO_JS_KEY ?? '';

  useEffect(() => {
    if (maps !== undefined) return;

    let cancelled = false;
    void loadKakaoSdk({ key }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      const loaded = (globalThis as { kakao?: { maps?: KakaoMapsNamespace } }).kakao?.maps;
      if (loaded === undefined) {
        setFailure('init');
        return;
      }
      setSdk(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [key, maps]);

  /**
   * 마커 클릭을 받을 콜백. 리스너는 마커 요소에 걸려 있고 그 요소는 오버레이와 같이
   * 사라지므로, 걷어 낼 것이 따로 없다. 여기서는 **최신 콜백**만 들고 있으면 된다.
   */
  const selectRef = useRef(onMarkerSelect);
  selectRef.current = onMarkerSelect;
  /**
   * 마커 동기화 effect 가 읽는 현재 선택.
   *
   * `focusedId` 를 그 effect 의 의존성에 넣으면 목록을 고를 때마다 마커 전체를
   * 다시 맞추게 되고, 그때 지도 범위까지 다시 계산된다 — 사용자가 끌어 놓은 지도가
   * 제자리로 튄다. 테를 다시 칠하는 것은 아래 전용 effect 의 몫이다.
   */
  const focusedRef = useRef(focusedId);
  focusedRef.current = focusedId;

  // 지도는 한 번만 만든다. 컨테이너가 살아 있는 동안 같은 인스턴스를 쓴다.
  useEffect(() => {
    const container = containerRef.current;
    if (sdk === null || container === null || mapRef.current !== null) return;

    mapRef.current = new sdk.Map(container, {
      center: new sdk.LatLng(SEOUL.lat, SEOUL.lng),
      level: SEOUL.level,
    });
  }, [sdk]);

  // 마커 동기화. 전부 지우고 다시 그리지 않는다 — 조회 중 깜빡임이 보인다.
  useEffect(() => {
    const map = mapRef.current;
    if (sdk === null || map === null) return;

    const overlays = overlaysRef.current;
    const specs = toMarkerSpecs(entries);
    const current = new Map([...overlays].map(([id, held]) => [id, held.spec]));
    const { added, moved, removed } = diffMarkers(current, specs);

    for (const id of removed) {
      overlays.get(id)?.overlay.setMap(null);
      overlays.delete(id);
    }
    for (const spec of moved) {
      const held = overlays.get(spec.id);
      if (held === undefined) continue;
      held.overlay.setPosition(new sdk.LatLng(spec.lat, spec.lng));
      paintMarker(held.element, spec, spec.id === focusedRef.current);
      held.spec = spec;
    }
    for (const spec of added) {
      const element = createMarker(spec, () => selectRef.current?.(spec.id));
      paintMarker(element, spec, spec.id === focusedRef.current);
      const overlay = new sdk.CustomOverlay({
        position: new sdk.LatLng(spec.lat, spec.lng),
        content: element,
        yAnchor: 1,
        clickable: true,
      });
      overlay.setMap(map);
      overlays.set(spec.id, { overlay, spec, element });
    }

    // 마커가 하나도 안 바뀌었으면 범위도 건드리지 않는다. 조회 중에 상태만 바뀌어도
    // 범위를 다시 맞추면, 사용자가 끌어 놓은 지도가 마커와 무관한 갱신에 원위치된다.
    if (added.length + moved.length + removed.length === 0) return;

    const view = computeView(specs.map((spec) => ({ lat: spec.lat, lng: spec.lng, label: spec.title, matchedBy: 'address' as const })));
    if (view.kind === 'center') {
      map.setCenter(new sdk.LatLng(view.lat, view.lng));
      map.setLevel(view.level);
    } else if (view.kind === 'bounds') {
      const bounds = new sdk.LatLngBounds();
      bounds.extend(new sdk.LatLng(view.south, view.west));
      bounds.extend(new sdk.LatLng(view.north, view.east));
      // 앱바와 시트가 덮은 만큼 안쪽으로 맞춘다. 좌우 여백은 마커 지름의 절반쯤이면
      // 가장자리 마커가 잘리지 않는다.
      const inset = containerRef.current === null ? { top: 0, bottom: 0 } : overlayPadding(containerRef.current);
      map.setBounds(bounds, inset.top + 16, 24, inset.bottom + 16, 24);
    }
  }, [entries, sdk]);

  // 목록에서 고른 항목으로 지도를 옮기고, 그 마커에만 테를 두른다.
  useEffect(() => {
    const map = mapRef.current;
    if (sdk === null || map === null) return;

    // 고른 것이 바뀌면 이전 마커의 테를 지워야 한다. 전체를 다시 칠하는 편이
    // 직전 선택을 따로 기억하는 것보다 틀릴 구석이 적다 — 마커는 많아야 수십 개다.
    for (const [id, held] of overlaysRef.current) {
      paintMarker(held.element, held.spec, id === focusedId);
    }

    if (focusedId === null) return;
    const held = overlaysRef.current.get(focusedId);
    if (held === undefined) return;
    map.panTo(new sdk.LatLng(held.spec.lat, held.spec.lng));
  }, [focusedId, sdk]);

  // 언마운트 때 오버레이를 걷어 낸다. 남겨 두면 다음 지도에 유령 마커가 뜬다.
  useEffect(() => {
    const overlays = overlaysRef.current;
    return () => {
      for (const { overlay } of overlays.values()) overlay.setMap(null);
      overlays.clear();
      mapRef.current = null;
    };
  }, []);

  if (failure !== null) {
    return (
      <section className="map-placeholder" aria-label="지도">
        <p>
          <strong>{LOAD_FAILURE_MESSAGE[failure]}</strong>
        </p>
      </section>
    );
  }

  return <div className="map-view" aria-label="지도" role="region" ref={containerRef} />;
}
