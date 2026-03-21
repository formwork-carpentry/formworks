/**
 * @module @formwork/core
 * @description EnvLoader — reads .env files and populates process.env
 * @patterns Strategy (file reading), Template Method (parse rules)
 * @principles SRP (only .env loading), OCP (extendable parse rules)
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";

export interface EnvLoaderOptions {
  /** Path to the .env file (default: '.env' in cwd) */
  path?: string;
  /** Whether to override existing env vars (default: false) */
  override?: boolean;
  /** Additional .env files to load (e.g., '.env.local', '.env.production') */
  extraFiles?: string[];
}

/**
 * Parse a .env file string into key-value pairs.
 * Supports: comments (#), empty lines, quoted values, multiline (not yet).
 *
 * @example
 * ```ts
 * import { parseEnvString } from '@formwork/core';
 * const vars = parseEnvString('FOO=bar');
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: env parsing requires multiple line format and escape sequence handling branches
export function parseEnvString(content: string): Map<string, string> {
  const result = new Map<string, string>();

  /**
   * @param {unknown} const rawLine of content.split('\n'
   */
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) continue;

    // Find first '=' — everything before is key, everything after is value
    const eqIndex = line.indexOf("=");
    if (eqIndex < 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle escape sequences in double-quoted values
    value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");

    // Strip inline comments (only for unquoted values)
    if (!rawLine.includes('"') && !rawLine.includes("'")) {
      const commentIdx = value.indexOf(" #");
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    }

    if (key) result.set(key, value);
  }

  return result;
}

/**
 * Load a .env file and populate process.env.
 *
 * @example
 * ```ts
 * await loadEnv(); // loads .env from cwd
 * await loadEnv({ path: '/app/.env', extraFiles: ['.env.local'] });
 * ```
 */
export async function loadEnv(options: EnvLoaderOptions = {}): Promise<Map<string, string>> {
  const allVars = new Map<string, string>();
  const basePath = options.path ?? join(process.cwd(), ".env");
  const override = options.override ?? false;

  // Load base .env file
  await loadSingleFile(basePath, allVars, override);

  // Load extra files (later files override earlier ones)
  /**
   * @param {unknown} options.extraFiles
   */
  if (options.extraFiles) {
    const dir = basePath.includes("/")
      ? basePath.slice(0, basePath.lastIndexOf("/"))
      : process.cwd();
    for (const file of options.extraFiles) {
      const filePath = file.startsWith("/") ? file : join(dir, file);
      await loadSingleFile(filePath, allVars, override);
    }
  }

  return allVars;
}

async function loadSingleFile(
  path: string,
  vars: Map<string, string>,
  override: boolean,
): Promise<void> {
  try {
    const content = await fs.readFile(path, "utf-8");
    const parsed = parseEnvString(content);

    for (const [key, value] of parsed) {
      vars.set(key, value);
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // File doesn't exist — silently skip (normal for .env.local, .env.production)
  }
}

/**
 * Synchronous version for config files that run at import time.
 * Reads from process.env (assumes loadEnv was called during bootstrap).
 */
export function envRequired(key: string): string {
  const value = process.env[key];
  /**
   * @param {unknown} [value === undefined || value === '']
   */
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}. Add it to your .env file.`);
  }
  return value;
}
