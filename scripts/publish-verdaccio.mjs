#!/usr/bin/env node
/**
 * @module scripts/publish-verdaccio
 * @description Publish all @carpentry/* packages to a local Verdaccio registry.
 *
 * This script handles the src→dist rewriting that's needed because packages
 * export from ./src/ in development but ship ./dist/ when published.
 *
 * Usage:
 *   node scripts/publish-verdaccio.mjs              # dry-run
 *   node scripts/publish-verdaccio.mjs --execute     # actually publish
 *   node scripts/publish-verdaccio.mjs --registry http://localhost:4873
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

const registryIdx = args.indexOf('--registry');
const REGISTRY = registryIdx !== -1 ? args[registryIdx + 1] : 'http://localhost:4873';

function getPackageDirs() {
  const dirs = [];
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

  return dirs;
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
}

// Build a name→version map from all package dirs for resolving workspace:* deps
function buildPackageVersionMap(dirs) {
  const map = new Map();
  for (const dir of dirs) {
    const pkg = readPkg(dir);
    map.set(pkg.name, pkg.version);
  }
  return map;
}

function writePkg(dir, pkg) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Rewrite a path from ./src/*.ts to ./dist/*.js (or .d.ts for types).
 */
function rewritePath(value, forTypes = false) {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('./src/')) return value;
  const rewritten = value.replace(/^\.\/src\//, './dist/');
  if (forTypes) return rewritten.replace(/\.ts$/, '.d.ts');
  return rewritten.replace(/\.ts$/, '.js');
}

/**
 * Rewrite exports map from src→dist.
 */
function rewriteExports(exports) {
  if (typeof exports === 'string') return rewritePath(exports);
  if (!exports || typeof exports !== 'object') return exports;

  const result = {};
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === 'string') {
      result[rewritePath(key)] = rewritePath(value);
    } else if (typeof value === 'object' && value !== null) {
      result[rewritePath(key)] = rewriteExports(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Rewrite package.json fields for publishing (src→dist).
 * Returns the original pkg data for restoration.
 */
function prepareForPublish(dir) {
  const raw = readFileSync(join(dir, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);

  const updated = { ...pkg };

  // Remove private flag for Verdaccio publishing
  delete updated.private;

  if (pkg.main) updated.main = rewritePath(pkg.main);
  if (pkg.types) updated.types = rewritePath(pkg.types, true);
  if (pkg.exports) updated.exports = rewriteExports(pkg.exports);

  // Rewrite workspace:* dependencies to actual versions
  // Build a lookup of all package names → dirs
  for (const depField of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!updated[depField]) continue;
    for (const [name, version] of Object.entries(updated[depField])) {
      if (version === 'workspace:*' || version === '*') {
        const resolved = packageVersionMap.get(name);
        if (resolved) {
          updated[depField][name] = `^${resolved}`;
        }
      }
    }
  }

  // Ensure files includes dist
  if (!updated.files) {
    updated.files = ['dist'];
  }

  writePkg(dir, updated);
  return raw; // return original for restoration
}

function restore(dir, originalRaw) {
  writeFileSync(join(dir, 'package.json'), originalRaw);
}

function ensureBuilt(dir, pkgName) {
  const tsconfigPath = join(dir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) return;

  const distDir = join(dir, 'dist');
  if (existsSync(distDir)) return;

  const buildInfoPath = join(dir, 'tsconfig.tsbuildinfo');
  if (existsSync(buildInfoPath)) {
    unlinkSync(buildInfoPath);
  }

  process.stdout.write(`    🔧 building ${pkgName}... `);
  execSync('npm run build', { cwd: dir, stdio: 'pipe' });
  process.stdout.write('done\n');
}

console.log(`\n🧱 Formwork → Verdaccio Publish${DRY_RUN ? ' (DRY RUN)' : ''}\n`);
console.log(`  Registry: ${REGISTRY}\n`);

const packageDirs = getPackageDirs();
const packageVersionMap = buildPackageVersionMap(packageDirs);
let published = 0;
let skipped = 0;
let failed = 0;

const results = [];

for (const dir of packageDirs) {
  const pkg = readPkg(dir);
  if (pkg.private) {
    // For Verdaccio, publish private packages too (they're adapter deps needed transitively)
    console.log(`  📦 ${pkg.name} — private (publishing to Verdaccio anyway)`);
  }

  const tag = pkg.version.includes('alpha') ? '--tag alpha' : pkg.version.includes('beta') ? '--tag beta' : '';

  if (DRY_RUN) {
    console.log(`  [dry-run] ${pkg.name}@${pkg.version} ${tag}`);
    // Show what would be rewritten
    const originalRaw = readFileSync(join(dir, 'package.json'), 'utf-8');
    const original = JSON.parse(originalRaw);
    if (original.main?.startsWith('./src/')) {
      console.log(`    main: ${original.main} → ${rewritePath(original.main)}`);
    }
    published++;
    continue;
  }

  // Rewrite for publish, then restore
  let originalRaw;
  try {
    ensureBuilt(dir, pkg.name);
    originalRaw = prepareForPublish(dir);
    const flags = `--access public ${tag} --registry ${REGISTRY}`.trim();
    execSync(`npm publish ${flags}`, { cwd: dir, stdio: 'pipe' });
    console.log(`  ✅ ${pkg.name}@${pkg.version}`);
    published++;
    results.push({ name: pkg.name, version: pkg.version, status: 'ok' });
  } catch (err) {
    const msg = (err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '') + (err.message ?? '');
    if (msg.includes('already exists') || msg.includes('EPUBLISHCONFLICT') || msg.includes('cannot publish over') || msg.includes('this package is already present')) {
      console.log(`  ⏭️  ${pkg.name}@${pkg.version} — already published`);
      skipped++;
    } else {
      console.log(`  ❌ ${pkg.name}@${pkg.version} — ${msg.substring(0, 200)}`);
      failed++;
    }
  } finally {
    if (originalRaw) restore(dir, originalRaw);
  }
}

console.log(`\n  Published: ${published} | Skipped: ${skipped} | Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
