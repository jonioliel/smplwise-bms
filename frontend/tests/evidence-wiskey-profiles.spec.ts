import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url, type Persona } from './access-control-mocks';
import { installProfilesMock, type ProfilesOptions } from './wiskey-profiles-mocks';
import { settlePage } from './pixel-settle';
import { pickOption } from './helpers/wk-choose';

// WISKEY-PROFILES-EDIT-2390 - "קבוצות ושדות" (#/wiskey/profiles) behind the real shell, against a MOCKED backend (tests/wiskey-profiles-mocks.ts:
// invented groups, fields, people and stations; nothing reaches the access-control system, a station or a door). Desktop and phone. What it pins:
//   - the editor: groups with their stations, fields with type / required / unique / options / condition, the photo switch; saved definitions can
//     only be disabled; a draft problem is marked in place and blocks the preview (nothing sent);
//   - the preview is the server's impact (who gains which station, the stations to sync, the offline ones, the field checks) and sends nothing
//     else; the confirmation needs "בדקתי את ההשפעה"; cancel sends nothing; one apply with the review and the command envelope;
//   - the honest result: saved + read back + "sync requested, not verified"; a refusal says "not saved" with the reason and is never resent;
//     no clear answer offers only "check what happened", whose readback then decides;
//   - the versions: compare with the current one, a rollback draft with its notes (and nothing saved);
//   - the group suggestions for one person (read only);
//   - an operator gets the "no permission" panel; no platform or vendor name; no horizontal overflow.
// Evidence images: docs/design/evidence/wiskey-profiles/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-profiles.spec.ts --project=desktop --project=mobile --workers=1

const SCREEN = 'sw-app wiskey-profiles-screen';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-profiles');
const s = (page: Page, sel: string) => page.locator(`${SCREEN} ${sel}`);

async function boot(page: Page, o: ProfilesOptions = {}) {
  const mock = await installProfilesMock(page, o);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url('/wiskey/profiles'));
  return { mock, errors };
}

async function ready(page: Page) {
  await expect(s(page, '[data-pf][data-pf-state="ready"]')).toBeVisible({ timeout: 30_000 });
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}

async function noOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

async function screenText(page: Page): Promise<string> {
  return page.locator(SCREEN).evaluate((el) => (el as HTMLElement).shadowRoot?.textContent ?? '');
}

/** Widen the staff group to the back door: the change the preview mock answers for. */
async function widenStaff(page: Page) {
  await s(page, '[data-pf-group="staff"] [data-pf-station="entry-c"]').click();
  await expect(s(page, '[data-pf-group="staff"] [data-pf-station="entry-c"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(s(page, '[data-pf-dirty]')).toHaveAttribute('data-pf-dirty', '1');
}

async function toPreview(page: Page) {
  await widenStaff(page);
  await s(page, '[data-pf-preview]').click();
  await expect(s(page, '[data-pf-preview-panel]')).toBeVisible();
}

test.describe('groups and profile fields', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the editor shows the groups with their stations, the fields with their conditions, and nothing is sent', async ({ page }, info) => {
    const { mock, errors } = await boot(page);
    await ready(page);
    await expect(s(page, '[data-pf-group]')).toHaveCount(3);
    await expect(s(page, '[data-pf-field]')).toHaveCount(3);
    await expect(s(page, '[data-pf-group="staff"] [data-pf-station="entry-a"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(s(page, '[data-pf-group="staff"] [data-pf-station="entry-d"]')).toBeDisabled(); // no managed lock: cannot be added
    await expect(s(page, '[data-pf-group="visitors"] [data-pf-no-stations]')).toBeVisible();
    await expect(s(page, '[data-pf-field="shift"] [data-pf-conditional]')).toBeVisible();
    await expect(s(page, '[data-pf-group-remove]')).toHaveCount(0); // saved definitions are disabled, never removed
    await expect(s(page, '[data-pf-preview]')).toHaveAttribute('disabled', '');
    expect(mock.posts).toEqual([]);
    expect(await screenText(page)).not.toMatch(BANNED);
    await noOverflow(page);
    await shot(page, info, '01-editor');
    expect(errors).toEqual([]);
  });

  test('a draft problem is marked where it is and blocks the preview; a new definition can be removed again', async ({ page }, info) => {
    const { mock } = await boot(page);
    await ready(page);
    await s(page, '[data-pf-add-field]').click();
    const added = s(page, '[data-pf-field="field_1"]');
    await expect(added.locator('[data-pf-mark="new"]')).toBeVisible();
    await added.locator('[data-pf-field-label]').fill('');
    await expect(s(page, '[data-pf-problem="fields.3.label"]')).toBeVisible();
    await expect(s(page, '[data-pf-problems]')).toBeVisible();
    await expect(s(page, '[data-pf-preview]')).toHaveAttribute('disabled', '');
    await shot(page, info, '02-problem');
    await added.locator('[data-pf-field-remove]').click();
    await expect(s(page, '[data-pf-field]')).toHaveCount(3);
    await expect(s(page, '[data-pf-dirty]')).toHaveAttribute('data-pf-dirty', '0');
    expect(mock.posts).toEqual([]);
  });

  test('a condition is set from the parent field and its options', async ({ page }) => {
    await boot(page);
    await ready(page);
    const badge = s(page, '[data-pf-field="badge"]');
    await pickOption(badge.locator('[data-pf-field-parent]'), 'department');
    await pickOption(badge.locator('[data-pf-field-parent-value]'), 'הנהלה');
    await expect(badge.locator('[data-pf-conditional]')).toBeVisible();
    await expect(s(page, '[data-pf-problems]')).toHaveCount(0);
    // the field the condition hangs on cannot depend on its own child (no cycle is offered)
    const options = await s(page, '[data-pf-field="department"] [data-pf-field-parent]').evaluate((n) => (n as HTMLElement & { items: { label: string }[] }).items.map((i) => i.label));
    expect(options).not.toContain('משמרת');
  });

  test('preview -> confirm -> apply: the impact first, the confirmation names it, one apply, an honest result', async ({ page }, info) => {
    const { mock, errors } = await boot(page);
    await ready(page);
    await toPreview(page);
    expect(mock.posts.map((x) => x.path)).toEqual(['access-control/profiles/preview']);
    expect((mock.posts[0].body.values as { groups: { id: string; station_ids: string[] }[] }).groups[0].station_ids).toEqual(['entry-a', 'entry-b', 'entry-c']);
    await expect(s(page, '[data-pf-diff-row="groups.staff"] [data-pf-after]')).toContainText('דלת אחורית');
    await expect(s(page, '[data-pf-person="p1"] [data-pf-gains]')).toContainText('דלת אחורית');
    await expect(s(page, '[data-pf-impact-changed]')).toHaveAttribute('data-pf-impact-changed', '1');
    await expect(s(page, '[data-pf-impact-offline]')).toContainText('דלת אחורית');
    await expect(s(page, '[data-pf-expiry]')).toBeVisible();
    expect(await screenText(page)).not.toMatch(BANNED);
    await noOverflow(page);
    await shot(page, info, '03-preview');

    await s(page, '[data-pf-confirm-open]').click();
    await expect(s(page, '[data-pf-confirm]')).toHaveAttribute('open', '');
    await expect(s(page, '[data-pf-confirm-sentence]')).toContainText('7 ← 8');
    await expect(s(page, '[data-pf-confirm-send]')).toHaveAttribute('disabled', '');
    await shot(page, info, '04-confirm');
    await s(page, '[data-pf-confirm-cancel]').click();
    await expect(s(page, '[data-pf-confirm]')).toHaveCount(0);
    expect(mock.posts).toHaveLength(1); // cancel sends nothing

    await s(page, '[data-pf-confirm-open]').click();
    await s(page, '[data-pf-confirm-check]').check();
    await s(page, '[data-pf-confirm-send]').click();
    await expect(s(page, '[data-pf-result="saved"]')).toBeVisible();
    const applies = mock.posts.filter((x) => x.path === 'access-control/profiles/apply');
    expect(applies).toHaveLength(1);
    expect(applies[0].body.review_id).toBe('a'.repeat(32));
    expect(applies[0].body.confirmed).toBe(true);
    expect(String(applies[0].body.client_request_id)).not.toBe('');
    expect(String(applies[0].body.expires_at)).toMatch(/Z$/);
    await expect(s(page, '[data-pf-result="saved"]')).toHaveAttribute('data-pf-tone', 'ok');
    await expect(s(page, '[data-pf-readback]')).toContainText('8');
    await expect(s(page, '[data-pf-sync]')).toContainText('לא אומת');
    expect(await screenText(page)).not.toMatch(BANNED);
    await shot(page, info, '05-result-saved');
    await s(page, '[data-pf-done]').click();
    await expect(s(page, '[data-pf-base]')).toContainText('8'); // reloaded: the draft is now on the saved version
    expect(errors).toEqual([]);
  });

  test('duplicates in a unique field: the preview says so and the apply is not offered', async ({ page }, info) => {
    const { mock } = await boot(page, { duplicates: true });
    await ready(page);
    await toPreview(page);
    await expect(s(page, '[data-pf-blocked]')).toBeVisible();
    await expect(s(page, '[data-pf-field-impact="badge"] [data-pf-dups]')).toHaveAttribute('data-pf-dups', '2');
    await expect(s(page, '[data-pf-confirm-open]')).toHaveAttribute('disabled', '');
    await shot(page, info, '06-blocked');
    expect(mock.posts.filter((x) => x.path.endsWith('/apply'))).toEqual([]);
  });

  test('a refusal says "not saved" with the reason and is never sent again by itself', async ({ page }, info) => {
    const { mock } = await boot(page, { apply: 'stale' });
    await ready(page);
    await toPreview(page);
    await s(page, '[data-pf-confirm-open]').click();
    await s(page, '[data-pf-confirm-check]').check();
    await s(page, '[data-pf-confirm-send]').click();
    await expect(s(page, '[data-pf-result="not_saved"]')).toHaveAttribute('data-pf-outcome', 'refused');
    await expect(s(page, '[data-pf-result-text]')).toContainText('הנתונים השתנו');
    await expect(s(page, '[data-pf-check]')).toHaveCount(0);
    await shot(page, info, '07-refused');
    await page.waitForTimeout(500);
    expect(mock.posts.filter((x) => x.path.endsWith('/apply'))).toHaveLength(1);
  });

  test('no clear answer: only "check what happened", and the readback decides', async ({ page }, info) => {
    const { mock } = await boot(page, { apply: 'unknown' });
    await ready(page);
    await toPreview(page);
    await s(page, '[data-pf-confirm-open]').click();
    await s(page, '[data-pf-confirm-check]').check();
    await s(page, '[data-pf-confirm-send]').click();
    await expect(s(page, '[data-pf-result="unknown"]')).toBeVisible();
    await expect(s(page, '[data-pf-reapply]')).toHaveCount(0);
    await shot(page, info, '08-unknown');
    await s(page, '[data-pf-check]').click();
    await expect(s(page, '[data-pf-result="saved"]')).toBeVisible();
    await expect(s(page, '[data-pf-check-line]')).toContainText('8');
    expect(mock.posts.map((x) => x.path.replace('a'.repeat(32), '<id>'))).toEqual([
      'access-control/profiles/preview', 'access-control/profiles/apply', 'access-control/profiles/reviews/<id>/check',
    ]);
    await shot(page, info, '09-checked');
  });

  test('versions: compare with the current one, and a rollback draft that saves nothing by itself', async ({ page }, info) => {
    const { mock } = await boot(page);
    await ready(page);
    await s(page, '[data-pf-tab="versions"]').click();
    await expect(s(page, '[data-pf-version]')).toHaveCount(3);
    await s(page, '[data-pf-compare="5"]').click();
    await expect(s(page, '[data-pf-compare-panel] [data-pf-diff-row="fields.badge"]')).toBeVisible();
    await expect(s(page, '[data-pf-compare-panel] [data-pf-diff-row="groups.staff"] [data-pf-after]')).toContainText('חניון');
    expect(await screenText(page)).not.toMatch(BANNED);
    await noOverflow(page);
    await shot(page, info, '10-versions');
    await s(page, '[data-pf-rollback="5"]').click();
    await expect(s(page, '[data-pf-rollback-notes] [data-pf-note="disabled_not_removed"]')).toContainText('מספר תג');
    await expect(s(page, '[data-pf-base]')).toContainText('5');
    await expect(s(page, '[data-pf-group="staff"] [data-pf-station="entry-b"]')).toHaveAttribute('aria-pressed', 'false');
    await shot(page, info, '11-rollback-draft');
    expect(mock.posts).toEqual([]);
  });

  test('group suggestions for one person: read only', async ({ page }, info) => {
    const { mock } = await boot(page);
    await ready(page);
    await s(page, '[data-pf-tab="suggest"]').click();
    await s(page, '[data-pf-people-q]').fill('דנה');
    await s(page, '[data-pf-people-search]').click();
    await s(page, '[data-pf-pick="p1"]').click();
    await s(page, '[data-pf-suggest-field="department"]').check();
    await s(page, '[data-pf-suggest-run]').click();
    await expect(s(page, '[data-pf-suggestion="night"]')).toContainText('דלת אחורית');
    expect(mock.reads.some((r) => r.includes('suggestions?user_id=p1&field=department'))).toBe(true);
    expect(mock.posts).toEqual([]);
    expect(await screenText(page)).not.toMatch(BANNED);
    await noOverflow(page);
    await shot(page, info, '12-suggestions');
  });

  for (const persona of ['operator', 'scopedAdmin'] as Persona[]) {
    test(`${persona}: the no-permission panel and nothing read`, async ({ page }, info) => {
      const { mock } = await boot(page, { persona });
      await expect(s(page, '[data-pf-state="forbidden"]')).toBeVisible({ timeout: 30_000 });
      expect(mock.reads).toEqual(['access-control/profiles/access']);
      if (persona === 'operator') await shot(page, info, '13-forbidden');
    });
  }
});
