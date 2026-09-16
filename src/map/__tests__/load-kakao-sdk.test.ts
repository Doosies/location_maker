import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadKakaoSdk, LOAD_FAILURE_MESSAGE, resetKakaoSdkLoader } from '../load-kakao-sdk';

/** 붙은 스크립트를 손에 쥐고 load·error 를 직접 쏜다. 네트워크는 쓰지 않는다. */
function harness() {
  const scripts: HTMLScriptElement[] = [];
  const head = { appendChild: (node: HTMLScriptElement) => scripts.push(node) };
  const doc = {
    getElementById: () => null,
    createElement: () => document.createElement('script'),
    head,
  } as unknown as Document;

  return { doc, scripts };
}

afterEach(() => {
  resetKakaoSdkLoader();
});

describe('Kakao SDK 로더', () => {
  it('UC-LM-SDK-001: 키가 없으면 스크립트를 붙이지 않는다', async () => {
    const { doc, scripts } = harness();

    const result = await loadKakaoSdk({ key: '', doc, scope: {} });

    expect(result).toEqual({ ok: false, reason: 'no-key' });
    expect(scripts).toHaveLength(0);
  });

  it('UC-LM-SDK-002: services 라이브러리와 autoload=false 로 붙인다', () => {
    const { doc, scripts } = harness();

    void loadKakaoSdk({ key: 'KEY', doc, scope: {} });

    // services 를 빼면 Geocoder 가 없어 어댑터가 통째로 죽는다.
    expect(scripts[0]?.src).toContain('libraries=services');
    expect(scripts[0]?.src).toContain('autoload=false');
    expect(scripts[0]?.src).toContain('appkey=KEY');
  });

  it('UC-LM-SDK-003: kakao.maps.load 가 끝나야 성공이다', async () => {
    const { doc, scripts } = harness();
    let ready: (() => void) | undefined;
    const scope = { kakao: { maps: { load: (cb: () => void) => { ready = cb; } } } };

    const pending = loadKakaoSdk({ key: 'KEY', doc, scope });
    scripts[0]?.dispatchEvent(new Event('load'));
    // 스크립트가 왔다고 끝이 아니다. autoload=false 라 load 콜백까지 기다린다.
    expect(ready).toBeTypeOf('function');
    ready?.();

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('UC-LM-SDK-004: 스크립트를 못 받으면 script 실패다', async () => {
    const { doc, scripts } = harness();

    const pending = loadKakaoSdk({ key: 'KEY', doc, scope: {} });
    scripts[0]?.dispatchEvent(new Event('error'));

    await expect(pending).resolves.toEqual({ ok: false, reason: 'script' });
  });

  it('UC-LM-SDK-005: 스크립트는 왔는데 전역이 없으면 init 실패다', async () => {
    const { doc, scripts } = harness();

    const pending = loadKakaoSdk({ key: 'KEY', doc, scope: {} });
    scripts[0]?.dispatchEvent(new Event('load'));

    // 도메인 미등록이 이 모양으로 나타난다. script 실패와 구분해야 할 일이 다르다.
    await expect(pending).resolves.toEqual({ ok: false, reason: 'init' });
  });

  it('UC-LM-SDK-006: 응답이 없으면 타임아웃으로 끝난다', async () => {
    vi.useFakeTimers();
    const { doc } = harness();

    const pending = loadKakaoSdk({ key: 'KEY', doc, scope: {}, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toEqual({ ok: false, reason: 'timeout' });
    vi.useRealTimers();
  });

  it('UC-LM-SDK-007: 두 번 불러도 스크립트는 하나다', () => {
    const { doc, scripts } = harness();

    const first = loadKakaoSdk({ key: 'KEY', doc, scope: {} });
    const second = loadKakaoSdk({ key: 'KEY', doc, scope: {} });

    expect(scripts).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('UC-LM-SDK-008: 실패한 뒤에는 다시 시도할 수 있다', async () => {
    const { doc, scripts } = harness();

    const first = loadKakaoSdk({ key: 'KEY', doc, scope: {} });
    scripts[0]?.dispatchEvent(new Event('error'));
    await first;

    const second = loadKakaoSdk({ key: 'KEY', doc, scope: {} });

    // 네트워크가 잠깐 끊긴 경우, 새로고침 없이 다시 붙일 수 있어야 한다.
    expect(second).not.toBe(first);
  });

  it('UC-LM-SDK-009: 실패 사유마다 할 일이 다른 문구를 준다', () => {
    const messages = Object.values(LOAD_FAILURE_MESSAGE);

    expect(new Set(messages).size).toBe(messages.length);
    expect(LOAD_FAILURE_MESSAGE.init).toContain('도메인');
    expect(LOAD_FAILURE_MESSAGE['no-key']).toContain('VITE_KAKAO_JS_KEY');
  });
});
