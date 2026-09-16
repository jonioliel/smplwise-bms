import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T063 against the running developer backend: a free-text question is parsed by the local baseline
// into chips (object / place / time), colour terms are reported as unsupported, results carry a confidence and their
// basis, the provider card states the opt-in / privacy / budget contract, and no external provider can be enabled.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T063-semantic-live');

test.describe('semantic search baseline (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('question → chips → scoped metadata results with confidence; external provider is only a contract', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const reg = await (await request.get('/api/v1/search/providers')).json();
    expect(reg.active).toBe('local');
    expect(reg.providers.find((p: { id: string }) => p.id === 'external').available).toBe(false);
    expect((await request.patch('/api/v1/settings', { data: { 'ai.provider': 'external' } })).status()).toBe(422);
    const q = 'תנועה או אדם בכחול היום';
    const api = await (await request.get(`/api/v1/search/semantic?q=${encodeURIComponent(q)}`)).json();
    testInfo.annotations.push({ type: 'semantic', description: JSON.stringify({ parsed: api.parsed, total: api.total, first: api.results[0]?.match, unsupported: api.unsupported }) });
    expect(api.parsed.objects).toEqual(expect.arrayContaining(['motion', 'person']));
    expect(api.unsupported.map((u: { term: string }) => u.term)).toContain('כחול');
    await page.goto('/#/investigate/search');
    await page.waitForSelector('sw-app');
    const screen = page.locator('investigate-search');
    await expect(screen.locator('[data-semantic-provider]')).toContainText('baseline', { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await screen.locator('[data-semantic-q]').fill(q);
    await expect(screen.locator('[data-semantic-run]')).not.toHaveAttribute('disabled', '', { timeout: 10_000 });
    await screen.locator('[data-semantic-run]').click();
    await expect(screen.locator('[data-semantic-parsed]')).toBeVisible({ timeout: 30_000 });
    await expect(screen.locator('[data-semantic-parsed]')).toContainText('תנועה');
    await expect(screen.locator('[data-semantic-unsupported]')).toContainText('כחול');
    await expect(screen.locator('[data-semantic-note]')).toContainText('ראיית זהות');
    await expect(screen.locator('[data-semantic-provider]')).toContainText('opt-in');
    if (api.total > 0) await expect(screen.locator('[data-semantic-result]').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `semantic-${testInfo.project.name}.png`), fullPage: true });
  });
});
