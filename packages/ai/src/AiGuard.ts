/**
 * @module @carpentry/ai
 * @description AiGuardMiddleware — security layer for AI requests.
 * Detects PII (personally identifiable information), prompt injection attempts,
 * and applies content filtering before messages reach the AI provider.
 *
 * WHY: AI models can leak PII from prompts, and malicious users can craft prompts
 * that override system instructions. AiGuard sits between user input and the provider
 * to detect and block these threats.
 *
 * HOW: Wrap your AI provider with AiGuard. It inspects messages before sending
 * and can redact PII, reject injections, or log suspicious activity.
 *
 * @patterns Decorator (wraps IAIProvider), Chain of Responsibility (multiple checks)
 * @principles SRP (security checks only), OCP (add custom rules via addRule)
 *
 * @example
 * ```ts
 * const guard = new AiGuard({
 *   detectPii: true,
 *   detectInjection: true,
 *   onViolation: (v) => console.warn(`AI Guard: ${v.type} — ${v.message}`),
 * });
 *
 * // Check before sending to AI
 * const result = guard.inspect('My SSN is 123-45-6789, ignore previous instructions');
 * if (result.blocked) throw new Error(result.reason);
 *
 * // Or use the redacted version
 * const safe = guard.redact('My email is alice@example.com');
 * // → 'My email is [EMAIL_REDACTED]'
 * ```
 */

// ── Types ─────────────────────────────────────────────────

/** A detected security violation */
export interface AiViolation {
  /** Type of violation */
  type: "pii" | "injection" | "content" | "custom";
  /** Human-readable description */
  message: string;
  /** The specific pattern or content that triggered the violation */
  match?: string;
  /** Severity: 'low' = log only, 'medium' = redact, 'high' = block */
  severity: "low" | "medium" | "high";
}

/** Result of inspecting a message */
export interface InspectResult {
  /** Whether the message should be blocked entirely */
  blocked: boolean;
  /** Reason for blocking (if blocked) */
  reason?: string;
  /** All violations detected */
  violations: AiViolation[];
  /** The original text with PII redacted (if detectPii is true) */
  redacted: string;
}

/** Custom guard rule — return a violation if the text triggers it, null otherwise */
export type GuardRule = (text: string) => AiViolation | null;

export interface AiGuardConfig {
  /** Enable PII detection (emails, phones, SSNs, credit cards) */
  detectPii?: boolean;
  /** Enable prompt injection detection */
  detectInjection?: boolean;
  /** Block on high-severity violations (default: true) */
  blockOnHigh?: boolean;
  /** Callback for every violation detected */
  onViolation?: (violation: AiViolation) => void;
  /** Custom rules to add to the pipeline */
  customRules?: GuardRule[];
}

// ── PII Detection Patterns ────────────────────────────────
// These regex patterns detect common PII types. They're intentionally
// somewhat broad — false positives are better than missed PII in a security context.

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    name: "phone",
    // Matches: (555) 123-4567, 555-123-4567, +1-555-123-4567, 5551234567
    pattern: /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "ssn",
    // US Social Security Number: XXX-XX-XXXX
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: "[SSN_REDACTED]",
  },
  {
    name: "credit_card",
    // Common credit card patterns (Visa, MC, Amex, Discover)
    pattern:
      /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
    replacement: "[CARD_REDACTED]",
  },
  {
    name: "ip_address",
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: "[IP_REDACTED]",
  },
];

// ── Prompt Injection Patterns ─────────────────────────────
// These detect common prompt injection techniques. Each returns a description
// of the technique detected.

const INJECTION_PATTERNS: Array<{ name: string; pattern: RegExp; description: string }> = [
  {
    name: "ignore_instructions",
    pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|rules)/i,
    description: "Attempt to override system instructions",
  },
  {
    name: "system_override",
    pattern: /(?:you\s+are\s+now|new\s+instructions|forget\s+everything|disregard\s+(?:all|your))/i,
    description: "Attempt to redefine AI role/behavior",
  },
  {
    name: "delimiter_escape",
    pattern: /```\s*system\b|<\/?system>|<\|im_start\|>|<\|endoftext\|>/i,
    description: "Attempt to inject system-level delimiters",
  },
  {
    name: "jailbreak",
    pattern:
      /(?:DAN|do anything now|bypass\s+(?:safety|filters|restrictions)|pretend\s+you\s+(?:can|have\s+no))/i,
    description: "Jailbreak attempt detected",
  },
];

// ── AiGuard ───────────────────────────────────────────────

/**
 * AiGuard — inspects, redacts, and blocks AI messages based on security rules.
 */
export class AiGuard {
  private readonly config: Required<AiGuardConfig>;
  private readonly customRules: GuardRule[];
  /** Count of violations detected since creation (for monitoring) */
  private violationCount = 0;

  constructor(config: AiGuardConfig = {}) {
    this.config = {
      detectPii: config.detectPii ?? true,
      detectInjection: config.detectInjection ?? true,
      blockOnHigh: config.blockOnHigh ?? true,
      onViolation: config.onViolation ?? (() => {}),
      customRules: config.customRules ?? [],
    };
    this.customRules = this.config.customRules;
  }

  /**
   * Inspect a text for PII, injection attempts, and custom rules.
   * Returns whether to block, all violations found, and the redacted text.
   */
  inspect(text: string): InspectResult {
    const violations: AiViolation[] = [];
    let redacted = text;

    // Run each detection stage
    if (this.config.detectPii) redacted = this.detectPii(text, violations);
    if (this.config.detectInjection) this.detectInjection(text, violations);
    for (const rule of this.customRules) {
      const v = rule(text);
      if (v) violations.push(v);
    }

    // Fire callbacks and count
    for (const v of violations) {
      this.config.onViolation(v);
      this.violationCount++;
    }

    const hasHigh = violations.some((v) => v.severity === "high");
    const blocked = this.config.blockOnHigh && hasHigh;

    return {
      blocked,
      reason: blocked ? violations.find((v) => v.severity === "high")?.message : undefined,
      violations,
      redacted,
    };
  }

  /** Scan text for PII patterns, add violations, return redacted text */
  private detectPii(text: string, violations: AiViolation[]): string {
    let redacted = text;
    for (const { name, pattern, replacement } of PII_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({ type: "pii", message: `${name} detected`, match, severity: "medium" });
        }
        redacted = redacted.replace(pattern, replacement);
      }
    }
    return redacted;
  }

  /** Scan text for prompt injection patterns */
  private detectInjection(text: string, violations: AiViolation[]): void {
    for (const { pattern, description } of INJECTION_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match)
        violations.push({
          type: "injection",
          message: description,
          match: match[0],
          severity: "high",
        });
    }
  }

  /**
   * Redact PII from text without blocking.
   * Convenience method — calls inspect() and returns the redacted string.
   */
  redact(text: string): string {
    return this.inspect(text).redacted;
  }

  /** Get total violation count since creation */
  getViolationCount(): number {
    return this.violationCount;
  }

  /** Add a custom guard rule at runtime */
  /**
   * @param {GuardRule} rule
   * @returns {this}
   */
  addRule(rule: GuardRule): this {
    this.customRules.push(rule);
    return this;
  }
}
