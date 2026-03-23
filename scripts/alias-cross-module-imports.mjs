import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const root = process.cwd();
const srcRoot = resolve(root, "formworks", "src");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...walk(abs));
    else if (name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

function toAliasPath(absPathNoExt) {
  const rel = relative(srcRoot, absPathNoExt).replaceAll("\\", "/");
  const trimmed = rel.endsWith("/index") ? rel.slice(0, -"/index".length) : rel;
  return `@carpentry/formworks/${trimmed}`;
}

function rewrite(file, spec) {
  if (!spec.startsWith("../..")) return spec;

  const sourceRel = relative(srcRoot, file).replaceAll("\\", "/");
  const sourceModule = sourceRel.split("/")[0] ?? "";

  const resolved = normalize(resolve(dirname(file), spec));
  if (!resolved.startsWith(srcRoot)) return spec;

  const targetRel = relative(srcRoot, resolved).replaceAll("\\", "/");
  const targetModule = targetRel.split("/")[0] ?? "";
  if (!targetModule || targetModule === sourceModule) {
    return spec;
  }

  return toAliasPath(resolved);
}

const files = walk(srcRoot);
let touched = 0;
for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;

  after = after.replace(/(from\s+["'])([^"']+)(["'])/g, (m, p1, spec, p3) => `${p1}${rewrite(file, spec)}${p3}`);
  after = after.replace(/(import\s*\(\s*["'])([^"']+)(["']\s*\))/g, (m, p1, spec, p3) => `${p1}${rewrite(file, spec)}${p3}`);

  if (after !== before) {
    touched += 1;
    writeFileSync(file, after, "utf8");
  }
}

console.log(`Aliased cross-module imports in ${touched} files.`);
