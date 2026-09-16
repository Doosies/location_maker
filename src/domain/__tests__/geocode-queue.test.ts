import { describe, expect, it, vi } from 'vitest';

import { runGeocodeQueue } from '../geocode-queue';
import { parseAddresses } from '../parse-addresses';
import type { Entry, GeocodePort, GeocodeResult, Place } from '../types';

const SEOUL: Place = { lat: 37.5665, lng: 126.978, label: '서울시청', matchedBy: 'address' };

function found(): GeocodeResult {
  return { ok: true, place: SEOUL };
}

function failedWith(reason: 'zero_result' | 'network' | 'quota' | 'sdk'): GeocodeResult {
  return { ok: false, failure: { reason, message: `${reason} 이다` } };
}

/** 응답 시점을 테스트가 직접 쥐는 어댑터. 동시성과 중단은 이것 없이는 못 본다. */
function controllablePort() {
  const calls: { query: string; resolve: (result: GeocodeResult) => void }[] = [];

  const port: GeocodePort = {
    geocode: (query) =>
      new Promise<GeocodeResult>((resolve) => {
        calls.push({ query, resolve });
      }),
  };

  return { port, calls };
}

function entriesOf(...addresses: string[]): Entry[] {
  return parseAddresses(addresses.join('\n'));
}

/** 마이크로태스크 큐를 비워, 해소된 프라미스에 이어진 작업이 실제로 돌게 한다. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runGeocodeQueue', () => {
  it('UC-LM-QUEUE-001: 동시 실행이 정해진 수를 넘지 않는다', async () => {
    const { port, calls } = controllablePort();
    const entries = entriesOf(...Array.from({ length: 10 }, (_, index) => `주소 ${index}`));

    let settledCalls = 0;
    let maxConcurrent = 0;

    const running = runGeocodeQueue({ entries, port, concurrency: 3, onResult: () => {} });

    // 대기 중인 조회를 한 번에 하나씩 풀어 주면서, 그때마다 몇 건이 떠 있는지 센다.
    while (settledCalls < entries.length) {
      await flush();
      maxConcurrent = Math.max(maxConcurrent, calls.length - settledCalls);
      calls[settledCalls]?.resolve(found());
      settledCalls += 1;
    }
    await running;

    expect(calls).toHaveLength(10);
    expect(maxConcurrent).toBe(3);
  });

  it('UC-LM-QUEUE-002: 한 건이 끝날 때마다 즉시 알린다', async () => {
    const { port, calls } = controllablePort();
    const entries = entriesOf('주소 1', '주소 2', '주소 3', '주소 4');
    const settled: Entry[] = [];

    const running = runGeocodeQueue({
      entries,
      port,
      concurrency: 2,
      onResult: (entry) => {
        if (entry.status !== 'loading') settled.push(entry);
      },
    });
    await flush();

    calls[0]?.resolve(found());
    await flush();

    // 아직 전체가 끝나지 않았는데도 첫 결과가 올라와 있다.
    expect(settled).toHaveLength(1);
    expect(settled[0]?.status).toBe('found');

    for (const call of calls) call.resolve(found());
    await flush();
    for (const call of calls) call.resolve(found());
    await running;
  });

  it('UC-LM-QUEUE-003: 찾은 항목은 found 가 된다', async () => {
    const port: GeocodePort = { geocode: () => Promise.resolve(found()) };
    const entries = entriesOf('  서울 중구 세종대로 110  ');
    const settled: Entry[] = [];

    await runGeocodeQueue({
      entries,
      port,
      onResult: (entry) => {
        if (entry.status !== 'loading') settled.push(entry);
      },
    });

    expect(settled[0]?.status).toBe('found');
    expect(settled[0]?.place).toEqual(SEOUL);
    expect(settled[0]?.raw).toBe('서울 중구 세종대로 110');
  });

  it('UC-LM-QUEUE-004: 결과가 없으면 notFound 가 된다', async () => {
    const port: GeocodePort = { geocode: () => Promise.resolve(failedWith('zero_result')) };
    const settled: Entry[] = [];

    await runGeocodeQueue({
      entries: entriesOf('없는 주소'),
      port,
      onResult: (entry) => {
        if (entry.status !== 'loading') settled.push(entry);
      },
    });

    expect(settled[0]?.status).toBe('notFound');
    expect(settled[0]?.failure?.reason).toBe('zero_result');
  });

  it('UC-LM-QUEUE-005: 한 건이 실패해도 나머지는 계속 돈다', async () => {
    const port: GeocodePort = {
      geocode: (query) => Promise.resolve(query === '주소 2' ? failedWith('network') : found()),
    };
    const settled: Entry[] = [];

    await runGeocodeQueue({
      entries: entriesOf('주소 1', '주소 2', '주소 3'),
      port,
      concurrency: 1,
      onResult: (entry) => {
        if (entry.status !== 'loading') settled.push(entry);
      },
    });

    expect(settled.map((entry) => entry.status)).toEqual(['found', 'failed', 'found']);
  });

  it('UC-LM-QUEUE-006: 쿼터 초과는 전체를 멈춘다', async () => {
    const geocode = vi
      .fn<GeocodePort['geocode']>()
      .mockResolvedValueOnce(found())
      .mockResolvedValueOnce(found())
      .mockResolvedValueOnce(failedWith('quota'))
      .mockResolvedValue(found());
    const settled: Entry[] = [];

    const entries = entriesOf('주소 1', '주소 2', '주소 3', '주소 4', '주소 5', '주소 6');
    await runGeocodeQueue({
      entries,
      port: { geocode },
      concurrency: 1,
      onResult: (entry) => {
        if (entry.status !== 'loading') settled.push(entry);
      },
    });

    expect(geocode).toHaveBeenCalledTimes(3);
    expect(settled.map((entry) => entry.status)).toEqual(['found', 'found', 'failed']);
    // 손대지 않은 항목은 입력 그대로 pending 이다.
    expect(entries.slice(3).every((entry) => entry.status === 'pending')).toBe(true);
  });

  it('UC-LM-QUEUE-007: 중단 신호를 받으면 새로 시작하지 않는다', async () => {
    const { port, calls } = controllablePort();
    const controller = new AbortController();
    const entries = entriesOf('주소 1', '주소 2', '주소 3', '주소 4');

    const running = runGeocodeQueue({
      entries,
      port,
      concurrency: 2,
      signal: controller.signal,
      onResult: () => {},
    });
    await flush();
    expect(calls).toHaveLength(2);

    controller.abort();
    for (const call of calls) call.resolve(found());
    await running;

    expect(calls).toHaveLength(2);
    expect(entries.slice(2).every((entry) => entry.status === 'pending')).toBe(true);
  });

  it('UC-LM-QUEUE-008: 같은 주소는 한 번만 조회한다', async () => {
    const geocode = vi.fn<GeocodePort['geocode']>().mockResolvedValue(found());
    const settled: Entry[] = [];

    await runGeocodeQueue({
      entries: entriesOf('서울 중구 세종대로 110', '서울 중구  세종대로 110', '  서울 중구 세종대로 110'),
      port: { geocode },
      onResult: (entry) => {
        if (entry.status !== 'loading') settled.push(entry);
      },
    });

    expect(geocode).toHaveBeenCalledTimes(1);
    expect(settled).toHaveLength(3);
    expect(settled.every((entry) => entry.status === 'found')).toBe(true);
  });

  it('UC-LM-QUEUE-009: 빈 배열은 아무것도 하지 않는다', async () => {
    const geocode = vi.fn<GeocodePort['geocode']>().mockResolvedValue(found());

    await runGeocodeQueue({ entries: [], port: { geocode }, onResult: () => {} });

    expect(geocode).not.toHaveBeenCalled();
  });
});
