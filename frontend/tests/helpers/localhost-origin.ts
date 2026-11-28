import type { Page } from '@playwright/test';

/**
 * FIX-SECURITY2-2570 (deep review 2.57 SA2-05 b): a WebAuthn ceremony needs a secure page whose host can be a relying-party id -
 * `localhost`, never an IP address. Every lane that runs page specs serves the app at `http://127.0.0.1:<port>/` (playwright configs,
 * scripts/gate/release_gate.py, scripts/fixture_job.py), so the ceremony specs that skipped themselves there ran in no gate at all.
 *
 * When the base URL is not `localhost`, the page is opened at `http://localhost:<same port>` and every request of that origin that the
 * spec's own routes do not answer is fetched from the real base URL and answered from it (the same technique as
 * unit-mfa-passkeys-2490.spec.ts's `appOrigin`, RELEASE-2510-TRAIN). Nothing connects to `localhost` itself. Test-only.
 * Routes registered AFTER this call (the spec's mocks) still win: Playwright runs the newest matching route first.
 */
export async function localhostOrigin(page: Page, baseURL: string | undefined): Promise<string> {
  const base = new URL(baseURL || 'http://localhost:4173/');
  if (base.hostname === 'localhost') return base.origin;
  const local = `http://localhost:${base.port || '80'}`;
  await page.route(`${local}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${base.origin}${url.pathname}${url.search}` });
    return route.fulfill({ response });
  });
  return local;
}
