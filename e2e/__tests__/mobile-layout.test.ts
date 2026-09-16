import { expect, test } from '@playwright/test';

import { installKakaoStub, MARKER_SELECTOR } from '../fixtures/kakao-sdk-stub';

/**
 * 좁은 화면에서 **지도가 첫 화면에 있는지** 본다.
 *
 * 이 앱이 하는 일은 주소를 지도에 찍는 것이다. 그 지도가 스크롤해야 나오면 앱이
 * 켜지긴 해도 제 일을 못 한다. 이전 레이아웃이 정확히 그랬다 — 390px 에서 지도
 * 상단이 스크롤 1,400px 아래였고, 단위 테스트도 1280px 저니도 그것을 못 잡았다.
 * 폭을 실제로 좁혀 보는 테스트가 여기 하나 있어야 한다.
 */

const THREE = ['서울 강남구 테헤란로 152', '서울 중구 을지로 65', '성남시 분당구 판교역로 235'].join('\n');

test('UC-LME-MOBILE-001: 390px 에서 지도가 스크롤 없이 첫 화면에 보인다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  const map = page.getByRole('region', { name: '지도' });
  await expect(map).toBeInViewport();

  // 문서 전체가 뷰포트 안에 들어간다. 페이지 스크롤이 없다는 뜻이다.
  const size = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight);
  // 가로 스크롤은 좁은 화면에서 가장 흔한 고장이다.
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
});

test('UC-LME-MOBILE-002: 조회하면 시트가 내려가고 마커가 보인다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill(THREE);
  await page.getByRole('button', { name: '지도에 표시' }).click();

  await expect(page.locator(MARKER_SELECTOR)).toHaveCount(3);
  // 시트가 절반으로 내려가야 마커가 찍히는 것이 보인다.
  await expect(page.locator('.sheet')).toHaveAttribute('data-snap', 'half');
  await expect(page.locator(MARKER_SELECTOR).first()).toBeInViewport();
});

test('UC-LME-MOBILE-003: 손잡이를 누르면 시트가 접혔다 펴진다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  const sheet = page.locator('.sheet');
  await expect(sheet).toHaveAttribute('data-snap', 'full');

  // 자리가 도는 것뿐 아니라 **높이가 실제로 달라지는지** 본다. data-snap 만 바뀌고
  // CSS 가 따라오지 않으면 화면에서는 아무 일도 일어나지 않는다.
  const full = (await sheet.boundingBox())?.height ?? 0;
  await page.getByRole('button', { name: '목록 접기' }).click();
  await expect(sheet).toHaveAttribute('data-snap', 'peek');
  // 높이는 220ms 에 걸쳐 줄어든다. 속성이 바뀐 순간에 재면 아직 옛 높이다.
  await expect.poll(async () => (await sheet.boundingBox())?.height ?? 0).toBeLessThan(full);

  await page.getByRole('button', { name: '목록 펼치기' }).click();
  await expect(sheet).toHaveAttribute('data-snap', 'half');
});

test('UC-LME-MOBILE-004: 마커를 누르면 그 줄이 목록에서 보인다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill(THREE);
  await page.getByRole('button', { name: '지도에 표시' }).click();
  await expect(page.locator(MARKER_SELECTOR)).toHaveCount(3);

  // 마커 3번을 누르면 세 번째 줄이 시트 안에서 보이는 자리로 온다.
  await page.locator(MARKER_SELECTOR).filter({ hasText: '3' }).click();

  const third = page.getByRole('listitem').nth(2);
  await expect(third).toContainText('성남시 분당구 판교역로 235');
  await expect(third).toBeInViewport();
});
