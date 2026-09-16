import { describe, expect, it, vi } from 'vitest';

import type { Entry } from '../../domain/types';
import { countByStatus, createStore } from '../store';

function entry(id: string, raw: string): Entry {
  return { id, raw, normalized: raw.toLowerCase(), status: 'pending' };
}

const THREE = [entry('a', '서울 강남구 테헤란로 152'), entry('b', '서울 중구 을지로 65'), entry('c', '서울 마포구 양화로 45')];

describe('스토어', () => {
  it('UC-LM-STORE-001: setEntries 는 배열을 통째로 교체한다', () => {
    const store = createStore();

    store.setEntries(THREE);

    expect(store.getSnapshot().entries).toEqual(THREE);
  });

  it('UC-LM-STORE-002: updateEntry 는 그 항목만 바꾼다', () => {
    const store = createStore();
    store.setEntries(THREE);

    store.updateEntry('b', { status: 'found' });

    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(entries[1]?.status).toBe('found');
    expect(entries[0]?.status).toBe('pending');
    expect(entries[2]?.status).toBe('pending');
  });

  it('UC-LM-STORE-003: 갱신이 아무 순서로 와도 목록 순서는 그대로다', () => {
    const store = createStore();
    store.setEntries(THREE);

    // 조회가 끝나는 순서는 제멋대로다. 그것이 목록을 흔들면 마커 번호가 어긋난다.
    store.updateEntry('c', { status: 'found' });
    store.updateEntry('a', { status: 'failed' });
    store.updateEntry('b', { status: 'found' });

    expect(store.getSnapshot().entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(store.getSnapshot().entries.map((e) => e.raw)).toEqual(THREE.map((e) => e.raw));
  });

  it('UC-LM-STORE-004: 없는 id 로 갱신하면 아무 일도 없다', () => {
    const store = createStore();
    store.setEntries(THREE);
    const before = store.getSnapshot();

    store.updateEntry('없는-id', { status: 'found' });

    expect(store.getSnapshot()).toBe(before);
  });

  it('UC-LM-STORE-005: 원본 배열과 원본 항목을 건드리지 않는다', () => {
    const store = createStore();
    const original = THREE.map((e) => ({ ...e }));
    store.setEntries(original);

    store.updateEntry('a', { status: 'found' });

    expect(original[0]?.status).toBe('pending');
  });

  it('UC-LM-STORE-006: 구독자는 바뀔 때만 불린다', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setEntries(THREE);
    expect(listener).toHaveBeenCalledTimes(1);

    // 같은 값으로 setRunning 하면 스냅샷이 그대로다. 매번 새 객체를 만들면
    // useSyncExternalStore 가 무한 루프에 빠진다.
    store.setRunning(false);
    expect(listener).toHaveBeenCalledTimes(1);

    store.setRunning(true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.reset();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('UC-LM-STORE-007: reset 은 빈 상태로 돌아간다', () => {
    const store = createStore();
    store.setEntries(THREE);
    store.setRunning(true);

    store.reset();

    expect(store.getSnapshot()).toEqual({ entries: [], running: false });
  });

  it('UC-LM-STORE-008: countByStatus 는 못 찾음과 오류를 함께 센다', () => {
    const entries: Entry[] = [
      { ...entry('a', 'a'), status: 'found' },
      { ...entry('b', 'b'), status: 'notFound' },
      { ...entry('c', 'c'), status: 'failed' },
      { ...entry('d', 'd'), status: 'loading' },
    ];

    expect(countByStatus(entries)).toEqual({ found: 1, failed: 2, done: 3, total: 4 });
  });
});
