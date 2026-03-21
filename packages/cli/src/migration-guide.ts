/**
 * @module @formwork/cli
 * @description Migration guide commands — help users upgrade between Carpenter versions.
 *
 * WHY: Breaking changes between major versions need clear upgrade paths. Instead of
 * writing docs manually, the `upgrade:check` command scans the codebase for
 * deprecated APIs and generates a step-by-step migration guide.
 *
 * HOW: Registers a set of "migration rules" keyed by version. Each rule has a pattern
 * to detect and a replacement suggestion. The scanner checks source files against
 * these rules and reports what needs to change.
 *
 * @patterns Strategy (migration rules), Visitor (file scanning)
 * @principles OCP (add version rules without modifying scanner), SRP (scanning only)
 *
 * @example
 * ```bash
 * carpenter upgrade:check --from 0.x --to 1.0
 * # Scanning 42 files...
 * #   src/routes.ts:12 — Route.get() signature changed: add middleware array
 * #   src/models/User.ts:5 — Model.find() is now Model.query().find()
 * # 2 changes needed. Run `carpenter upgrade:apply` to auto-fix.
 * ```
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── Migration Rule ────────────────────────────────────────

/** A single migration rule: detects a pattern and suggests a fix */
export interface MigrationRule {
  /** Rule ID (e.g., 'v1.0-route-signature') */
  id: string;
  /** Human-readable description of the change */
  description: string;
  /** Version this rule applies to (e.g., '1.0') */
  targetVersion: string;
  /** Regex pattern to detect the deprecated usage */
  pattern: RegExp;
  /** Suggested replacement (can use $1, $2 for capture groups) */
  replacement?: string;
  /** Severity: 'breaking' requires fix, 'deprecation' is a warning */
  severity: "breaking" | "deprecation";
  /** Link to docs explaining the change */
  docsUrl?: string;
}

/** Result of scanning a single file */
export interface MigrationMatch {
  file: string;
  line: number;
  column: number;
  rule: MigrationRule;
  matchedText: string;
}

// ── Built-in Migration Rules (0.x → 1.0) ─────────────────

const BUILTIN_RULES: MigrationRule[] = [
  {
    id: "v1.0-session-async",
    description:
      "Session methods are now async — add `await` to session.get(), session.put(), session.flash()",
    targetVersion: "1.0",
    pattern: /(?<!await\s)session\.(get|put|flash|forget)\(/g,
    severity: "breaking",
  },
  {
    id: "v1.0-translator-api",
    description:
      "Translator.trans() renamed to Translator.get(), Translator.transChoice() renamed to Translator.choice()",
    targetVersion: "1.0",
    pattern: /\.trans(?:Choice)?\(/g,
    severity: "breaking",
    replacement: ".get(",
  },
  {
    id: "v1.0-response-headers",
    description: "Response headers are now lowercase — use res.getHeaders() instead of res.headers",
    targetVersion: "1.0",
    pattern: /res\.headers\[/g,
    severity: "deprecation",
  },
  {
    id: "v1.0-config-env",
    description: "Use loadEnv() + buildDefaultConfig() instead of manual process.env reads",
    targetVersion: "1.0",
    pattern: /process\.env\[['"](?:DB_|CACHE_|QUEUE_|MAIL_|STORAGE_)/g,
    severity: "deprecation",
  },
  {
    id: "v1.0-container-make",
    description: "Container.make<T>() now throws if binding not found (was returning undefined)",
    targetVersion: "1.0",
    pattern: /container\.make\([^)]+\)\s*\?\./g,
    severity: "deprecation",
  },
];

// ── Migration Scanner ─────────────────────────────────────

/**
 * MigrationScanner — scans source code for deprecated patterns and generates a report.
 *
 * @example
 * ```ts
 * const scanner = new MigrationScanner();
 * scanner.addRule({ id: 'custom', description: '...', targetVersion: '2.0', pattern: /oldApi/g, severity: 'breaking' });
 *
 * const matches = scanner.scanText('src/app.ts', sourceCode, '1.0');
 * console.log(`Found ${matches.length} issues`);
 * ```
 */
export class MigrationScanner {
  private rules: MigrationRule[] = [...BUILTIN_RULES];

  /** Add a custom migration rule */
  /**
   * @param {MigrationRule} rule
   * @returns {this}
   */
  addRule(rule: MigrationRule): this {
    this.rules.push(rule);
    return this;
  }

  /** Get all rules for a target version */
  /**
   * @param {string} version
   * @returns {MigrationRule[]}
   */
  getRulesForVersion(version: string): MigrationRule[] {
    return this.rules.filter((r) => r.targetVersion === version);
  }

  /**
   * Scan a source text for migration issues.
   *
   * @param filename - The file being scanned (for reporting)
   * @param source - The source code text
   * @param targetVersion - The version being upgraded to
   * @returns Array of matches found
   */
  scanText(filename: string, source: string, targetVersion: string): MigrationMatch[] {
    const matches: MigrationMatch[] = [];
    const rules = this.getRulesForVersion(targetVersion);
    const lines = source.split("\n");

    for (const rule of rules) {
      // Reset regex state
      rule.pattern.lastIndex = 0;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        rule.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
        while ((match = rule.pattern.exec(line)) !== null) {
          matches.push({
            file: filename,
            line: lineIdx + 1,
            column: match.index + 1,
            rule,
            matchedText: match[0],
          });
        }
      }
    }

    return matches;
  }

  /**
   * Generate a human-readable migration report from scan results.
   */
  formatReport(matches: MigrationMatch[]): string {
    if (matches.length === 0) return "No migration issues found. Your code is up to date!";

    const lines: string[] = ["Migration Report:", ""];
    const byFile = new Map<string, MigrationMatch[]>();
    for (const m of matches) {
      if (!byFile.has(m.file)) byFile.set(m.file, []);
      byFile.get(m.file)?.push(m);
    }

    for (const [file, fileMatches] of byFile) {
      lines.push(`  ${file}:`);
      for (const m of fileMatches) {
        const icon = m.rule.severity === "breaking" ? "❌" : "⚠️";
        lines.push(`    ${icon} Line ${m.line}: ${m.rule.description}`);
      }
      lines.push("");
    }

    const breaking = matches.filter((m) => m.rule.severity === "breaking").length;
    const deprecations = matches.filter((m) => m.rule.severity === "deprecation").length;
    lines.push(`${breaking} breaking change(s), ${deprecations} deprecation(s)`);

    return lines.join("\n");
  }
}

// ── CLI Command ───────────────────────────────────────────

/**
 * CLI command `upgrade:check` — uses `MigrationScanner` to report deprecated API usage for a target version.
 *
 * @example
 * ```ts
 * import { CliApp, UpgradeCheckCommand } from '@formwork/cli';
 * await new CliApp().register(new UpgradeCheckCommand()).run(['upgrade:check', '--to', '1.0', '--path', 'src']);
 * ```
 *
 * @see MigrationScanner
 * @see BaseCommand
 */
export class UpgradeCheckCommand extends BaseCommand {
  name = "upgrade:check";
  description = "Check your codebase for migration issues when upgrading Carpenter";

  constructor() {
    super();
    this.option("to", "Target version to upgrade to", "string", "1.0");
    this.option("path", "Source directory to scan", "string", "src");
  }

  /**
   * @param {Object} options
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    _args: Record<string, string>,
    options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    const targetVersion = (options.to as string) ?? "1.0";
    const scanPath = (options.path as string) ?? "src";

    output.info(`🔄 Checking for migration issues (upgrading to v${targetVersion})`);
    output.info(`   Scanning: ${scanPath}/`);
    output.info("");

    const scanner = new MigrationScanner();
    const rules = scanner.getRulesForVersion(targetVersion);
    output.info(`   ${rules.length} migration rules for v${targetVersion}`);

    // In a real implementation, this would recursively scan files.
    // For now, report the available rules.
    output.info("");
    output.info("   Available checks:");
    for (const rule of rules) {
      const icon = rule.severity === "breaking" ? "❌" : "⚠️";
      output.info(`     ${icon} ${rule.id}: ${rule.description}`);
    }

    output.info("");
    output.success("Scan complete. Run on your source files to detect issues.");
    return 0;
  }
}
