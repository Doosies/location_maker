import { useId, type RefObject } from 'react';

/**
 * 입력창의 기본 줄 수.
 *
 * 4줄이다. 모바일에서 가상 키보드가 올라오면 화면의 절반이 사라지는데, 8줄짜리
 * 입력창은 그 남은 절반을 혼자 다 쓴다. 넘치는 줄은 스크롤되고, 손잡이로 늘릴 수 있다.
 */
const ROWS = 4;

const EXAMPLE = ['서울 강남구 테헤란로 152', '서울 중구 세종대로 110', '부산 해운대구 해운대해변로 264'].join('\n');

export type AddressInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** 조회 중에는 입력과 버튼을 잠근다. 도중에 바뀌면 목록과 입력이 어긋난다. */
  disabled?: boolean;
  /** `고쳐서 다시` 가 입력창으로 포커스를 돌려놓기 위해 쓴다. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

/** 빈 줄은 항목이 되지 않는다. 화면에 보여 줄 줄 수도 같은 기준이어야 한다. */
function countLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '').length;
}

export function AddressInput({ value, onChange, onSubmit, disabled = false, textareaRef }: AddressInputProps) {
  const textareaId = useId();
  const lines = countLines(value);

  return (
    <section className="address-input">
      <label className="address-input__label" htmlFor={textareaId}>
        주소 입력
      </label>
      <p className="address-input__hint">
        한 줄에 주소 하나를 넣어 주세요. 엑셀의 주소 열을 그대로 붙여넣어도 됩니다.
      </p>
      <textarea
        id={textareaId}
        ref={textareaRef}
        className="address-input__field"
        rows={ROWS}
        value={value}
        disabled={disabled}
        placeholder={EXAMPLE}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="address-input__count" aria-live="polite">
        {lines === 0 ? '아직 주소가 없습니다' : `${lines}줄`}
      </p>
      <div className="address-input__actions">
        <button type="button" className="button button--primary" disabled={disabled || lines === 0} onClick={onSubmit}>
          지도에 표시
        </button>
        <button type="button" className="button" disabled={disabled} onClick={() => onChange(EXAMPLE)}>
          예시 넣어보기
        </button>
        <button type="button" className="button" disabled={disabled || value === ''} onClick={() => onChange('')}>
          비우기
        </button>
      </div>
    </section>
  );
}
