/**
 * 지도 쪽에서 쓰는 SDK 조각만 직접 선언한다. 커뮤니티 타입 패키지를 끌어오지 않는
 * 이유는 M3 어댑터와 같다 — 버전 추종 문제를 피하고, 어긋나면 여기서 끝난다.
 */

export type KakaoLatLng = { getLat(): number; getLng(): number };

export type KakaoBounds = { extend(latlng: KakaoLatLng): void };

export type KakaoMap = {
  /**
   * 범위를 맞춘다. 여백을 주면 그만큼 **안쪽**에 맞춘다.
   * https://apis.map.kakao.com/web/documentation/#Map_setBounds
   *
   * 지도 컨테이너 위를 앱바와 시트가 덮고 있으므로, 여백 없이 맞추면 마커가 그
   * 아래에 숨는다.
   */
  setBounds(
    bounds: KakaoBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  panTo(latlng: KakaoLatLng): void;
};

export type KakaoOverlay = {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
  setContent(content: string | HTMLElement): void;
};

export type KakaoMapsNamespace = {
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    /**
     * 문자열도 되지만 **요소를 준다.** 요소를 주면 그 요소에 직접 리스너를 걸 수
     * 있어, 클릭이 지도 컨테이너까지 버블되는지에 기대지 않아도 된다.
     */
    content: string | HTMLElement;
    yAnchor?: number;
    clickable?: boolean;
  }) => KakaoOverlay;
};
