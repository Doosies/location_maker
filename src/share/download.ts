/**
 * 브라우저에게 파일을 건네는 자리. 여기만 DOM 을 안다.
 *
 * `to-csv.ts` 는 문자열만 만들고, 그것을 파일로 만드는 일은 이 파일이 한다. 그래야
 * CSV 형식을 DOM 없이 테스트할 수 있다.
 */

export type DownloadDeps = {
  doc?: Document;
  /** 테스트가 가짜를 넣는다. jsdom 에는 `createObjectURL` 이 없다. */
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
};

export function downloadText(content: string, fileName: string, deps: DownloadDeps = {}): void {
  const doc = deps.doc ?? globalThis.document;
  const createUrl = deps.createUrl ?? ((blob) => URL.createObjectURL(blob));
  const revokeUrl = deps.revokeUrl ?? ((url) => URL.revokeObjectURL(url));

  // `text/csv;charset=utf-8` 를 명시한다. BOM 과 함께 엑셀이 한글을 제대로 읽게 하는 짝이다.
  const url = createUrl(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;

  // Firefox 는 문서에 붙지 않은 `<a download>` 의 click() 을 오래 무시했다. 붙였다 뗀다.
  doc.body.appendChild(link);
  link.click();
  link.remove();

  // 한 틱 뒤에 거둔다. 곧바로 거두면 내려받기가 시작되기 전에 URL 이 사라지는 경우가 있다.
  setTimeout(() => revokeUrl(url), 0);
}
