import { describe, expect, it } from 'vitest';

import {
  createKakaoGeocoder,
  createKakaoGeocoderFromGlobal,
  type KakaoAddressItem,
  type KakaoPlaceItem,
  type KakaoServices,
} from '../kakao-adapter';

/**
 * 계약이 아니라 **Kakao 특유의 것**만 여기서 본다 — 좌표 축, 콜백→Promise,
 * 주소→키워드 순서, status 분류. 계약 자체는 `port-contract.test.ts` 가 본다.
 */

const STATUS = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' } as const;

/** `'silent'` 는 콜백을 영영 부르지 않는 SDK 다 — 스크립트가 죽은 경우가 이렇다. */
type AddressAnswer = { result: KakaoAddressItem[]; status: string } | 'throw' | 'silent';
type KeywordAnswer = { result: KakaoPlaceItem[]; status: string } | 'throw' | 'silent';

type Calls = { address: string[]; keyword: string[] };

function services(
  address: AddressAnswer,
  keyword: KeywordAnswer = { result: [], status: STATUS.ZERO_RESULT },
  calls: Calls = { address: [], keyword: [] },
): KakaoServices {
  return {
    Status: STATUS,
    Geocoder: class {
      addressSearch(query: string, cb: (r: KakaoAddressItem[], s: string) => void): void {
        calls.address.push(query);
        if (address === 'throw') throw new Error('SDK 가 로드되지 않았다');
        if (address === 'silent') return;
        queueMicrotask(() => cb(address.result, address.status));
      }
    },
    Places: class {
      keywordSearch(query: string, cb: (r: KakaoPlaceItem[], s: string) => void): void {
        calls.keyword.push(query);
        if (keyword === 'throw') throw new Error('SDK 가 로드되지 않았다');
        if (keyword === 'silent') return;
        queueMicrotask(() => cb(keyword.result, keyword.status));
      }
    },
  };
}

const 역삼: KakaoAddressItem = {
  address_name: '서울 강남구 역삼동 737',
  // 경도 127, 위도 37. 뒤집히면 위도 127 이 되어 한국 밖으로 나간다.
  x: '127.036486',
  y: '37.500713',
  road_address: { address_name: '서울 강남구 테헤란로 152' },
};

describe('Kakao 어댑터', () => {
  it('UC-LM-KAKAO-001: x 를 lng 로, y 를 lat 로 옮긴다', async () => {
    const port = createKakaoGeocoder(services({ result: [역삼], status: STATUS.OK }));

    const result = await port.geocode('서울 강남구 테헤란로 152');

    expect(result).toEqual({
      ok: true,
      place: {
        lat: 37.500713,
        lng: 127.036486,
        label: '서울 강남구 역삼동 737',
        roadAddress: '서울 강남구 테헤란로 152',
        matchedBy: 'address',
      },
    });
  });

  it('UC-LM-KAKAO-002: 문자열 좌표를 숫자로 바꾼다', async () => {
    const port = createKakaoGeocoder(services({ result: [역삼], status: STATUS.OK }));

    const result = await port.geocode('서울 강남구 테헤란로 152');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.place.lat).toBe('number');
    expect(typeof result.place.lng).toBe('number');
  });

  it('UC-LM-KAKAO-003: road_address 가 null 이면 roadAddress 를 비워 둔다', async () => {
    const port = createKakaoGeocoder(
      services({ result: [{ ...역삼, road_address: null }], status: STATUS.OK }),
    );

    const result = await port.geocode('서울 강남구 역삼동 737');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.place.roadAddress).toBeUndefined();
  });

  it('UC-LM-KAKAO-004: 주소로 못 찾으면 키워드 검색으로 한 번 더 간다', async () => {
    const calls: Calls = { address: [], keyword: [] };
    const port = createKakaoGeocoder(
      services(
        { result: [], status: STATUS.ZERO_RESULT },
        {
          result: [
            {
              place_name: '카카오판교오피스',
              address_name: '경기 성남시 분당구 삼평동 681',
              road_address_name: '경기 성남시 분당구 판교역로 166',
              x: '127.108212',
              y: '37.402056',
            },
          ],
          status: STATUS.OK,
        },
        calls,
      ),
    );

    const result = await port.geocode('카카오판교오피스');

    expect(calls.address).toEqual(['카카오판교오피스']);
    expect(calls.keyword).toEqual(['카카오판교오피스']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.place.matchedBy).toBe('keyword');
    expect(result.place.label).toBe('카카오판교오피스');
  });

  it('UC-LM-KAKAO-005: 주소로 찾았으면 키워드 검색을 부르지 않는다', async () => {
    const calls: Calls = { address: [], keyword: [] };
    const port = createKakaoGeocoder(
      services({ result: [역삼], status: STATUS.OK }, undefined, calls),
    );

    await port.geocode('서울 강남구 테헤란로 152');

    expect(calls.keyword).toEqual([]);
  });

  it('UC-LM-KAKAO-006: 양쪽 다 결과가 없으면 zero_result 다', async () => {
    const port = createKakaoGeocoder(services({ result: [], status: STATUS.ZERO_RESULT }));

    const result = await port.geocode('있을 리 없는 주소');

    expect(result).toEqual({
      ok: false,
      failure: { reason: 'zero_result', message: '검색 결과가 없습니다' },
    });
  });

  it('UC-LM-KAKAO-007: ERROR 는 sdk 실패로 분류한다 (쿼터로 추측하지 않는다)', async () => {
    const port = createKakaoGeocoder(services({ result: [], status: STATUS.ERROR }));

    const result = await port.geocode('서울 강남구 테헤란로 152');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // SDK 가 쿼터 초과를 별도 코드로 알려 주지 않는다. 'quota' 로 부르면
    // 큐가 나머지를 통째로 멈춰 버리므로, 근거 없이 그렇게 부르지 않는다.
    expect(result.failure.reason).toBe('sdk');
  });

  it('UC-LM-KAKAO-008: SDK 가 동기 예외를 던져도 값으로 답한다', async () => {
    const port = createKakaoGeocoder(services('throw'));

    const result = await port.geocode('서울 강남구 테헤란로 152');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('sdk');
    expect(result.failure.message).toBe('SDK 가 로드되지 않았다');
  });

  it('UC-LM-KAKAO-009: 좌표가 숫자로 파싱되지 않으면 키워드 검색으로 넘어간다', async () => {
    const calls: Calls = { address: [], keyword: [] };
    const port = createKakaoGeocoder(
      services({ result: [{ ...역삼, x: '', y: '' }], status: STATUS.OK }, undefined, calls),
    );

    const result = await port.geocode('서울 강남구 테헤란로 152');

    // 쓸 수 없는 항목은 결과가 없는 것과 같다. 그러니 폴백도 그대로 탄다.
    expect(calls.keyword).toEqual(['서울 강남구 테헤란로 152']);
    expect(result.ok).toBe(false);
  });

  it('UC-LM-KAKAO-011: 주소 검색이 OK 인데 결과가 비어 있으면 키워드로 넘어간다', async () => {
    const calls: Calls = { address: [], keyword: [] };
    const port = createKakaoGeocoder(services({ result: [], status: STATUS.OK }, undefined, calls));

    const result = await port.geocode('서울 강남구 테헤란로 152');

    expect(calls.keyword).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  it('UC-LM-KAKAO-012: 키워드 검색의 ERROR 도 sdk 실패로 분류한다', async () => {
    const port = createKakaoGeocoder(
      services({ result: [], status: STATUS.ZERO_RESULT }, { result: [], status: STATUS.ERROR }),
    );

    const result = await port.geocode('있을 리 없는 주소');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('sdk');
  });

  it('UC-LM-KAKAO-013: 진행 중에 abort 되면 콜백을 기다리지 않고 끝난다', async () => {
    // 콜백이 영영 오지 않는 SDK. abort 를 받지 못하면 이 프라미스는 settle 되지 않고,
    // 큐의 Promise.all 이 끝나지 않아 화면이 loading 에 고정된다.
    const port = createKakaoGeocoder(services('silent'));
    const controller = new AbortController();

    const pending = port.geocode('서울 강남구 테헤란로 152', controller.signal);
    controller.abort();

    const result = await pending;

    expect(result.ok).toBe(false);
  });

  it('UC-LM-KAKAO-014: abort 보다 먼저 도착한 성공 결과는 살린다', async () => {
    let fire: (() => void) | undefined;
    const controller = new AbortController();
    const port = createKakaoGeocoder({
      Status: STATUS,
      Geocoder: class {
        addressSearch(_q: string, cb: (r: KakaoAddressItem[], s: string) => void): void {
          fire = () => cb([역삼], STATUS.OK);
        }
      },
      Places: class {
        keywordSearch(_q: string, cb: (r: KakaoPlaceItem[], s: string) => void): void {
          cb([], STATUS.ZERO_RESULT);
        }
      },
    });

    const pending = port.geocode('서울 강남구 테헤란로 152', controller.signal);
    fire?.();
    controller.abort();

    const result = await pending;

    // 이미 쿼터를 쓴 응답이다. 버리면 사용자가 멈춘 대가로 좌표까지 잃는다.
    expect(result.ok).toBe(true);
  });

  it('UC-LM-KAKAO-010: 전역에 SDK 가 없으면 어댑터를 만들지 않는다', () => {
    expect(createKakaoGeocoderFromGlobal({})).toBeNull();
    expect(createKakaoGeocoderFromGlobal({ kakao: { maps: {} } })).toBeNull();
    expect(createKakaoGeocoderFromGlobal({ kakao: { maps: { services: services({ result: [], status: STATUS.OK }) } } })).not.toBeNull();
  });
});
