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
  /** 테스트가 가짜 SDK 를 넣는다. 주면 로더를 건너뛴다. */
  maps?: KakaoMapsNamespace;
  apiKey?: string;
};

function markerContent(spec: MarkerSpec): string {
  // 번호는 목록 자리 번호다. 사용자가 목록과 지도를 눈으로 짝지을 유일한 단서다.
  return `<div class="marker" title="${escapeHtml(spec.title)}">${spec.number}</div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function MapView({ entries, focusedId = null, maps, apiKey }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef(new Map<string, { overlay: KakaoOverlay; spec: MarkerSpec }>());
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
      held.overlay.setContent(markerContent(spec));
      held.spec = spec;
    }
    for (const spec of added) {
      const overlay = new sdk.CustomOverlay({
        position: new sdk.LatLng(spec.lat, spec.lng),
        content: markerContent(spec),
        yAnchor: 1,
        clickable: true,
      });
      overlay.setMap(map);
      overlays.set(spec.id, { overlay, spec });
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
      map.setBounds(bounds);
    }
  }, [entries, sdk]);

  // 목록에서 고른 항목으로 지도를 옮긴다.
  useEffect(() => {
    const map = mapRef.current;
    if (sdk === null || map === null || focusedId === null) return;

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
