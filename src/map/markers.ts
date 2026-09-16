import type { Entry } from '../domain/types';

/**
 * 지도에 무엇을 찍을지. SDK 를 모르는 순수 계산이다.
 *
 * **번호는 목록 자리 번호다.** "찾은 것 중 몇 번째" 가 아니다. 실패한 줄이 번호를
 * 건너뛰면 사용자가 목록의 세 번째 줄과 지도의 마커를 짝지을 수 없게 된다.
 */
export type MarkerSpec = {
  /** `Entry.id` 와 같다. 마커를 항목과 이어 두기 위한 열쇠다. */
  id: string;
  number: number;
  lat: number;
  lng: number;
  title: string;
  /** 인포윈도우에 보여 줄 줄들. 원문·건물명·좌표 순서다. */
  detail: string[];
};

export function toMarkerSpecs(entries: Entry[]): MarkerSpec[] {
  const specs: MarkerSpec[] = [];

  entries.forEach((entry, index) => {
    const place = entry.place;
    if (entry.status !== 'found' || place === undefined) return;

    specs.push({
      id: entry.id,
      number: index + 1,
      lat: place.lat,
      lng: place.lng,
      title: place.label,
      detail: [
        entry.raw,
        ...(place.roadAddress === undefined || place.roadAddress === entry.raw ? [] : [place.roadAddress]),
        `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`,
      ],
    });
  });

  return specs;
}

/**
 * 이미 찍힌 마커와 새 목록을 견줘 **무엇만 바꾸면 되는지** 낸다.
 *
 * 매번 전부 지우고 다시 그리면 조회가 진행되는 동안 마커가 화면에서 깜빡인다.
 * 열 줄짜리 입력이면 열 번 깜빡인다.
 */
export function diffMarkers(
  current: Map<string, MarkerSpec>,
  next: MarkerSpec[],
): { added: MarkerSpec[]; moved: MarkerSpec[]; removed: string[] } {
  const added: MarkerSpec[] = [];
  const moved: MarkerSpec[] = [];
  const keep = new Set<string>();

  for (const spec of next) {
    keep.add(spec.id);
    const before = current.get(spec.id);
    if (before === undefined) {
      added.push(spec);
    } else if (before.lat !== spec.lat || before.lng !== spec.lng || before.number !== spec.number) {
      moved.push(spec);
    }
  }

  const removed = [...current.keys()].filter((id) => !keep.has(id));
  return { added, moved, removed };
}
