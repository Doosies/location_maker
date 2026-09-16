import { describe, expect, it } from 'vitest';

import { parseAddresses } from '../parse-addresses';

describe('parseAddresses', () => {
  it('UC-LM-PARSE-001: 줄마다 항목 하나를 만든다', () => {
    const entries = parseAddresses('서울 중구 세종대로 110\n부산 연제구 중앙대로 1001\n대전 서구 둔산로 100');

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.raw)).toEqual([
      '서울 중구 세종대로 110',
      '부산 연제구 중앙대로 1001',
      '대전 서구 둔산로 100',
    ]);
    expect(entries.every((entry) => entry.status === 'pending')).toBe(true);
  });

  it('UC-LM-PARSE-002: 빈 줄과 공백만 있는 줄은 버린다', () => {
    const entries = parseAddresses('서울 중구 세종대로 110\n\n   \n\t\n부산 연제구 중앙대로 1001');

    expect(entries.map((entry) => entry.raw)).toEqual(['서울 중구 세종대로 110', '부산 연제구 중앙대로 1001']);
  });

  it('UC-LM-PARSE-003: 앞뒤 공백을 트림한다', () => {
    const entries = parseAddresses('  \t서울 중구 세종대로 110  \t');

    expect(entries[0]?.raw).toBe('서울 중구 세종대로 110');
  });

  it('UC-LM-PARSE-004: 엑셀에서 딸려온 큰따옴표를 뗀다', () => {
    const entries = parseAddresses('"서울 중구 세종대로 110"');

    expect(entries[0]?.raw).toBe('서울 중구 세종대로 110');
  });

  it('UC-LM-PARSE-005: 번호 접두사를 뗀다', () => {
    const entries = parseAddresses('1. 서울 중구 세종대로 110\n2) 부산 연제구 중앙대로 1001\n3 - 대전 서구 둔산로 100');

    expect(entries.map((entry) => entry.raw)).toEqual([
      '서울 중구 세종대로 110',
      '부산 연제구 중앙대로 1001',
      '대전 서구 둔산로 100',
    ]);
  });

  it('UC-LM-PARSE-006: 번지수는 번호 접두사로 오해하지 않는다', () => {
    const entries = parseAddresses('123-45 어딘가\n110 세종대로');

    expect(entries.map((entry) => entry.raw)).toEqual(['123-45 어딘가', '110 세종대로']);
  });

  it('UC-LM-PARSE-007: CRLF 를 LF 와 같게 다룬다', () => {
    const crlf = parseAddresses('서울 중구 세종대로 110\r\n부산 연제구 중앙대로 1001');
    const lf = parseAddresses('서울 중구 세종대로 110\n부산 연제구 중앙대로 1001');

    expect(crlf.map((entry) => entry.raw)).toEqual(lf.map((entry) => entry.raw));
  });

  it('UC-LM-PARSE-008: 같은 주소가 두 줄이어도 항목은 둘이다', () => {
    const entries = parseAddresses('서울 중구  세종대로 110\n서울 중구 세종대로 110');

    expect(entries).toHaveLength(2);
    expect(entries[0]?.raw).toBe('서울 중구  세종대로 110');
    expect(entries[1]?.raw).toBe('서울 중구 세종대로 110');
    expect(entries[0]?.normalized).toBe(entries[1]?.normalized);
  });

  it('UC-LM-PARSE-009: id 는 줄마다 다르다', () => {
    const entries = parseAddresses('서울 중구 세종대로 110\n서울 중구 세종대로 110');

    expect(entries[0]?.id).not.toBe(entries[1]?.id);
  });

  it('UC-LM-PARSE-010: 빈 입력은 빈 배열이다', () => {
    expect(parseAddresses('')).toEqual([]);
    expect(parseAddresses('  \n\t\r\n  ')).toEqual([]);
  });
});
