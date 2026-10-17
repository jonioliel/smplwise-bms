import { test, expect, type Page, type Route } from '@playwright/test';
import { buildBundle, dropBundle, open, ORIGIN, quoteOf, RfqFake, rfqView, TOKEN, type Json } from './public-rfq-fixtures';

// RFQ-VENDOR-UPLOAD (contract 19.10) evidence: the vendor's files on his quote, on the public RFQ page - the card appears only when the
// answer carries `uploads` (the installation switch is OFF by default: no card, no chunk fetched), the empty / ready / sending / refused
// states, removal, the 404 that forgets the link, desktop / phone / RTL / dark. Screens into docs/design/evidence/rfq-vendor-upload/.
//   npx playwright test -c playwright.public.config.ts tests/evidence-public-rfq-upload.spec.ts --workers=1
// Status when written (2026-10-17): NOT_RUN (the runner was busy with a gate; written for the next runner slot).
// 2.7.0 gate fix: the owner-decisions commit (files with a question) prefixed the picker ids with their target (quote-file /
// quote-camera on the quote, q-file / q-camera on a question); the spec still looked for the bare "file" and waited out its timeout.
// The 404 test also caught a page bug: after the uniform 404 the card reloaded the request and brought the forgotten page back.

const SHOTS = '../docs/design/evidence/rfq-vendor-upload';

function uploads(over: Json = {}): Json {
  return {
    files: [], limits: { files: 5, uploads: 10, image_bytes: 8 * 1024 * 1024, document_bytes: 10 * 1024 * 1024, total_bytes: 20 * 1024 * 1024, types: ['jpg', 'png', 'pdf'] },
    quote_id: 'q-1', used_bytes: 0, uploads_left: 10, can: { upload: true, remove: true }, ...over,
  };
}

function sentView(over: Json = {}): Json {
  return rfqView({ quote: quoteOf(), can: { quote: true, withdraw: true, decline: false, ask: true }, uploads: uploads(), ...over });
}

/** The upload routes on top of the RFQ fake: a stored file joins `uploads.files`; `refuse` answers the next upload with that refusal. */
async function uploadRoutes(page: Page, fake: RfqFake, opts: { refuse?: { status: number; body: Json }; slow?: boolean } = {}): Promise<{ posts: string[] }> {
  const seen = { posts: [] as string[] };
  await page.route(`${ORIGIN}/t/api/rfq/upload**`, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    seen.posts.push(p);
    expect(req.headers()['x-ticket-token']).toBe(TOKEN);
    expect(req.url()).not.toContain(TOKEN); // never in an address
    const json = (status: number, data: unknown) => route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const v = fake.view as Json;
    const up = v.uploads as Json;
    if (opts.refuse) {
      const r = opts.refuse;
      opts.refuse = undefined;
      return json(r.status, r.body);
    }
    if (opts.slow) await new Promise((r) => setTimeout(r, 1500));
    if (p === '/t/api/rfq/upload') {
      const file = { id: `f-${seen.posts.length}`, name: 'הצעה חתומה.pdf', kind: 'pdf', bytes: 312_000, at: new Date().toISOString() };
      fake.view = { ...v, uploads: { ...up, files: [...(up.files as Json[]), file] } };
      return json(201, { ok: true, file });
    }
    const id = (req.postDataJSON() as Json).file_id;
    fake.view = { ...v, uploads: { ...up, files: (up.files as Json[]).filter((f) => f.id !== id) } };
    return json(200, { ok: true });
  });
  return seen;
}

const PDF = { name: 'offer.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n%%EOF\n') };

test.describe('RFQ-VENDOR-UPLOAD: the vendor attaches files to his quote', () => {
  test.beforeAll(() => buildBundle());
  test.afterAll(() => dropBundle());
  test.beforeEach(() => test.setTimeout(180_000));

  test('switch off: no card, the upload chunk is never fetched', async ({ page }) => {
    const chunks: string[] = [];
    page.on('request', (r) => { if (/rfq-upload-/.test(r.url())) chunks.push(r.url()); });
    await open(page, new RfqFake(sentView({ uploads: null })));
    await expect(page.locator('[data-rfq-sent]')).toBeVisible();
    await expect(page.locator('[data-rfq-uploads]')).toHaveCount(0);
    expect(chunks).toEqual([]);
  });

  test('empty, ready, removal - desktop and phone, RTL', async ({ page }, info) => {
    const fake = new RfqFake(sentView());
    await open(page, fake);
    const routes = await uploadRoutes(page, fake);
    const card = page.locator('[data-rfq-uploads]');
    await expect(card).toHaveAttribute('data-rfq-uploads', '0');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: `${SHOTS}/empty-${info.project.name}-light.png`, fullPage: true });
    await page.locator('[data-rfq-upload-input="quote-file"]').setInputFiles(PDF);
    await expect(card).toHaveAttribute('data-rfq-uploads', '1');
    expect(routes.posts).toEqual(['/t/api/rfq/upload']);
    await page.screenshot({ path: `${SHOTS}/ready-${info.project.name}-light.png`, fullPage: true });
    await page.locator('[data-rfq-upload-remove]').first().click();
    await expect(card).toHaveAttribute('data-rfq-uploads', '0');
  });

  test('sending and a refusal in the vendor\'s words; the limit closes the picker', async ({ page }, info) => {
    const fake = new RfqFake(sentView());
    await open(page, fake);
    await uploadRoutes(page, fake, { refuse: { status: 415, body: { code: 'unsupported_format' } } });
    await page.locator('[data-rfq-upload-input="quote-file"]').setInputFiles(PDF);
    await expect(page.locator('[data-rfq-upload-error="type"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/error-${info.project.name}-light.png`, fullPage: true });
    await open(page, new RfqFake(sentView({ uploads: uploads({ can: { upload: false, remove: true } }) })));
    await expect(page.locator('[data-rfq-upload-input]')).toHaveCount(0);
    const slow = new RfqFake(sentView());
    await open(page, slow);
    await uploadRoutes(page, slow, { slow: true });
    await page.locator('[data-rfq-upload-input="quote-file"]').setInputFiles(PDF);
    await expect(page.locator('.rfq-upload [role="status"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/loading-${info.project.name}-light.png`, fullPage: true });
  });

  test('a 404 on upload forgets the link (the uniform "unavailable"); dark theme', async ({ page }, info) => {
    const fake = new RfqFake(sentView());
    await open(page, fake, { scheme: 'dark' });
    await page.screenshot({ path: `${SHOTS}/empty-${info.project.name}-dark.png`, fullPage: true });
    await uploadRoutes(page, fake, { refuse: { status: 404, body: { code: 'link_unavailable' } } });
    await page.locator('[data-rfq-upload-input="quote-file"]').setInputFiles(PDF);
    await expect(page.locator('[data-rfq-screen]')).toHaveCount(0);
  });
});
