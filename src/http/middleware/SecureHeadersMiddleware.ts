/**
 * @module @carpentry/http
 * @description Security headers middleware — sets X-Frame-Options, CSP, HSTS, etc.
 * @patterns Strategy (configurable header sets)
 * @principles OCP (extend via config), SRP (only security headers)
 */

import type { Request as CarpenterRequest } from "../request/Request.js";
import type { CarpenterResponse } from "../response/Response.js";

/** Configuration for SecureHeaders middleware */
export interface SecureHeadersConfig {
  frameOptions?: string;
  contentSecurityPolicy?: Record<string, string[]> | false;
  hsts?: { maxAge: number; includeSubDomains?: boolean; preload?: boolean } | false;
  contentTypeOptions?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: Record<string, string[]> | false;
  crossOriginOpenerPolicy?: string;
  crossOriginEmbedderPolicy?: string;
  crossOriginResourcePolicy?: string;
  customHeaders?: Record<string, string>;
  cspNonce?: boolean;
}

const DEFAULT_CONFIG: SecureHeadersConfig = {
  frameOptions: "SAMEORIGIN",
  contentSecurityPolicy: {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-ancestors": ["'self'"],
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
  cspNonce: false,
};

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildCspHeader(directives: Record<string, string[]>, nonce?: string): string {
  const parts: string[] = [];
  /**
   * @param {unknown} const [directive
   * @param {unknown} values] of Object.entries(directives
   */
  for (const [directive, values] of Object.entries(directives)) {
    const vals = [...values];
    if (nonce && (directive === "script-src" || directive === "style-src")) {
      vals.push(`'nonce-${nonce}'`);
    }
    parts.push(`${directive} ${vals.join(" ")}`);
  }
  return parts.join("; ");
}

function buildHstsHeader(cfg: {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}): string {
  let value = `max-age=${cfg.maxAge}`;
  /**
   * @param {unknown} cfg.includeSubDomains
   */
  if (cfg.includeSubDomains) value += "; includeSubDomains";
  /**
   * @param {unknown} cfg.preload
   */
  if (cfg.preload) value += "; preload";
  return value;
}

function buildPermissionsPolicy(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([f, a]) => (a.length === 0 ? `${f}=()` : `${f}=(${a.join(" ")})`))
    .join(", ");
}

export type NextFn = (req: CarpenterRequest) => Promise<CarpenterResponse>;

/**
 * Applies CSP, HSTS, frame options, and related headers to every response from `next(request)`.
 *
 * @example
 * ```ts
 * import { SecureHeadersMiddleware } from '..';
 * const mw = new SecureHeadersMiddleware({ frameOptions: 'DENY' });
 * ```
 */
export class SecureHeadersMiddleware {
  private readonly config: SecureHeadersConfig;

  constructor(config: Partial<SecureHeadersConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * @param {CarpenterRequest} request
   * @param {NextFn} next
   * @returns {Promise<CarpenterResponse>}
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each security header is an independent optional feature branch
  async handle(request: CarpenterRequest, next: NextFn): Promise<CarpenterResponse> {
    let nonce: string | undefined;
    if (this.config.cspNonce) {
      nonce = generateNonce();
      (request as unknown as Record<string, unknown>).cspNonce = nonce;
    }

    const response = await next(request);
    const c = this.config;

    if (c.frameOptions) response.header("X-Frame-Options", c.frameOptions);

    if (c.contentSecurityPolicy !== false && c.contentSecurityPolicy) {
      response.header("Content-Security-Policy", buildCspHeader(c.contentSecurityPolicy, nonce));
    }

    if (c.hsts !== false && c.hsts) {
      response.header("Strict-Transport-Security", buildHstsHeader(c.hsts));
    }

    if (c.contentTypeOptions) response.header("X-Content-Type-Options", "nosniff");
    if (c.xssProtection) response.header("X-XSS-Protection", "1; mode=block");
    if (c.referrerPolicy) response.header("Referrer-Policy", c.referrerPolicy);

    if (c.permissionsPolicy !== false && c.permissionsPolicy) {
      response.header("Permissions-Policy", buildPermissionsPolicy(c.permissionsPolicy));
    }

    if (c.crossOriginOpenerPolicy)
      response.header("Cross-Origin-Opener-Policy", c.crossOriginOpenerPolicy);
    if (c.crossOriginEmbedderPolicy)
      response.header("Cross-Origin-Embedder-Policy", c.crossOriginEmbedderPolicy);
    if (c.crossOriginResourcePolicy)
      response.header("Cross-Origin-Resource-Policy", c.crossOriginResourcePolicy);

    if (c.customHeaders) {
      for (const [name, value] of Object.entries(c.customHeaders)) {
        response.header(name, value);
      }
    }

    return response;
  }
}
