import { useCallback, useEffect, useRef, useState } from 'react';

import { runGeocodeQueue } from './domain/geocode-queue';
import { normalizeLine, parseAddresses } from './domain/parse-addresses';
import type { Entry, GeocodePort } from './domain/types';
import { countByStatus, store as defaultStore, useStore, type Store } from './state/store';
import { createFakeGeocoder } from './geocoding/fake-adapter';
import { AddressInput } from './ui/AddressInput';
import { MapPlaceholder } from './ui/MapPlaceholder';
import { ProgressBar } from './ui/ProgressBar';
import { ResultList } from './ui/ResultList';

export type AppProps = {
  /**
   * 어댑터는 주입한다. M4 는 가짜 어댑터로 돌고, M5 에서 Kakao 어댑터로 바꿔 끼운다.
   * 앱 본체가 어느 쪽인지 몰라야 그 교체가 한 줄로 끝난다.
   */
  port?: GeocodePort;
  store?: Store;
};

export function App({ port, store = defaultStore }: AppProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** `고쳐서 다시` 가 고르라고 표시해 둔 원문. 렌더 뒤에 그 줄을 선택한다. */
  const pendingSelection = useRef<string | null>(null);
  // 가짜 어댑터를 매 렌더마다 새로 만들면 조회 중에 표가 갈아 끼워진다.
  const fallbackPort = useRef<GeocodePort | undefined>(undefined);
  const activePort = port ?? (fallbackPort.current ??= createFakeGeocoder({ delayMs: 120 }));

  const { entries, running } = useStore(store);
  const { found, failed, done, total } = countByStatus(entries);

  const submit = useCallback(async () => {
    const parsed = parseAddresses(text);
    if (parsed.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    store.setEntries(parsed);
    store.setRunning(true);

    try {
      await runGeocodeQueue({
        entries: parsed,
        port: activePort,
        signal: controller.signal,
        onResult: (entry) => store.updateEntry(entry.id, entry),
      });
    } finally {
      store.setRunning(false);
      abortRef.current = null;
    }
  }, [activePort, store, text]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * 실패한 줄의 원문을 입력창으로 되돌린다.
   *
   * 입력창을 통째로 덮어쓰지 않는다 — 그러면 나머지 줄이 사라진다. 그 줄이 이미
   * 있으면 **그 줄을 선택해 보여 주고**, 없으면 끝에 붙인 뒤 선택한다. 포커스만
   * 옮기면 줄이 서른 개일 때 어느 줄을 고쳐야 하는지 알 수 없다.
   *
   * 비교는 파서와 **같은 규칙**으로 한다. `line.trim()` 으로 비교하면 입력창의
   * `1. 서울…` 과 항목의 `서울…` 이 달라 보여 같은 주소가 한 줄 더 붙는다.
   */
  const retry = useCallback((entry: Entry) => {
    setText((current) => {
      const lines = current.split(/\r?\n/);
      const found = lines.findIndex((line) => normalizeLine(line) === entry.raw);
      const next = found === -1 ? [...lines, entry.raw].join('\n').replace(/^\n+/, '') : current;
      // setState 안에서 DOM 을 만지지 않는다. 다음 줄의 선택은 상태가 반영된 뒤에 한다.
      pendingSelection.current = entry.raw;
      return next;
    });
  }, []);

  useEffect(() => {
    const target = pendingSelection.current;
    const field = textareaRef.current;
    if (target === null || field === null) return;
    pendingSelection.current = null;

    const lines = field.value.split('\n');
    const index = lines.findIndex((line) => normalizeLine(line) === target);
    field.focus();
    if (index === -1) return;

    // 줄 시작 오프셋 = 앞 줄들의 길이 합 + 줄바꿈 수
    const start = lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0);
    field.setSelectionRange(start, start + (lines[index]?.length ?? 0));
  });

  const skip = useCallback(
    (entry: Entry) => {
      store.updateEntry(entry.id, { status: 'skipped' });
    },
    [store],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>location maker</h1>
        <p>주소를 여러 줄 붙여넣으면 지도에 표시한다.</p>
      </header>
      <main className="app__body">
        <div className="app__panel">
          <AddressInput
            value={text}
            onChange={setText}
            onSubmit={() => {
              void submit();
            }}
            disabled={running}
            textareaRef={textareaRef}
          />
          {running && <ProgressBar done={done} total={total} onAbort={abort} />}
          <ResultList entries={entries} onRetry={retry} onSkip={skip} running={running} />
        </div>
        <div className="app__map">
          <MapPlaceholder />
          {!running && entries.length > 0 && (
            <p className="app__map-note" aria-live="polite">
              지도가 붙으면 찾은 {found}곳에 번호 마커가 찍힌다. 실패 {failed}곳은 목록에만 남는다.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
