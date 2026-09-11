# 배포 검토

**결정: GitHub Pages + GitHub Actions** (2026-09-11 승인)

백엔드가 없으니 배포할 것은 `dist/` 폴더 하나다. 그래서 선택 기준은 성능도 가격도 아니고
둘로 좁혀진다 — **빌드할 때 Kakao 키를 안전하게 넣을 수 있는가**, 그리고 **Kakao 콘솔에
등록할 도메인이 고정되는가**.

## 왜 GitHub Pages 인가

- `Doosies/location_maker` 는 **공개 저장소**라 GitHub Pages 가 무료다. 비공개였다면 유료
  플랜이 필요했다.
- 키는 저장소 Secrets 에 넣고 Actions 가 빌드할 때 꺼내 쓴다. 계정을 하나도 더 만들지 않는다.
- 테스트 · 빌드 · 배포가 워크플로 하나에 들어간다. 테스트가 깨지면 배포가 안 나간다.
- 도메인이 `doosies.github.io` 하나로 고정이라 Kakao 콘솔 등록이 한 번으로 끝난다.

나중에 전용 도메인이나 미리보기 배포가 필요해지면 **Cloudflare Pages** 로 옮긴다.
옮기는 비용은 워크플로 파일 하나와 Kakao 콘솔에 도메인 한 줄 추가가 전부다.

## 비교표

2026년 9월 기준 무료 구간이다. 다섯 후보 모두 이 앱을 돌릴 수는 있고, 갈리는 것은 제약이다.

| 후보 | 무료 범위 | 빌드 시 시크릿 | 배포 도메인 | 미리보기 | 이 앱에 걸리는 점 |
| --- | --- | --- | --- | --- | --- |
| **GitHub Pages** + Actions | 대역폭 100GB/월 (soft), 사이트 1GB | 저장소 Secrets | `doosies.github.io/location_maker` | 없음 | Vite `base` 설정 필요. origin 을 다른 내 프로젝트와 공유 |
| Cloudflare Pages | 대역폭 **무제한**, 빌드 500회/월, 동시 1 | 빌드 환경변수 | `<프로젝트>.pages.dev` (전용 origin, 커스텀 도메인 무료) | 브랜치별 | 계정 하나 추가. 동시 빌드 1개라 밀리면 대기 |
| Netlify | 크레딧 300/월 (빌드·대역폭 통합 소진) | 빌드 환경변수 | `<사이트>.netlify.app` | PR별 | 크레딧 한 풀이라 빌드를 자주 돌리면 대역폭까지 같이 깎임 |
| Vercel | 대역폭 100GB/월, 빌드 6,000분/월 | 빌드 환경변수 | `<프로젝트>.vercel.app` | PR별 | **Hobby 는 상업적 이용 금지.** 개인 용도가 아니면 월 $20 |
| S3 + CloudFront | 프리티어 이후 종량 | Actions Secrets | 직접 지정 | 직접 구성 | 이 규모에 설정이 과하다. 버킷 정책·OAC·캐시 무효화를 직접 관리 |

## 키는 이렇게 들어간다

GitHub Actions Secrets 에 값을 넣어 두면 워크플로가 빌드할 때 꺼내 쓴다. 저장소에는 값이
남지 않고, 로그에도 마스킹되어 찍힌다. 워크플로 전문은
[02-architecture.md §8](02-architecture.md#8-배포) 에 있다.

> **시크릿에 잘 넣는 것과, 그 값이 비밀로 남는 것은 별개다.**
>
> Secrets 는 **저장소와 CI 로그에서** 값을 지켜 준다. 그건 제대로 동작한다. 다만 `VITE_`
> 변수는 빌드 시점에 코드로 치환되므로, 빌드가 끝난 `dist/` 파일에는 값이 평문으로 들어
> 있다. 사이트를 연 사람이 개발자 도구로 JS 파일을 열면 그대로 읽힌다. **위 표의 다섯 후보
> 모두 똑같다.** 브라우저가 읽어야 하는 값이니 숨길 자리가 없다.
>
> 그래서 이 값을 지키는 것은 비밀 유지가 아니라 **도메인 제한**이다. Kakao 는 요청이 온
> 도메인을 콘솔 등록 목록과 대조하므로, 키를 복사해 남의 사이트에 붙여도 거부된다. 반대로
> Kakao REST API 키는 도메인 제한이 없어, Secrets 에 아무리 잘 넣어도 `VITE_` 로 내보내는
> 순간 누구나 쓸 수 있게 된다 — 그런 키는 이 앱에 넣지 않는다.

## Kakao 도메인 등록이 배포처를 제약한다

지도가 뜨려면 페이지의 origin 이 Kakao 콘솔에 등록돼 있어야 한다. 이 조건이 배포 방식 몇
가지를 잘라 낸다.

- 사이트 도메인은 **앱당 10개까지** 등록할 수 있다. 로컬 개발 주소와 배포 주소를 합쳐도
  여유가 있다.
- **와일드카드(`https://*.example.com`)는 비즈 앱만 쓸 수 있다.** 일반 앱은 정확한 도메인만
  등록된다.
- 그래서 **배포마다 주소가 바뀌는 미리보기 배포에서는 지도가 뜨지 않는다.** Vercel · Netlify ·
  Cloudflare 가 커밋마다 만드는 해시 주소는 미리 등록할 수가 없다. 브랜치별 고정 주소
  (`dev.<프로젝트>.pages.dev` 같은) 는 등록이 가능하니, 미리보기를 쓰려면 그쪽을 써야 한다.
- GitHub Pages 는 미리보기 배포가 없어서 이 문제를 아예 만나지 않는다. 대신
  `https://doosies.github.io` 하나를 등록하는 것이라, 같은 origin 에 올린 **다른 내 프로젝트도
  이 키를 쓸 수 있게 된다.** 전부 본인 것이라 실질적 위험은 낮지만 알고는 있어야 한다.

## Vite 설정

GitHub Pages 의 프로젝트 사이트는 `/location_maker/` 하위 경로로 서비스된다. 안 맞추면
자산 경로가 전부 깨진다.

```ts
// vite.config.ts
export default defineConfig({
  base: '/location_maker/',
});
```

설계에서 URL 상태를 해시에 담기로 한 것이 여기서 덤으로 도움이 된다. Pages 는 경로 라우팅에
404 를 내는데, 해시는 그 문제를 지나간다.

## 출처와 확인 한계

조사 세션이 외부 사이트 직접 접속을 못 하는 환경이어서, 위 수치는 **웹 검색 결과로**
확인했다. 공식 페이지를 직접 열어 대조하지는 못했다. 저장소가 공개인 것과 기본 브랜치가
`main` 인 것은 GitHub API 로 직접 확인했다.

- GitHub Pages limits: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- Cloudflare Pages limits: <https://developers.cloudflare.com/pages/platform/limits/>
- Vercel Hobby 플랜 (비상업 이용 조건): <https://vercel.com/docs/plans/hobby>
- Netlify 요금: <https://www.netlify.com/pricing/>
- Kakao 사이트 도메인 등록 수 제한: <https://devtalk.kakao.com/t/topic/82307>
