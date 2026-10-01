import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-016 S3 evidence: the player panel (components/media-player-panel.ts + media-player-volume.ts), its routing from <media-remote>, the area
// card and the home widget, in DEMO MODE (no backend: the client answers from its in-memory MOCK adapter, media-players-mock.ts - two
// fixture houses: "ma" with a music library, "sonos" without Music Assistant). The spec drives the app on the Vite DEV server so it can reach
// the very same mock store the app uses (`import(PM_URL)` inside the page):
//   npx vite --host 127.0.0.1 --port 4501   then   SW_BASE_URL=http://127.0.0.1:4501/ npx playwright test evidence-media-player-panel --project=desktop
// SW_SHOTS=<dir> saves the screenshots there (docs/design/evidence/CR-016/s3). One project only: the spec sets the three widths itself.
// `<media-player-card>` is S2's; until it merges the spec injects tests/fixtures/media-player-card-stub.js (defines the tag only if the product has not).
const SHOTS = process.env.SW_SHOTS ?? '';
const PM_URL = '/src/api/media-players-mock.ts';
const MM_URL = '/src/api/media-screens-mock.ts';
const HOME_CFG_URL = '/src/api/home-config.ts';
const STUB = fileURLToPath(new URL('./fixtures/media-player-card-stub.js', import.meta.url));
const SIZES = [
  { w: 1440, h: 900 },
  { w: 820, h: 1180 },
  { w: 390, h: 844 },
] as const;

type House = 'ma' | 'sonos';
type Sent = { key: string; command: Record<string, unknown> };

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/** The same state at 1440 / 820 / 390 (or only the widths listed). */
async function shots(page: Page, name: string, widths: readonly number[] = [1440, 820, 390]) {
  for (const s of SIZES) {
    if (!widths.includes(s.w)) continue;
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(350);
    await shot(page, `${name}-${s.w}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

/** The app in demo mode with a glass stage behind the panel (what the players page / area screen would be) and a fresh mock house. */
async function stage(page: Page, opts: { scheme?: 'light' | 'dark'; house?: House } = {}) {
  await page.goto('./');
  await page.waitForFunction(() => !!customElements.get('media-player-panel') && !!customElements.get('media-remote') && !!customElements.get('sw-drawer'));
  await page.addScriptTag({ path: STUB });
  await page.evaluate(
    async ([scheme, url, house]) => {
      const mod = await import(/* @vite-ignore */ url);
      mod.resetPlayersMock(house);
      document.querySelectorAll('#pn-stage').forEach((e) => e.remove());
      const st = document.createElement('div');
      st.id = 'pn-stage';
      const dark = scheme === 'dark';
      st.style.cssText = `position:fixed;inset:0;z-index:50;overflow:auto;padding:24px;background:${
        dark
          ? 'radial-gradient(1200px 600px at 80% -10%,rgba(255,184,86,.22),transparent 60%),radial-gradient(900px 500px at 10% 110%,rgba(10,132,255,.25),transparent 60%),#0a0a0c'
          : 'radial-gradient(1100px 560px at 85% -12%,rgba(255,184,86,.2),transparent 60%),radial-gradient(900px 520px at 8% 112%,rgba(10,132,255,.16),transparent 60%),linear-gradient(180deg,#eef2f9,#e5eaf4)'
      }`;
      document.body.appendChild(st);
    },
    [opts.scheme ?? 'light', PM_URL, opts.house ?? 'ma'] as const,
  );
}

/** Runs `fn(store)` in the page against the app's own players mock store. */
async function withMock<T>(page: Page, fn: (m: any) => T | Promise<T>): Promise<T> {
  return page.evaluate(
    async ([url, src]) => {
      const mod = await import(/* @vite-ignore */ url);
      // eslint-disable-next-line no-new-func
      return new Function('m', `return (${src})(m)`)(mod.playersMock());
    },
    [PM_URL, fn.toString()] as const,
  );
}

const sent = (page: Page): Promise<Sent[]> => withMock(page, (m) => m.sent.map((x: any) => ({ key: x.key, command: x.command })));
const id = (k: string) => `mp-${k}`;

/** Opens a panel on the stage for a mock player and waits for it to be drawn. */
async function openPanel(page: Page, key: string, scheme: 'light' | 'dark' = 'light') {
  await page.evaluate(([k, sch]) => {
    const st = document.querySelector('#pn-stage')!;
    st.querySelectorAll('media-player-panel').forEach((e) => e.remove());
    const el = document.createElement('media-player-panel') as HTMLElement & { deviceKey: string; open: boolean; scheme: string };
    el.scheme = sch;
    el.deviceKey = k;
    el.open = true;
    st.appendChild(el);
  }, [key, scheme] as const);
  await page.locator('media-player-panel [data-pn-state]:not([data-pn-state="loading"])').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(450);
}

const q = (page: Page, sel: string): Locator => page.locator('#pn-stage media-player-panel').locator(sel);

/** Sets a range input's value the way a drag does (input events), optionally ending it (change). */
async function setRange(loc: Locator, value: number, end = false) {
  await loc.evaluate((el, [v, ch]) => {
    const i = el as HTMLInputElement;
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    if (ch) i.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, [value, end] as const);
}

/** The panel's body has no horizontal overflow at the current width. */
async function noOverflow(page: Page) {
  const w = await page.evaluate(() => {
    const p = document.querySelector('#pn-stage media-player-panel') as HTMLElement | null;
    const r = p?.shadowRoot?.querySelector('sw-drawer')?.shadowRoot?.querySelector('.body') as HTMLElement | null;
    return r ? { sw: r.scrollWidth, cw: r.clientWidth } : null;
  });
  expect(w).not.toBeNull();
  expect(w!.sw).toBeLessThanOrEqual(w!.cw + 1);
}

test.describe.configure({ mode: 'serial' });

test.describe('the player panel: a speaker that plays (house with a music library)', () => {
  test('playing, not in a group: artwork, title, artist, album, seekable bar, transport, volume, up next, library tabs; opening sends nothing', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void delete m.grp.liv); // liv plays on its own
    await openPanel(page, id('liv'));
    expect(await sent(page)).toEqual([]); // opening sends nothing
    await expect(q(page, '[data-pn-state="on"]')).toBeVisible();
    await expect(q(page, '[data-pn-title]')).toHaveText('Blue in Green');
    await expect(q(page, '[data-pn-artist]')).toHaveText('Miles Davis');
    await expect(q(page, '[data-pn-word]')).toHaveText('מנגן');
    await expect(q(page, '[data-pn-seek]')).toBeVisible();
    await expect(q(page, '[data-pn-tp="shuffle"]')).toBeVisible();
    await expect(q(page, '[data-pn-tp="repeat"]')).toBeVisible();
    await expect(q(page, '[data-pn-upnext="rows"]')).toBeVisible();
    await expect(q(page, '[data-pn-libtab]')).toHaveCount(3);
    await expect(q(page, '[data-pn-group]')).toBeVisible(); // can group: the other rooms of the same layer
    await expect(q(page, '[data-pn-room]').first()).toBeVisible();
    // volume_max 70 is set on this speaker: its marker is drawn; a speaker without a ceiling draws none
    await expect(q(page, 'media-player-volume [data-pv-cap]')).toHaveAttribute('data-pv-cap', '70');
    await shots(page, 'panel-playing-light');
    await noOverflow(page);
  });

  test('dark at 1440 and 390', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await withMock(page, (m) => void delete m.grp.liv);
    await openPanel(page, id('liv'), 'dark');
    await shots(page, 'panel-playing-dark');
  });

  test('a speaker without a ceiling draws no marker and the slider is never clamped (no default ceiling)', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('per')); // pergola: station, no volume_max
    await expect(q(page, '[data-pv="single"] [data-pv-cap]')).toHaveCount(0);
    await setRange(q(page, '[data-pv-slider]'), 100);
    await page.waitForTimeout(600);
    expect((await sent(page)).filter((x) => x.command.command === 'volume_set')).toEqual([{ key: id('per'), command: { command: 'volume_set', level: 100 } }]);
    await expect(q(page, '[data-pv="single"] [data-pv-value]')).toHaveText('100');
  });

  test('a station: "שידור חי" and no progress bar, no seek; the transport still follows the caps', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('per'));
    await expect(q(page, '[data-pn-word]')).toHaveText('תחנה');
    await expect(q(page, '[data-pn-live]')).toContainText('שידור חי');
    await expect(q(page, '[data-pn-progress]')).toHaveCount(0);
    await expect(q(page, '[data-pn-seek]')).toHaveCount(0);
    await expect(q(page, '[data-pn-art="station"]')).toBeVisible();
    await shots(page, 'panel-station-light');
  });

  test('a leader: group slider, "לפי חדר" with a slider per room, the group section; the group slider clamps only the room that has a ceiling', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('liv')); // leader of liv + kit
    await expect(q(page, '[data-pv="group"]')).toBeVisible();
    await expect(q(page, '[data-pn-gcount]')).toHaveText('2 חדרים');
    await q(page, '[data-pv-rooms]').click();
    await expect(q(page, '[data-pv-room]')).toHaveCount(2);
    await expect(q(page, '[data-pv-room]').first()).toContainText('מוביל');
    await shots(page, 'panel-leader-rooms-light');
    // the group slider to 100: relative - the loudest lands on 100 where no ceiling is set, the living room stops at its own ceiling of 70
    await setRange(q(page, '[data-pv-group]'), 100);
    await expect(q(page, '[data-pv-room="mp-liv"] [data-pv-outcome="clamped"]')).toBeVisible({ timeout: 6000 });
    await expect(q(page, '[data-pv-room="mp-liv"] [data-pv-value]')).toHaveText('70');
    await expect(q(page, '[data-pv-room="mp-kit"] [data-pv-value]')).toHaveText('65');
    await expect(q(page, '[data-pv-room="mp-kit"] [data-pv-cap]')).toHaveCount(0); // no ceiling set on the kitchen: nothing drawn, nothing clamped
    expect((await sent(page)).filter((x) => x.command.command === 'volume_set')).toEqual([]); // the group goes through the group route, not per-device commands
    await shots(page, 'panel-leader-clamped-light');
    // "אותה עוצמה": one level on all rooms (absolute), each still limited by its own ceiling
    await q(page, '[data-pv-equalize]').click();
    await expect(q(page, '[data-pv-room="mp-kit"] [data-pv-value]')).toHaveText('70', { timeout: 6000 });
  });

  test('a member: "מנגן עם סלון", the leader\'s music and group; transport acts on the leader (the server resolves it)', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('kit'));
    await expect(q(page, '[data-pn-word]')).toHaveText('מנגן עם סלון');
    await expect(q(page, '[data-pn-title]')).toHaveText('Blue in Green');
    await expect(q(page, '[data-pv="group"]')).toBeVisible();
    await expect(q(page, '[data-pn-upnext="rows"]')).toBeVisible();
    await q(page, '[data-pn-tp="next"]').click();
    await expect.poll(async () => (await sent(page)).map((x) => `${x.key}:${x.command.command}`)).toContain('mp-kit:transport');
    await shots(page, 'panel-member-light');
  });

  test('a static group: its members as rooms, the group slider, no join section', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      const r = m.rows.find((x: any) => x.seed.id === 'sgrp');
      r.st = 'playing';
      r.track = 'blue';
      r.pos = 30;
      r.queue = { count: 5, index: 0 };
    });
    await openPanel(page, id('sgrp'));
    await expect(q(page, '[data-pn-state="on"]')).toBeVisible();
    await q(page, '[data-pv-rooms]').click();
    await expect(q(page, '[data-pv-room]')).toHaveCount(2);
    await expect(q(page, '[data-pn-group]')).toHaveCount(0);
    await shots(page, 'panel-static-group-light');
  });
});

test.describe('the player panel: receiver, off, unavailable, view-only, greyed', () => {
  test('a receiver with a second zone: power, volume, sources, sound modes (no keys) and a zone switch; Zone2 has its own power, volume and source', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('ampl'));
    await expect(q(page, '[data-pn-kind="receiver"]')).toBeVisible();
    await expect(q(page, '[data-pn-zones] [data-pn-zone]')).toHaveCount(2);
    await expect(q(page, '[data-pn-source]')).toHaveCount(4);
    await expect(q(page, '[data-pn-mode]')).toHaveCount(5);
    await expect(q(page, '[data-pn-transport]')).toHaveCount(0); // no keys, no transport
    await expect(q(page, '[data-pn-source="TV"]')).toHaveAttribute('aria-checked', 'true');
    await shots(page, 'panel-receiver-light');
    await q(page, '[data-pn-source="Game"]').click();
    await expect(q(page, '[data-pn-source="Game"]')).toHaveAttribute('aria-checked', 'true', { timeout: 6000 });
    await q(page, '[data-pn-mode="קולנוע"]').click();
    await expect(q(page, '[data-pn-mode="קולנוע"]')).toHaveAttribute('aria-checked', 'true', { timeout: 6000 });
    // Zone2 is off: the big power over a dimmed body; turning it on is an explicit tap and carries the zone
    await q(page, '[data-pn-zone="z2"]').click();
    await expect(q(page, '[data-pn-off]')).toBeVisible();
    await shots(page, 'panel-receiver-zone2-off-light');
    await q(page, '[data-pn-off] [data-pn-power="on"]').click();
    await expect(q(page, '[data-pn-zone-power="off"]')).toBeVisible({ timeout: 6000 });
    await q(page, '[data-pn-source="Bluetooth"]').click();
    await expect(q(page, '[data-pn-source="Bluetooth"]')).toHaveAttribute('aria-checked', 'true', { timeout: 6000 });
    const cmds = (await sent(page)).map((x) => x.command);
    expect(cmds).toEqual([
      { command: 'source', source_id: 'Game' },
      { command: 'sound_output', output: 'קולנוע' },
      { command: 'power_on', zone: 'z2' },
      { command: 'source', source_id: 'Bluetooth', zone: 'z2' },
    ]);
    await shots(page, 'panel-receiver-zone2-on-light');
  });

  test('off: the big "הפעל" over a dimmed inert body; turning on is an explicit tap, and only then', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await openPanel(page, id('off'), 'dark');
    await expect(q(page, '[data-pn-state="off"]')).toBeVisible();
    await expect(q(page, '.dimmed')).toHaveAttribute('inert', '');
    expect(await sent(page)).toEqual([]);
    await shots(page, 'panel-off-dark');
    await q(page, '[data-pn-off] [data-pn-power="on"]').click();
    await expect(q(page, '[data-pn-state="on"]')).toBeVisible({ timeout: 6000 });
    expect((await sent(page)).map((x) => x.command)).toEqual([{ command: 'power_on' }]);
  });

  test('unavailable: "הרמקול לא זמין", since when, nothing else', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('gym'));
    await expect(q(page, '[data-pn-unavailable] b')).toHaveText('הרמקול לא זמין');
    await expect(q(page, '[data-pn-unavailable] small')).toContainText('מאז');
    await expect(q(page, '[data-pn-tp]')).toHaveCount(0);
    await expect(q(page, 'media-player-volume')).toHaveCount(0);
    await shots(page, 'panel-unavailable-light');
  });

  test('view-only (media.read only): the state and "הבא בתור", no controls at all', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      const down = (d: any) => ({ ...d, can: { ...d.can, control: false, power: false, bulk: false, group: false } });
      const get = m.get.bind(m);
      const list = m.list.bind(m);
      m.get = async (k: string) => down(await get(k));
      m.list = async (qq: any) => ({ devices: (await list(qq)).devices.map(down) });
    });
    await openPanel(page, id('liv'));
    await expect(q(page, '[data-pn-state="on"][data-view-only]')).toBeVisible();
    await expect(q(page, '[data-pn-now]')).toBeVisible();
    await expect(q(page, '[data-pn-upnext="rows"]')).toBeVisible();
    await expect(q(page, '[data-pn-seek]')).toHaveCount(0); // a bar, not a control
    await expect(q(page, '[data-pn-progress] .bar')).toBeVisible();
    for (const sel of ['[data-pn-transport]', 'media-player-volume', '[data-pn-libtabs]', '[data-pn-group]', '[data-pn-power]']) await expect(q(page, sel)).toHaveCount(0);
    await shots(page, 'panel-viewonly-light');
  });

  test('caps_known false with a power that still reads on: every control is drawn greyed and nothing can be sent', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      const mute = (d: any) => (d.key === 'mp-par' ? { ...d, live: { ...d.live, caps_known: false } } : d);
      const get = m.get.bind(m);
      m.get = async (k: string) => mute(await get(k));
    });
    await openPanel(page, id('par'));
    await expect(q(page, '[data-pn-state="on"][data-greyed]')).toBeVisible();
    for (const t of ['shuffle', 'previous', 'play_pause', 'next', 'repeat']) await expect(q(page, `[data-pn-tp="${t}"]`)).toBeDisabled();
    await expect(q(page, '[data-pv-slider]')).toBeDisabled();
    await expect(q(page, '[data-pn-libtab]')).toHaveCount(0); // no library read without a known capability
    await expect(q(page, '[data-pn-power]')).toHaveCount(0);
    expect(await sent(page)).toEqual([]);
  });

  test('a grouping conflict: "קיבוץ לא תואם" and no join control', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('gst'));
    await expect(q(page, '[data-pn-conflict]')).toContainText('קיבוץ לא תואם');
    await expect(q(page, '[data-pn-room]')).toHaveCount(0);
    await shots(page, 'panel-conflict-light');
  });
});

test.describe('the player panel: commands, honest outcomes, rate limits', () => {
  test('play / pause is pending until the state confirms; seek and shuffle / repeat send exactly one command each', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void delete m.grp.liv);
    await openPanel(page, id('liv'));
    await q(page, '[data-pn-tp="play_pause"]').click();
    await expect(q(page, '[data-pn-tp="play_pause"][aria-label="נגן"]')).toBeVisible({ timeout: 6000 }); // paused: the pad now offers play
    await expect(q(page, '[data-pn-word]')).toHaveText('מושהה');
    await q(page, '[data-pn-tp="shuffle"]').click();
    await expect(q(page, '[data-pn-tp="shuffle"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 6000 });
    await q(page, '[data-pn-tp="repeat"]').click();
    await expect(q(page, '[data-pn-tp="repeat"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 6000 });
    await page.waitForTimeout(700);
    await setRange(q(page, '[data-pn-seek]'), 750, true);
    await expect.poll(async () => (await sent(page)).some((x) => x.command.command === 'seek'), { timeout: 6000 }).toBe(true);
    expect((await sent(page)).map((x) => x.command)).toEqual([
      { command: 'transport', action: 'play_pause' },
      { command: 'shuffle', on: true },
      { command: 'repeat', mode: 'all' },
      { command: 'seek', position_s: 253 }, // 750 / 1000 of 337 s
    ]);
  });

  test('not confirmed: an accepted command that the state never shows is "הנגן לא אישר את הפקודה" after 8 s, and the last state is back', async ({ page }) => {
    test.setTimeout(60_000);
    await stage(page);
    await withMock(page, (m) => {
      delete m.grp.liv;
      m.command = async (_k: string, body: any) => ({ command_id: body.client_request_id, status: 'accepted', action_id: null, confirm: 'state', error: null }); // accepted, never applied
    });
    await openPanel(page, id('liv'));
    await q(page, '[data-pn-tp="shuffle"]').click();
    await expect(q(page, '[data-pn-tp="shuffle"].pend')).toBeVisible();
    await shot(page, 'panel-pending-light-1440');
    await expect(q(page, '[data-pn-notice]')).toHaveText('הנגן לא אישר את הפקודה', { timeout: 14_000 });
    await expect(q(page, '[data-pn-tp="shuffle"]')).toHaveAttribute('aria-pressed', 'false'); // the last confirmed state
    await expect(q(page, '[data-pn-tp="shuffle"].pend')).toHaveCount(0);
    await shots(page, 'panel-not-confirmed-light');
  });

  test('rate limit: a burst of presses is dropped with a short shake (no text) and never queued', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void delete m.grp.liv);
    await openPanel(page, id('liv'));
    await page.evaluate(() => {
      const b = document.querySelector('#pn-stage media-player-panel')!.shadowRoot!.querySelector('[data-pn-tp="next"]') as HTMLElement;
      for (let i = 0; i < 16; i++) b.click();
    });
    await expect(q(page, '.tport.shake')).toBeVisible({ timeout: 2000 });
    await expect(q(page, '[data-pn-notice]')).toHaveCount(0); // no text
    await page.waitForTimeout(1500);
    const n = (await sent(page)).filter((x) => x.command.command === 'transport').length;
    expect(n).toBeLessThanOrEqual(9); // the client's bucket: burst 8 (+ at most one refill)
    expect(n).toBeGreaterThanOrEqual(1);
  });

  test('the keyboard: a held "+" sends volume steps that repeat (200 ms) and stop on release', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void delete m.grp.liv);
    await openPanel(page, id('liv'));
    await page.keyboard.down('+');
    await page.waitForTimeout(1100);
    await page.keyboard.up('+');
    const n = (await sent(page)).filter((x) => x.command.command === 'volume_step').length;
    expect(n).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(500);
    expect((await sent(page)).filter((x) => x.command.command === 'volume_step').length).toBe(n); // released: no more
  });

  test('a device that only steps (no volume_set) gets the "-" / "+" pair; holding "+" repeats and releasing stops', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      delete m.grp.liv;
      const get = m.get.bind(m);
      m.get = async (k: string) => {
        const d = await get(k);
        return k === 'mp-par' ? { ...d, caps: { ...d.caps, volume_set: false } } : d;
      };
    });
    await openPanel(page, id('par'));
    await expect(q(page, '[data-pv="step"]')).toBeVisible();
    await expect(q(page, '[data-pv-slider]')).toHaveCount(0);
    await shot(page, 'panel-volume-steps-light-1440');
    const up = q(page, '[data-key="volup"]');
    const box = (await up.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    const n = (await sent(page)).filter((x) => x.command.command === 'volume_step').length;
    expect(n).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(600);
    expect((await sent(page)).filter((x) => x.command.command === 'volume_step').length).toBe(n);
    // every step is one deliberate press of the same direction
    expect((await sent(page)).filter((x) => x.command.command === 'volume_step').every((x) => x.command.direction === 'up')).toBe(true);
  });

  test('a ceiling set by the night window: the marker and the clamp appear only inside the window', async ({ page }) => {
    await stage(page);
    // the parents' speaker has a night window 22:00-07:00 / 25 and no volume_max
    await page.evaluate(() => {
      const st = document.querySelector('#pn-stage')!;
      const el = document.createElement('media-player-panel') as any;
      el.clock = () => new Date(2026, 9, 1, 23, 30);
      el.scheme = 'light';
      el.deviceKey = 'mp-par';
      el.open = true;
      st.appendChild(el);
    });
    await q(page, '[data-pn-state="on"]').waitFor();
    await expect(q(page, '[data-pv-cap]')).toHaveAttribute('data-pv-cap', '25');
    await setRange(q(page, '[data-pv-slider]'), 90);
    await expect(q(page, '[data-pv="single"] [data-pv-value]')).toHaveText('25'); // clamped by the window
    await page.evaluate(() => {
      const el = document.querySelector('#pn-stage media-player-panel') as any;
      el.clock = () => new Date(2026, 9, 1, 12, 0);
      el.requestUpdate();
    });
    await expect(q(page, '[data-pv-cap]')).toHaveCount(0); // noon: no window, no marker
  });
});

test.describe('the player panel: the library, "הבא בתור" and transfer', () => {
  test('a favourite starts with one tap, "נגן אחרי הנוכחי" with a long press; only server-listed items travel (item_ref)', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void delete m.grp.liv);
    await openPanel(page, id('liv'));
    await q(page, '[data-pn-libtab="stations"]').click();
    await expect(q(page, '[data-pn-lib="stations"] [data-pn-item]')).toHaveCount(5);
    await q(page, '[data-pn-item]').nth(1).click(); // 88FM
    await expect(q(page, '[data-pn-title]')).toHaveText('88FM', { timeout: 6000 });
    await q(page, '[data-pn-libtab="favourites"]').click();
    const item = q(page, '[data-pn-lib="favourites"] [data-pn-item]').nth(1);
    await item.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1100); // play_item is 1/s: the second start is a separate, deliberate press
    const box = (await item.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const plays = (await sent(page)).filter((x) => x.command.command === 'play_item').map((x) => x.command);
    expect(plays).toHaveLength(2);
    expect(plays[0]).toMatchObject({ command: 'play_item', item_ref: expect.stringMatching(/^[a-f0-9]{24}$/) });
    expect(plays[0]).not.toHaveProperty('enqueue');
    expect(plays[1]).toMatchObject({ command: 'play_item', enqueue: 'next' });
    await shots(page, 'panel-library-light');
  });

  test('without a library (the music layer is unavailable): no library tabs, "הבא בתור" reads "לא זמין" - never an empty list', async ({ page }) => {
    await stage(page);
    await withMock(page, async (m: any) => {
      delete m.grp.liv;
      const clientUrl = '/src/api/client.ts';
      const { ApiError } = await import(/* @vite-ignore */ clientUrl);
      m.failUpNext = true;
      m.library = async () => {
        throw new ApiError(503, { code: 'no_library', user_message: 'אין ספריית מוזיקה.', retryable: false, correlation_id: 'x', details: {} });
      };
    });
    await openPanel(page, id('liv'));
    await expect(q(page, '[data-pn-upnext="unavailable"]')).toContainText('לא זמין');
    await expect(q(page, '[data-pn-libtab]')).toHaveCount(0);
    await expect(q(page, '[data-pn-upnext="rows"]')).toHaveCount(0);
    await expect(q(page, '[data-pn-tp="play_pause"]')).toBeEnabled(); // the cards keep working
    await shots(page, 'panel-nolib-light');
  });

  test('an unconfirmed queue read is never an empty list (the read fails while the title is known)', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      delete m.grp.liv;
      m.failUpNext = true;
    });
    await openPanel(page, id('liv'));
    await expect(q(page, '[data-pn-upnext="unavailable"]')).toBeVisible();
    await expect(q(page, '[data-pn-libtab]')).toHaveCount(3); // the library itself is fine
  });

  test('transfer: "העבר את המוזיקה לכאן" from the room that plays (a menu when several play); only on a device that is not playing', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('balc')); // idle, MA layer
    await expect(q(page, '[data-pn-transfer]')).toBeVisible();
    await q(page, '[data-pn-transfer] button').click();
    await expect(q(page, '[data-pn-transfer-from]').first()).toBeVisible();
    await shots(page, 'panel-transfer-menu-light');
    await q(page, '[data-pn-transfer-from="mp-per"]').click();
    await expect(q(page, '[data-pn-state="on"] [data-pn-title]')).toHaveText('גלגלצ', { timeout: 6000 });
    expect((await sent(page)).map((x) => x.command)).toEqual([{ command: 'transfer', from_key: 'mp-per' }]);
    await expect(q(page, '[data-pn-transfer]')).toHaveCount(0); // it plays now
  });
});

test.describe('the player panel: the group section', () => {
  test('ticks are batched 500 ms into ONE join; a room that does not join is named by its room', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      delete m.grp.liv; // liv on its own: two ticks make a group of three on one floor (no confirmation)
      m.refuseJoin.add('mp-per');
    });
    await openPanel(page, id('liv'));
    await q(page, '[data-pn-room="mp-balc"]').click();
    await q(page, '[data-pn-room="mp-per"]').click();
    await expect(q(page, '[data-pn-room="mp-per"][aria-checked="true"]')).toBeVisible(); // ticked at once, sent after the quiet
    expect(await withMock(page, (m) => m.sent.length)).toBe(0);
    await expect(q(page, '[data-pn-gout="not_joined"]')).toHaveText('לא הצטרף', { timeout: 8000 });
    await expect(q(page, '[data-pn-notice]')).toContainText('פרגולה לא הצטרף');
    await expect(q(page, '[data-pn-room="mp-balc"][aria-checked="true"]')).toBeVisible();
    await expect(q(page, '[data-pn-room="mp-per"][aria-checked="false"]')).toBeVisible();
    // one join request carried both ticks: the room that joined is in, the refused one is not
    expect(await withMock(page, (m) => m.grp.liv)).toEqual(['balc']);
    await shots(page, 'panel-group-partial-light');
  });

  test('4 or more rooms, or more than one floor: a confirmation before anything is sent; cancel sends nothing', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('liv'));
    await q(page, '[data-pn-room="mp-per"]').click();
    await q(page, '[data-pn-room="mp-par"]').click(); // parents' room: another floor, and the group reaches 4 rooms
    const dlg = page.locator('#pn-stage media-player-panel sw-dialog[data-pn-dialog="confirm"]');
    await expect(dlg).toHaveAttribute('heading', 'לצרף 4 חדרים לקבוצה אחת?', { timeout: 4000 });
    await expect(dlg).toContainText('הקבוצה תשמיע ב־2 קומות.');
    expect(await withMock(page, (m) => m.grp.liv)).toEqual(['kit']); // nothing sent yet
    await shots(page, 'panel-group-confirm-light');
    await dlg.locator('details summary').click();
    await expect(dlg).toContainText('רמקול הורים');
    await page.locator('#pn-stage media-player-panel [data-pn-cancel]').click();
    await expect(dlg).toHaveCount(0);
    expect(await withMock(page, (m) => m.grp.liv)).toEqual(['kit']); // cancel sent nothing
    await expect(q(page, '[data-pn-room="mp-per"][aria-checked="false"]')).toBeVisible();
    // again, this time confirmed
    await q(page, '[data-pn-room="mp-per"]').click();
    await q(page, '[data-pn-room="mp-par"]').click();
    await expect(dlg.locator('[role="dialog"]')).toBeVisible({ timeout: 4000 });
    await page.locator('#pn-stage media-player-panel [data-pn-confirm]').click();
    await expect.poll(() => withMock(page, (m) => [...m.grp.liv].sort()), { timeout: 8000 }).toEqual(['kit', 'par', 'per']);
  });

  test('"פרק" dissolves the group; a room of another layer, an unavailable room or a conflicting one is never offered', async ({ page }) => {
    await stage(page);
    await openPanel(page, id('liv'));
    const rooms = await q(page, '[data-pn-room]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.pnRoom));
    expect(rooms).not.toContain('mp-gym'); // unavailable
    expect(rooms).not.toContain('mp-gst'); // conflict
    expect(rooms).not.toContain('mp-kids'); // a player without grouping
    expect(rooms).not.toContain('mp-ampl'); // a receiver
    await q(page, '[data-pn-ungroup]').click();
    await expect(q(page, '[data-pn-gcount]')).toHaveCount(0, { timeout: 6000 });
    expect(await withMock(page, (m) => m.grp.liv)).toBeUndefined();
  });
});

test.describe('the player panel: the house without a music assistant (Sonos)', () => {
  test('favourites and stations only (no playlists), no transfer, no next item: "עוד N"; a leader with its room', async ({ page }) => {
    await stage(page, { house: 'sonos' });
    await openPanel(page, id('liv'));
    await expect(q(page, '[data-pn-libtab]')).toHaveCount(2);
    await expect(q(page, '[data-pn-libtab="playlists"]')).toHaveCount(0);
    await expect(q(page, '[data-pn-next]')).toHaveCount(0);
    await expect(q(page, '[data-pn-more]')).toContainText('עוד');
    await expect(q(page, '[data-pn-transfer]')).toHaveCount(0);
    await expect(q(page, '[data-pv="group"]')).toBeVisible();
    await shots(page, 'panel-sonos-light');
  });

  test('dark: a paused speaker with a night window', async ({ page }) => {
    await stage(page, { house: 'sonos', scheme: 'dark' });
    await openPanel(page, id('bed'), 'dark');
    await expect(q(page, '[data-pn-word]')).toHaveText('מושהה');
    await shots(page, 'panel-sonos-dark');
  });

  test('a member of the Sonos group', async ({ page }) => {
    await stage(page, { house: 'sonos' });
    await openPanel(page, id('kit'));
    await expect(q(page, '[data-pn-word]')).toHaveText('מנגן עם סלון');
    await shots(page, 'panel-sonos-member-light');
  });
});

test.describe('routing from <media-remote>, the area card and the home widget', () => {
  test('<media-remote> opens the panel for a non-screen key (told the kind, or learning it) and keeps drawing screens as before', async ({ page }) => {
    await stage(page);
    await page.evaluate(() => {
      const st = document.querySelector('#pn-stage')!;
      for (const kind of ['speaker', '']) {
        const el = document.createElement('media-remote') as any;
        el.scheme = 'light';
        el.deviceKey = 'mp-liv';
        if (kind) el.kind = kind;
        el.open = false;
        el.dataset.k = kind || 'learn';
        st.appendChild(el);
      }
    });
    for (const k of ['speaker', 'learn']) {
      await page.evaluate((kk) => ((document.querySelector(`#pn-stage media-remote[data-k="${kk}"]`) as any).open = true), k);
      await expect(page.locator(`#pn-stage media-remote[data-k="${k}"] media-player-panel [data-pn-state="on"]`)).toBeVisible({ timeout: 8000 });
      await page.evaluate((kk) => ((document.querySelector(`#pn-stage media-remote[data-k="${kk}"]`) as any).open = false), k);
      await page.waitForTimeout(300);
    }
    // a screen key still gets the TV remote
    await page.evaluate(async (url) => {
      (await import(/* @vite-ignore */ url)).resetMediaMock();
    }, MM_URL);
    await page.evaluate(() => {
      const st = document.querySelector('#pn-stage')!;
      const el = document.createElement('media-remote') as any;
      el.deviceKey = 'md-living';
      el.dataset.k = 'tv';
      el.open = true;
      st.appendChild(el);
    });
    await expect(page.locator('#pn-stage media-remote[data-k="tv"] [data-mr-state="on"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#pn-stage media-remote[data-k="tv"] media-player-panel')).toHaveCount(0);
  });

  test("the area card draws the area's speakers next to its TVs; a speaker opens the player panel, \"כבה הכל\" stays screens-only", async ({ page }) => {
    await stage(page);
    await page.evaluate(async (url) => {
      const mm = await import(/* @vite-ignore */ url);
      mm.resetMediaMock();
      const k = mm.mediaMock().rows.find((r: any) => r.device.key === 'md-kitchen').device; // two screens in the living room, like the CR-015 spec
      k.area_id = 'living';
      k.area_name = 'סלון';
      k.floor_id = 'g';
      k.live.confirmed = false;
    }, MM_URL);
    await page.evaluate(() => {
      const st = document.querySelector('#pn-stage') as HTMLElement;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'max-inline-size:520px;margin-inline:auto;padding-block-start:40px';
      const card = document.createElement('sw-card') as HTMLElement & { heading: string; subheading: string };
      card.heading = 'מולטימדיה';
      const el = document.createElement('media-area-card') as HTMLElement & { areaId: string; areaName: string };
      el.areaId = 'living';
      el.areaName = 'סלון';
      card.appendChild(el);
      wrap.appendChild(card);
      st.appendChild(wrap);
    });
    await page.locator('[data-media-tile]').first().waitFor();
    await expect(page.locator('[data-media-tile]')).toHaveCount(2); // the screens, unchanged
    await expect(page.locator('[data-player-tile]')).toHaveCount(2); // רמקול סלון + מגבר סלון
    await expect(page.locator('[data-media-area-sub="players"]')).toHaveText('רמקולים ומגברים');
    await shots(page, 'areacard-with-speakers-light');
    // "כבה הכל" is the screens' (a count of screens only)
    await page.locator('[data-media-off-all]').click();
    await expect(page.locator('sw-dialog[data-mac-dialog="ask"]')).toHaveAttribute('heading', 'לכבות מסך אחד בסלון?');
    await page.locator('[data-mac-cancel]').click();
    expect(await sent(page)).toEqual([]);
    // the speaker's "נגן" opens the player panel in the same drawer
    await page.locator('[data-player-tile="mp-liv"]').evaluate((el) => (el.shadowRoot!.querySelector('[data-stub-open]') as HTMLElement).click());
    await expect(page.locator('media-area-card media-player-panel [data-pn-state="on"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('media-area-card media-remote')).toHaveCount(1);
    await shots(page, 'areacard-speaker-panel-light');
    expect(await sent(page)).toEqual([]); // opening sent nothing
  });

  test('the home widget counts the players that play next to the screens; a player chip opens the panel; with no screen it still shows the players', async ({ page }) => {
    await stage(page);
    await page.evaluate(async (url) => {
      (await import(/* @vite-ignore */ url)).resetMediaMock();
    }, MM_URL);
    const mount = async (size: 's' | 'm' | 'l', wait = true) => {
      await page.evaluate(
        async ([sz, cfgUrl]) => {
          const cfgMod = await import(/* @vite-ignore */ cfgUrl);
          const st = document.querySelector('#pn-stage') as HTMLElement;
          st.querySelectorAll('home-widgets').forEach((e) => e.remove());
          const el = document.createElement('home-widgets') as any;
          el.config = cfgMod.defaultConfig();
          el.layout = 'hero';
          el.items = [
            { id: 'clock', avail: 'ok', size: sz, title: 'שעון' },
            { id: 'media', avail: 'ok', size: sz, title: 'מולטימדיה' },
            { id: 'quick', avail: 'ok', size: sz, title: 'פעולות מהירות' },
          ];
          el.quick = { allowed: { lights_off: true, all_off: true }, lightsOn: 4, switchesOn: 2 };
          el.data = cfgMod.NO_DATA;
          el.style.cssText = 'display:block;max-inline-size:1100px;margin-inline:auto;padding-block-start:40px';
          st.appendChild(el);
        },
        [size, HOME_CFG_URL] as const,
      );
      if (wait) await page.locator('#pn-stage [data-home-widget="media"]').waitFor();
    };
    for (const size of ['s', 'm', 'l'] as const) {
      await mount(size);
      await expect(page.locator('#pn-stage [data-home-media-count]')).toHaveText(/5/); // the screens, as before
      await expect(page.locator('#pn-stage [data-home-media-playing]')).toHaveText(/7/); // the mock house plays on seven speakers
      await shots(page, `home-widget-${size}-light`, size === 'm' ? [1440, 390] : [1440]);
    }
    await mount('m');
    await page.locator('#pn-stage [data-home-media-chip="mp-liv"]').click();
    await expect(page.locator('#pn-stage home-widgets media-player-panel [data-pn-state="on"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#pn-stage home-widgets media-player-panel sw-drawer')).toHaveAttribute('heading', 'רמקול סלון');
    await shots(page, 'home-widget-panel-light', [1440]);
    expect(await sent(page)).toEqual([]);
    await page.keyboard.press('Escape');
    // no screen at all: the players keep the widget
    await page.evaluate(async (url) => {
      (await import(/* @vite-ignore */ url)).mediaMock().rows.length = 0;
    }, MM_URL);
    await mount('m');
    await expect(page.locator('#pn-stage [data-home-media-playing]')).toHaveText(/7/);
    await expect(page.locator('#pn-stage [data-home-media-count]')).toHaveCount(0);
    // neither screens nor players: the widget draws nothing
    await withMock(page, (m) => void (m.rows.length = 0));
    await mount('m', false);
    await page.waitForTimeout(900);
    await expect(page.locator('#pn-stage [data-home-widget="media"]')).toHaveCount(0);
  });
});
