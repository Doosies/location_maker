import type { GeocodePort, GeocodeResult } from './port';
import { aborted, abortedResult, emptyQueryResult } from './results';

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
    network: '네트워크가 끊겼습니다',
    quota: '오늘 조회 한도를 다 썼습니다',
    sdk: '지도 SDK 가 응답하지 않습니다',
  } as const;
  return { ok: false, failure: { reason, message: messages[reason] } };
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
          failure: { reason: 'zero_result', message: '검색 결과가 없습니다' },
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    // 큐는 항목 전부에 같은 signal 을 넘긴다. 정상 만료 때 리스너를 떼지 않으면
    // (`once` 는 발화했을 때만 떼 준다) 항목 수만큼 리스너가 쌓인다.
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}
