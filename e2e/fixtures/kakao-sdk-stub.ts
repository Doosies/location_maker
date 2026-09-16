import type { Page } from '@playwright/test';

/**
 * Kakao SDK 요청을 가로채 **우리가 아는 응답만 주는 가짜 SDK** 를 심는다.
 *
 * CI 에서 진짜 SDK 를 쓰면 테스트가 남의 서비스의 네트워크와 쿼터에 묶인다. 카카오가
 * 느린 날 우리 CI 가 빨개지고, 원인은 우리 코드에 없다. 그래서 기본 저니는 스텁으로
 * 돈다 — 대신 계약이 바뀌는 것을 못 잡으므로 `live-kakao.test.ts` 를 따로 둔다.
 *
 * 가짜 지도는 **DOM 에 흔적을 남긴다.** 실제로 타일을 그리지 않으므로, 테스트가 셀 수
 * 있는 것은 우리가 남긴 자국뿐이다.
 */

/** 스텁이 아는 주소. 여기 없는 주소는 `ZERO_RESULT` 다. */
export const STUB_ADDRESSES: Record<string, { lat: number; lng: number; label: string; road: string }> = {
  '서울 강남구 테헤란로 152': {
    lat: 37.500718,
    lng: 127.036585,
    label: '서울 강남구 역삼동 737',
    road: '서울 강남구 테헤란로 152',
  },
  '서울 중구 을지로 65': {
    lat: 37.566295,
    lng: 126.991158,
    label: '서울 중구 을지로2가 199',
    road: '서울 중구 을지로 65',
  },
  '성남시 분당구 판교역로 235': {
    lat: 37.39501,
    lng: 127.11059,
    label: '경기 성남시 분당구 삼평동 681',
    road: '경기 성남시 분당구 판교역로 235',
  },
  '서울 종로구 사직로 161': {
    lat: 37.579617,
    lng: 126.977041,
    label: '서울 종로구 세종로 1-1',
    road: '서울 종로구 사직로 161',
  },
  '부산 해운대구 해운대해변로 264': {
    lat: 35.158698,
    lng: 129.160384,
    label: '부산 해운대구 중동 1394',
    road: '부산 해운대구 해운대해변로 264',
  },
};

/** 키워드로만 찾히는 곳. 주소 검색이 비고 키워드 폴백이 도는 경로를 태운다. */
export const STUB_KEYWORDS: Record<string, { lat: number; lng: number; place: string; address: string }> = {
  카카오판교아지트: {
    lat: 37.39571,
    lng: 127.11051,
    place: '카카오판교아지트',
    address: '경기 성남시 분당구 삼평동 681',
  },
};

/** 마커가 만든 요소에 붙는 클래스. 테스트는 이것을 센다. */
export const MARKER_SELECTOR = '.e2e-marker';

export type StubOptions = {
  /** 응답 지연. `중단` 을 누를 틈을 만들 때 쓴다. */
  delayMs?: number;
};

export async function installKakaoStub(page: Page, options: StubOptions = {}): Promise<void> {
  const script = stubScript(options.delayMs ?? 0);

  // 앱은 `autoload=false` 로 붙이고 `kakao.maps.load(cb)` 를 부른다. 그러니 스크립트가
  // 할 일은 전역을 채우고 `load` 를 노출하는 것까지다.
  await page.route('**/dapi.kakao.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: script }),
  );
}

function stubScript(delayMs: number): string {
  return `(function () {
  var ADDRESSES = ${JSON.stringify(STUB_ADDRESSES)};
  var KEYWORDS = ${JSON.stringify(STUB_KEYWORDS)};
  var DELAY = ${delayMs};

  function LatLng(lat, lng) { this.lat = lat; this.lng = lng; }
  LatLng.prototype.getLat = function () { return this.lat; };
  LatLng.prototype.getLng = function () { return this.lng; };

  function LatLngBounds() { this.points = []; }
  LatLngBounds.prototype.extend = function (point) { this.points.push(point); };

  function KakaoMap(container, options) {
    this.container = container;
    container.dataset.map = 'ready';
    this.setCenter(options.center);
    this.setLevel(options.level);
  }
  KakaoMap.prototype.setCenter = function (latlng) {
    this.container.dataset.center = latlng.getLat() + ',' + latlng.getLng();
  };
  KakaoMap.prototype.setLevel = function (level) { this.container.dataset.level = String(level); };
  KakaoMap.prototype.setBounds = function (bounds) {
    this.container.dataset.bounds = bounds.points
      .map(function (point) { return point.getLat() + ',' + point.getLng(); })
      .join(' ');
  };
  KakaoMap.prototype.panTo = function (latlng) {
    this.container.dataset.panTo = latlng.getLat() + ',' + latlng.getLng();
  };

  function CustomOverlay(options) {
    this.element = document.createElement('div');
    this.element.className = 'e2e-marker';
    this.setContent(options.content);
    this.setPosition(options.position);
  }
  CustomOverlay.prototype.setMap = function (map) {
    if (map === null) { this.element.remove(); return; }
    map.container.appendChild(this.element);
  };
  CustomOverlay.prototype.setPosition = function (latlng) {
    this.element.dataset.lat = String(latlng.getLat());
    this.element.dataset.lng = String(latlng.getLng());
  };
  CustomOverlay.prototype.setContent = function (content) { this.element.innerHTML = content; };

  var Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' };

  function answer(callback, result, status) {
    if (DELAY === 0) { callback(result, status); return; }
    setTimeout(function () { callback(result, status); }, DELAY);
  }

  function Geocoder() {}
  Geocoder.prototype.addressSearch = function (query, callback) {
    var hit = ADDRESSES[query];
    if (hit === undefined) { answer(callback, [], Status.ZERO_RESULT); return; }
    answer(callback, [{
      address_name: hit.label,
      x: String(hit.lng),
      y: String(hit.lat),
      road_address: { address_name: hit.road },
    }], Status.OK);
  };

  function Places() {}
  Places.prototype.keywordSearch = function (query, callback) {
    var hit = KEYWORDS[query];
    if (hit === undefined) { answer(callback, [], Status.ZERO_RESULT); return; }
    answer(callback, [{
      place_name: hit.place,
      address_name: hit.address,
      x: String(hit.lng),
      y: String(hit.lat),
    }], Status.OK);
  };

  window.kakao = {
    maps: {
      LatLng: LatLng,
      LatLngBounds: LatLngBounds,
      Map: KakaoMap,
      CustomOverlay: CustomOverlay,
      services: { Geocoder: Geocoder, Places: Places, Status: Status },
      load: function (callback) { callback(); },
    },
  };
})();`;
}
