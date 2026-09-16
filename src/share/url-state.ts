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
 * 해시 길이 상한.
 *
 * 브라우저 자체는 훨씬 긴 URL 도 받지만, 링크가 실제로 지나가는 곳(메신저·메일·문서)이
 * 2000자 근처에서 자른다. 잘린 링크는 열리기는 하는데 주소가 몇 개 사라진 채로 열려서
 * 사용자가 알아채기 어렵다. 그래서 자르지 않고 **거절하고 알려 준다.**
 */
export const MAX_HASH_LENGTH = 2000;

export type EncodeResult =
  | { ok: true; hash: string }
  | { ok: false; reason: 'too-long'; limit: number };

/** 주소 목록을 `#a=...` 로 만든다. 빈 목록이면 해시를 붙이지 않는다. */
export function encodeAddresses(addresses: string[]): EncodeResult {
  const lines = addresses.map((line) => line.trim()).filter((line) => line !== '');
  if (lines.length === 0) return { ok: true, hash: '' };

  const hash = `#${HASH_KEY}=${encodeURIComponent(lines.join('\n'))}`;
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

  let text: string;
  try {
    // `+` 는 공백이다. 일부 클라이언트가 공백을 그렇게 바꿔 붙인다.
    text = decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    // 잘린 퍼센트 escape (`%E`) 는 여기서 던진다.
    return [];
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
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
