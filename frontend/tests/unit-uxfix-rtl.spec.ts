import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRUMB_SEP, bidi, crumbPath, isolateRuns, ltrIsolate, ltrNum } from '../src/i18n/bidi';
import { INGEST_REASON_TEXT, ingestReason, ingestReasonKey, type IngestLang } from '../src/i18n/ingest-reason';

// UXFIX-RTL (UX audit 2026-10-20): the pure rules - no browser page.
//   npx playwright test -c playwright.unit.config.ts tests/unit-uxfix-rtl.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const LRI = '⁦';
const PDI = '⁩';
const FORWARD = '›';

test.describe('bidi runs (finding 2)', () => {
  test('an ISO date with a time stays one left-to-right run', () => {
    expect(isolateRuns('פגישה 2026-10-28 19:30 בלובי')).toBe(`פגישה ${LRI}2026-10-28 19:30${PDI} בלובי`);
    expect(isolateRuns('2026-10-28T19:30:00')).toBe(`${LRI}2026-10-28T19:30:00${PDI}`);
  });
  test('a dotted date with a time, and a number with its unit', () => {
    expect(isolateRuns('עודכן 20.10.2026 17:38')).toBe(`עודכן ${LRI}20.10.2026 17:38${PDI}`);
    expect(bidi('1.3 TB מתוך 1.9 TB')).toBe(`${LRI}1.3 TB${PDI} מתוך ${LRI}1.9 TB${PDI}`);
    expect(isolateRuns('3-phase 400V')).toBe(`3-phase ${LRI}400V${PDI}`);
  });
  test('it is idempotent and leaves plain words and bare numbers alone', () => {
    const once = bidi('קומה 3, 2026-10-28 19:30');
    expect(bidi(once)).toBe(once);
    expect(isolateRuns('אין כאן כלום')).toBe('אין כאן כלום');
    expect(isolateRuns('bus 742 (S/N 4F77A1)')).toBe('bus 742 (S/N 4F77A1)');
    expect(isolateRuns('4F77A1')).toBe('4F77A1');
  });
  test('the old behaviour stays: a negative level keeps its sign', () => {
    expect(bidi('קומה -1')).toBe('קומה ‎-1');
    expect(ltrNum(-1)).toBe('‎-1');
    expect(bidi(null)).toBe('');
  });
  test('ltrIsolate wraps a whole value once', () => {
    expect(ltrIsolate('20.10.2026, 17:38')).toBe(`${LRI}20.10.2026, 17:38${PDI}`);
    expect(ltrIsolate(ltrIsolate('x'))).toBe(`${LRI}x${PDI}`);
    expect(ltrIsolate(null)).toBe('');
  });
});

test.describe('path separator (finding 5)', () => {
  test('the shared separator points left and joins the steps', () => {
    expect(CRUMB_SEP).toBe('‹');
    expect(crumbPath(['הגדרות', null, 'אבטחה', 'ניהול אזעקה'])).toBe('הגדרות ‹ אבטחה ‹ ניהול אזעקה');
  });

  /** No user-facing Hebrew text keeps the forward-pointing U+203A (comments and English strings may). */
  test('no source line pairs a Hebrew string with U+203A', () => {
    const bad: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.ts')) continue;
        readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (!line.includes(FORWARD)) return;
          const t = line.trim();
          if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
          const comment = /(?<![:'"\w])\/\/\s|\/\*/.exec(line);
          if (comment && comment.index < line.indexOf(FORWARD)) return;
          if (/[֐-׿]/.test(line)) bad.push(`${path.relative(SRC, p)}:${i + 1}`);
        });
      }
    };
    walk(SRC);
    expect(bad).toEqual([]);
  });

  test('the breadcrumb joins and the rfq crumbs use the left-pointing arrow', () => {
    for (const f of ['tickets/rfq-board.ts', 'tickets/rfq-compare.ts', 'screens/devices-type-admin.ts', 'screens/system-multimedia.ts']) {
      const src = readFileSync(path.join(SRC, f), 'utf8');
      expect(src.includes('‹'), f).toBe(true);
      const code = src.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
      expect(code.includes(FORWARD), f).toBe(false);
    }
  });
});

test.describe('ingest reason (finding 6)', () => {
  const langs: IngestLang[] = ['he', 'en', 'ar', 'ru'];
  test('nvr_not_configured becomes plain text in all four languages and never echoes the code', () => {
    for (const l of langs) {
      const s = ingestReason('nvr_not_configured', l);
      expect(s, l).toBe(INGEST_REASON_TEXT[l].notConfigured);
      expect(s, l).not.toMatch(/nvr_not_configured|_/);
    }
    expect(ingestReason('nvr_not_configured', 'he')).toBe('לא חובר NVR');
  });
  test('every key has a non-empty text per language', () => {
    for (const l of langs) for (const v of Object.values(INGEST_REASON_TEXT[l])) expect(v.length).toBeGreaterThan(3);
  });
  test('http statuses, timeouts and connection errors map to their sentences', () => {
    expect(ingestReasonKey('http_401')).toBe('rejected');
    expect(ingestReasonKey('http_403')).toBe('rejected');
    expect(ingestReasonKey('http_404')).toBe('notFound');
    expect(ingestReasonKey('http_503')).toBe('serverError');
    expect(ingestReasonKey('ReadTimeout')).toBe('timeout');
    expect(ingestReasonKey('ConnectError')).toBe('unreachable');
    expect(ingestReasonKey('disconnected')).toBe('disconnected');
    expect(ingestReasonKey('SomethingOdd')).toBe('unknown');
    expect(ingestReasonKey(null)).toBe('unknown');
    expect(ingestReason('http_503', 'en')).toBe('The NVR returned an error');
  });
});

test.describe('source guards (findings 1, 3, 4)', () => {
  const read = (f: string): string => readFileSync(path.join(SRC, f), 'utf8');
  test('ticket card title: dir=auto, title attribute, two-line clamp', () => {
    expect(read('tickets/ticket-card.ts')).toMatch(/<h3 dir="auto"[^>]*><a class="name"[^>]* title=\$\{t\.title\}/);
    expect(read('tickets/ticket-detail.ts')).toMatch(/<h1 dir="auto" data-ticket-title title=\$\{t\.title\}>/);
    const css = read('tickets/styles.ts');
    expect(css).toMatch(/-webkit-line-clamp: 2/);
    expect(css).not.toMatch(/h3 \{[^}]*white-space: nowrap/);
  });
  test('the audit table isolates its left-to-right spans', () => {
    expect(read('components/sw-table.ts')).toMatch(/td \.ltr \{[^}]*unicode-bidi: isolate/);
    expect(read('screens/system-audit.ts')).toMatch(/data-audit-json/);
  });
  test('site cards: shrinkable text column, clamped name and address, actions in their own column', () => {
    const s = read('screens/explore-sites.ts');
    expect(s).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/);
    expect(s).toMatch(/minmax\(min\(280px, 100%\), 1fr\)/);
    expect(s).toMatch(/data-site-name/);
    expect(s).toMatch(/data-site-address/);
  });
});
