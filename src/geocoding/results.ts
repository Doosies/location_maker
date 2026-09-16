import type { GeocodeResult } from './port';

/**
 * 두 어댑터가 **똑같이** 답해야 하는 자리.
 *
 * 계약 테스트가 두 구현에 같은 기대를 걸기 때문에 여기 모아 둔다. 가짜 어댑터 쪽에
 * 두면 진짜 어댑터가 테스트 더블을 import 하게 되고, 프로덕션 번들에 가짜 주소표가
 * 딸려 들어간다.
 */

export function abortedResult(): GeocodeResult {
  // `reason` 에 'aborted' 는 없다. 큐가 중단 중의 실패를 `pending` 으로 되돌리므로
  // 사용자에게 이 메시지가 보일 일은 없지만, 남는다면 재시도하라는 뜻이 맞다.
  return { ok: false, failure: { reason: 'network', message: '조회를 멈췄다' } };
}

export function emptyQueryResult(): GeocodeResult {
  return { ok: false, failure: { reason: 'zero_result', message: '주소가 비어 있다' } };
}

/**
 * `signal.aborted` 를 프로퍼티로 두 번 읽으면 첫 검사가 타입을 좁혀 두 번째가
 * "일어날 수 없는 비교" 로 잡힌다. abort 는 도중에 바뀌는 값이라 매번 새로 읽는다.
 */
export function aborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}
