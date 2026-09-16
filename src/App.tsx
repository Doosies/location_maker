import { useCallback, useEffect, useRef, useState } from 'react';

import { runGeocodeQueue } from './domain/geocode-queue';
import { normalizeLine, parseAddresses } from './domain/parse-addresses';
import type { Entry, GeocodePort } from './domain/types';
import { countByStatus, store as defaultStore, useStore, type Store } from './state/store';
import { createFakeGeocoder } from './geocoding/fake-adapter';
import { createKakaoGeocoderFromGlobal } from './geocoding/kakao-adapter';
import { loadKakaoSdk, type LoadFailure } from './map/load-kakao-sdk';
import { MapView } from './map/MapView';
import { AddressInput } from './ui/AddressInput';
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

/** 입력창에서 `raw` 와 같은 줄을 찾아 선택한다. 없으면 포커스만 옮긴다. */
function selectLine(field: HTMLTextAreaElement | null, raw: string): void {
  if (field === null) return;
  field.focus();

  const lines = field.value.split('\n');
  const index = lines.findIndex((line) => normalizeLine(line) === raw);
  if (index === -1) return;

  // 줄 시작 오프셋 = 앞 줄들의 길이 합 + 그만큼의 줄바꿈
  const start = lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0);
  field.setSelectionRange(start, start + (lines[index]?.length ?? 0));
}

export function App({ port, store = defaultStore }: AppProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** `고쳐서 다시` 가 고르라고 표시해 둔 원문. 렌더 뒤에 그 줄을 선택한다. */
  const pendingSelection = useRef<string | null>(null);
  // 가짜 어댑터를 매 렌더마다 새로 만들면 조회 중에 표가 갈아 끼워진다.
  const fallbackPort = useRef<GeocodePort | undefined>(undefined);
  const [kakaoPort, setKakaoPort] = useState<GeocodePort | null>(null);
  const [sdkFailure, setSdkFailure] = useState<LoadFailure | null>(null);

  const key = import.meta.env.VITE_KAKAO_JS_KEY ?? '';
  /**
   * 키가 있는데 Kakao 어댑터가 아직(또는 끝내) 없는 상태.
   *
   * 이때 가짜 어댑터로 답하면 배포 사이트에서 실제 주소가 가짜 표와 대조돼 전부
   * "못 찾음" 으로 찍힌다. 로드가 실패한 뒤라면 그 상태가 영영 이어진다. 그러니
   * **조회 자체를 잠근다.** 키가 없을 때 가짜로 흐름을 볼 수 있는 것은 그대로 둔다.
   */
  const waitingForSdk = port === undefined && key !== '' && kakaoPort === null;
  // 주입이 최우선(테스트), 그다음이 실제 SDK, 마지막이 가짜다. 키가 없어도 앱은 돈다.
  const activePort =
    port ?? kakaoPort ?? (fallbackPort.current ??= createFakeGeocoder({ delayMs: 120 }));

  // SDK 로더는 같은 약속을 나눠 주므로, 지도 쪽과 따로 불러도 스크립트는 하나다.
  useEffect(() => {
    if (port !== undefined) return;

    let cancelled = false;
    void loadKakaoSdk({ key }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setSdkFailure(result.reason);
        return;
      }
      setKakaoPort(createKakaoGeocoderFromGlobal());
    });

    return () => {
      cancelled = true;
    };
  }, [key, port]);

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
    const field = textareaRef.current;
    const current = field?.value ?? '';
    const lines = current.split(/\r?\n/);

    if (lines.some((line) => normalizeLine(line) === entry.raw)) {
      // 값이 그대로면 리렌더가 없다. 그러니 선택도 지금 여기서 끝낸다.
      selectLine(field, entry.raw);
      return;
    }

    // 붙이는 경우에는 DOM 이 아직 새 값을 모른다. 렌더 뒤에 고르도록 남겨 둔다.
    pendingSelection.current = entry.raw;
    setText([...lines, entry.raw].join('\n').replace(/^\n+/, ''));
  }, []);

  // 줄을 붙인 뒤의 선택. 렌더가 끝나 DOM 이 새 값을 들고 있을 때 실행된다.
  useEffect(() => {
    const target = pendingSelection.current;
    if (target === null) return;
    pendingSelection.current = null;
    selectLine(textareaRef.current, target);
  }, [text]);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const select = useCallback((entry: Entry) => {
    setFocusedId(entry.id);
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
            disabled={running || waitingForSdk}
            textareaRef={textareaRef}
          />
          {waitingForSdk && (
            <p className="app__notice" aria-live="polite">
              {sdkFailure === null
                ? '지도를 불러오는 중이다. 준비되면 조회할 수 있다.'
                : '지도를 불러오지 못해 조회를 멈춰 뒀다. 오른쪽 안내를 확인한다.'}
            </p>
          )}
          {running && <ProgressBar done={done} total={total} onAbort={abort} />}
          <ResultList entries={entries} onRetry={retry} onSkip={skip} onSelect={select} running={running} />
        </div>
        <div className="app__map">
          <MapView entries={entries} focusedId={focusedId} />
          {/* 지도가 실제로 떠 있을 때만 말한다. 지도 자리에 오류 문구가 떠 있는데
              "마커가 찍혔다" 고 하면 화면이 서로 다른 말을 한다. */}
          {kakaoPort !== null && !running && entries.length > 0 && (
            <p className="app__map-note" aria-live="polite">
              찾은 {found}곳에 번호 마커가 찍혔다. 실패 {failed}곳은 목록에만 남는다.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
