/**
 * Kakao 지도 SDK 를 붙인다.
 *
 * 실패 원인을 **구분해서** 돌려주는 것이 이 파일의 핵심이다. 화면에서는 전부
 * "지도가 안 뜬다" 로 같아 보이지만 사람이 할 일이 다르다 — 키를 넣거나,
 * 네트워크·키·도메인 중 무엇이 막혔는지 보거나, 그냥 새로고침하거나.
 *
 * **잘못된 키와 등록되지 않은 도메인은 `script` 로 온다.** `dapi.kakao.com` 이
 * JS 대신 4xx JSON(`AccessDeniedError`) 을 돌려주고, 브라우저는 2xx 가 아닌 응답에
 * `load` 가 아니라 `error` 를 쏘기 때문이다. 브라우저에서는 `<script>` 의 응답 코드를
 * 읽을 수 없어 이보다 잘게 가를 수 없다 — 그래서 `script` 문구가 셋을 함께 가리킨다.
 */

export type LoadFailure =
  | 'no-key' // 키가 주입되지 않았다 → .env.local 또는 Actions Secret
  | 'script' // 스크립트를 받지 못했다 → 네트워크·잘못된 키·미등록 도메인
  | 'timeout' // 받긴 했는데 초기화가 안 끝났다
  | 'init'; // 2xx 로 받았는데 kakao.maps 가 없다 → 드물다

export type LoadResult = { ok: true } | { ok: false; reason: LoadFailure };

export const LOAD_FAILURE_MESSAGE: Record<LoadFailure, string> = {
  'no-key': '지도를 띄울 키가 없다. VITE_KAKAO_JS_KEY 를 넣어야 한다.',
  script:
    '지도 스크립트를 받지 못했다. 네트워크, VITE_KAKAO_JS_KEY 값, Kakao 콘솔의 도메인 등록을 확인한다.',
  timeout: '지도 스크립트가 제때 응답하지 않았다. 새로고침해 보자.',
  init: '지도 스크립트는 받았는데 초기화되지 않았다. 새로고침해도 같으면 키와 도메인을 확인한다.',
};

/** `libraries=services` 를 빼면 `services.Geocoder` 가 없다. 어댑터가 통째로 죽는다. */
const SDK_URL = (key: string): string =>
  `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;

const SCRIPT_ID = 'kakao-maps-sdk';
const DEFAULT_TIMEOUT_MS = 10_000;

export type LoadOptions = {
  key: string;
  timeoutMs?: number;
  /** 테스트가 가짜 document/window 를 넣는다. 전역을 직접 읽으면 테스트가 불가능하다. */
  doc?: Document;
  scope?: { kakao?: { maps?: { load?: (cb: () => void) => void } } };
};

// 같은 스크립트를 두 번 붙이면 SDK 가 두 번 초기화된다. 진행 중인 약속을 나눠 쓴다.
let pending: Promise<LoadResult> | null = null;

/** 테스트가 호출 사이에 상태를 지운다. 프로덕션에서는 쓰지 않는다. */
export function resetKakaoSdkLoader(): void {
  pending = null;
}

export function loadKakaoSdk(options: LoadOptions): Promise<LoadResult> {
  if (options.key === '') return Promise.resolve({ ok: false, reason: 'no-key' });
  if (pending !== null) return pending;

  const doc = options.doc ?? globalThis.document;
  const scope = options.scope ?? (globalThis as LoadOptions['scope'] & object);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  pending = new Promise<LoadResult>((resolve) => {
    let settled = false;
    const finish = (result: LoadResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // 실패는 재시도할 수 있어야 한다. 성공만 붙잡아 둔다.
      //
      // 붙은 `<script>` 도 함께 걷어 낸다. 남겨 두면 다음 시도가 그 요소를 재사용하는데,
      // 그 요소의 load·error 는 이미 발화한 뒤라 두 번째 시도는 언제나 타임아웃으로 끝난다.
      if (!result.ok) {
        pending = null;
        script.remove();
      }
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);

    const existing = doc.getElementById(SCRIPT_ID);
    const script = existing instanceof HTMLScriptElement ? existing : doc.createElement('script');

    script.addEventListener('load', () => {
      const load = scope?.kakao?.maps?.load;
      if (typeof load !== 'function') {
        // 2xx 로 받았는데 전역이 없다. 키·도메인 문제는 여기까지 오지 않고 error 로 끝난다.
        finish({ ok: false, reason: 'init' });
        return;
      }
      // autoload=false 라 여기서 명시적으로 부른다. 이걸 빼면 kakao.maps 가 비어 있다.
      load(() => finish({ ok: true }));
    });
    script.addEventListener('error', () => finish({ ok: false, reason: 'script' }));

    if (existing === null) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = SDK_URL(options.key);
      doc.head.appendChild(script);
    }
  });

  return pending;
}
