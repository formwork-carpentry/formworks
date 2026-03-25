/**
 * @module @carpentry/http/route-gauger
 * @description Utilities for generating typed route references and route manifest files.
 */

import type { HttpMethod, IRoute } from "@carpentry/formworks/contracts";

/** Supported route parameter value types for URL generation. */
export type RouteParamValue = string | number | boolean;
/** Runtime map of route parameter names to values. */
export type RouteParams = Record<string, RouteParamValue>;

/**
 * Typed route reference returned by generated route modules.
 */
export interface RouteGaugerReference {
  /** Logical route name, for example posts.show. */
  name: string;
  /** HTTP verb for the route. */
  method: HttpMethod;
  /** Canonical route pattern, including parameter placeholders. */
  path: string;
  /** Resolved href including substituted params and query string. */
  href: string;
  /** Alias of href used by some consumers. */
  url: string;
  /** Parameters used to build the final URL. */
  params: RouteParams;
}

/** Internal manifest entry produced from registered routes. */
export interface RouteGaugerEntry {
  /** Source module file segment used for generated export grouping. */
  moduleName: string;
  /** Export object name generated for the module. */
  exportName: string;
  /** Method name used in the generated route reference object. */
  actionName: string;
  /** Original route name from the router registration. */
  routeName: string;
  /** HTTP verb registered for this route. */
  method: HttpMethod;
  /** Raw route path pattern. */
  path: string;
  /** Parameter keys extracted from the route path. */
  params: string[];
}

/** Generated file payload for route gauger output. */
export interface RouteGaugerFile {
  /** Output file name. */
  fileName: string;
  /** Logical module name represented by the generated file. */
  moduleName: string;
  /** TypeScript source content to write. */
  code: string;
}

/**
 * Builds a typed route reference by resolving path params and query params.
 *
 * @param {string} name Route name.
 * @param {HttpMethod} method HTTP verb.
 * @param {string} path Route path template.
 * @param {RouteParams} [params={}] Route params for path and query values.
 * @returns {RouteGaugerReference} Resolved route reference.
 * @throws {Error} When a required route parameter is missing.
 */
export function defineRouteGaugerReference(
  name: string,
  method: HttpMethod,
  path: string,
  params: RouteParams = {},
): RouteGaugerReference {
  const consumed = new Set<string>();
  const parts = path.split("/").filter(Boolean);
  const builtPath = parts.reduce((accumulator, part) => {
    if (!part.startsWith(":")) {
      return `${accumulator}/${part}`;
    }

    const optional = part.endsWith("?");
    const key = part.slice(1, optional ? -1 : undefined);
    const value = params[key];
    consumed.add(key);

    if (value === undefined) {
      if (optional) {
        return accumulator;
      }
      throw new Error(`Missing required route parameter \"${key}\" for ${name}.`);
    }

    return `${accumulator}/${encodeURIComponent(String(value))}`;
  }, "");

  const hrefPath = builtPath || "/";
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (consumed.has(key)) {
      continue;
    }
    search.append(key, String(value));
  }

  const query = search.toString();
  const href = query ? `${hrefPath}?${query}` : hrefPath;

  return {
    name,
    method,
    path,
    href,
    url: href,
    params,
  };
}

/**
 * Converts runtime routes into an intermediate route gauger manifest.
 *
 * @param {IRoute[]} routes Registered routes.
 * @returns {RouteGaugerEntry[]} Sorted manifest entries.
 */
export function buildRouteGauger(routes: IRoute[]): RouteGaugerEntry[] {
  return routes
    .filter((route): route is IRoute & { name: string } => typeof route.name === "string")
    .map((route) => {
      const params = extractRouteParams(route.path);
      const { moduleName, exportName, actionName } = splitRouteName(route.name);
      return {
        moduleName,
        exportName,
        actionName,
        routeName: route.name,
        method: route.method,
        path: route.path,
        params,
      };
    })
    .sort((left, right) => left.routeName.localeCompare(right.routeName));
}

/**
 * Generates TypeScript file payloads for typed route helper modules.
 *
 * @param {IRoute[]} routes Registered routes.
 * @returns {RouteGaugerFile[]} Generated module and index files.
 */
export function generateRouteGaugerFiles(routes: IRoute[]): RouteGaugerFile[] {
  const manifest = buildRouteGauger(routes);
  const grouped = new Map<string, RouteGaugerEntry[]>();

  for (const entry of manifest) {
    const bucket = grouped.get(entry.moduleName) ?? [];
    bucket.push(entry);
    grouped.set(entry.moduleName, bucket);
  }

  const files: RouteGaugerFile[] = [];
  const moduleNames = [...grouped.keys()].sort((left, right) => left.localeCompare(right));

  for (const moduleName of moduleNames) {
    const entries = grouped.get(moduleName) ?? [];
    const exportName = entries[0]?.exportName ?? moduleName;
    const body = entries
      .sort((left, right) => left.actionName.localeCompare(right.actionName))
      .map((entry) => renderRouteGaugerAction(entry))
      .join("\n\n");

    files.push({
      fileName: `${moduleName}.ts`,
      moduleName,
      code: `import { defineRouteGaugerReference, type RouteGaugerReference } from '@carpentry/formworks/http';\n\nexport const ${exportName} = {\n${body}\n} as const;\n`,
    });
  }

  files.push({
    fileName: "index.ts",
    moduleName: "index",
    code: `${moduleNames.map((moduleName) => `export * from './${moduleName}';`).join("\n")}\n`,
  });

  return files;
}

function renderRouteGaugerAction(entry: RouteGaugerEntry): string {
  const paramsType =
    entry.params.length === 0
      ? ""
      : `params: { ${entry.params.map((param) => `${param}: string | number`).join("; ")} }`;
  const signature =
    paramsType.length === 0 ? "(): RouteGaugerReference" : `(${paramsType}): RouteGaugerReference`;
  const invocation =
    entry.params.length === 0
      ? `defineRouteGaugerReference('${entry.routeName}', '${entry.method}', '${entry.path}')`
      : `defineRouteGaugerReference('${entry.routeName}', '${entry.method}', '${entry.path}', params)`;

  return `  ${entry.actionName}${signature} {\n    return ${invocation};\n  },`;
}

function extractRouteParams(path: string): string[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => segment.slice(1).replace(/\?$/, ""));
}

function splitRouteName(name: string): {
  moduleName: string;
  exportName: string;
  actionName: string;
} {
  const parts = name.split(".");
  const moduleSource = parts[0] ?? "route";
  const actionSource = parts.length === 1 ? "index" : parts.slice(1).join(".");
  const moduleName = toIdentifier(moduleSource);
  return {
    moduleName,
    exportName: moduleName,
    actionName: toIdentifier(actionSource),
  };
}

function toIdentifier(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (normalized.length === 0) {
    return "route";
  }

  return normalized
    .map((segment, index) => {
      const lower = segment.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}
