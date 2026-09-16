import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const domainDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 주석은 코드가 아니다. 경계를 설명하는 주석이 경계 위반으로 잡히면 곤란하다. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** 하위 폴더까지 훑는다. `__tests__` 는 테스트라 경계 밖을 봐도 된다. */
function collectSources(dir: string, prefix = ''): { name: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : collectSources(join(dir, entry.name), rel);
    }
    if (!/\.[cm]?tsx?$/.test(entry.name)) return [];
    return [{ name: rel, text: stripComments(readFileSync(join(dir, entry.name), 'utf8')) }];
  });
}

const sourceFiles = collectSources(domainDir);

describe('도메인 경계', () => {
  it('UC-LM-BOUNDARY-001: 도메인은 같은 폴더 밖을 import 하지 않는다', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);

    const outsideImports = sourceFiles.flatMap(({ name, text }) =>
      // from '…' · from "…" · await import('…') · require('…') 를 모두 잡는다.
      [...text.matchAll(/(?:from|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1] ?? '')
        .filter((specifier) => !specifier.startsWith('./'))
        .map((specifier) => `${name} → ${specifier}`),
    );

    expect(outsideImports).toEqual([]);
  });

  it('UC-LM-BOUNDARY-002: 도메인은 브라우저 전역을 쓰지 않는다', () => {
    const globalUses = sourceFiles.flatMap(({ name, text }) =>
      [...text.matchAll(/\b(window|document|kakao)\b/g)].map((match) => `${name} → ${match[1]}`),
    );

    expect(globalUses).toEqual([]);
  });
});
