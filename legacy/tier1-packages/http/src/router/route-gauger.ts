import type { HttpMethod, IRoute } from "@carpentry/core/contracts";

export type RouteParamValue = string | number | boolean;
export type RouteParams = Record<string, RouteParamValue>;

export interface RouteGaugerReference {
  name: string;
  method: HttpMethod;
  path: string;
  href: string;
  url: string;
  params: RouteParams;
}

export interface RouteGaugerEntry {
  moduleName: string;
  exportName: string;
  actionName: string;
  routeName: string;
  method: HttpMethod;
  path: string;
  params: string[];
}

export interface RouteGaugerFile {
  fileName: string;
  moduleName: string;
  code: string;
}

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
    code: moduleNames.map((moduleName) => `export * from './${moduleName}';`).join("\n") + "\n",
  });

  return files;
}

function renderRouteGaugerAction(entry: RouteGaugerEntry): string {
  const paramsType = entry.params.length === 0
    ? ""
    : `params: { ${entry.params.map((param) => `${param}: string | number`).join("; ")} }`;
  const signature = paramsType.length === 0 ? "(): RouteGaugerReference" : `(${paramsType}): RouteGaugerReference`;
  const invocation = entry.params.length === 0
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

function splitRouteName(name: string): { moduleName: string; exportName: string; actionName: string } {
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
