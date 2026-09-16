import type { Entry, GeocodePort, GeocodeResult } from './types';

export type RunGeocodeQueueOptions = {
  entries: Entry[];
  port: GeocodePort;
  /** 동시에 흘려보낼 조회 수. 한꺼번에 던지면 남의 서비스에 실례고, 하나씩이면 느리다. */
  concurrency?: number;
  signal?: AbortSignal;
  /** 한 건이 끝날 때마다 즉시 불린다. 화면이 전체를 기다리지 않게 하려는 것이다. */
  onResult: (entry: Entry) => void;
};

const DEFAULT_CONCURRENCY = 3;

function applyResult(entry: Entry, result: GeocodeResult): Entry {
  if (result.ok) {
    return { ...entry, status: 'found', place: result.place };
  }

  return {
    ...entry,
    // 결과가 없는 것과 조회가 깨진 것은 사용자가 할 일이 다르다.
    // 전자는 주소를 고치면 되고, 후자는 다시 시도하면 된다.
    status: result.failure.reason === 'zero_result' ? 'notFound' : 'failed',
    failure: result.failure,
  };
}

/**
 * 항목들을 동시 실행 수를 지켜 가며 조회한다.
 *
 * 이 함수는 `GeocodePort` 만 안다. `window` 도 `document` 도 `kakao` 도 쓰지 않는다.
 * 중단·쿼터·동시성이 전부 가짜 어댑터만으로 검증되는 것은 그래서다.
 *
 * 입력 배열은 손대지 않는다. 결과는 새 객체로 `onResult` 에 실어 보낸다.
 */
export async function runGeocodeQueue(options: RunGeocodeQueueOptions): Promise<void> {
  const { entries, port, signal, onResult } = options;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);

  let nextIndex = 0;
  // 쿼터가 막혔다면 나머지도 막힐 것이고, 계속 던지면 남은 한도까지 태운다.
  // 그래서 그 자리에서 전체를 멈춘다.
  let quotaExceeded = false;

  // 같은 곳을 두 번 조회하지 않는다. 진행 중인 조회를 공유해야
  // 같은 주소 셋이 동시에 출발하는 경우까지 한 번으로 접힌다.
  const inFlight = new Map<string, Promise<GeocodeResult>>();

  function lookup(entry: Entry): Promise<GeocodeResult> {
    const shared = inFlight.get(entry.normalized);
    if (shared) return shared;

    const pending = port.geocode(entry.raw, signal);
    inFlight.set(entry.normalized, pending);
    return pending;
  }

  async function worker(): Promise<void> {
    while (true) {
      if (quotaExceeded || signal?.aborted === true) return;

      const index = nextIndex++;
      const entry = entries[index];
      if (entry === undefined) return;

      onResult({ ...entry, status: 'loading' });

      let result: GeocodeResult;
      try {
        result = await lookup(entry);
      } catch (error) {
        // 어댑터가 값 대신 예외를 던진 경우. 계약 위반이지만 큐가 멈출 이유는 아니다.
        result = {
          ok: false,
          failure: { reason: 'sdk', message: error instanceof Error ? error.message : '조회에 실패했다' },
        };
      }

      if (!result.ok && result.failure.reason === 'quota') {
        quotaExceeded = true;
      }

      onResult(applyResult(entry, result));
    }
  }

  const workerCount = Math.min(concurrency, entries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
