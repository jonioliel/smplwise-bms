// A11Y-AUDIT-2490: the report's grouping (node --test scripts/a11y-report.test.mjs). Fake rows only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleOf, summarise, tagFiles } from './a11y-report.mjs';

test('moduleOf: the src folder; the shared components one by one', () => {
  assert.equal(moduleOf('src/components/sw-table.ts'), 'components/sw-table');
  assert.equal(moduleOf('src/infra/infra-meters.ts'), 'infra');
  assert.equal(moduleOf(undefined), 'shell/document');
});

test('tagFiles: a tag maps to the file that registers it', () => {
  const tags = tagFiles();
  assert.equal(tags.get('sw-app'), 'src/shell/sw-app.ts');
  assert.ok(tags.size > 100);
});

test('summarise: by rule (nodes, page views) and by module (examples), critical first; load errors kept apart', () => {
  const tags = new Map([['sw-dialog', 'src/components/sw-dialog.ts'], ['system-storage', 'src/screens/system-storage.ts']]);
  const ex = (host) => ({ host, target: [host], html: '<b>', summary: '' });
  const rows = [
    { route: '#/a', project: 'desktop', scheme: 'light', violations: [{ rule: 'color-contrast', impact: 'serious', help: 'c', count: 3, hosts: ['system-storage'], examples: [ex('system-storage'), ex('system-storage')] }] },
    { route: '#/a', project: 'desktop', scheme: 'dark', violations: [{ rule: 'button-name', impact: 'critical', help: 'b', count: 1, hosts: ['sw-dialog'], examples: [ex('sw-dialog')] }] },
    { route: '#/b', project: 'mobile', error: 'timeout' },
  ];
  const s = summarise(rows, tags);
  assert.equal(s.routes, 2);
  assert.deepEqual(s.errors, [{ route: '#/b', project: 'mobile', error: 'timeout' }]);
  assert.deepEqual(s.rules.map((r) => [r.rule, r.nodes, r.pages, r.modules]), [['button-name', 1, 1, ['components/sw-dialog']], ['color-contrast', 3, 1, ['screens']]]);
  assert.deepEqual(s.modules.map((m) => m.module), ['screens', 'components/sw-dialog']);
  assert.deepEqual(s.modules[0].files, ['src/screens/system-storage.ts']);
});
