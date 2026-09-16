import { describe, expect, it } from 'vitest';

import type { Entry } from '../../domain/types';
import { csvFileName, toCsv } from '../to-csv';

function entry(id: string, raw: string, patch: Partial<Entry> = {}): Entry {
  return { id, raw, normalized: raw, status: 'pending', ...patch };
}

const FOUND = entry('a', '서울 강남구 테헤란로 152', {
  status: 'found',
  place: {
    lat: 37.500718,
    lng: 127.036585,
    label: '서울 강남구 역삼동 737',
    roadAddress: '서울 강남구 테헤란로 152',
    matchedBy: 'address',
  },
});

const NOT_FOUND = entry('b', '있을 리 없는 주소', {
  status: 'notFound',
  failure: { reason: 'zero_result', message: '검색 결과가 없다' },
});

function rows(csv: string): string[] {
  return csv.replace(/^﻿/, '').split('\r\n');
}

describe('CSV 내보내기', () => {
  it('UC-LM-CSV-001: 머리글과 항목 줄을 순서대로 낸다', () => {
    const lines = rows(toCsv([FOUND, NOT_FOUND]));

    expect(lines[0]).toBe('순번,입력값,상태,주소,도로명주소,위도,경도');
    expect(lines[1]).toBe('1,서울 강남구 테헤란로 152,찾음,서울 강남구 역삼동 737,서울 강남구 테헤란로 152,37.500718,127.036585');
  });

  it('UC-LM-CSV-002: 실패한 줄도 자리와 상태를 지키고 들어간다', () => {
    const lines = rows(toCsv([FOUND, NOT_FOUND]));

    // 스무 줄을 넣었는데 열여덟 줄만 있으면 어느 둘이 빠졌는지 대조해야 한다.
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('2,있을 리 없는 주소,못 찾음,,,,');
  });

  it('UC-LM-CSV-003: 한글이 깨지지 않게 BOM 을 붙인다', () => {
    // 없으면 엑셀이 지역 인코딩으로 읽어 한글이 전부 깨진다.
    expect(toCsv([FOUND]).startsWith('﻿')).toBe(true);
  });

  it('UC-LM-CSV-004: 쉼표·따옴표·줄바꿈이 든 값을 감싼다', () => {
    const tricky = [
      entry('c', '서울 중구 세종대로 110, 서울시청'),
      entry('d', '"따옴표" 가 든 주소'),
      entry('e', '줄바꿈이\n든 주소'),
    ];

    const lines = rows(toCsv(tricky));

    // 감싸지 않으면 열이 밀려 좌표가 엉뚱한 칸에 들어간다.
    expect(lines[1]).toContain('"서울 중구 세종대로 110, 서울시청"');
    expect(lines[2]).toContain('"""따옴표"" 가 든 주소"');
    expect(toCsv(tricky)).toContain('"줄바꿈이\n든 주소"');
  });

  it('UC-LM-CSV-005: 파일명에 날짜가 들어간다', () => {
    // 같은 폴더에 여러 번 받아도 덮어쓰지 않는다.
    expect(csvFileName(new Date(2026, 8, 16))).toBe('location-maker-2026-09-16.csv');
  });
});
