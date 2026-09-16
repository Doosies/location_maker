import type { Entry } from '../domain/types';
import { countByStatus } from '../state/store';
import { ResultItem } from './ResultItem';

export type ResultListProps = {
  entries: Entry[];
  onRetry: (entry: Entry) => void;
  onSkip: (entry: Entry) => void;
  /** 찾은 항목을 고르면 지도가 그 마커로 옮겨진다. */
  onSelect?: (entry: Entry) => void;
  /** 조회 중인가. 항목의 두 버튼을 입력창과 함께 잠근다. */
  running?: boolean;
};

export function ResultList({ entries, onRetry, onSkip, onSelect, running = false }: ResultListProps) {
  if (entries.length === 0) {
    return (
      <section className="result-list" aria-label="결과 목록">
        <p className="result-list__empty">아직 표시할 주소가 없습니다. 위에 주소를 넣고 눌러 보세요.</p>
      </section>
    );
  }

  const { found, failed } = countByStatus(entries);

  return (
    <section className="result-list" aria-label="결과 목록">
      <p className="result-list__summary">
        <span className="chip chip--found">찾음 {found}</span>
        <span className="chip chip--failed">실패 {failed}</span>
      </p>
      <ol className="result-list__items">
        {/* 실패한 줄도 원래 자리에 남는다. 목록에서 빼면 마커 개수가 왜 다른지 알 수 없다. */}
        {entries.map((entry, index) => (
          <ResultItem
            key={entry.id}
            entry={entry}
            index={index + 1}
            onRetry={onRetry}
            onSkip={onSkip}
            {...(onSelect === undefined ? {} : { onSelect })}
            disabled={running}
          />
        ))}
      </ol>
    </section>
  );
}
