/**
 * @module @formwork/auth
 * @description JwtGuard — stateless JWT authentication using HMAC-SHA256
 * @patterns Strategy (implements IAuthGuard), Factory (token creation)
 * @principles SRP (JWT auth only), DIP (depends on IUserProvider interface)
 */

import type {
  AuthCredentials,
  IAuthGuard,
  IAuthenticatable,
  IUserProvider,
} from "@formwork/core/contracts";

/** JWT configuration options */
export interface JwtConfig {
  /** HMAC secret key (minimum 32 characters recommended) */
  secret: string;
  /** Token expiration in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Token issuer claim */
  issuer?: string;
  /** Token audience claim */
  audience?: string;
}

/** Decoded JWT payload */
export interface JwtPayload {
  sub: string | number;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/** JWT verification result */
export interface JwtVerifyResult {
  valid: boolean;
  payload: JwtPayload | null;
  error?: string;
}

// ── HMAC-SHA256 JWT implementation (Web Crypto API) ───────

function base64UrlEncode(data: Uint8Array | string): string {
  const str = typeof data === "string" ? btoa(data) : btoa(String.fromCharCode(...data));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(header: string, payload: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return base64UrlEncode(new Uint8Array(sig));
}

async function verify(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  /**
   * @param {unknown} [parts.length !== 3]
   */
  if (parts.length !== 3) return false;
  const key = await importKey(secret);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sigBytes = Uint8Array.from(base64UrlDecode(parts[2]), (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sigBytes, data);
}

// ── Token creation and parsing ────────────────────────────

/** Create a signed JWT token */
/**
 * @param {Object} payload
 * @param {JwtConfig} config
 * @returns {Promise<string>}
 */
export async function createToken(
  payload: Record<string, unknown>,
  config: JwtConfig,
): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);

  const claims: JwtPayload = {
    ...payload,
    sub: payload.sub as string | number,
    iat: now,
    exp: now + (config.expiresIn ?? 3600),
    ...(config.issuer ? { iss: config.issuer } : {}),
    ...(config.audience ? { aud: config.audience } : {}),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signature = await sign(header, encodedPayload, config.secret);
  return `${header}.${encodedPayload}.${signature}`;
}

/** Verify and decode a JWT token */
/**
 * @param {string} token
 * @param {JwtConfig} config
 * @returns {Promise<JwtVerifyResult>}
 */
export async function verifyToken(token: string, config: JwtConfig): Promise<JwtVerifyResult> {
  const valid = await verify(token, config.secret);
  /**
   * @param {unknown} !valid
   */
  if (!valid) return { valid: false, payload: null, error: "Invalid signature" };

  const parts = token.split(".");
  const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;

  const now = Math.floor(Date.now() / 1000);
  /**
   * @param {unknown} payload.exp && payload.exp < now
   */
  if (payload.exp && payload.exp < now) {
    return { valid: false, payload, error: "Token expired" };
  }

  /**
   * @param {unknown} [config.issuer && payload.iss !== config.issuer]
   */
  if (config.issuer && payload.iss !== config.issuer) {
    return { valid: false, payload, error: "Invalid issuer" };
  }

  /**
   * @param {unknown} [config.audience && payload.aud !== config.audience]
   */
  if (config.audience && payload.aud !== config.audience) {
    return { valid: false, payload, error: "Invalid audience" };
  }

  return { valid: true, payload };
}

// ── JwtGuard ──────────────────────────────────────────────

/**
 * Stateless JWT authentication guard.
 *
 * @example
 * ```ts
 * const guard = new JwtGuard(userProvider, { secret: 'my-secret-key' });
 *
 * // Login: returns a token
 * const token = await guard.attempt({ email: 'user@example.com', password: 'secret' });
 *
 * // Authenticate from token
 * await guard.authenticateToken('eyJhbG...');
 * const user = await guard.user();
 * ```
 */
export class JwtGuard implements IAuthGuard {
  private currentUser: IAuthenticatable | null = null;
  private currentToken: string | null = null;

  constructor(
    private readonly provider: IUserProvider,
    private readonly config: JwtConfig,
  ) {}

  async user<T = unknown>(): Promise<T | null> {
    return this.currentUser as T | null;
  }

  async check(): Promise<boolean> {
    return this.currentUser !== null;
  }

  async guest(): Promise<boolean> {
    return this.currentUser === null;
  }

  async id(): Promise<string | number | null> {
    return this.currentUser?.getAuthIdentifier() ?? null;
  }

  /**
   * @param {IAuthenticatable} user
   * @returns {Promise<void>}
   */
  async login(user: IAuthenticatable): Promise<void> {
    this.currentUser = user;
    this.currentToken = await createToken({ sub: user.getAuthIdentifier() }, this.config);
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    this.currentToken = null;
  }

  /**
   * Attempt to authenticate with credentials.
   * On success, generates a JWT token accessible via getToken().
   */
  async attempt(credentials: AuthCredentials): Promise<boolean> {
    const user = await this.provider.findByCredentials(credentials);
    if (!user) return false;

    const password = credentials.password as string | undefined;
    if (!password) return false;

    const valid = await this.provider.validateCredentials(user, credentials);
    if (!valid) return false;

    await this.login(user);
    return true;
  }

  /**
   * Authenticate from a JWT token string.
   * Verifies the token and loads the user from the provider.
   */
  async authenticateToken(token: string): Promise<boolean> {
    const result = await verifyToken(token, this.config);
    if (!result.valid || !result.payload) return false;

    const user = await this.provider.findById(result.payload.sub);
    if (!user) return false;

    this.currentUser = user;
    this.currentToken = token;
    return true;
  }

  /** Get the current JWT token (after login or authenticateToken) */
  getToken(): string | null {
    return this.currentToken;
  }
}
