/**
 * 지도 쪽에서 쓰는 SDK 조각만 직접 선언한다. 커뮤니티 타입 패키지를 끌어오지 않는
 * 이유는 M3 어댑터와 같다 — 버전 추종 문제를 피하고, 어긋나면 여기서 끝난다.
 */

export type KakaoLatLng = { getLat(): number; getLng(): number };

export type KakaoBounds = { extend(latlng: KakaoLatLng): void };

export type KakaoMap = {
  setBounds(bounds: KakaoBounds): void;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  panTo(latlng: KakaoLatLng): void;
};

export type KakaoOverlay = {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
  setContent(content: string): void;
};

export type KakaoMapsNamespace = {
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: string;
    yAnchor?: number;
    clickable?: boolean;
  }) => KakaoOverlay;
};
