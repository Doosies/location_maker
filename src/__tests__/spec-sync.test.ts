import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkSpecSync, readPrefixRegistry } from '@cas/spec-sync';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('spec-sync', () => {
  it('UC-LM-SPEC-SYNC-001: 스펙 문서와 테스트가 어긋나지 않는다', () => {
    const registry = readPrefixRegistry(join(packageRoot, 'docs/testing/uc-id-prefixes.md'));

    // 위반을 배열째로 비교하면 실패 메시지에 무엇이 어긋났는지 그대로 찍힌다.
    expect(
      checkSpecSync({
        packageRoot,
        // e2e 도 같은 규약을 따른다. 저니 스펙이 테스트와 어긋나면 여기서 잡힌다.
        testDirs: ['src', 'e2e'],
        knownPrefixes: registry.map((row) => row.prefix),
      }),
    ).toEqual([]);
  });
});
