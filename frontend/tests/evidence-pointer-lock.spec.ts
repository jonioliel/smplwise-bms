import { test, expect, type Page } from '@playwright/test';

// Plan Studio 6, slice S5-B (CR-029 section 4.5, docs/changes/CR-029-ST7-S5B-NOTES.md), the real browser half of unit-pointer-lock-gate.spec.ts:
// pointer lock inside a sandboxed iframe (what an embedding frame such as the Home Assistant Ingress panel may be) is REFUSED by the
// platform, and the gate turns the refusal into "drag" with nothing thrown. A DEV-SERVER spec (it imports /src modules):
// `run_smart.py spec <branch> tests/evidence-pointer-lock.spec.ts`. What the real Ingress page does is a device row for the owner (NOT_RUN here).

const frameFor = (page: Page, sandbox: string) =>
  page.evaluate(async (sb) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'lock-frame';
    iframe.setAttribute('sandbox', sb);
    iframe.srcdoc = '<!doctype html><body><canvas id="c" width="40" height="40"></canvas></body>';
    document.body.appendChild(iframe);
    await new Promise((res) => iframe.addEventListener('load', res, { once: true }));
    return true;
  }, sandbox);

test.describe('pointer lock where an embedding frame refuses it', () => {
  test('the gate reads the frame it runs in: a sandbox without allow-pointer-lock is known before any request', async ({ page }) => {
    await page.goto('/');
    await frameFor(page, 'allow-scripts allow-same-origin');
    const out = await page.evaluate(async () => {
      const win = (document.getElementById('lock-frame') as HTMLIFrameElement).contentWindow as unknown as { Function(body: string): () => Promise<typeof import('../src/map/pointer-lock-gate')> };
      const m = await win.Function('return import("/src/map/pointer-lock-gate.ts")')(); // evaluated INSIDE the frame: its window, its frameElement
      const env = m.browserLockEnv();
      const gate = new m.PointerLockGate(env);
      return { supported: env.supported(), frame: env.frame(), blocked: gate.blocked, lock: gate.effectiveMode('lock'), auto: gate.effectiveMode('auto'), drag: gate.effectiveMode('drag') };
    });
    expect(out).toEqual({ supported: true, frame: { sandbox: ['allow-scripts', 'allow-same-origin'] }, blocked: 'frame-sandbox', lock: 'drag', auto: 'drag', drag: 'drag' });
  });

  test('a frame that allows it is not blocked up front; one without a sandbox attribute either', async ({ page }) => {
    await page.goto('/');
    await frameFor(page, 'allow-scripts allow-same-origin allow-pointer-lock');
    const allowed = await page.evaluate(async () => {
      const win = (document.getElementById('lock-frame') as HTMLIFrameElement).contentWindow as unknown as { Function(body: string): () => Promise<typeof import('../src/map/pointer-lock-gate')> };
      const m = await win.Function('return import("/src/map/pointer-lock-gate.ts")')();
      return new m.PointerLockGate(m.browserLockEnv()).blocked;
    });
    expect(allowed).toBeNull();
    const top = await page.evaluate(async () => {
      const m = await import('/src/map/pointer-lock-gate.ts' as string);
      const env = m.browserLockEnv();
      return { frame: env.frame(), blocked: new m.PointerLockGate(env).blocked };
    });
    expect(top).toEqual({ frame: null, blocked: null }); // the top-level page: not framed, nothing known in advance
  });

  test('the platform\'s own refusal in a sandboxed frame is a verdict, never an exception or an unhandled rejection', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await frameFor(page, 'allow-scripts allow-same-origin');
    const out = await page.evaluate(async () => {
      const iframe = document.getElementById('lock-frame') as HTMLIFrameElement;
      const doc = iframe.contentDocument!;
      const canvas = doc.getElementById('c') as HTMLCanvasElement;
      const m = await import('/src/map/pointer-lock-gate.ts' as string);
      let asked = 0;
      const real = canvas.requestPointerLock.bind(canvas);
      canvas.requestPointerLock = ((...a: unknown[]) => (asked++, (real as (...x: unknown[]) => unknown)(...a))) as typeof canvas.requestPointerLock;
      let reported = '';
      // the frame is the same origin here, but pretend the page cannot read its sandbox: the REQUEST has to find out
      const env = { ...m.browserLockEnv(), doc, frame: () => null, store: (() => { let v: string | null = null; return { get: () => v, set: (x: string | null) => (v = x) }; })() };
      const gate = new m.PointerLockGate(env, (r: string) => (reported = r));
      const stop = gate.attach();
      const verdict = await gate.request(canvas);
      const again = await gate.request(canvas);
      stop();
      return { verdict, again, asked, reported, blocked: gate.blocked, mode: gate.effectiveMode('lock'), locked: doc.pointerLockElement === canvas };
    });
    expect(out.verdict).toEqual({ state: 'refused', reason: 'refused' });
    expect(out.again).toEqual({ state: 'blocked', reason: 'refused' }); // not asked twice
    expect(out.asked).toBe(1);
    expect(out.reported).toBe('refused');
    expect(out.blocked).toBe('refused');
    expect(out.mode).toBe('drag');
    expect(out.locked).toBe(false);
    expect(errors).toEqual([]);
  });

  test('with a real click in the top-level page the lock is granted where the browser grants it (reported, not required)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.id = 'lock-canvas';
      c.width = 300;
      c.height = 200;
      c.style.cssText = 'position:fixed;left:20px;top:20px;width:300px;height:200px;z-index:99999;background:#abc';
      document.body.appendChild(c);
      (window as unknown as { __verdict: Promise<unknown> }).__verdict = new Promise((res) => {
        c.addEventListener('pointerdown', async () => {
          const m = await import('/src/map/pointer-lock-gate.ts' as string);
          res(await new m.PointerLockGate(m.browserLockEnv()).request(c));
        }, { once: true });
      });
    });
    await page.mouse.click(100, 100);
    const verdict = (await page.evaluate(() => (window as unknown as { __verdict: Promise<{ state: string }> }).__verdict)) as { state: string };
    test.info().annotations.push({ type: 'real click', description: `pointer lock verdict in headless Chromium: ${verdict.state}` });
    expect(['locked', 'refused']).toContain(verdict.state); // either is a clean verdict; "locked" is what a desktop browser answers
    await page.evaluate(() => document.exitPointerLock?.());
  });
});
