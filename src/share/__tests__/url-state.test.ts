import { describe, expect, it } from 'vitest';

import { decodeAddresses, encodeAddresses, MAX_HASH_LENGTH } from '../url-state';

const THREE = ['서울 강남구 테헤란로 152', '서울 중구 을지로 65', '성남시 분당구 판교역로 235'];

describe('링크에 담는 주소 목록', () => {
  it('UC-LM-URL-001: 넣은 순서 그대로 돌아온다', () => {
    const encoded = encodeAddresses(THREE);

    expect(encoded.ok).toBe(true);
    // 목록 순서 = 입력 줄 순서 = 마커 번호. 링크를 지나도 같아야 한다.
    expect(decodeAddresses(encoded.ok ? encoded.hash : '')).toEqual(THREE);
  });

  it('UC-LM-URL-002: 한글이 깨지지 않는다', () => {
    const encoded = encodeAddresses(['서울 강남구 테헤란로 152']);

    expect(decodeAddresses(encoded.ok ? encoded.hash : '')).toEqual(['서울 강남구 테헤란로 152']);
  });

  it('UC-LM-URL-003: 빈 목록이면 해시를 붙이지 않는다', () => {
    // 아무것도 안 넣은 상태에서 링크를 복사해도 주소창이 지저분해지지 않는다.
    expect(encodeAddresses([])).toEqual({ ok: true, hash: '' });
    expect(encodeAddresses(['', '   '])).toEqual({ ok: true, hash: '' });
  });

  it('UC-LM-URL-004: 망가진 해시에도 던지지 않는다', () => {
    // 링크는 손으로 잘리고 붙는 물건이다. 던지면 앱이 흰 화면이 된다.
    expect(decodeAddresses('#a=!!!망가진!!!')).toEqual([]);
    // base64 로는 읽히는데 UTF-8 이 아닌 경우도 주소가 아니다.
    expect(decodeAddresses('#a=_____w')).toEqual([]);
    expect(decodeAddresses('#b=서울')).toEqual([]);
    expect(decodeAddresses('#')).toEqual([]);
    expect(decodeAddresses('')).toEqual([]);
  });

  it('UC-LM-URL-007: 실제 형태의 주소 스무 줄이 링크 하나에 들어간다', () => {
    // 시·도와 건물명이 붙은, 사람이 실제로 붙여넣는 모양이다. 퍼센트 인코딩이었다면
    // 2887자라 상한을 넘겼다 — 흔한 사용이 막히면 링크 기능 자체가 쓸모없어진다.
    const twenty = Array.from(
      { length: 20 },
      (_, index) => `서울특별시 강남구 테헤란로 ${index + 100} 어떤빌딩 ${index + 1}층`,
    );

    const encoded = encodeAddresses(twenty);

    expect(encoded.ok).toBe(true);
    expect(decodeAddresses(encoded.ok ? encoded.hash : '')).toEqual(twenty);
  });

  it('UC-LM-URL-005: 너무 길면 자르지 않고 거절한다', () => {
    const many = Array.from({ length: 200 }, (_, index) => `서울특별시 강남구 테헤란로 ${index} 어떤빌딩`);

    const encoded = encodeAddresses(many);

    // 몰래 자르면 주소 몇 개가 사라진 링크가 열린다. 사용자가 알아챌 수 없다.
    expect(encoded).toEqual({ ok: false, reason: 'too-long', limit: MAX_HASH_LENGTH });
  });

  it('UC-LM-URL-006: 앞뒤 공백과 빈 줄은 담지 않는다', () => {
    const encoded = encodeAddresses(['  서울 중구 을지로 65  ', '', '성남시 분당구 판교역로 235']);

    expect(decodeAddresses(encoded.ok ? encoded.hash : '')).toEqual([
      '서울 중구 을지로 65',
      '성남시 분당구 판교역로 235',
    ]);
  });
});
