import { describe, expect, it } from 'vitest';

import type { Entry, Place } from '../../domain/types';
import { diffMarkers, toMarkerSpecs, type MarkerSpec } from '../markers';

function place(lat: number, lng: number, roadAddress?: string): Place {
  return { lat, lng, label: '라벨', matchedBy: 'address', ...(roadAddress === undefined ? {} : { roadAddress }) };
}

function entry(id: string, raw: string, patch: Partial<Entry> = {}): Entry {
  return { id, raw, normalized: raw, status: 'pending', ...patch };
}

describe('마커', () => {
  it('UC-LM-MARKER-001: 찾은 항목만 마커가 된다', () => {
    const specs = toMarkerSpecs([
      entry('a', '가', { status: 'found', place: place(37.5, 127.0) }),
      entry('b', '나', { status: 'notFound' }),
      entry('c', '다', { status: 'loading' }),
    ]);

    expect(specs.map((s) => s.id)).toEqual(['a']);
  });

  it('UC-LM-MARKER-002: 번호는 목록 자리 번호다', () => {
    const specs = toMarkerSpecs([
      entry('a', '가', { status: 'found', place: place(37.5, 127.0) }),
      entry('b', '나', { status: 'failed' }),
      entry('c', '다', { status: 'found', place: place(35.1, 129.0) }),
    ]);

    // 실패한 줄이 번호를 건너뛰면 목록의 세 번째 줄과 지도의 마커를 짝지을 수 없다.
    expect(specs.map((s) => s.number)).toEqual([1, 3]);
  });

  it('UC-LM-MARKER-003: 인포윈도우에 원문과 좌표가 들어간다', () => {
    const specs = toMarkerSpecs([
      entry('a', '서울 강남구 테헤란로 152', {
        status: 'found',
        place: place(37.500713, 127.036486, '서울 강남구 테헤란로 152 (도로명)'),
      }),
    ]);

    expect(specs[0]?.detail).toEqual([
      '서울 강남구 테헤란로 152',
      '서울 강남구 테헤란로 152 (도로명)',
      '37.500713, 127.036486',
    ]);
  });

  it('UC-LM-MARKER-004: 도로명이 원문과 같으면 두 번 쓰지 않는다', () => {
    const specs = toMarkerSpecs([
      entry('a', '서울 강남구 테헤란로 152', {
        status: 'found',
        place: place(37.5, 127.0, '서울 강남구 테헤란로 152'),
      }),
    ]);

    expect(specs[0]?.detail).toHaveLength(2);
  });

  it('UC-LM-MARKER-005: 바뀐 것만 골라낸다', () => {
    const current = new Map<string, MarkerSpec>([
      ['a', { id: 'a', number: 1, lat: 37.5, lng: 127.0, title: '가', detail: [] }],
      ['b', { id: 'b', number: 2, lat: 35.1, lng: 129.0, title: '나', detail: [] }],
    ]);

    const diff = diffMarkers(current, [
      { id: 'a', number: 1, lat: 37.5, lng: 127.0, title: '가', detail: [] },
      { id: 'c', number: 3, lat: 36.0, lng: 128.0, title: '다', detail: [] },
    ]);

    // 매번 전부 지우고 다시 그리면 조회가 도는 동안 마커가 계속 깜빡인다.
    expect(diff.added.map((s) => s.id)).toEqual(['c']);
    expect(diff.moved).toEqual([]);
    expect(diff.removed).toEqual(['b']);
  });

  it('UC-LM-MARKER-006: 번호만 바뀌어도 갱신 대상이다', () => {
    const current = new Map<string, MarkerSpec>([
      ['a', { id: 'a', number: 2, lat: 37.5, lng: 127.0, title: '가', detail: [] }],
    ]);

    const diff = diffMarkers(current, [
      { id: 'a', number: 1, lat: 37.5, lng: 127.0, title: '가', detail: [] },
    ]);

    expect(diff.moved.map((s) => s.number)).toEqual([1]);
  });
});
