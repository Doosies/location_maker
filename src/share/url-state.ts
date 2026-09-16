/**
 * 주소 목록을 주소창에 담는다. 저장소도 로그인도 없는 앱이라 **링크가 곧 저장**이다.
 *
 * **좌표는 넣지 않는다.** 링크를 연 쪽이 다시 조회하면 되고, 좌표까지 담으면 스무 줄만
 * 넘어도 링크가 메신저에서 잘린다. 대신 원문만 담아 짧게 유지한다.
 *
 * 해시(`#`)를 쓰는 이유는 GitHub Pages 가 경로 라우팅에 404 를 내기 때문이다. 해시는
 * 서버까지 가지 않으므로 그 문제를 지나간다.
 */

/** 해시 안의 키. `#a=...` 한 칸만 쓴다. */
export const HASH_KEY = 'a';

/**
 * 해시 길이 상한. **재 본 값에서 정했다.**
 *
 * 시·도와 건물명이 붙은 실제 주소 20줄(원문 429자)이 base64url 로 약 1330자다. 4000자면
 * 그런 주소 60줄 언저리까지 들어간다. 그보다 많으면 링크로 주고받을 크기가 아니라 CSV 를
 * 권하는 편이 낫다.
 *
 * 잘린 링크는 **열리기는 하는데** 주소가 몇 개 사라진 채로 열려 사용자가 알아채기 어렵다.
 * 그래서 자르지 않고 거절하고 알려 준다.
 *
 * 상한은 해시에만 건다. 배포 주소(`https://doosies.github.io/location_maker/`)가 앞에
 * 40자쯤 더 붙지만, 그건 링크마다 같은 값이라 여기서 셀 이유가 없다.
 */
export const MAX_HASH_LENGTH = 4000;

export type EncodeResult =
  | { ok: true; hash: string }
  | { ok: false; reason: 'too-long'; limit: number };

/** 주소 목록을 `#a=...` 로 만든다. 빈 목록이면 해시를 붙이지 않는다. */
export function encodeAddresses(addresses: string[]): EncodeResult {
  const lines = addresses.map((line) => line.trim()).filter((line) => line !== '');
  if (lines.length === 0) return { ok: true, hash: '' };

  const hash = `#${HASH_KEY}=${toBase64Url(lines.join('\n'))}`;
  if (hash.length > MAX_HASH_LENGTH) return { ok: false, reason: 'too-long', limit: MAX_HASH_LENGTH };

  return { ok: true, hash };
}

/**
 * 해시에서 주소 목록을 읽는다. **어떤 입력에도 던지지 않는다.**
 *
 * 링크는 손으로 잘리고 붙고 하는 물건이다. 망가진 해시에 예외를 던지면 앱이 흰 화면이
 * 되는데, 그건 사용자가 고칠 수 없는 고장이다. 못 읽으면 빈 목록으로 시작한다.
 */
export function decodeAddresses(hash: string): string[] {
  const value = readParam(hash);
  if (value === null) return [];

  const text = fromBase64Url(value);
  if (text === null) return [];

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * UTF-8 → base64url.
 *
 * 퍼센트 인코딩은 한글 한 글자를 9자(`%EC%84%9C`)로 만든다. 실제 주소 20줄이면 2887자다.
 * base64url 은 같은 줄이 1330자라, 흔한 사용(스무 줄 안팎)이 링크 하나에 들어간다.
 * 라이브러리는 필요 없다 — `btoa` 와 `TextEncoder` 는 어디에나 있다.
 */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  // `+` 와 `/` 는 URL 에서 뜻이 있고, `=` 는 붙는 곳마다 다르게 다뤄진다.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → UTF-8. 조금이라도 깨져 있으면 `null` 이다. */
function fromBase64Url(value: string): string | null {
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    // `fatal` 이 없으면 깨진 바이트가 U+FFFD 로 조용히 통과한다. 그건 주소가 아니다.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function readParam(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return null;

  for (const part of raw.split('&')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator) !== HASH_KEY) continue;

    const value = part.slice(separator + 1);
    return value === '' ? null : value;
  }

  return null;
}
