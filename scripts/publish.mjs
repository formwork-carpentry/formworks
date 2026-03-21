#!/usr/bin/env node
/**
 * @module scripts/publish
 * @description Publish all @formwork/* packages to npm.
 *
 * Usage:
 *   node scripts/publish.mjs              # dry-run (default)
 *   node scripts/publish.mjs --execute    # actually publish
 *   node scripts/publish.mjs --bun        # use bun publish instead of npm
 *
 * Prerequisites:
 *   - npm login (or NPM_TOKEN env var)
 *   - All packages built: npx turbo build
 *   - All typechecks pass: npx turbo typecheck
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const USE_BUN = args.includes('--bun');
const CMD = USE_BUN ? 'bun publish' : 'npm publish';

function getPackageDirs() {
  const dirs = [];

  // Core packages
  const pkgDir = join(ROOT, 'packages');
  for (const name of readdirSync(pkgDir)) {
    const pkg = join(pkgDir, name, 'package.json');
    if (existsSync(pkg)) dirs.push(join(pkgDir, name));
  }

  // Adapter sub-packages
  const adapterPatterns = ['cache-adapters', 'db-adapters', 'mail-adapters', 'queue-adapters', 'storage-adapters', 'bridge-adapters', 'ui-adapters'];
  for (const pattern of adapterPatterns) {
    const adapterDir = join(pkgDir, pattern);
    if (!existsSync(adapterDir)) continue;
    for (const name of readdirSync(adapterDir)) {
      const pkg = join(adapterDir, name, 'package.json');
      if (existsSync(pkg)) dirs.push(join(adapterDir, name));
    }
  }

  // create-carpenter-app
  const cca = join(ROOT, 'create-carpenter-app');
  if (existsSync(join(cca, 'package.json'))) dirs.push(cca);

  return dirs;
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
}

console.log(`\n🪚 Carpenter Publish${DRY_RUN ? ' (DRY RUN)' : ''}\n`);
console.log(`  Using: ${CMD}`);
console.log(`  Registry: https://registry.npmjs.org\n`);

const packageDirs = getPackageDirs();
let published = 0;
let skipped = 0;
let failed = 0;

for (const dir of packageDirs) {
  const pkg = readPkg(dir);
  if (pkg.private) {
    skipped++;
    continue;
  }

  const tag = pkg.version.includes('alpha') ? '--tag alpha' : pkg.version.includes('beta') ? '--tag beta' : '';

  if (DRY_RUN) {
    console.log(`  [dry-run] ${pkg.name}@${pkg.version} ${tag}`);
    published++;
    continue;
  }

  try {
    const flags = `--access public ${tag}`.trim();
    execSync(`${CMD} ${flags}`, { cwd: dir, stdio: 'pipe' });
    console.log(`  ✅ ${pkg.name}@${pkg.version}`);
    published++;
  } catch (err) {
    const msg = err.stderr?.toString() ?? '';
    if (msg.includes('already exists') || msg.includes('EPUBLISHCONFLICT')) {
      console.log(`  ⏭️  ${pkg.name}@${pkg.version} — already published`);
      skipped++;
    } else {
      console.log(`  ❌ ${pkg.name}@${pkg.version} — ${msg.split('\n')[0]}`);
      failed++;
    }
  }
}

console.log(`\n  Published: ${published} | Skipped: ${skipped} | Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
