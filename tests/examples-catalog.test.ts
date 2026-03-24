/**
 * @module tests
 * @description Validates that every file path listed in the package example catalog exists.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PACKAGE_EXAMPLE_CATALOG } from '../docs/examples/catalog.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

describe('Examples catalog integrity', () => {
  it('references only existing files', () => {
    const missing: string[] = [];

    for (const entry of PACKAGE_EXAMPLE_CATALOG) {
      for (const relativePath of entry.files) {
        if (relativePath.includes('examples/packages/')) {
          continue;
        }
        const fullPath = path.resolve(repoRoot, relativePath);
        if (!fs.existsSync(fullPath)) {
          missing.push(`${entry.packageName}: ${relativePath}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
