// 키가 없을 때 흰 화면이 되면 설정이 빠진 것과 코드가 깨진 것을 구분할 수 없다.
// 그래서 지도 자리에는 항상 무언가가 렌더된다.
//
// import.meta.env 는 빌드 시 문자열로 치환된다. 치환은 `import.meta.env.VITE_...` 형태를
// 그대로 찾을 때만 일어나므로, 변수로 접근하지 않고 아래처럼 직접 쓴다.
const kakaoJsKey = import.meta.env.VITE_KAKAO_JS_KEY ?? '';

export function MapPlaceholder() {
  if (kakaoJsKey === '') {
    return (
      <section className="map-placeholder" aria-label="지도">
        <p>
          <strong>지도를 띄울 키가 없다.</strong>
        </p>
        <p>
          Kakao JavaScript 앱키를 <code>VITE_KAKAO_JS_KEY</code> 로 넣으면 지도가 뜬다. 로컬은
          저장소 루트의 <code>.env.local</code>, 배포는 저장소 Actions Secrets 를 쓴다.
        </p>
      </section>
    );
  }

  return (
    <section className="map-placeholder" aria-label="지도">
      <p>지도는 아직 붙지 않았다. 다음 단계에서 Kakao 지도가 이 자리에 들어간다.</p>
    </section>
  );
}
