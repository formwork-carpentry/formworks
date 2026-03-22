#!/usr/bin/env node
/**
 * Release script for Formworks monorepo
 * 
 * Updates package versions, creates git tags, and manages releases
 * across all @formwork/* packages in the monorepo.
 * 
 * Usage:
 *   node scripts/release.mjs [--dry-run]
 * 
 * Release types:
 *   - patch: 1.0.0 -> 1.0.1
 *   - minor: 1.0.0 -> 1.1.0
 *   - major: 1.0.0 -> 2.0.0
 *   - prerelease: 1.0.0 -> 1.0.0-alpha.1
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packageDir = path.resolve(rootDir, 'packages');

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

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
  header: (msg) => console.log(`\n${colors.blue}==> ${msg}${colors.reset}`),
};

/**
 * Parse semantic version string
 */
function parseVersion(versionStr) {
  const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${versionStr}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

/**
 * Increment version based on release type
 */
function incrementVersion(currentVersion, releaseType) {
  const ver = parseVersion(currentVersion);

  switch (releaseType) {
    case 'major':
      return `${ver.major + 1}.0.0`;
    case 'minor':
      return `${ver.major}.${ver.minor + 1}.0`;
    case 'patch':
      return `${ver.major}.${ver.minor}.${ver.patch + 1}`;
    case 'prerelease': {
      if (ver.prerelease) {
        // Increment existing prerelease
        const parts = ver.prerelease.split('.');
        const num = parseInt(parts[parts.length - 1], 10);
        parts[parts.length - 1] = String(num + 1);
        return `${ver.major}.${ver.minor}.${ver.patch}-${parts.join('.')}`;
      }
      // Create new prerelease
      return `${ver.major}.${ver.minor}.${ver.patch}-alpha.1`;
    }
    default:
      throw new Error(`Unknown release type: ${releaseType}`);
  }
}

/**
 * Read JSON file
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${err.message}`);
  }
}

/**
 * Write JSON file with proper formatting
 */
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch (err) {
    throw new Error(`Failed to write ${filePath}: ${err.message}`);
  }
}

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
 * Main release function
 */
function release() {
  try {
    log.header('Formworks Release Tool');

    if (!fs.existsSync(packageDir)) {
      log.warn(`No packages directory found at ${packageDir}`);
      process.exit(1);
    }

    // Read root package.json
    const rootPkgPath = path.join(rootDir, 'package.json');
    const rootPkg = readJson(rootPkgPath);
    const currentVersion = rootPkg.version;

    log.info(`Current version: ${colors.blue}${currentVersion}${colors.reset}`);

    // Collect all package.json files
    const packages = [];
    const entries = fs.readdirSync(packageDir);

    for (const entry of entries) {
      const pkgPath = path.join(packageDir, entry, 'package.json');
      if (fs.existsSync(pkgPath)) {
        packages.push({
          name: entry,
          path: pkgPath,
          pkg: readJson(pkgPath),
        });
      }
    }

    log.info(`Found ${packages.length} packages`);

    // For now, default to patch release
    // In a real implementation, you would prompt the user here
    const releaseType = process.argv[2] || 'patch';
    const validTypes = ['major', 'minor', 'patch', 'prerelease'];

    if (!validTypes.includes(releaseType)) {
      throw new Error(`Invalid release type: ${releaseType}. Must be one of: ${validTypes.join(', ')}`);
    }

    const newVersion = incrementVersion(currentVersion, releaseType);
    log.info(`Release type: ${colors.blue}${releaseType}${colors.reset}`);
    log.info(`New version: ${colors.blue}${newVersion}${colors.reset}`);

    if (!isDryRun) {
      log.header('Updating package versions');

      // Update root package.json
      rootPkg.version = newVersion;
      writeJson(rootPkgPath, rootPkg);
      log.success(`Updated root package.json to ${newVersion}`);

      // Update all workspace packages
      for (const pkg of packages) {
        pkg.pkg.version = newVersion;
        writeJson(pkg.path, pkg.pkg);
        log.success(`Updated ${pkg.name} to ${newVersion}`);
      }

      // Create git tag
      log.header('Creating git tag');
      const tagName = `v${newVersion}`;
      execGit(`tag -a ${tagName} -m "Release ${newVersion}"`);
      log.success(`Created git tag: ${tagName}`);

      log.header('Release completed');
      log.success(`🚀 Successfully released version ${newVersion}`);
    } else {
      log.warn('DRY RUN MODE - No changes were made');
      log.info(`Would update to version: ${newVersion}`);
      log.info(`Would create tag: v${newVersion}`);
    }

    process.exit(0);
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

// Run release
release();
