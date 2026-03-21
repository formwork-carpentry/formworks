/**
 * @module @formwork/edge
 * @description Edge middleware — geo-routing, A/B testing, bot detection.
 *
 * @example
 * ```ts
 * // Geo-routing: redirect based on country
 * const geo = edgeGeo({ routes: { US: '/us', DE: '/de', default: '/global' } });
 *
 * // A/B testing: assign variant by cookie
 * const ab = edgeABTest({ name: 'checkout', variants: ['control', 'new-flow'], cookie: 'ab_checkout' });
 *
 * // Bot detection: block known bots
 * const bot = edgeBotGuard({ action: 'block', allowList: ['googlebot'] });
 * ```
 */

import type { EdgeMiddleware, EdgeRequest } from "@formwork/core/contracts";

// ── Geo-Routing ───────────────────────────────────────────

/**
 * @typedef {Object} GeoRouteConfig
 * @property {Record<string, string>} routes - Country code to path mapping
 * @property {string} [headerName='cf-ipcountry'] - Header containing country code
 */
export interface GeoRouteConfig {
  routes: Record<string, string>;
  headerName?: string;
}

/**
 * Edge middleware that redirects requests based on geographic location.
 *
 * @param {GeoRouteConfig} config - Route configuration
 * @returns {EdgeMiddleware} Middleware function
 *
 * @example
 * ```ts
 * const geo = edgeGeo({
 *   routes: { US: '/en-us', DE: '/de', FR: '/fr', default: '/en' },
 *   headerName: 'cf-ipcountry',
 * });
 * ```
 */
export function edgeGeo(config: GeoRouteConfig): EdgeMiddleware {
  const header = config.headerName ?? "cf-ipcountry";

  return async (req, next) => {
    const country = (req.headers[header] ?? req.headers[header.toLowerCase()] ?? "").toUpperCase();
    const target = config.routes[country] ?? config.routes.default;

    if (target && !req.url.startsWith(target)) {
      return { status: 302, headers: { location: target + req.url }, body: "" };
    }
    return next(req);
  };
}

// ── A/B Testing ───────────────────────────────────────────

/**
 * @typedef {Object} ABTestConfig
 * @property {string} name - Experiment name
 * @property {string[]} variants - Variant names (e.g., ['control', 'treatment'])
 * @property {string} [cookie] - Cookie name for sticky assignment
 * @property {number[]} [weights] - Weight per variant (must sum to 1.0)
 */
export interface ABTestConfig {
  name: string;
  variants: string[];
  cookie?: string;
  weights?: number[];
}

/**
 * @typedef {Object} ABTestResult
 * @property {string} variant - Assigned variant name
 * @property {string} experiment - Experiment name
 * @property {boolean} isNew - True if this is a new assignment (not from cookie)
 */
export interface ABTestResult {
  variant: string;
  experiment: string;
  isNew: boolean;
}

/**
 * Edge middleware that assigns users to A/B test variants.
 * Uses a cookie for sticky assignment (same user always sees same variant).
 *
 * @param {ABTestConfig} config - Experiment configuration
 * @returns {EdgeMiddleware} Middleware that sets x-ab-variant header + cookie
 *
 * @example
 * ```ts
 * const ab = edgeABTest({
 *   name: 'new-checkout',
 *   variants: ['control', 'new-flow'],
 *   weights: [0.5, 0.5],
 * });
 * // Response will have:
 * //   x-ab-variant: new-checkout=control (or new-flow)
 * //   set-cookie: ab_new-checkout=control; Path=/; Max-Age=2592000
 * ```
 */
export function edgeABTest(config: ABTestConfig): EdgeMiddleware {
  const cookieName = config.cookie ?? `ab_${config.name}`;
  const weights = config.weights ?? config.variants.map(() => 1 / config.variants.length);

  return async (req, next) => {
    const cookies = parseCookies(req.headers.cookie ?? "");
    let variant = cookies[cookieName];
    let isNew = false;

    if (!variant || !config.variants.includes(variant)) {
      variant = pickVariant(config.variants, weights);
      isNew = true;
    }

    req.headers["x-ab-variant"] = `${config.name}=${variant}`;

    const response = await next(req);
    response.headers["x-ab-variant"] = `${config.name}=${variant}`;

    if (isNew) {
      response.headers["set-cookie"] =
        `${cookieName}=${variant}; Path=/; Max-Age=2592000; SameSite=Lax`;
    }

    return response;
  };
}

/**
 * Resolve the A/B variant from a request (for use in route handlers).
 *
 * @param {EdgeRequest} req - The request
 * @param {string} experimentName - Experiment name
 * @returns {ABTestResult} The assigned variant
 */
export function resolveABVariant(req: EdgeRequest, experimentName: string): ABTestResult {
  const header = req.headers["x-ab-variant"] ?? "";
  const match = header.match(new RegExp(`${experimentName}=(\\w+)`));
  return {
    variant: match ? match[1] : "control",
    experiment: experimentName,
    isNew: false,
  };
}

// ── Bot Detection ─────────────────────────────────────────

/**
 * @typedef {Object} BotGuardConfig
 * @property {'block' | 'flag'} [action='block'] - Block bots or just flag them
 * @property {string[]} [allowList] - Bots to allow (e.g., ['googlebot', 'bingbot'])
 * @property {string} [blockMessage] - Custom block response body
 */
export interface BotGuardConfig {
  action?: "block" | "flag";
  allowList?: string[];
  blockMessage?: string;
}

const KNOWN_BOTS = [
  "bot",
  "crawler",
  "spider",
  "scraper",
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "ahrefsbot",
  "semrushbot",
  "dotbot",
  "mj12bot",
  "yandexbot",
  "baiduspider",
  "sogou",
  "exabot",
  "facebot",
];

/**
 * Edge middleware that detects and blocks (or flags) bot traffic.
 *
 * @param {BotGuardConfig} [config] - Bot guard configuration
 * @returns {EdgeMiddleware} Middleware function
 *
 * @example
 * ```ts
 * const guard = edgeBotGuard({ action: 'block', allowList: ['googlebot', 'bingbot'] });
 * ```
 */
export function edgeBotGuard(config: BotGuardConfig = {}): EdgeMiddleware {
  const action = config.action ?? "block";
  const allowList = (config.allowList ?? ["googlebot", "bingbot"]).map((b) => b.toLowerCase());
  const blockBody = config.blockMessage ?? '{"error":"Forbidden"}';

  return async (req, next) => {
    const ua = (req.headers["user-agent"] ?? "").toLowerCase();
    const isBot = KNOWN_BOTS.some((bot) => ua.includes(bot));
    const isAllowed = allowList.some((bot) => ua.includes(bot));

    if (isBot && !isAllowed) {
      if (action === "block") {
        return { status: 403, headers: { "content-type": "application/json" }, body: blockBody };
      }
      req.headers["x-bot-detected"] = "true";
    }

    return next(req);
  };
}

// ── Helpers ───────────────────────────────────────────────

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.split("=");
    if (key) cookies[key.trim()] = rest.join("=").trim();
  }
  return cookies;
}

function pickVariant(variants: string[], weights: number[]): string {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return variants[i];
  }
  return variants[variants.length - 1];
}
