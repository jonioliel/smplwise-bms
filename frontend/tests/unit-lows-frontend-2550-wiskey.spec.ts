import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ApiError } from '../src/api/client';
import { physicalOutcome } from '../src/api/physical-outcome';

// LOWS-FRONTEND-2550: the low findings of the 2.52 deep review on the WisKey screens and the call banner (SCR-50, SCR-51). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-lows-frontend-2550-wiskey.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const apiErr = (status: number, code = 'x') => new ApiError(status, { code, user_message: 'נדחה', retryable: false, correlation_id: '', details: {} });

test.describe('SCR-50 "people on stations only"', () => {
  test('a write that got no answer reads as "no clear outcome", only a refusal as "not performed"', () => {
    // the rule the screen now uses (api/physical-outcome.ts): no answer / 5xx = unknown, 4xx = refused
    expect(physicalOutcome(new TypeError('Failed to fetch'))).toBe('unknown');
    expect(physicalOutcome(apiErr(502, 'http_502'))).toBe('unknown');
    expect(physicalOutcome(apiErr(409, 'conflict'))).toBe('refused');
    const s = src('screens/wiskey-station-people.ts');
    expect(s).toMatch(/this\.failureUnknown = physicalOutcome\(err\) === 'unknown';/);
    expect(s).toMatch(/this\.failure = this\.failureUnknown \? st\('res_unknown_all'\)/);
    expect(s).toMatch(/if \(this\.failure && this\.failureUnknown\) return html`<p class="result unknown" role="status" data-station-result="unknown">/);
    // the list is read again after an unknown outcome too (some stations may have been written)
    expect(s).toMatch(/if \(this\.failureUnknown \|\| \(this\.reply && /);
  });

  test('a late duplicate check of person A is never applied to the dialog of person B', () => {
    const s = src('screens/wiskey-station-people.ts');
    const check = s.slice(s.indexOf('private async runCheck('), s.indexOf('private get possibleDuplicates()'));
    expect(check).toMatch(/const acting = this\.acting;/);
    expect(check).toMatch(/if \(this\.acting !== acting\) return;\s*\n\s*this\.check = check;/);
    expect(check).not.toMatch(/this\.check = await checkStationUser/);
  });
});

test.describe('SCR-51 the call banner and the station permissions', () => {
  test('a 403 on the banner\'s read ends every talk session it showed (microphone closed), then goes quiet', () => {
    const s = src('components/sw-incoming-call.ts');
    const refresh = s.slice(s.indexOf('protected async refresh()'), s.indexOf('protected ended(callId: string)'));
    expect(refresh).toMatch(/err\.status === 403\) \{\s*\n[^\n]*\n[^\n]*\n\s*for \(const id of new Set\(\[\.\.\.this\.sessions\.keys\(\), \.\.\.\(this\.active\?\.calls \?\? \[\]\)\.map\(\(c\) => c\.call_id\)\]\)\) this\.ended\(id\);\s*\n\s*this\.active = null;/);
  });

  test('station permissions: one busy slot per station; the result line stays with its own person', () => {
    const s = src('screens/wiskey-station-permissions.ts');
    expect(s).toMatch(/@state\(\) private busy: ReadonlySet<string> = new Set\(\);/);
    expect(s).toMatch(/if \(this\.busy\.has\(st\.station_id\)\) return;/);
    expect(s).toMatch(/this\.busy = new Set\(\[\.\.\.this\.busy\]\.filter\(\(s\) => s !== st\.station_id\)\);/);
    expect(s).not.toMatch(/this\.busy = '';/);
    expect(s).toMatch(/if \(this\.personId === id\) this\.line = line;/);
    expect(s).not.toMatch(/\n\s*this\.line = \{ ok: (true|false)/);
  });
});
