import { expect, test } from '@playwright/test';

import { installKakaoStub, MARKER_SELECTOR } from '../fixtures/kakao-sdk-stub';

/**
 * 붙여넣기부터 CSV 까지, 사용자가 실제로 지나는 길을 한 번에 본다.
 *
 * 단위 테스트는 부분이 맞는지 보고, 이 파일은 **부분들이 이어지는지** 본다. 빌드된
 * 번들·base 경로·SDK 로더·클립보드·내려받기는 여기서만 함께 돈다.
 */

const FIVE = [
'서울 강남구 테헤란로 152',
'서울 중구 을지로 65',
'성남시 분당구 판교역로 235',
'서울 종로구 사직로 161',
'부산 해운대구 해운대해변로 264',
].join('\n');

test('UC-LME-PLOT-001: 주소 다섯 개를 넣으면 마커 다섯 개가 목록 순서대로 찍힌다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill(FIVE);
  await page.getByRole('button', { name: '지도에 표시' }).click();

  await expect(page.getByText('찾음 5')).toBeVisible();
  await expect(page.locator(MARKER_SELECTOR)).toHaveCount(5);
  // 목록 자리 번호 = 마커 번호. 이 불변식이 화면 전체를 지나 살아 있는지 본다.
  await expect(page.locator(MARKER_SELECTOR)).toHaveText(['1', '2', '3', '4', '5']);
});

test('UC-LME-PLOT-002: 못 찾는 주소는 제자리에 남고 마커만 그만큼 적다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill('있을 리 없는 주소\n서울 중구 을지로 65');
  await page.getByRole('button', { name: '지도에 표시' }).click();

  await expect(page.getByText('실패 1', { exact: true })).toBeVisible();
  const items = page.getByRole('listitem');
  await expect(items).toHaveCount(2);
  // 실패한 줄이 1번을 차지하므로 남은 마커는 2번이다.
  await expect(items.first()).toContainText('있을 리 없는 주소');
  await expect(page.locator(MARKER_SELECTOR)).toHaveText(['2']);
});

test('UC-LME-PLOT-003: 고쳐서 다시는 그 줄을 입력창에서 골라 준다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  const field = page.getByLabel('주소 입력');
  await field.fill('있을 리 없는 주소\n서울 중구 을지로 65');
  await page.getByRole('button', { name: '지도에 표시' }).click();
  await page.getByRole('button', { name: '고쳐서 다시' }).click();

  // 입력창을 덮어쓰지 않는다. 줄은 그대로 두고 고칠 줄만 골라 준다.
  await expect(field).toHaveValue('있을 리 없는 주소\n서울 중구 을지로 65');
  const selected = await field.evaluate((node) => {
    const textarea = node as HTMLTextAreaElement;
    return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  });
  expect(selected).toBe('있을 리 없는 주소');
});

test('UC-LME-PLOT-004: 중단을 누르면 멈추고 남은 줄이 대기로 남는다', async ({ page }) => {
  await installKakaoStub(page, { delayMs: 400 });
  await page.goto('');

  await page.getByLabel('주소 입력').fill(FIVE);
  await page.getByRole('button', { name: '지도에 표시' }).click();
  await page.getByRole('button', { name: '중단' }).click();

  // 멈춘 것은 실패가 아니다. 다시 눌러 이어 할 수 있어야 한다.
  await expect(page.getByRole('button', { name: '지도에 표시' })).toBeEnabled();
  await expect(page.getByText('대기').first()).toBeVisible();
});

test('UC-LME-PLOT-005: 링크를 복사해 열면 같은 목록이 복원되고 저절로 조회된다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill('서울 중구 을지로 65\n성남시 분당구 판교역로 235');
  await page.getByRole('button', { name: '링크 복사' }).click();
  await expect(page.getByText('링크를 복사했다.')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  const opened = await context.newPage();
  await installKakaoStub(opened);
  await opened.goto(link);

  // 받은 쪽이 버튼을 한 번 더 누르지 않아도 같은 지도를 본다.
  await expect(opened.getByText('찾음 2')).toBeVisible();
  await expect(opened.locator(MARKER_SELECTOR)).toHaveCount(2);
});

test('UC-LME-PLOT-006: CSV 를 내려받으면 입력 줄 수만큼 줄이 들어 있다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill('서울 중구 을지로 65\n있을 리 없는 주소');
  await page.getByRole('button', { name: '지도에 표시' }).click();
  await expect(page.getByText('실패 1', { exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV 내려받기' }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');

  expect(download.suggestedFilename()).toMatch(/^location-maker-\d{4}-\d{2}-\d{2}\.csv$/);
  // 머리글 + 두 줄. 실패한 줄도 빠지지 않는다.
  expect(text.replace(/^﻿/, '').trim().split('\r\n')).toHaveLength(3);
  expect(text).toContain('있을 리 없는 주소');
});

test('UC-LME-PLOT-007: 장소명으로만 찾히는 줄도 마커가 된다', async ({ page }) => {
  await installKakaoStub(page);
  await page.goto('');

  await page.getByLabel('주소 입력').fill('카카오판교아지트');
  await page.getByRole('button', { name: '지도에 표시' }).click();

  // 주소 검색이 비면 키워드로 한 번 더 간다. 그 경로가 실제로 도는지 본다.
  await expect(page.getByText('장소명으로 찾음')).toBeVisible();
  await expect(page.locator(MARKER_SELECTOR)).toHaveCount(1);
});
