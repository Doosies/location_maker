import type { Entry } from './types';

// 엑셀에서 복사하면 값이 통째로 큰따옴표에 감기고, 안쪽 따옴표는 두 번 겹친다.
const WRAPPING_QUOTES = /^"(.*)"$/s;

// `1. `, `2) `, `3 - ` 처럼 사람이 붙인 번호.
// 뒤에 구분 기호(`.`, `)`, `-`)와 공백이 반드시 따라와야 한다.
// 그래야 `123-45 어딘가` 같은 번지수를 번호로 오해하지 않는다.
const LIST_MARKER = /^\d{1,3}\s*[.)]\s+|^\d{1,3}\s+-\s+/;

/**
 * 한 줄에서 사람이 붙인 장식(따옴표·번호)을 뗀 값. `Entry.raw` 가 이것과 같다.
 *
 * 화면이 "이 항목이 입력창의 어느 줄인가" 를 물을 때 같은 규칙을 써야 한다.
 * `line.trim()` 으로 비교하면 `1. 서울…` 과 `서울…` 이 다른 줄로 보여 같은 주소가
 * 두 번 들어간다.
 */
export function normalizeLine(line: string): string {
  let value = line.trim();

  const unwrapped = WRAPPING_QUOTES.exec(value);
  if (unwrapped?.[1] !== undefined) {
    value = unwrapped[1].replace(/""/g, '"').trim();
  }

  return value.replace(LIST_MARKER, '').trim();
}

// 원문이 같은 줄이 둘 있어도 React key 로 쓸 id 는 달라야 한다.
// 내용에서 뽑으면 같아지므로 세는 수를 쓴다.
let nextId = 0;

/**
 * 조회 키. 공백 차이만 있는 두 줄은 같은 곳으로 본다.
 *
 * NFC 정규화가 필요한 이유: macOS 에서 복사한 한글은 자모가 분리된 NFD 로 온다.
 * 눈에는 같은 '서울' 이지만 코드 포인트가 달라, 정규화하지 않으면 같은 주소를
 * 두 번 조회하게 된다.
 */
function toLookupKey(address: string): string {
  return address.normalize('NFC').replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 붙여넣은 텍스트를 줄 단위 항목으로 나눈다.
 *
 * 줄 하나가 항목 하나다. 정규화하면 같아지는 줄이 둘이어도 항목은 둘로 남는다 —
 * 목록 순서와 마커 번호가 입력 줄 순서와 끝까지 같아야 하기 때문이다.
 * 같은 곳을 두 번 조회하지 않는 일은 `normalized` 를 보고 큐가 처리한다.
 */
export function parseAddresses(input: string): Entry[] {
  const entries: Entry[] = [];

  for (const line of input.split(/\r\n|\r|\n/)) {
    const address = normalizeLine(line);
    if (address === '') continue;

    entries.push({
      id: `entry-${++nextId}`,
      raw: address,
      normalized: toLookupKey(address),
      status: 'pending',
    });
  }

  return entries;
}
