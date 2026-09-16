// 계약 자체는 `src/domain/types.ts` 에 있다. 도메인이 이 폴더를 import 하지 않아야
// 해서 큐가 쓰는 타입이 도메인 안에 살아야 했기 때문이다.
//
// 그러니 여기서 다시 정의하지 않고 내보내기만 한다. 같은 계약이 두 군데 적혀 있으면
// 언젠가 반드시 어긋나고, 어긋난 쪽이 어느 쪽인지 아무도 모르게 된다.
export type { GeocodePort, GeocodeResult } from '../domain/types';
export type { Failure, Place } from '../domain/types';
