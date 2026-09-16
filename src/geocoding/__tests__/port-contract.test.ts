import { describe, expect, it } from 'vitest';

import { createFakeGeocoder, DEFAULT_FAKE_PLACES } from '../fake-adapter';
import {
  createKakaoGeocoder,
  type KakaoAddressItem,
  type KakaoServices,
} from '../kakao-adapter';
import type { GeocodePort } from '../port';

/**
 * 두 구현에 **같은 테스트**를 돌린다. 계약이 말뿐인지 아닌지는 이 파일이 정한다.
 *
 * Kakao 쪽은 SDK 를 스텁으로 주입해 돌린다 — 네트워크도 키도 쓰지 않는다.
 */

const KNOWN_ADDRESS = '서울 강남구 테헤란로 152';
const UNKNOWN_ADDRESS = '있을 리 없는 주소 zzzz';

const STATUS = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' } as const;

/** 가짜 어댑터의 표를 그대로 SDK 응답 모양으로 바꾼 스텁. */
function stubServices(): KakaoServices {
  const rows = new Map<string, KakaoAddressItem>(
    Object.entries(DEFAULT_FAKE_PLACES).map(([address, row]) => [
      address,
      {
        address_name: row.label,
        // SDK 는 x=경도, y=위도를 **문자열**로 준다. 스텁도 문자열이어야 의미가 있다.
        x: String(row.lng),
        y: String(row.lat),
        road_address: row.roadAddress === undefined ? null : { address_name: row.roadAddress },
      },
    ]),
  );

  return {
    Status: STATUS,
    Geocoder: class {
      addressSearch(query: string, callback: (r: KakaoAddressItem[], s: string) => void): void {
        const row = rows.get(query);
        queueMicrotask(() =>
          row === undefined ? callback([], STATUS.ZERO_RESULT) : callback([row], STATUS.OK),
        );
      }
    },
    Places: class {
      keywordSearch(_query: string, callback: (r: never[], s: string) => void): void {
        queueMicrotask(() => callback([], STATUS.ZERO_RESULT));
      }
    },
  };
}

const implementations: [name: string, make: () => GeocodePort][] = [
  ['가짜 어댑터', () => createFakeGeocoder()],
  ['Kakao 어댑터(스텁 SDK)', () => createKakaoGeocoder(stubServices())],
];

describe.each(implementations)('GeocodePort 계약 — %s', (_name, make) => {
  it('UC-LM-PORT-001: 아는 주소는 한국 범위 안의 좌표로 돌아온다', async () => {
    const result = await make().geocode(KNOWN_ADDRESS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.place.lat).toBeGreaterThan(33);
    expect(result.place.lat).toBeLessThan(39);
    expect(result.place.lng).toBeGreaterThan(124);
    expect(result.place.lng).toBeLessThan(132);
    expect(result.place.label).not.toBe('');
  });

  it('UC-LM-PORT-002: 없는 주소는 zero_result 로 돌아온다', async () => {
    const result = await make().geocode(UNKNOWN_ADDRESS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('zero_result');
  });

  it('UC-LM-PORT-003: 빈 문자열은 실패로 돌아온다', async () => {
    const result = await make().geocode('   ');

    expect(result.ok).toBe(false);
  });

  it('UC-LM-PORT-004: 이미 abort 된 signal 이면 즉시 끝난다', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await make().geocode(KNOWN_ADDRESS, controller.signal);

    expect(result.ok).toBe(false);
  });

  it('UC-LM-PORT-005: 예외를 던지지 않고 값으로만 답한다', async () => {
    const port = make();

    // 큐가 예외 처리를 맡지 않아도 되도록 계약이 값을 약속한다.
    await expect(port.geocode(UNKNOWN_ADDRESS)).resolves.toBeDefined();
    await expect(port.geocode('')).resolves.toBeDefined();
  });
});
