import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CD_DEV_MARKED, CD_KEYS, CD_TABLES } from '../src/i18n/confirm-dialog';

// CR-CONFIRM-DIALOG-2438 (owner Q-SYS-6 / O7 a; code review 06:CMP-1, 07:F18): the browser's native confirm() / alert() / prompt()
// boxes ignore the skin, RTL and the focus rules, and an embedded web view may suppress them. Every confirmation goes through
// confirmDialog() (src/components/confirm-dialog.ts), which opens the system's own sw-dialog. This guard reads frontend/src and fails
// on any new native call:
//   npx playwright test -c playwright.unit.config.ts tests/unit-no-native-dialogs.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs)$/.test(p) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Comments out of the way (a note may say "never confirm()"); string contents are kept, a call inside a template is still a call. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

const NATIVE = /(?<![\w$#.])(?:(?:window|globalThis|self|top|parent)\s*\.\s*)?(confirm|alert|prompt)\s*\(/g;
const QUALIFIED = /(?:window|globalThis|self|top|parent)\s*\.\s*(?:confirm|alert|prompt)\s*\(/;
/** A class method / interface member of the same name (`private async confirm() {`, `prompt(): Promise<void>;`) is not a call. */
const DEFINITION = /^\s*(?:(?:private|protected|public|static|async|override|readonly)\s+)*(?:confirm|alert|prompt)\s*\([^)]*\)\s*(?::\s*[^={;]+[{;]|\{)\s*$/;

function nativeDialogCalls(src: string): { line: number; text: string }[] {
  const lines = stripComments(src).split('\n');
  const hits: { line: number; text: string }[] = [];
  lines.forEach((text, i) => {
    for (const m of text.matchAll(NATIVE)) {
      if (!QUALIFIED.test(m[0]) && DEFINITION.test(text)) continue;
      hits.push({ line: i + 1, text: text.trim() });
    }
  });
  return hits;
}

test('the guard itself: it catches native calls and leaves methods of the same name alone', () => {
  expect(nativeDialogCalls(`if (!window.confirm('x')) return;`)).toHaveLength(1);
  expect(nativeDialogCalls(`if (confirm(em('a'))) go();`)).toHaveLength(1);
  expect(nativeDialogCalls(`alert('done');`)).toHaveLength(1);
  expect(nativeDialogCalls(`const v = window.prompt('name?');`)).toHaveLength(1);
  expect(nativeDialogCalls(`globalThis.alert ('x')`)).toHaveLength(1);
  expect(nativeDialogCalls(`@click=\${() => { if (confirm('x')) del(); }}`)).toHaveLength(1);
  // not calls
  expect(nativeDialogCalls(`  private async confirm(): Promise<void> {`)).toHaveLength(0);
  expect(nativeDialogCalls(`  confirm(req: GroupConfirmRequest) {`)).toHaveLength(0);
  expect(nativeDialogCalls(`  prompt(): Promise<void>;`)).toHaveLength(0);
  expect(nativeDialogCalls(`await this.confirm(cmd);`)).toHaveLength(0);
  expect(nativeDialogCalls(`await ev.prompt();`)).toHaveLength(0);
  expect(nativeDialogCalls(`dlg.confirm({ a: 1 });`)).toHaveLength(0);
  expect(nativeDialogCalls(`await confirmDialog({ body: 'x' });`)).toHaveLength(0);
  expect(nativeDialogCalls(`// never confirm(): the dialog asks`)).toHaveLength(0);
  expect(nativeDialogCalls(`/* window.alert(1) */ go();`)).toHaveLength(0);
});

test('no native confirm() / alert() / prompt() in frontend/src - use confirmDialog() (components/confirm-dialog.ts)', () => {
  const found: string[] = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    for (const h of nativeDialogCalls(readFileSync(f, 'utf8'))) found.push(`${rel}:${h.line}: ${h.text.slice(0, 140)}`);
  }
  expect(found, `native browser dialogs found - use confirmDialog() from components/confirm-dialog.ts:\n${found.join('\n')}`).toEqual([]);
});

test('the confirmation dialog words: every language has every key', () => {
  for (const [lang, table] of Object.entries(CD_TABLES)) {
    for (const k of CD_KEYS) expect(table[k], `${lang}.${k}`).toBeTruthy();
  }
  expect(CD_DEV_MARKED).toEqual(['ar', 'ru']);
});
