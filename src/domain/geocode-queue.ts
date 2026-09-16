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
  const requested = options.concurrency ?? DEFAULT_CONCURRENCY;
  // NaN·소수·0 이 들어오면 워커 수 계산이 조용히 무너져 아무것도 조회하지 않는다.
  const concurrency = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : DEFAULT_CONCURRENCY;

  // 프로퍼티로 직접 읽으면 앞선 검사 때문에 타입이 좁혀져, 뒤의 검사가
  // "일어날 수 없는 비교" 로 잡힌다. abort 는 도중에 바뀌는 값이므로 매번 새로 읽는다.
  const isAborted = () => signal?.aborted === true;

  let nextIndex = 0;
  // 쿼터가 막혔다면 나머지도 막힐 것이고, 계속 던지면 남은 한도까지 태운다.
  // 그래서 그 자리에서 전체를 멈춘다.
  let quotaExceeded = false;

  // 같은 곳을 두 번 조회하지 않는다. 진행 중인 조회를 공유해야
  // 같은 주소 셋이 동시에 출발하는 경우까지 한 번으로 접힌다.
  //
  // **끝난 프라미스도 지우지 않는다.** 한 실행 안에서는 결과를 그대로 재사용한다 —
  // 동시성 1 로 같은 주소가 차례로 와도 한 번만 물어보게 하려는 것이다.
  // 실패도 재사용되므로, 재시도는 큐를 다시 부르는 쪽(M4)에서 한다.
  const lookups = new Map<string, Promise<GeocodeResult>>();

  function lookup(entry: Entry): Promise<GeocodeResult> {
    const shared = lookups.get(entry.normalized);
    if (shared) return shared;

    const started = port.geocode(entry.raw, signal);
    lookups.set(entry.normalized, started);
    return started;
  }

  async function worker(): Promise<void> {
    while (true) {
      if (quotaExceeded || isAborted()) return;

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
          failure: { reason: 'sdk', message: error instanceof Error ? error.message : '조회에 실패했습니다' },
        };
      }

      // 중단 뒤에 도착한 실패는 사용자가 멈춘 결과이지 조회가 깨진 것이 아니다.
      // signal 을 받은 어댑터는 AbortError 를 던지므로, 그대로 두면 화면에
      // "실패" 로 뜬다. 되돌려 놓아야 "내가 멈췄는데 왜 실패지" 가 안 나온다.
      // 성공은 살린다 — 이미 받은 좌표를 버릴 이유가 없다.
      if (isAborted() && !result.ok) {
        onResult({ ...entry, status: 'pending' });
        return;
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
