export type ProgressBarProps = {
  done: number;
  total: number;
  onAbort: () => void;
};

/**
 * 오래 걸리는 동안 화면이 아무 말도 하지 않으면 사용자는 앱이 멈췄다고 본다.
 * 그래서 몇 건 중 몇 건인지와 멈추는 방법을 항상 같이 보여 준다.
 */
export function ProgressBar({ done, total, onAbort }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="progress" aria-label="조회 진행">
      <div className="progress__row">
        <p className="progress__text" aria-live="polite">
          조회 중 {done} / {total}
        </p>
        <button type="button" className="button button--danger" onClick={onAbort}>
          중단
        </button>
      </div>
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
