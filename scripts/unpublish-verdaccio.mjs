#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const REGISTRY = 'http://localhost:4873';

function getPackageNames() {
  const names = [];
  const pkgDir = join(ROOT, 'packages');

  for (const name of readdirSync(pkgDir)) {
    const pkgPath = join(pkgDir, name, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      names.push(pkg.name);
    }
  }

  const adapterPatterns = ['cache-adapters', 'db-adapters', 'mail-adapters', 'queue-adapters', 'storage-adapters', 'bridge-adapters', 'ui-adapters'];
  for (const pattern of adapterPatterns) {
    const adapterDir = join(pkgDir, pattern);
    if (!existsSync(adapterDir)) continue;
    for (const name of readdirSync(adapterDir)) {
      const pkgPath = join(adapterDir, name, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        names.push(pkg.name);
      }
    }
  }

  return names;
}

const names = getPackageNames();
console.log(`Unpublishing ${names.length} packages from ${REGISTRY}...\n`);

let ok = 0;
for (const name of names) {
  try {
    execSync(`npm unpublish "${name}@1.0.0-alpha.0" --registry ${REGISTRY} --force`, { stdio: 'pipe' });
    console.log(`  ✅ ${name}`);
    ok++;
  } catch {
    console.log(`  ⏭️  ${name} (not found or already removed)`);
  }
}

// Also unpublish @carpentry/formwork
try {
  execSync(`npm unpublish "@carpentry/formwork@1.0.0-alpha.0" --registry ${REGISTRY} --force`, { stdio: 'pipe' });
  console.log(`  ✅ @carpentry/formwork`);
  ok++;
} catch {
  console.log(`  ⏭️  @carpentry/formwork (not found)`);
}

// Also unpublish carpenter (old name) and carpenter-cli
for (const name of ['carpenter', 'carpenter-cli']) {
  try {
    execSync(`npm unpublish "${name}@1.0.0-alpha.0" --registry ${REGISTRY} --force`, { stdio: 'pipe' });
    console.log(`  ✅ ${name}`);
    ok++;
  } catch {
    console.log(`  ⏭️  ${name} (not found)`);
  }
}

console.log(`\nUnpublished: ${ok}`);
