import { useSyncExternalStore } from 'react';

import type { Entry } from '../domain/types';

/**
 * 항목 배열 하나와 그것을 구독하는 것이 전부다. 상태 라이브러리를 쓰지 않는다 —
 * 이 앱의 상태는 "줄 목록" 하나뿐이고, 지켜야 할 규칙도 하나뿐이다.
 *
 * **배열 순서 = 입력 줄 순서 = 마커 번호.** 조회가 끝나는 순서는 제멋대로지만
 * 목록은 절대 흐트러지지 않는다. 그래서 갱신은 항상 `id` 로 제자리 교체다.
 */

export type StoreState = {
  entries: Entry[];
  /** 조회가 돌고 있는가. 진행 표시와 중단 버튼이 이것을 본다. */
  running: boolean;
};

const EMPTY: StoreState = { entries: [], running: false };

export type Store = {
  getSnapshot: () => StoreState;
  subscribe: (listener: () => void) => () => void;
  setEntries: (entries: Entry[]) => void;
  /** `id` 로 찾아 **그 항목만** 바꾼다. 없는 id 면 아무 일도 하지 않는다. */
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  setRunning: (running: boolean) => void;
  reset: () => void;
};

export function createStore(initial: StoreState = EMPTY): Store {
  let state = initial;
  const listeners = new Set<() => void>();

  // 스냅샷은 **바뀔 때만** 새 객체가 된다. useSyncExternalStore 는 매 렌더에서
  // getSnapshot 을 부르고 Object.is 로 비교하므로, 매번 새로 만들면 무한 루프가 난다.
  const commit = (next: StoreState): void => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEntries(entries) {
      commit({ ...state, entries });
    },
    updateEntry(id, patch) {
      const index = state.entries.findIndex((entry) => entry.id === id);
      if (index === -1) return;

      // map 이 아니라 slice + 인덱스 교체를 쓴다. 길이와 순서가 구조적으로 보장된다.
      const entries = state.entries.slice();
      entries[index] = { ...state.entries[index], ...patch } as Entry;
      commit({ ...state, entries });
    },
    setRunning(running) {
      if (state.running === running) return;
      commit({ ...state, running });
    },
    reset() {
      commit(EMPTY);
    },
  };
}

/** 앱이 쓰는 단일 스토어. 테스트는 `createStore()` 로 자기 것을 만든다. */
export const store = createStore();

export function useStore(target: Store = store): StoreState {
  return useSyncExternalStore(target.subscribe, target.getSnapshot, target.getSnapshot);
}

/** 화면 여러 곳이 같은 계산을 반복하지 않도록 한 번에 센다. */
export function countByStatus(entries: Entry[]): {
  found: number;
  failed: number;
  done: number;
  total: number;
} {
  let found = 0;
  let failed = 0;
  for (const entry of entries) {
    if (entry.status === 'found') found += 1;
    // 못 찾은 것과 오류는 사용자에게 똑같이 "안 된 것" 이다. 한 숫자로 센다.
    else if (entry.status === 'notFound' || entry.status === 'failed' || entry.status === 'skipped')
      failed += 1;
  }
  return { found, failed, done: found + failed, total: entries.length };
}
