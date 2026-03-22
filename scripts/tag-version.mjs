#!/usr/bin/env node
/**
 * Tag version script for Formworks
 * 
 * Reads the version from root package.json and creates a git tag.
 * 
 * Usage:
 *   node scripts/tag-version.mjs [--push]
 * 
 * Options:
 *   --push    Push the tag to the remote repository
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Parse command line arguments
const shouldPush = process.argv.includes('--push');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
};

/**
 * Execute git command
 */
function execGit(command) {
  try {
    return execSync(`git ${command}`, {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    throw new Error(`Git command failed: git ${command}\n${err.message}`);
  }
}

/**
 * Main function
 */
function main() {
  try {
    // Read root package.json
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    log.info(`📦 Reading version from package.json: ${colors.blue}${version}${colors.reset}`);

    const tagName = `v${version}`;

    // Check if tag already exists
    try {
      execGit(`rev-parse ${tagName}`);
      log.warn(`Tag ${tagName} already exists`);
      process.exit(1);
    } catch {
      // Tag doesn't exist, which is expected
    }

    // Create tag
    log.info(`🏷️  Creating git tag: ${colors.blue}${tagName}${colors.reset}`);
    execGit(`tag -a ${tagName} -m "Version ${version}"`);
    log.success(`Created tag ${tagName}`);

    // Push tag if requested
    if (shouldPush) {
      log.info(`📤 Pushing tag to remote...`);
      execGit(`push origin ${tagName}`);
      log.success(`Pushed tag ${tagName} to remote`);
    }

    log.success(`✨ Tag ${tagName} created successfully`);
    process.exit(0);
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

// Run main
main();
