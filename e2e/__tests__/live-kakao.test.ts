import { expect, test } from '@playwright/test';

/**
 * 진짜 Kakao SDK 에 붙는 유일한 테스트. **수동으로 돌린다** (`pnpm test:e2e:live`).
 *
 * 스텁 저니만 있으면 "우리 코드는 맞는데 SDK 계약이 바뀐" 경우를 영영 못 잡는다.
 * 반대로 이것을 CI 에 넣으면 남의 서비스가 느린 날 우리 CI 가 빨개진다. 그래서 따로 둔다.
 *
 * **키가 없으면 실패한다.** 조용히 건너뛰면 초록이 신호가 아니게 된다.
 * 쿼터를 축내지 않도록 주소는 하나만 쓴다.
 */

/** 남한을 넉넉히 감싸는 사각형. 축을 뒤집으면 좌표가 여기서 벗어난다. */
const KOREA = { south: 33, north: 39, west: 124, east: 132 };

test('UC-LME-LIVE-001: 진짜 SDK 가 준 좌표가 한국 안에 있다', async ({ page }) => {
  await page.goto('');

  // SDK 가 실제로 붙을 때까지 기다린다. 이 테스트의 초록은 "실제로 붙었다" 만 뜻해야 한다.
  // 로더가 실패하면 지도 자리가 사유 문구로 바뀌므로, 그 문구를 그대로 실패 메시지에
  // 싣는다 — no-key / script / timeout / init 중 무엇인지 바로 보인다. 변수 이름만 찾는
  // 단언으로는 구분되지 않는다. `script` 문구에도 같은 이름이 들어 있기 때문이다.
  const field = page.getByLabel('주소 입력');
  const mapFailure = page.locator('.map-placeholder');
  await expect(async () => {
    if ((await mapFailure.count()) > 0) {
      throw new Error(`지도를 띄우지 못했다: ${await mapFailure.innerText()}`);
    }
    // SDK 가 준비되기 전에는 입력이 잠겨 있다. 풀렸다는 것이 곧 준비됐다는 뜻이다.
    await expect(field).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await field.fill('서울 강남구 테헤란로 152');
  await page.getByRole('button', { name: '지도에 표시' }).click();
  await expect(page.getByText('찾음 1')).toBeVisible({ timeout: 15_000 });

  // 진짜 지도의 마커에서는 좌표를 읽을 수 없다. CSV 가 같은 값을 그대로 내보내므로
  // 그쪽으로 확인한다 — 축을 뒤집었으면 여기서 드러난다.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV 내려받기' }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const row = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '').split('\r\n')[1] ?? '';
  const cells = row.split(',');

  const lat = Number(cells.at(-2));
  const lng = Number(cells.at(-1));
  expect(lat).toBeGreaterThan(KOREA.south);
  expect(lat).toBeLessThan(KOREA.north);
  expect(lng).toBeGreaterThan(KOREA.west);
  expect(lng).toBeLessThan(KOREA.east);
});
