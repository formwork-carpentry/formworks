import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const testsRoot = join(root, "tests");

const EXEMPT_TOP_LEVEL = new Set(["integration", "examples", "starters", "support"]);

function walkTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...walkTests(abs));
      continue;
    }
    if (name.endsWith(".test.ts")) {
      out.push(abs);
    }
  }
  return out;
}

function collectDomains(content) {
  const domains = new Set();

  const aliasPattern = /@carpentry\/formworks\/([a-zA-Z0-9_-]+)/g;
  const srcPathPattern = /src\/([a-zA-Z0-9_-]+)\//g;

  for (const match of content.matchAll(aliasPattern)) {
    if (match[1]) domains.add(match[1]);
  }

  for (const match of content.matchAll(srcPathPattern)) {
    if (match[1]) domains.add(match[1]);
  }

  return domains;
}

const allTests = walkTests(testsRoot);
const mismatches = [];
let inspected = 0;
let skipped = 0;

for (const file of allTests) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const parts = rel.split("/");
  const topLevel = parts[1];

  if (!topLevel || EXEMPT_TOP_LEVEL.has(topLevel)) {
    skipped += 1;
    continue;
  }

  const content = readFileSync(file, "utf8");
  const domains = collectDomains(content);

  // If no formworks-domain imports are present, we cannot infer ownership reliably.
  if (domains.size === 0) {
    skipped += 1;
    continue;
  }

  inspected += 1;

  const domainList = [...domains].sort();
  const isSingleDomain = domainList.length === 1;
  const matchesFolder = isSingleDomain && domainList[0] === topLevel;

  if (!matchesFolder) {
    mismatches.push({
      file: rel,
      folder: topLevel,
      domains: domainList,
    });
  }
}

if (mismatches.length > 0) {
  console.error("Test mirroring check failed.");
  console.error("Policy: tests/<domain>/*.test.ts must target exactly one @carpentry/formworks domain and match <domain>.");
  console.error("Use tests/integration for intentional cross-domain scenarios.");
  console.error("");

  for (const item of mismatches) {
    console.error(`- ${item.file}`);
    console.error(`  folder: ${item.folder}`);
    console.error(`  domains: ${item.domains.join(", ")}`);
  }

  process.exit(1);
}

console.log(
  `Test mirroring check passed (${inspected} inspected, ${skipped} skipped by policy/exemption).`,
);
