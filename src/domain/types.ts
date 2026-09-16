// 이 폴더는 브라우저도 SDK 도 모른다. 여기서 바깥을 import 하는 순간
// M3 의 가짜 어댑터 전략이 의미를 잃는다.

export type EntryStatus =
  | 'pending' // 아직 조회 안 함
  | 'loading' // 조회 중
  | 'found' // 좌표 있음
  | 'notFound' // 조회했지만 결과 없음
  | 'failed'; // 네트워크·쿼터·SDK 오류

export type Place = {
  lat: number;
  lng: number;
  label: string; // 지도·목록에 보여 줄 이름
  roadAddress?: string;
  matchedBy: 'address' | 'keyword';
};

export type Failure = {
  reason: 'zero_result' | 'network' | 'quota' | 'sdk';
  message: string; // 사용자에게 그대로 보여 줄 한 줄
};

export type Entry = {
  id: string; // 안정적 key. 원문이 같아도 줄마다 다름
  /**
   * 사용자가 친 원문. **절대 덮어쓰지 않는다.**
   * 실패한 항목을 고쳐서 다시 시도할 때 입력창에 돌려놓을 문자열이다.
   * 정규화 결과만 들고 있으면 "내가 쓴 게 이게 아닌데" 하는 순간이 온다.
   */
  raw: string;
  /** 조회 키. 같은 값이면 같은 곳이므로 한 번만 조회한다. 화면에는 쓰지 않는다. */
  normalized: string;
  status: EntryStatus;
  place?: Place;
  failure?: Failure;
};

// 아래 둘은 M3 의 `src/geocoding/port.ts` 가 구현할 계약이다.
// 도메인이 geocoding 폴더를 import 하지 않도록 여기에 선언해 두고,
// 어댑터 쪽이 이 타입에 맞춘다.

export type GeocodeResult = { ok: true; place: Place } | { ok: false; failure: Failure };

export interface GeocodePort {
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult>;
}
