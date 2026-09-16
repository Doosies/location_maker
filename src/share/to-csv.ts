import type { Entry } from '../domain/types';

/**
 * 결과를 엑셀에서 열 수 있는 표로 만든다.
 *
 * **실패한 줄도 빠지지 않는다.** 화면과 같은 원칙이다 — 스무 줄을 넣었는데 CSV 에
 * 열여덟 줄만 있으면, 어느 둘이 빠졌는지 사용자가 원본과 대조해야 한다.
 */

/**
 * 엑셀은 BOM 이 없는 UTF-8 CSV 를 지역 인코딩으로 읽는다. 그러면 한글이 전부 깨진다.
 * 세 글자로 파일 하나가 살거나 죽는다.
 */
const BOM = '﻿';

/**
 * 플랜의 `건물명` 대신 `도로명주소` 를 쓴다. 어댑터가 들고 오는 것은 건물명이 아니라
 * 지번 주소(`label`)와 도로명 주소(`roadAddress`) 둘이고, 장소명으로 찾은 경우에만
 * `label` 이 상호가 된다. 없는 열을 만들기보다 있는 것을 그대로 내보낸다.
 */
const HEADER = ['순번', '입력값', '상태', '주소', '도로명주소', '위도', '경도'];

const STATUS_LABEL: Record<Entry['status'], string> = {
  pending: '대기',
  loading: '조회 중',
  found: '찾음',
  notFound: '못 찾음',
  failed: '오류',
  skipped: '건너뜀',
};

export function toCsv(entries: Entry[]): string {
  const rows = entries.map((entry, index) => {
    const place = entry.place;

    return [
      String(index + 1),
      entry.raw,
      STATUS_LABEL[entry.status],
      place?.label ?? '',
      place?.roadAddress ?? '',
      // 좌표를 문자열로 다루는 것은 이 앱의 규칙이다. 숫자로 바꾸면 소수점이 흔들린다.
      place === undefined ? '' : String(place.lat),
      place === undefined ? '' : String(place.lng),
    ];
  });

  // 줄 끝은 CRLF 다. 엑셀이 LF 만 있는 파일에서 줄을 합쳐 보이는 경우가 있다.
  return BOM + [HEADER, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** 날짜가 붙은 파일명. 같은 폴더에 여러 번 받아도 덮어쓰지 않는다. */
export function csvFileName(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `location-maker-${year}-${month}-${day}.csv`;
}

/**
 * 쉼표·따옴표·줄바꿈이 든 값은 감싸고, 안쪽 따옴표는 두 번 겹친다 (RFC 4180).
 *
 * 주소에는 셋 다 흔하다 — `서울 중구 세종대로 110, 서울시청` 같은 줄을 그냥 내보내면
 * 열이 하나 밀려서 좌표가 엉뚱한 칸에 들어간다.
 */
function escapeCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;

  return `"${value.replace(/"/g, '""')}"`;
}
