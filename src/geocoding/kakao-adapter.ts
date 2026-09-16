import type { GeocodePort, GeocodeResult, Place } from './port';
import { aborted, abortedResult, emptyQueryResult } from './results';

/**
 * Kakao 지도 SDK 를 `GeocodePort` 뒤로 감춘다.
 *
 * **콜백을 Promise 로 바꾸는 층은 이 파일 하나뿐이다.** 앱의 나머지는 SDK 가
 * 콜백 API 라는 사실도, `x`/`y` 가 문자열이라는 사실도 모른다.
 *
 * 시그니처의 근거는 `docs/findings/kakao-sdk.md` 다. 설계 문서가 아니다.
 */

// ── SDK 타입 ────────────────────────────────────────────────────────────────
// 커뮤니티 타입 패키지를 끌어오지 않고 **쓰는 만큼만** 직접 선언한다.
// 버전 추종 문제를 피하고, 어긋나면 이 파일 안에서 끝난다.

/** 주소 검색 결과 한 건. `x`·`y` 는 **문자열**이다. */
export type KakaoAddressItem = {
  address_name: string;
  address_type?: string;
  x: string;
  y: string;
  road_address?: { address_name?: string; building_name?: string } | null;
};

/** 키워드 검색 결과 한 건. */
export type KakaoPlaceItem = {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string;
  y: string;
};

export type KakaoStatus = { OK: string; ZERO_RESULT: string; ERROR: string };

type Callback<T> = (result: T[], status: string) => void;

/** 콜백이 먼저 왔는지, abort 가 먼저 왔는지. 둘을 섞으면 성공을 버리게 된다. */
type CallOutcome<T> = { aborted: true } | { aborted: false; result: T[]; status: string };

export type KakaoGeocoder = {
  addressSearch(query: string, callback: Callback<KakaoAddressItem>): void;
};

export type KakaoPlaces = {
  keywordSearch(query: string, callback: Callback<KakaoPlaceItem>): void;
};

/**
 * 어댑터가 필요로 하는 SDK 조각. 전역 `kakao` 를 직접 읽지 않고 이것을 주입받는다 —
 * 테스트가 스텁을 넣을 수 있어야 하고, 전역을 읽는 순간 이 파일이 브라우저 전용이 된다.
 */
export type KakaoServices = {
  Geocoder: new () => KakaoGeocoder;
  Places: new () => KakaoPlaces;
  Status: KakaoStatus;
};

// ── 변환 ────────────────────────────────────────────────────────────────────

/**
 * SDK 좌표 → 우리 좌표.
 *
 * **`x` 가 경도, `y` 가 위도이고 둘 다 문자열이다.** 여기서 뒤집거나 파싱을 빼먹으면
 * 마커가 전부 바다로 간다. 축을 옮기는 자리는 이 함수 하나뿐이다.
 */
function toLatLng(item: { x: string; y: string }): { lat: number; lng: number } | null {
  const lat = Number.parseFloat(item.y);
  const lng = Number.parseFloat(item.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toPlaceFromAddress(item: KakaoAddressItem): Place | null {
  const coords = toLatLng(item);
  if (coords === null) return null;

  const roadAddress = item.road_address?.address_name;
  return {
    ...coords,
    label: item.address_name,
    // `road_address` 는 없을 수 있고, 있어도 빈 문자열인 경우가 있다.
    ...(roadAddress !== undefined && roadAddress !== '' ? { roadAddress } : {}),
    matchedBy: 'address',
  };
}

function toPlaceFromKeyword(item: KakaoPlaceItem): Place | null {
  const coords = toLatLng(item);
  if (coords === null) return null;

  const roadAddress = item.road_address_name;
  return {
    ...coords,
    // 키워드로 찾았다면 사용자가 친 것은 상호명일 가능성이 높다. 상호명을 보여 준다.
    label: item.place_name === '' ? item.address_name : item.place_name,
    ...(roadAddress !== undefined && roadAddress !== '' ? { roadAddress } : {}),
    matchedBy: 'keyword',
  };
}

function sdkFailure(message: string): GeocodeResult {
  // 쿼터 초과가 별도 status 로 오지 않는다 (docs/findings/kakao-sdk.md).
  // `ERROR` 하나로 서버 오류와 한도 초과가 섞여 오므로, **추측해서 'quota' 로
  // 부르지 않는다.** 한도 때문이었다면 다시 시도해도 같은 오류가 날 뿐이고,
  // 서버 오류였다면 재시도가 맞다. 두 경우 모두 사용자가 할 일은 같다.
  return { ok: false, failure: { reason: 'sdk', message } };
}

function zeroResult(): GeocodeResult {
  return { ok: false, failure: { reason: 'zero_result', message: '검색 결과가 없다' } };
}

// ── 어댑터 ──────────────────────────────────────────────────────────────────

export function createKakaoGeocoder(services: KakaoServices): GeocodePort {
  const geocoder = new services.Geocoder();
  const places = new services.Places();
  const { Status } = services;

  /**
   * 콜백 한 번을 Promise 한 번으로 바꾼다. 두 번 부르는 SDK 가 있어도 첫 번째만 쓴다.
   *
   * **진행 중에도 `signal` 을 본다.** 콜백이 영영 오지 않는 경우(스크립트가 죽거나
   * 응답이 유실되는 경우)가 실제로 있고, abort 를 여기서 받지 않으면 `geocode` 가
   * settle 되지 않는다. 그러면 큐의 `Promise.all` 이 끝나지 않아 화면의 그 줄이
   * `loading` 에 고정되고 "멈춤" 버튼도 듣지 않는다.
   *
   * 콜백이 abort 보다 먼저 왔다면 **그 결과를 쓴다** — 이미 쿼터를 쓴 응답을 버릴
   * 이유가 없다. 큐도 같은 이유로 "성공은 살린다" 로 돼 있다.
   */
  function call<T>(invoke: (callback: Callback<T>) => void, signal?: AbortSignal): Promise<CallOutcome<T>> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (outcome: CallOutcome<T>): void => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        resolve(outcome);
      };
      function onAbort(): void {
        finish({ aborted: true });
      }

      if (aborted(signal)) {
        resolve({ aborted: true });
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });

      try {
        invoke((result, status) => finish({ aborted: false, result: result ?? [], status }));
      } catch (error) {
        // SDK 가 콜백 대신 동기 예외를 던지는 경우 (스크립트 미로딩 등).
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  return {
    async geocode(query, signal): Promise<GeocodeResult> {
      if (aborted(signal)) return abortedResult();
      if (query.trim() === '') return emptyQueryResult();

      let address: CallOutcome<KakaoAddressItem>;
      try {
        address = await call<KakaoAddressItem>((cb) => geocoder.addressSearch(query, cb), signal);
      } catch (error) {
        return sdkFailure(error instanceof Error ? error.message : '주소 검색에 실패했다');
      }

      if (address.aborted) return abortedResult();

      if (address.status === Status.OK) {
        const first = address.result[0];
        const place = first === undefined ? null : toPlaceFromAddress(first);
        // 좌표가 이미 손에 있다면 그 사이 abort 가 있었더라도 돌려준다.
        if (place !== null) return { ok: true, place };
        // OK 인데 쓸 수 있는 항목이 없다. 키워드 검색으로 한 번 더 가 본다.
      } else if (address.status === Status.ERROR) {
        return sdkFailure('주소 검색 중 오류가 났다');
      }

      // 두 번째 조회를 **시작하기 전에** 중단을 본다. 첫 조회가 빈손으로 끝난 뒤라
      // 버릴 결과가 없고, 멈춘 뒤에 쿼터를 한 건 더 쓸 이유도 없다.
      if (aborted(signal)) return abortedResult();

      // 지번·도로명으로 못 찾았다. 상호명일 수 있으니 키워드로 한 번 더 찾는다.
      let keyword: CallOutcome<KakaoPlaceItem>;
      try {
        keyword = await call<KakaoPlaceItem>((cb) => places.keywordSearch(query, cb), signal);
      } catch (error) {
        return sdkFailure(error instanceof Error ? error.message : '키워드 검색에 실패했다');
      }

      if (keyword.aborted) return abortedResult();

      if (keyword.status === Status.ERROR) {
        return sdkFailure('키워드 검색 중 오류가 났다');
      }
      if (keyword.status !== Status.OK) return zeroResult();

      const first = keyword.result[0];
      const place = first === undefined ? null : toPlaceFromKeyword(first);
      if (place === null) return zeroResult();

      return { ok: true, place };
    },
  };
}

/**
 * 전역 `kakao` 에서 어댑터를 만든다. 전역을 읽는 곳은 여기 한 줄뿐이고,
 * SDK 가 아직 로드되지 않았으면 `null` 을 돌려준다 — 키가 없을 때 흰 화면 대신
 * 안내를 띄우려면 호출하는 쪽이 이 구분을 볼 수 있어야 한다.
 */
export function createKakaoGeocoderFromGlobal(scope: unknown = globalThis): GeocodePort | null {
  const services = (scope as { kakao?: { maps?: { services?: KakaoServices } } }).kakao?.maps?.services;
  if (services === undefined) return null;
  return createKakaoGeocoder(services);
}
