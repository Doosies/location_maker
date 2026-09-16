import type { GeocodePort, GeocodeResult } from './port';

/**
 * 네트워크도 SDK 도 없는 지오코더.
 *
 * 큐의 동시성·중단·쿼터 경로를 검증하는 데 쓴다. 실패를 내는 방법이 없으면
 * 실패 경로는 영영 테스트되지 않는다. 그래서 고정 표 말고 **트리거 문자열**을 둔다.
 */

/** 표에 없는 주소라도 이 문자열이 들어 있으면 그 실패를 낸다. */
export const FAKE_TRIGGERS = {
  network: '__network__',
  quota: '__quota__',
  sdk: '__sdk__',
} as const;

export type FakePlaceRow = {
  lat: number;
  lng: number;
  label: string;
  roadAddress?: string;
};

/** 기본 표. 실제로 존재하는 주소의 대략적인 좌표다. */
export const DEFAULT_FAKE_PLACES: Record<string, FakePlaceRow> = {
  '서울 강남구 테헤란로 152': {
    lat: 37.500713,
    lng: 127.036486,
    label: '서울 강남구 역삼동 737',
    roadAddress: '서울 강남구 테헤란로 152',
  },
  '서울 중구 세종대로 110': {
    lat: 37.566295,
    lng: 126.977945,
    label: '서울 중구 태평로1가 31',
    roadAddress: '서울 중구 세종대로 110',
  },
  '부산 해운대구 해운대해변로 264': {
    lat: 35.158698,
    lng: 129.160384,
    label: '부산 해운대구 우동 1393',
    roadAddress: '부산 해운대구 해운대해변로 264',
  },
};

export type FakeGeocoderOptions = {
  places?: Record<string, FakePlaceRow>;
  /** 응답까지의 지연(ms). 큐의 동시성 테스트가 겹침을 관찰하려면 0 보다 커야 한다. */
  delayMs?: number;
  /** 호출된 질의를 순서대로 기록한다. 중복 접기를 확인하는 쪽에서 본다. */
  calls?: string[];
};

/** 표 조회 키. 도메인의 정규화와 같은 규칙이어야 표가 예상대로 맞는다. */
function toKey(query: string): string {
  return query.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function failure(reason: 'network' | 'quota' | 'sdk'): GeocodeResult {
  const messages = {
    network: '네트워크가 끊겼다',
    quota: '오늘 조회 한도를 다 썼다',
    sdk: '지도 SDK 가 응답하지 않는다',
  } as const;
  return { ok: false, failure: { reason, message: messages[reason] } };
}

/**
 * `signal.aborted` 를 프로퍼티로 두 번 읽으면 첫 검사가 타입을 좁혀 두 번째가
 * "일어날 수 없는 비교" 로 잡힌다. abort 는 도중에 바뀌는 값이라 매번 새로 읽는다.
 */
function aborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

export function createFakeGeocoder(options: FakeGeocoderOptions = {}): GeocodePort {
  const places = options.places ?? DEFAULT_FAKE_PLACES;
  const delayMs = options.delayMs ?? 0;

  const table = new Map<string, FakePlaceRow>(
    Object.entries(places).map(([address, row]) => [toKey(address), row]),
  );

  return {
    async geocode(query, signal): Promise<GeocodeResult> {
      options.calls?.push(query);

      if (aborted(signal)) {
        return abortedResult();
      }

      if (query.trim() === '') {
        return emptyQueryResult();
      }

      if (delayMs > 0) {
        await sleep(delayMs, signal);
        if (aborted(signal)) {
          return abortedResult();
        }
      }

      for (const [reason, trigger] of Object.entries(FAKE_TRIGGERS)) {
        if (query.includes(trigger)) {
          return failure(reason as 'network' | 'quota' | 'sdk');
        }
      }

      const row = table.get(toKey(query));
      if (row === undefined) {
        return {
          ok: false,
          failure: { reason: 'zero_result', message: '검색 결과가 없다' },
        };
      }

      return {
        ok: true,
        place: {
          lat: row.lat,
          lng: row.lng,
          label: row.label,
          ...(row.roadAddress === undefined ? {} : { roadAddress: row.roadAddress }),
          matchedBy: 'address',
        },
      };
    },
  };
}

/**
 * 중단과 빈 질의는 두 어댑터가 똑같이 답해야 하는 자리라 여기 모아 둔다.
 * 계약 테스트가 두 구현에 같은 기대를 걸기 때문이다.
 */
export function abortedResult(): GeocodeResult {
  // `reason` 에 'aborted' 는 없다. 큐가 중단 중의 실패를 `pending` 으로 되돌리므로
  // 사용자에게 이 메시지가 보일 일은 없지만, 남는다면 재시도하라는 뜻이 맞다.
  return { ok: false, failure: { reason: 'network', message: '조회를 멈췄다' } };
}

export function emptyQueryResult(): GeocodeResult {
  return { ok: false, failure: { reason: 'zero_result', message: '주소가 비어 있다' } };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
