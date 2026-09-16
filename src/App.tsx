import { useCallback, useRef, useState } from 'react';

import { runGeocodeQueue } from './domain/geocode-queue';
import { parseAddresses } from './domain/parse-addresses';
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
   * 실패한 줄의 원문을 입력창으로 되돌린다. 입력창을 통째로 덮어쓰지 않고, 그 줄이
   * 이미 있으면 그대로 두고 없으면 붙인다 — 조회 뒤에 입력을 지운 경우까지 받는다.
   */
  const retry = useCallback((entry: Entry) => {
    setText((current) => {
      const lines = current.split(/\r?\n/);
      const next = lines.some((line) => line.trim() === entry.raw) ? current : [...lines, entry.raw].join('\n').trimStart();
      return next;
    });
    textareaRef.current?.focus();
  }, []);

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
          <ResultList entries={entries} onRetry={retry} onSkip={skip} />
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
