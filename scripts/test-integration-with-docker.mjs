#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

// Set KEEP_DOCKER_UP=1 (or pass --keep-up) to skip docker:down after tests.
// Useful for local debugging: containers stay running so you can inspect state.
const keepUp =
  process.env.KEEP_DOCKER_UP === '1' ||
  process.argv.includes('--keep-up');

function runNpmScript(scriptName) {
  const result = spawnSync('npm', ['run', scriptName], {
    stdio: 'inherit',
    env: process.env,
  });

  return result.status ?? 1;
}

let exitCode = 0;
let stackStarted = false;

try {
  exitCode = runNpmScript('docker:up');
  if (exitCode === 0) {
    stackStarted = true;

    exitCode = runNpmScript('docker:test');
    if (exitCode === 0) {
      exitCode = runNpmScript('test:integration:raw');
    }
  }
} finally {
  if (stackStarted && !keepUp) {
    const downCode = runNpmScript('docker:down');
    if (exitCode === 0 && downCode !== 0) {
      exitCode = downCode;
    }
  } else if (keepUp) {
    console.log('\n[keep-up] Docker stack left running for debugging. Run `npm run docker:down` when done.');
  }
}

process.exit(exitCode);
