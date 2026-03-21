/**
 * @module @formwork/edge
 * @description Edge middleware — geo-routing, A/B testing, and bot detection.
 *
 * All middleware follows the EdgeMiddleware signature:
 *   (req, next) => Promise<EdgeResponse>
 *
 * @example
 * ```ts
 * const kernel = new EdgeKernel();
 * kernel.use(edgeBotGuard());
 * kernel.use(edgeGeo({ routes: { US: '/us', EU: '/eu' } }));
 * kernel.use(edgeABTest({ experiment: 'new-checkout', variants: ['control', 'variant-a'] }));
 * ```
 */

import type { EdgeMiddleware, EdgeRequest } from "@formwork/core/contracts";

// ── Geo-Routing ───────────────────────────────────────────

/** @typedef {Object} GeoConfig */
export interface GeoConfig {
  /** @property {Record<string, string>} routes - Country code to redirect path */
  routes: Record<string, string>;
  /** @property {string} [headerName='cf-ipcountry'] - Header containing country code */
  headerName?: string;
  /** @property {string} [fallback] - Default path if country not in routes */
  fallback?: string;
}

/**
 * Geo-routing middleware — redirects users based on their country.
 *
 * @param {GeoConfig} config - Routing configuration
 * @returns {EdgeMiddleware} Middleware function
 *
 * @example
 * ```ts
 * edgeGeo({
 *   routes: { US: '/us', GB: '/uk', DE: '/de', FR: '/fr' },
 *   fallback: '/en',
 *   headerName: 'cf-ipcountry',
 * });
 * // Request from Germany -> redirects to /de
 * ```
 */
export function edgeGeo(config: GeoConfig): EdgeMiddleware {
  const headerName = config.headerName ?? "cf-ipcountry";
  return async (req: EdgeRequest, next) => {
    const country = (req.headers[headerName] ?? "").toUpperCase();
    const target = config.routes[country];
    const pathname = new URL(req.url).pathname;

    if (target && !pathname.startsWith(target)) {
      return {
        status: 302,
        headers: { location: target + pathname },
        body: "",
      };
    }

    if (!target && config.fallback && !pathname.startsWith(config.fallback)) {
      return {
        status: 302,
        headers: { location: config.fallback + pathname },
        body: "",
      };
    }

    return next(req);
  };
}

// ── A/B Testing ───────────────────────────────────────────

/** @typedef {Object} ABTestConfig */
export interface ABTestConfig {
  /** @property {string} experiment - Experiment name */
  experiment: string;
  /** @property {string[]} variants - Variant names (e.g., ['control', 'variant-a', 'variant-b']) */
  variants: string[];
  /** @property {number[]} [weights] - Weights per variant (default: equal distribution) */
  weights?: number[];
  /** @property {string} [cookieName] - Cookie name for sticky assignment (default: 'ab-{experiment}') */
  cookieName?: string;
  /** @property {number} [cookieMaxAge=2592000] - Cookie max age in seconds (default: 30 days) */
  cookieMaxAge?: number;
}

/**
 * A/B testing middleware — assigns users to experiment variants via sticky cookies.
 *
 * @param {ABTestConfig} config - Experiment configuration
 * @returns {EdgeMiddleware} Middleware function
 *
 * @example
 * ```ts
 * edgeABTest({
 *   experiment: 'new-checkout',
 *   variants: ['control', 'variant-a'],
 *   weights: [50, 50],
 * });
 * // First request: assigns variant via cookie, adds x-ab-variant header
 * // Subsequent requests: reads cookie, keeps same variant (sticky)
 * ```
 */
export function edgeABTest(config: ABTestConfig): EdgeMiddleware {
  const cookieName = config.cookieName ?? `ab-${config.experiment}`;
  const maxAge = config.cookieMaxAge ?? 2592000;
  const weights = config.weights ?? config.variants.map(() => 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  return async (req: EdgeRequest, next) => {
    // Check for existing assignment
    const cookies = parseCookies(req.headers.cookie ?? "");
    let variant = cookies[cookieName];

    if (!variant || !config.variants.includes(variant)) {
      variant = pickVariant(config.variants, weights, totalWeight);
    }

    // Add variant to request headers for downstream handlers
    req.headers["x-ab-experiment"] = config.experiment;
    req.headers["x-ab-variant"] = variant;

    const response = await next(req);

    // Set sticky cookie
    response.headers["set-cookie"] =
      `${cookieName}=${variant}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    response.headers["x-ab-variant"] = variant;

    return response;
  };
}

// ── Bot Detection ─────────────────────────────────────────

/** @typedef {Object} BotGuardConfig */
export interface BotGuardConfig {
  /** @property {string[]} [blockedAgents] - User-agent patterns to block */
  blockedAgents?: string[];
  /** @property {boolean} [allowSearchEngines=true] - Allow Google/Bing bots */
  allowSearchEngines?: boolean;
  /** @property {number} [blockStatus=403] - HTTP status for blocked requests */
  blockStatus?: number;
}

const DEFAULT_BLOCKED = [
  "ahrefsbot",
  "semrushbot",
  "dotbot",
  "mj12bot",
  "blexbot",
  "petalbot",
  "bytespider",
  "gptbot",
  "ccbot",
  "claudebot",
];

const SEARCH_ENGINES = ["googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot"];

/**
 * Bot detection middleware — blocks known scraper/crawler bots.
 *
 * @param {BotGuardConfig} [config] - Guard configuration
 * @returns {EdgeMiddleware} Middleware function
 *
 * @example
 * ```ts
 * edgeBotGuard({ allowSearchEngines: true, blockStatus: 403 });
 * // Blocks AhrefsBot, SEMrushBot, etc.
 * // Allows Googlebot, Bingbot
 * ```
 */
export function edgeBotGuard(config: BotGuardConfig = {}): EdgeMiddleware {
  const blocked = (config.blockedAgents ?? DEFAULT_BLOCKED).map((a) => a.toLowerCase());
  const allowSearch = config.allowSearchEngines ?? true;
  const blockStatus = config.blockStatus ?? 403;

  return async (req: EdgeRequest, next) => {
    const ua = (req.headers["user-agent"] ?? "").toLowerCase();

    if (!ua) return next(req);

    const isBlocked = blocked.some((bot) => ua.includes(bot));
    const isSearchEngine = SEARCH_ENGINES.some((se) => ua.includes(se));

    if (isBlocked && !(allowSearch && isSearchEngine)) {
      return { status: blockStatus, headers: { "content-type": "text/plain" }, body: "Forbidden" };
    }

    return next(req);
  };
}

// ── Helpers ───────────────────────────────────────────────

/**
 * Parse a cookie header string into key-value pairs.
 * @param {string} header - Cookie header value
 * @returns {Record<string, string>}
 */
function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key.trim()] = rest.join("=").trim();
  }
  return cookies;
}

/**
 * Pick a variant based on weighted random selection.
 * @param {string[]} variants - Variant names
 * @param {number[]} weights - Weights
 * @param {number} total - Total weight
 * @returns {string} Selected variant
 */
function pickVariant(variants: string[], weights: number[], total: number): string {
  let r = Math.random() * total;
  for (let i = 0; i < variants.length; i++) {
    r -= weights[i];
    if (r <= 0) return variants[i];
  }
  return variants[variants.length - 1];
}
