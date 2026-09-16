import { expect, test } from '@playwright/test';

import { LOAD_FAILURE_MESSAGE } from '../../src/map/load-kakao-sdk';

/**
 * 키를 넣지 않고 빌드한 화면.
 *
 * 키 주입은 **빌드 타임**이라 키가 있는 화면과 없는 화면은 서로 다른 번들이다. 그래서
 * 이 파일만 다른 서버(4174)를 본다. 배포가 키 없이 나갔을 때 사용자가 무엇을 보는지가
 * 여기서만 확인된다 — 흰 화면이면 설정이 빠진 것과 코드가 깨진 것을 구분할 수 없다.
 */

test('UC-LME-NOKEY-001: 키가 없으면 지도 자리에 넣을 변수 이름이 보인다', async ({ page }) => {
  await page.goto('');

  // 문구를 그대로 댄다. `/VITE_KAKAO_JS_KEY/` 로는 부족하다 — `script` 실패 문구에도 그
  // 이름이 들어 있어, 키가 있는데 도메인이 안 맞는 경우까지 초록이 된다.
  await expect(page.getByText(LOAD_FAILURE_MESSAGE['no-key'])).toBeVisible();
});

test('UC-LME-NOKEY-002: 키가 없어도 입력과 목록은 그대로 돈다', async ({ page }) => {
  await page.goto('');

  await page.getByLabel('주소 입력').fill('서울 강남구 테헤란로 152');
  await page.getByRole('button', { name: '지도에 표시' }).click();

  // 지도를 못 띄우는 것과 앱이 멈추는 것은 다르다. 키가 없으면 가짜 어댑터로 흐름을 본다.
  await expect(page.getByRole('listitem')).toHaveCount(1);
});
