/**
 * JSDoc Upgrade Script — adds @param and @returns tags to all public methods
 * that don't already have them.
 *
 * Usage: node --import tsx scripts/upgrade-jsdoc.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Find all source files missing JSDoc
const files = execSync(
  `find packages -path '*/src/*.ts' -not -path '*/contracts/*' -not -path '*/node_modules/*'`,
  { encoding: 'utf-8' },
).trim().split('\n').filter(Boolean);

let totalUpgraded = 0;
let totalTagsAdded = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const newLines: string[] = [];
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line is a method/function signature that needs JSDoc
    const isExportedFunction = /^export (async )?function \w+/.test(trimmed);
    const isClassMethod = /^  (async )?(get |set )?\w+\s*[\(<]/.test(line) &&
      !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*') &&
      !trimmed.startsWith('private') && !trimmed.startsWith('protected') &&
      !trimmed.startsWith('constructor') && !trimmed.startsWith('static') &&
      (trimmed.includes('(') || trimmed.includes('<'));
    const isExportedClass = /^export (abstract )?class \w+/.test(trimmed);

    // Check if previous lines already have JSDoc
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const prevPrevLine = i > 1 ? lines[i - 2].trim() : '';
    const hasJSDoc = prevLine === '*/' || prevLine.startsWith('*/') ||
      prevPrevLine === '*/' || prevPrevLine.startsWith('*/');

    if ((isExportedFunction || (isClassMethod && !hasJSDoc)) && !hasJSDoc) {
      // Parse the signature to extract params and return type
      const sig = extractSignature(lines, i);
      if (sig && sig.params.length > 0) {
        const indent = line.match(/^(\s*)/)?.[1] ?? '  ';
        const jsdoc = buildJSDoc(sig, indent);
        if (jsdoc) {
          newLines.push(jsdoc);
          modified = true;
          totalTagsAdded += sig.params.length + (sig.returnType ? 1 : 0);
        }
      }
    }

    newLines.push(line);
  }

  if (modified) {
    writeFileSync(file, newLines.join('\n'), 'utf-8');
    totalUpgraded++;
  }
}

console.log(`Upgraded ${totalUpgraded} files, added ~${totalTagsAdded} tags`);

// ── Helpers ───────────────────────────────────────────────

interface Signature {
  name: string;
  params: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string | null;
  isAsync: boolean;
}

function extractSignature(lines: string[], lineIdx: number): Signature | null {
  // Join continuation lines
  let sig = lines[lineIdx];
  let j = lineIdx + 1;
  while (j < lines.length && !sig.includes('{') && !sig.includes(';')) {
    sig += ' ' + lines[j].trim();
    j++;
  }

  // Extract function/method name
  const nameMatch = sig.match(/(async\s+)?(?:function\s+)?(\w+)\s*[<(]/);
  if (!nameMatch) return null;

  const name = nameMatch[2];
  const isAsync = !!nameMatch[1] || sig.includes(': Promise<');

  // Extract params from parentheses
  const paramsMatch = sig.match(/\(([^)]*)\)/);
  if (!paramsMatch) return null;

  const paramsStr = paramsMatch[1].trim();
  const params: Signature['params'] = [];

  if (paramsStr) {
    // Split on commas (but not commas inside angle brackets)
    let depth = 0;
    let current = '';
    for (const ch of paramsStr) {
      if (ch === '<' || ch === '(') depth++;
      if (ch === '>' || ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        params.push(parseParam(current.trim()));
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) params.push(parseParam(current.trim()));
  }

  // Extract return type
  const returnMatch = sig.match(/\):\s*([^{;]+)/);
  let returnType = returnMatch ? returnMatch[1].trim() : null;
  if (returnType === 'void') returnType = null;

  return { name, params, returnType, isAsync };
}

function parseParam(raw: string): { name: string; type: string; optional: boolean } {
  // Handle destructured params
  if (raw.startsWith('{')) return { name: 'options', type: 'Object', optional: false };

  const optional = raw.includes('?') || raw.includes('=');
  const parts = raw.split(':');
  let name = parts[0].replace(/\?$/, '').trim();
  let type = parts.length > 1 ? parts.slice(1).join(':').trim().replace(/\s*=.*$/, '') : 'unknown';

  // Clean up common types for JSDoc
  type = type.replace(/\s+/g, ' ').replace(/Record<string,\s*unknown>/, 'Object');
  if (type.length > 60) type = 'Object'; // Too complex, simplify

  return { name, type, optional };
}

function buildJSDoc(sig: Signature, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}/**`);

  // Description from method name
  const desc = sig.name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();

  for (const p of sig.params) {
    if (p.name.startsWith('_')) continue; // Skip unused params
    const opt = p.optional ? `[${p.name}]` : p.name;
    lines.push(`${indent} * @param {${p.type}} ${opt}`);
  }

  if (sig.returnType) {
    const rt = sig.isAsync && !sig.returnType.startsWith('Promise') ? `Promise<${sig.returnType}>` : sig.returnType;
    lines.push(`${indent} * @returns {${rt}}`);
  }

  lines.push(`${indent} */`);

  // Only return if we actually added useful tags
  return sig.params.filter(p => !p.name.startsWith('_')).length > 0 || sig.returnType
    ? lines.join('\n')
    : '';
}
