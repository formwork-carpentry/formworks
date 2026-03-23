import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, relative, posix } from "node:path";

const root = process.cwd();
const srcRoot = join(root, "formworks", "src");

const tier1 = new Set([
  "core",
  "http",
  "foundation",
  "auth",
  "orm",
  "db",
  "validation",
  "events",
  "session",
  "log",
  "cache",
  "queue",
  "mail",
  "storage",
  "bridge",
  "resilience",
  "scheduler",
  "flags",
  "notifications",
  "tenancy",
  "i18n",
  "ui",
  "helpers",
  "http-client",
  "media",
  "encrypt",
  "testing",
  "faker",
  "crypto",
  "number",
  "pipeline",
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...walk(abs));
      continue;
    }
    if (name.endsWith(".ts")) {
      out.push(abs);
    }
  }
  return out;
}

function normalizeRelative(fromFile, toPathNoExt) {
  const rel = relative(dirname(fromFile), toPathNoExt).replaceAll("\\", "/");
  if (rel.startsWith(".")) return rel;
  return `./${rel}`;
}

function rewriteSpecifier(filePath, specifier) {
  if (!specifier.startsWith("@carpentry/")) {
    return specifier;
  }

  const remainder = specifier.slice("@carpentry/".length);
  const parts = remainder.split("/");
  const moduleName = parts[0] ?? "";
  if (!tier1.has(moduleName)) {
    return specifier;
  }

  const subpath = parts.slice(1).join("/");
  const target = subpath.length > 0
    ? posix.join(srcRoot.replaceAll("\\", "/"), moduleName, subpath)
    : posix.join(srcRoot.replaceAll("\\", "/"), moduleName);

  return normalizeRelative(filePath, target);
}

const files = walk(srcRoot);
for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;

  after = after.replace(/(from\s+["'])([^"']+)(["'])/g, (m, p1, spec, p3) => {
    return `${p1}${rewriteSpecifier(file, spec)}${p3}`;
  });

  after = after.replace(/(import\s*\(\s*["'])([^"']+)(["']\s*\))/g, (m, p1, spec, p3) => {
    return `${p1}${rewriteSpecifier(file, spec)}${p3}`;
  });

  if (after !== before) {
    writeFileSync(file, after, "utf8");
  }
}

console.log(`Updated imports in ${files.length} files.`);
