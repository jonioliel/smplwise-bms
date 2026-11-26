import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boardItemIds } from '../src/notices/model';
import { auditCsv, auditCsvCell, auditTime } from '../src/screens/audit-logic';

// LOWS-FRONTEND-2550: the low findings of the 2.52 deep review on the settings screens - notice boards (SCR-46), backups (SCR-47), the
// audit log (SCR-48) and users and permissions (SCR-49), plus the administrator factor reset (SCR-45). Node only, no page:
//   npx playwright test -c playwright.unit.config.ts tests/unit-lows-frontend-2550-settings.spec.ts
// The page behaviour (mocked backend) is in unit-lows-frontend-2550-pages.spec.ts.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test.describe('SCR-46 notice board items', () => {
  test('each change is built from the list as it is now: "remove A, then B" never puts A back', () => {
    let ids = ['a', 'b', 'c'];
    ids = boardItemIds(ids, { remove: 'a' });
    ids = boardItemIds(ids, { remove: 'b' });
    expect(ids).toEqual(['c']);
    expect(boardItemIds(ids, { add: 'd' })).toEqual(['c', 'd']);
    expect(boardItemIds(['c', 'd'], { add: 'd' })).toEqual(['c', 'd']); // added twice: once
  });

  test('the screen queues the list changes, guards the board read and keeps edits typed during a save', () => {
    const s = src('screens/system-notices.ts');
    expect(s).toMatch(/private queueItems\(op/);
    expect(s).toMatch(/this\.itemsQueue = run\.catch/);
    expect(s).toMatch(/const ids = boardItemIds\(now, op\);/);
    expect(s).not.toMatch(/this\.setItems\(\[\.\.\.this\.detail\.notices/); // the old list captured at the click
    expect(s).toMatch(/const current = this\.boardReads\.begin\(\);/);
    expect(s).toMatch(/if \(this\.draft !== sent \|\| \(body\.display === undefined && this\.dirty\)\)/);
  });
});

test.describe('SCR-47 the backup tab', () => {
  test('the error panel follows the backup read\'s own failure, so "no backups yet" is reachable', () => {
    const s = src('screens/system-diagnostics.ts');
    expect(s).toMatch(/: this\.loadFailed\.backup \/\/ LOWS-FRONTEND-2550/);
    expect(s).not.toMatch(/: this\.loadFailed\s*\n\s*\? html`<sw-state-panel compact state="error" heading=\$\{tr\('רשימת הגיבויים לא נטענה'\)\}/);
  });
});

test.describe('SCR-48 the audit log', () => {
  test('CSV cells that start like a formula are neutralised; quotes doubled', () => {
    expect(auditCsvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(auditCsvCell('+1')).toBe('"\'+1"');
    expect(auditCsvCell('-2')).toBe('"\'-2"');
    expect(auditCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(auditCsvCell('＝1')).toBe('"\'＝1"');
    expect(auditCsvCell('דנה')).toBe('"דנה"');
    expect(auditCsvCell(null)).toBe('""');
    expect(auditCsvCell(7)).toBe('"7"');
    const csv = auditCsv([{ at: '2026-11-26T08:00:00Z', actor_username: '=cmd', action: 'auth.login', decision: 'allowed', reason: 'x', permission_revision: 3 }]);
    expect(csv.split('\n')).toEqual([
      'at,actor,action,decision,resource_type,resource_id,reason,request_id,permission_revision',
      '"2026-11-26T08:00:00Z","\'=cmd","auth.login","allowed","","","x","","3"',
    ]);
  });

  test('the time column is in the installation zone, not the browser zone', () => {
    // 22:30 UTC is already the next day in Jerusalem (+2 in November) and still the same day in New York
    const iso = '2026-11-26T22:30:00Z';
    expect(auditTime(iso, 'Asia/Jerusalem', 'en-GB')).toBe('27/11/2026, 00:30:00');
    expect(auditTime(iso, 'America/New_York', 'en-GB')).toBe('26/11/2026, 17:30:00');
    expect(auditTime('not a time', 'Asia/Jerusalem', 'en-GB')).toBe('not a time');
  });

  test('the screen: newest filter read wins, the export waits for a read in flight and uses the neutralised CSV', () => {
    const s = src('screens/system-audit.ts');
    expect(s).toMatch(/const current = this\.reads\.begin\(\);/);
    expect(s).toMatch(/if \(!current\(\)\) return;\s*\n\s*this\.rows = r\.rows;/);
    expect(s).toMatch(/new Blob\(\['\\ufeff' \+ auditCsv\(rows\)\]/);
    expect(s).toMatch(/auditTime\(String\(r\.at\), zone, uiLocale\(\)\)/);
    expect(s).not.toMatch(/new Date\(String\(r\.at\)\)\.toLocaleString/);
  });
});

test.describe('SCR-45 the administrator factor reset', () => {
  test('the answer is painted only on the user it was sent for (both reset surfaces)', () => {
    for (const f of ['components/sw-second-factor.ts', 'components/sw-user-factors.ts']) {
      const s = src(f);
      expect(s, f).toMatch(/const id = this\.userId;\s*\n\s*try \{\s*\n\s*await resetFactor\(id, /);
      expect(s, f).toMatch(/if \(id === this\.userId\) this\.error = resetErrorText\(err\);/);
    }
  });
});

test.describe('SCR-49 revoking a user role', () => {
  test('a user binding is revoked only after a confirmation naming it (own binding: a stronger warning)', () => {
    const s = src('screens/system-access.ts');
    const revoke = s.slice(s.indexOf('private async revoke(b: AccessBinding)'), s.indexOf('private async sync()'));
    expect(revoke).toMatch(/await confirmDialog\(\{ body, danger: true, confirmLabel: tr\('בטל שיוך'\), focusCancel: own \}\)/);
    expect(revoke.indexOf('confirmDialog')).toBeLessThan(revoke.indexOf('await revokeBinding(b.id)'));
    const en = src('i18n/lang/en/i18n/msg/system-a.ts');
    expect(en).toContain("'לבטל את השיוך \"{role} · {scope}\" של {name}?': 'Remove the assignment \"{role} · {scope}\" of {name}?',");
  });
});
