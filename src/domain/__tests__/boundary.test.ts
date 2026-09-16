import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const domainDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 주석은 코드가 아니다. 경계를 설명하는 주석이 경계 위반으로 잡히면 곤란하다. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const sourceFiles = readdirSync(domainDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, text: stripComments(readFileSync(join(domainDir, name), 'utf8')) }));

describe('도메인 경계', () => {
  it('UC-LM-BOUNDARY-001: 도메인은 같은 폴더 밖을 import 하지 않는다', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);

    const outsideImports = sourceFiles.flatMap(({ name, text }) =>
      [...text.matchAll(/(?:from|import)\s+'([^']+)'/g)]
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
