import type { Entry } from '../domain/types';

export type ResultItemProps = {
  entry: Entry;
  /** 목록에서의 자리. 마커 번호와 같은 숫자다. */
  index: number;
  onRetry: (entry: Entry) => void;
  onSkip: (entry: Entry) => void;
  /** 찾은 항목을 고르면 지도가 그 마커로 옮겨진다. 좌표가 없는 줄에는 붙이지 않는다. */
  onSelect?: (entry: Entry) => void;
  /** 조회 중에는 잠근다. `고쳐서 다시` 가 잠긴 입력창에 줄을 붙일 수 있어서다. */
  disabled?: boolean;
};

const STATUS_LABEL: Record<Entry['status'], string> = {
  pending: '대기',
  loading: '조회 중',
  found: '찾음',
  notFound: '못 찾음',
  failed: '오류',
  skipped: '건너뜀',
};

export function ResultItem({ entry, index, onRetry, onSkip, onSelect, disabled = false }: ResultItemProps) {
  // 건너뛴 줄은 자리와 원문을 그대로 두되 더 권하지 않는다. 사용자가 이미 결정했다.
  const failed = entry.status === 'notFound' || entry.status === 'failed';
  const marked = failed || entry.status === 'skipped';

  return (
    <li className={`result-item result-item--${entry.status}`}>
      <span className="result-item__badge" aria-hidden="true">
        {marked ? '⚠' : index}
      </span>
      <div className="result-item__body">
        {/* 원문은 어떤 상태에서도 그대로 남는다. 실패한 줄을 고치려면 이것이 있어야 한다. */}
        {onSelect !== undefined && entry.place !== undefined ? (
          // 좌표가 있을 때만 버튼이다. 마커가 없는 줄에 눌리는 버튼을 두면 아무 일도
          // 일어나지 않는 것이 고장으로 보인다.
          <button type="button" className="result-item__raw result-item__select" onClick={() => onSelect(entry)}>
            {entry.raw}
          </button>
        ) : (
          <p className="result-item__raw">{entry.raw}</p>
        )}
        {entry.place !== undefined && (
          <p className="result-item__detail">
            {entry.place.label}
            {entry.place.matchedBy === 'keyword' && <span className="result-item__tag">장소명으로 찾음</span>}
          </p>
        )}
        {entry.failure !== undefined && <p className="result-item__detail">{entry.failure.message}</p>}
        <span className="result-item__status">{STATUS_LABEL[entry.status]}</span>
      </div>
      {failed && (
        <div className="result-item__actions">
          <button type="button" className="button button--small" disabled={disabled} onClick={() => onRetry(entry)}>
            고쳐서 다시
          </button>
          <button type="button" className="button button--small" disabled={disabled} onClick={() => onSkip(entry)}>
            건너뛰기
          </button>
        </div>
      )}
    </li>
  );
}
