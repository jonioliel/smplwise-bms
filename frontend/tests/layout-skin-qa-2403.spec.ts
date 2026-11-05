import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PICKER_SKINS } from './helpers/frozen-skins';
import { collectTargets, failing, measureContrast, over, parseRgba, pageScroll, pixelAt, ratio, type ContrastRow } from './helpers/skin-qa-probe';
import { ACCESS, D, FOLDS, foldGeometry, installCardsMock, openAccess } from './settings-cards-mocks';
import { FAKE_MEDIA } from './live-fake-media';

// SKIN-QA-2403: the 2.40.1 / 2.40.2 surfaces in EVERY skin the product ships (the picker's skins: classic, domus, tesla, crystal, infra,
// soft - the frozen bubble is drawn as domus and is not offered) x light / dark. Until now they were checked in classic light only (the
// NOT_RUN lists of SETTINGS-INTERCOM-CARDS-2401, SETTINGS-CARDS-ACCORDION-2402, WALL-PHONE-TOOLBAR-2401, VIDEO-SUB-FALLBACK-2402).
//
//   1. Settings › "מתגי מסכי כניסה" in its four layouts - cards with the headers at the side (default), cards that open in place
//      (accordion), two tabs, one list - on a desktop; the cards on a phone.
//   2. The camera wall's phone toolbar - the icon row (default) and the two rows of labels - with its long-press name bubble.
//   3. The wall tile's tag "עבר לזרם הראשי" (a sub stream remembered as giving nothing: the tile opens on main and says so).
//
// Measured, per skin and scheme: WCAG AA text contrast on the RENDERED pixels (4.5:1; 3:1 for large text and for icons / focus rings,
// tests/helpers/skin-qa-probe.ts), clipped titles, hover / focus / pressed states, 44 px touch targets, the RTL side of the headers'
// column and of the tag, no sideways scroll anywhere, and the no-scroll rule of the default layout at 1440x900 and 1366x768 (each card
// opened in turn). Mocked backend only (page.route; synthetic data, drawn video).
//   ~/run_remote.sh preview <branch> tests/layout-skin-qa-2403.spec.ts --project=desktop --project=mobile
//   Every measurement goes to <repo>/.tmp_skinqa/*.json (SKINQA_OUT overrides) with a screenshot per state; the spec fails on a defect.
const OUT = process.env.SKINQA_OUT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.tmp_skinqa');
const SCHEMES = ['light', 'dark'] as const;
const SIZES: [number, number][] = [[1440, 900], [1366, 768]];
const HEAD_SLOT = 48; // room for one more header (the acceptance-check card, drawn only for whoever may run it)

type Scheme = (typeof SCHEMES)[number];

function save(info: TestInfo, name: string, data: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}-${info.project.name}.json`), JSON.stringify(data, null, 1));
}
async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}
/** The lowest ratio per text (a text measured in several states keeps its worst). */
function keep(all: Map<string, ContrastRow & { where: string }>, rows: ContrastRow[], where: string) {
  for (const r of rows) {
    const k = `${r.key}|${r.text}`;
    const old = all.get(k);
    if (!old || r.ratio < old.ratio) all.set(k, { ...r, where });
  }
}
/**
 * Shortfalls of SHARED components that every screen draws, not of these surfaces - reported in docs/changes/SKIN-QA-2403.md §4 for the
 * owner (a fix changes every screen that uses them), listed in each result file under `known`, not counted as this spec's defects:
 *   K1  sw-badge `filled` kind live (the pairing verdict): inverse ink on --sw-success, 1.8-3.5:1 in every skin (no --sw-on-success token);
 *   K2  sw-button primary in classic dark: the classic raised-key gradient under white ink, 4.1-4.3:1.
 */
const KNOWN: { id: string; test: (r: ContrastRow, skin: string, scheme: string) => boolean }[] = [
  { id: 'K1', test: (r) => /sw-badge>span\.t$/.test(r.key) && r.text.startsWith('מצב:') },
  { id: 'K2', test: (r, skin, scheme) => skin === 'classic' && scheme === 'dark' && /sw-button$/.test(r.key) && r.ratio >= 4 },
];
const knownOf = (r: ContrastRow, skin: string, scheme: string) => KNOWN.find((k) => k.test(r, skin, scheme))?.id ?? '';
const contrastProblems = (all: Map<string, ContrastRow & { where: string }>, skin: string, scheme: string) =>
  failing([...all.values()]).filter((r) => !knownOf(r, skin, scheme)).map((r) => `${r.where}: "${r.text}" ${r.ratio} < ${r.need} (${r.key}, ${r.size}px/${r.weight})`);
const knownRows = (all: Map<string, ContrastRow & { where: string }>, skin: string, scheme: string) =>
  failing([...all.values()]).filter((r) => knownOf(r, skin, scheme)).map((r) => `${knownOf(r, skin, scheme)} ${r.where}: "${r.text}" ${r.ratio}`);
/** Header titles must never be cut (the summary line ends in an ellipsis by design, its full text is the tooltip). */
const cutTitles = (all: Map<string, ContrastRow & { where: string }>) =>
  [...all.values()].filter((r) => r.cut && /span\.t\b/.test(r.key)).map((r) => `${r.where}: header title cut "${r.text}"`);

/** The press must follow the skin: its `--sw-press-scale` (0.97 in classic, domus, infra, soft; 1 = no press scale in the flat crystal / tesla). */
const pressScale = (page: Page) => page.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--sw-press-scale').trim() || '1'));
const scaleOf = (transform: string) => (transform === 'none' ? 1 : Number(transform.match(/matrix\(([-\d.]+)/)?.[1] ?? 1));
const pressFollows = (transform: string, token: number) => Math.abs(scaleOf(transform) - token) < 0.011;

const headLoc = (page: Page, id: string) => page.locator(`${FOLDS} [data-fold-toggle="${id}"]`);

async function openCards(page: Page, skin: string, scheme: Scheme, layout: 'cards' | 'accordion' | 'tabs' | 'list' = 'cards', hash = ACCESS) {
  await installCardsMock(page, { layout });
  await openAccess(page, hash, { skin, scheme });
  await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
  await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
  if (layout === 'cards' || layout === 'accordion') {
    await headLoc(page, 'screens').waitFor({ timeout: 30_000 });
    await expect(headLoc(page, 'calls')).toBeVisible({ timeout: 20_000 });
    await expect(headLoc(page, 'pairing')).toBeVisible();
  } else {
    await page.locator(`${D} .sections[data-access-layout]`).waitFor({ timeout: 30_000 });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

/** Hover, keyboard focus and press of one header: the state must be visible (hover / press change something, the focus ring reads at 3:1). */
async function headerStates(page: Page, id: string) {
  const head = headLoc(page, id);
  const style = () => head.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { border: cs.borderTopColor, bg: cs.backgroundColor, transform: cs.transform, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, outlineW: parseFloat(cs.outlineWidth) || 0, outlineColor: cs.outlineColor, focusVisible: el.matches(':focus-visible') };
  });
  await page.mouse.move(0, 0);
  const rest = await style();
  await head.hover();
  await page.waitForTimeout(250);
  const hover = await style();
  await page.mouse.move(0, 0);
  await head.evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.press('Shift');
  await page.waitForTimeout(100);
  const focus = await style();
  const box = (await head.boundingBox())!;
  // the ring against what is just outside it at the start-side gap between the column and the open card (left side of the header in RTL
  // is the end side; the left gap is the column gap / the card padding)
  const bg = await pixelAt(page, box.x - 7, box.y + box.height / 2);
  const ringRatio = ratio(over(parseRgba(focus.outlineColor), bg), bg);
  await head.evaluate((el) => (el as HTMLElement).blur());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const token = await pressScale(page);
  await page.mouse.down();
  await page.waitForTimeout(140);
  const pressed = await style();
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const colorDelta = (a: string, b: string) => {
    const x = parseRgba(a);
    const y = parseRgba(b);
    return Math.max(...[0, 1, 2].map((i) => Math.abs(x[i] * x[3] - y[i] * y[3])), Math.abs(x[3] - y[3]) * 255);
  };
  return {
    hoverDelta: Math.round(Math.max(colorDelta(rest.border, hover.border), colorDelta(rest.bg, hover.bg))),
    focusVisible: focus.focusVisible,
    focusRing: focus.outline,
    ringRatio: Math.round(ringRatio * 100) / 100,
    pressed: pressed.transform,
    token,
  };
}

test.describe('SKIN-QA-2403 · Settings › "מתגי מסכי כניסה" in every skin and scheme', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of PICKER_SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} ${scheme}: cards (default) fit 1440x900 and 1366x768 with any card open; contrast, states, RTL`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the sizes are set by the test itself');
        test.setTimeout(300_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const bad: string[] = [];
        const log: string[] = [];
        const all = new Map<string, ContrastRow & { where: string }>();
        let states: Awaited<ReturnType<typeof headerStates>> | null = null;
        for (const [w, h] of SIZES) {
          await page.setViewportSize({ width: w, height: h });
          await openCards(page, skin, scheme);
          const first = await foldGeometry(page);
          if (!first.wide) bad.push(`${w}x${h}: the open card does not stand beside the headers`);
          for (const id of first.heads) {
            await headLoc(page, id).click();
            await page.mouse.move(0, 0);
            await expect(headLoc(page, id)).toHaveAttribute('aria-expanded', 'true');
            await page.waitForTimeout(400);
            let s = await pageScroll(page);
            await expect.poll(async () => { s = await pageScroll(page); return s.vertical; }, { timeout: 4_000 }).toBeLessThanOrEqual(1).catch(() => undefined);
            const g = await foldGeometry(page);
            // RTL: the headers' column is at the start side (the right), the open card beside it on its left
            const side = await page.evaluate(() => {
              const diag = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-diagnostics');
              const head = diag?.shadowRoot?.querySelector('sw-fold-cards')?.shadowRoot?.querySelector('.head:not([hidden])')?.getBoundingClientRect();
              const body = diag?.shadowRoot?.querySelector('.afold-body:not([hidden])')?.getBoundingClientRect();
              const t = diag?.shadowRoot?.querySelector('sw-fold-cards')?.shadowRoot?.querySelector('.head:not([hidden]) .t');
              const range = document.createRange();
              if (t) range.selectNodeContents(t);
              const tr = t ? range.getBoundingClientRect() : null;
              return { headLeft: head?.left ?? 0, headRight: head?.right ?? 0, bodyRight: body?.right ?? 0, titleRight: tr?.right ?? 0 };
            });
            log.push(`${id} @${w}x${h}: page v ${s.vertical} / side ${s.sideways} · body ${g.bodyTop}-${g.bodyBottom} inner ${g.bodyInner}${g.bodyScroll ? ' (scrolls)' : ''} · last header ${g.lastHead} · heads ${Math.min(...g.headH)}-${Math.max(...g.headH)} px`);
            if (s.vertical > 1) bad.push(`${id} @${w}x${h}: the page scrolls ${s.vertical} px`);
            if (s.sideways > 1) bad.push(`${id} @${w}x${h}: sideways scroll ${s.sideways} px`);
            if (g.bodyScroll || g.bodyInner > 1) {
              bad.push(`${id} @${w}x${h}: the open card scrolls inside (${g.bodyInner} px)`);
              // what the card is made of (to see which part of the skin makes it taller than in classic)
              const parts = await page.evaluate((cid) => {
                const diag = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-diagnostics');
                const body = diag?.shadowRoot?.querySelector(`.afold-body[data-access-fold="${cid}"]`);
                const card = body?.querySelector('sw-card');
                const inner = card?.shadowRoot?.querySelector('.body, .card, section, div') as HTMLElement | null;
                const cs = inner ? getComputedStyle(inner) : null;
                return { pad: cs ? `${cs.paddingTop} ${cs.paddingBottom}` : '', kids: [...(card?.children ?? [])].map((k) => `${k.className || k.tagName.toLowerCase()}:${Math.round(k.getBoundingClientRect().height)}`) };
              }, id);
              log.push(`  ${id} parts: ${JSON.stringify(parts)}`);
              await shot(page, info, `settings-cards-${id}-${skin}-${scheme}-${w}-inner`);
            }
            if (g.bodyBottom > g.win) bad.push(`${id} @${w}x${h}: the open card ends at ${g.bodyBottom} > ${g.win}`);
            if (g.lastHead > g.win) bad.push(`${id} @${w}x${h}: the last header ends at ${g.lastHead} > ${g.win}`);
            if (!g.heads.includes('validation') && g.lastHead + HEAD_SLOT > g.win) bad.push(`${id} @${w}x${h}: no room for the acceptance-check header`);
            if (Math.min(...g.headH) < 44) bad.push(`${id} @${w}x${h}: a header is ${Math.min(...g.headH)} px tall (< 44)`);
            if (side.headLeft < side.bodyRight - 1) bad.push(`${id} @${w}x${h}: the headers' column is not at the start (right) side`);
            if (side.titleRight < side.headRight - 16) bad.push(`${id} @${w}x${h}: the header title is not aligned to the start (right) edge`);
            if (w === 1440) {
              keep(all, await measureContrast(page, await collectTargets(page.locator(FOLDS), { icons: true })), `cards/${id}`);
              if (id === 'screens' || id === 'announce') await shot(page, info, `settings-cards-${id}-${skin}-${scheme}-${w}`);
            }
          }
          if (w === 1440) {
            // the states of a closed header (hover, keyboard focus, press) and of the open one (its tint is measured above)
            await headLoc(page, 'screens').click();
            states = await headerStates(page, 'area');
            await page.mouse.move(0, 0);
            if (states.hoverDelta < 8) bad.push(`hover on a header changes nothing visible (delta ${states.hoverDelta})`);
            if (!states.focusVisible || !/solid/.test(states.focusRing)) bad.push(`keyboard focus on a header draws no ring (${states.focusRing})`);
            else if (states.ringRatio < 3) bad.push(`the header's focus ring reads at ${states.ringRatio} < 3`);
            if (!pressFollows(states.pressed, states.token)) bad.push(`pressing a header does not follow the skin's press (${states.pressed}, token ${states.token})`);
          }
        }
        bad.push(...contrastProblems(all, skin, scheme), ...cutTitles(all));
        save(info, `settings-cards-${skin}-${scheme}`, { log, states, contrast: [...all.values()], known: knownRows(all, skin, scheme), bad });
        console.log(`SKIN-QA-2403 cards ${skin} ${scheme}: ${all.size} texts, ${bad.length} problems\n  ${log.join('\n  ')}`);
        expect(bad, `cards ${skin} ${scheme}`).toEqual([]);
      });

      test(`${skin} ${scheme}: accordion opens in place, never sideways; contrast`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'a desktop layout');
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 900 });
        await openCards(page, skin, scheme, 'accordion');
        const bad: string[] = [];
        const all = new Map<string, ContrastRow & { where: string }>();
        const g0 = await foldGeometry(page);
        if (g0.wide) bad.push('the accordion took the side arrangement');
        for (const id of g0.heads) {
          const head = headLoc(page, id);
          if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
          await page.mouse.move(0, 0);
          await expect(head).toHaveAttribute('aria-expanded', 'true');
          await page.waitForTimeout(350);
          await head.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(150);
          const s = await pageScroll(page);
          const g = await foldGeometry(page);
          if (s.sideways > 1) bad.push(`${id}: sideways scroll ${s.sideways} px`);
          if (Math.min(...g.headH) < 44) bad.push(`${id}: a header is ${Math.min(...g.headH)} px tall`);
          if (g.bodyTop < (await head.boundingBox())!.y) bad.push(`${id}: the card does not open under its header`);
          keep(all, await measureContrast(page, await collectTargets(page.locator(FOLDS), { icons: true })), `accordion/${id}`);
          if (id === 'display') await shot(page, info, `settings-accordion-${id}-${skin}-${scheme}-1440`);
        }
        bad.push(...contrastProblems(all, skin, scheme), ...cutTitles(all));
        save(info, `settings-accordion-${skin}-${scheme}`, { contrast: [...all.values()], known: knownRows(all, skin, scheme), bad });
        console.log(`SKIN-QA-2403 accordion ${skin} ${scheme}: ${all.size} texts, ${bad.length} problems`);
        expect(bad, `accordion ${skin} ${scheme}`).toEqual([]);
      });

      test(`${skin} ${scheme}: two tabs and one list never scroll sideways; contrast`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'a desktop layout');
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 900 });
        const bad: string[] = [];
        const all = new Map<string, ContrastRow & { where: string }>();
        for (const [layout, hash, name] of [['tabs', ACCESS, 'tabs-screens'], ['tabs', '/system/diagnostics?tab=access-voice', 'tabs-voice'], ['list', ACCESS, 'list']] as const) {
          await page.goto('about:blank');
          await openCards(page, skin, scheme, layout, hash);
          if (name === 'tabs-voice') await expect(page.locator(`${D} .sections[data-access-voice]`)).toBeVisible();
          for (let step = 0; step < 6; step++) {
            const s = await pageScroll(page);
            if (s.sideways > 1) bad.push(`${name} (step ${step}): sideways scroll ${s.sideways} px`);
            const roots = [page.locator(`${D} .sections[data-access-layout]`)];
            if (layout === 'tabs' && step === 0) roots.push(page.locator(`${D} sw-tabs[data-settings-tabs]`));
            for (const r of roots) keep(all, await measureContrast(page, await collectTargets(r, { icons: true })), `${name}`);
            if (step === 0) await shot(page, info, `settings-${name}-${skin}-${scheme}-1440`);
            // scroll the page by a window (whatever scrolls it: the document or the shell's main)
            const moved = await page.evaluate(() => {
              const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
              const doc = document.scrollingElement!;
              const el = doc.scrollHeight - doc.clientHeight > 1 ? doc : main && main.scrollHeight - main.clientHeight > 1 ? main : null;
              if (!el) return false;
              const before = el.scrollTop;
              el.scrollTop = before + el.clientHeight - 120;
              return el.scrollTop > before;
            });
            if (!moved) break;
            await page.waitForTimeout(200);
          }
        }
        bad.push(...contrastProblems(all, skin, scheme));
        save(info, `settings-tabs-list-${skin}-${scheme}`, { contrast: [...all.values()], known: knownRows(all, skin, scheme), bad });
        console.log(`SKIN-QA-2403 tabs+list ${skin} ${scheme}: ${all.size} texts, ${bad.length} problems`);
        expect(bad, `tabs / list ${skin} ${scheme}`).toEqual([]);
      });

      test(`${skin} ${scheme}: phone - the cards stack, 44 px headers, no sideways scroll; contrast`, async ({ page }, info) => {
        test.skip(info.project.name !== 'mobile', 'a phone layout');
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openCards(page, skin, scheme);
        const bad: string[] = [];
        const all = new Map<string, ContrastRow & { where: string }>();
        let g = await foldGeometry(page);
        if (g.wide) bad.push('the phone took the side arrangement');
        for (const id of g.heads) {
          const head = headLoc(page, id);
          if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
          await expect(head).toHaveAttribute('aria-expanded', 'true');
          await page.waitForTimeout(350);
          await head.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(150);
          g = await foldGeometry(page);
          const s = await pageScroll(page);
          if (s.sideways > 0) bad.push(`${id}: sideways scroll ${s.sideways} px`);
          if (Math.min(...g.headH) < 44) bad.push(`${id}: a header is ${Math.min(...g.headH)} px tall`);
          const widths = await page.evaluate(() => {
            const diag = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-diagnostics');
            return [...(diag?.shadowRoot?.querySelector('sw-fold-cards')?.shadowRoot?.querySelectorAll<HTMLElement>('.head:not([hidden])') ?? [])].map((h) => Math.round(h.getBoundingClientRect().right));
          });
          if (Math.max(...widths) > 390) bad.push(`${id}: a header runs past the screen (${Math.max(...widths)})`);
          keep(all, await measureContrast(page, await collectTargets(page.locator(FOLDS), { icons: true })), `phone/${id}`);
          if (id === 'screens') await shot(page, info, `settings-cards-phone-${id}-${skin}-${scheme}`);
        }
        bad.push(...contrastProblems(all, skin, scheme), ...cutTitles(all));
        save(info, `settings-phone-${skin}-${scheme}`, { contrast: [...all.values()], known: knownRows(all, skin, scheme), bad });
        console.log(`SKIN-QA-2403 phone cards ${skin} ${scheme}: ${all.size} texts, ${bad.length} problems`);
        expect(bad, `phone cards ${skin} ${scheme}`).toEqual([]);
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------- the camera wall
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };
const CAMS = 4;

/** The wall with 4 live cameras (drawn video, tests/live-fake-media.ts); cameras c1 and c2 are remembered as "sub gives nothing", so they
 * open on main and carry the tag. `bar` = the installation's ui.wall_phone_bar; `cols` = the columns chosen on this device (0 = auto). */
async function openWall(page: Page, skin: string, scheme: Scheme, o: { bar?: 'icons' | 'labels'; cols?: number; channel?: 'local' | 'remote' } = {}) {
  const channel = o.channel ?? 'local';
  await page.addInitScript(
    (x) => {
      try {
        localStorage.setItem('sw.wall.count', '4');
        localStorage.removeItem('sw.wall.quality');
        if (x.cols) localStorage.setItem('sw.wall.cols', String(x.cols));
        else localStorage.removeItem('sw.wall.cols');
        localStorage.removeItem('sw.live.works');
        const now = Date.now();
        sessionStorage.setItem('sw.live.sub_down', JSON.stringify({ c1: now, c2: now }));
      } catch {
        /* storage unavailable */
      }
      (window as unknown as Record<string, unknown>).__rtc = { sub: 'ok', main: 'ok' };
    },
    { cols: o.cols ?? 0 },
  );
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live', 'sources.configure'];
      return json({
        user: { id: 'u', username: 'dana', display_name: 'Dana', source: channel === 'remote' ? 'remote' : 'ingress' },
        channel,
        remote: channel === 'remote' ? { 'remote.policy': 'flag', 'remote.session': 'rolling_90d', 'remote.idle_lock_minutes': 720, 'remote.default_profile': 'main', 'remote.mse_fallback': 'true' } : null,
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'media/video-policy') return json({ choice: 'webrtc', source: 'installation', explicit: true, installation: 'webrtc', personal: null, channel, order: ['webrtc'], remote: channel === 'remote' ? { default_profile: 'main', mse_fallback: true } : null });
    if (p === 'cameras') {
      const cameras = Array.from({ length: CAMS }, (_, i) => ({
        id: `c${i + 1}`, recorder_id: 'r', channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING,
      }));
      return json({ cameras, recorder: null, can_sync: true, media: {} });
    }
    if (p === 'settings') {
      return json({ settings: { 'media.transport_default': 'webrtc', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'media.video_notices': 'false', 'snapshots.max_age_s': 60, 'remote.max_live_streams': 16, 'remote.wall_profile': 'sub', 'remote.mse_fallback': 'true', 'ui.wall_phone_bar': o.bar ?? 'icons' }, can_edit: false });
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-04T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#/live/wall`);
  await page.waitForSelector('live-wall');
  await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
  await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
  await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(CAMS, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** The tag of a tile: its box, the tile's, every other overlay drawn on the tile, and its contrast (rendered, and the worst case: the
 * scrim over a pure white / black picture). */
async function tagFacts(page: Page, cam: string) {
  const tag = page.locator(`live-wall sw-camera-tile[data-cam="${cam}"] sw-live-player [data-sub-fallback]`);
  await expect(tag).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.locator(`live-wall sw-camera-tile[data-cam="${cam}"] sw-live-player`).evaluate((p) => (p as unknown as { status: string }).status), { timeout: 20_000 }).toBe('playing');
  const f = await tag.evaluate((el) => {
    const player = (el.getRootNode() as ShadowRoot).host as HTMLElement;
    const tile = (player.getRootNode() as ShadowRoot).host as HTMLElement;
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const others = [
      ...[...(player.shadowRoot?.querySelectorAll('.status, .vbadge, .h265tag, .plan, .served, .mute, .vnotice, .tap') ?? [])],
      ...[...(tile.shadowRoot?.querySelectorAll('.label, .demo, .pill, .stamp, .meta') ?? [])],
    ].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ cls: e.className, ...box(e) }));
    const cs = getComputedStyle(el);
    return { tag: box(el), tile: box(tile), others, color: cs.color, bg: cs.backgroundColor, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), text: el.textContent ?? '' };
  });
  const overlaps = f.others.filter((o) => o.x < f.tag.r && o.r > f.tag.x && o.y < f.tag.b && o.b > f.tag.y).map((o) => o.cls);
  const fg = parseRgba(f.color);
  const scrim = parseRgba(f.bg);
  const worst = Math.min(...[[255, 255, 255], [0, 0, 0], [128, 128, 128]].map((pic) => {
    const bg = over(scrim, pic);
    return ratio(over(fg, bg), bg);
  }));
  return { ...f, overlaps, worst: Math.round(worst * 100) / 100 };
}

test.describe('SKIN-QA-2403 · the camera wall: phone toolbar and the tile tag', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of PICKER_SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} ${scheme}: phone toolbar (icon row, long-press name, two rows of labels) and the tag`, async ({ page }, info) => {
        test.skip(info.project.name !== 'mobile', 'the phone toolbar');
        test.setTimeout(180_000);
        const bad: string[] = [];
        const all = new Map<string, ContrastRow & { where: string }>();
        // 1. the icon row (default)
        await openWall(page, skin, scheme);
        const bar = page.locator('live-wall [data-wall-phone-bar]');
        await expect(bar).toHaveAttribute('data-mode', 'icons');
        await page.waitForTimeout(400);
        const geo = await bar.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const keys = [...el.querySelectorAll<HTMLElement>('[data-wall-key]')].map((k) => {
            const kr = k.getBoundingClientRect();
            return { hint: k.getAttribute('data-hint') ?? '', w: kr.width, h: kr.height, left: kr.left, right: kr.right };
          });
          return { h: r.height, left: r.left, right: r.right, keys };
        });
        const s1 = await pageScroll(page);
        if (geo.h > 56) bad.push(`icons: the bar is ${geo.h} px tall (> 56)`);
        if (s1.sideways > 0) bad.push(`icons: sideways scroll ${s1.sideways} px`);
        for (const k of geo.keys) {
          if (Math.min(k.w, k.h) < 44) bad.push(`icons: key "${k.hint}" is ${Math.round(k.w)}x${Math.round(k.h)} (< 44)`);
          if (k.right > 390 || k.left < 0) bad.push(`icons: key "${k.hint}" leaves the screen`);
        }
        // RTL: the row starts at the right
        if (geo.keys.length && geo.keys[0].right < geo.keys[geo.keys.length - 1].right) bad.push('icons: the row does not start at the right (RTL)');
        keep(all, await measureContrast(page, await collectTargets(bar, { icons: true })), 'icons');
        // the focus ring of a key (the select inside takes the focus; the key draws the ring)
        const ring = await bar.locator('[data-wall-quality]').evaluate((sel) => {
          (sel as HTMLElement).focus();
          const key = sel.closest('[data-wall-key]') as HTMLElement;
          const cs = getComputedStyle(key);
          return { shadow: cs.boxShadow, border: cs.borderTopColor, focusWithin: key.matches(':focus-within') };
        });
        if (!ring.focusWithin || ring.shadow === 'none') bad.push(`icons: a focused key draws no ring (${ring.shadow})`);
        await bar.locator('[data-wall-quality]').evaluate((sel) => (sel as HTMLElement).blur());
        // pressing a key gives feedback (the kiosk key and a picker key)
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const token = await pressScale(page);
        for (const sel of ['[data-open-kiosk]', '.ikey:has([data-wall-count-select])']) {
          const k = bar.locator(sel).first();
          const b = (await k.boundingBox())!;
          // a real press (a synthetic event does not set :active); released away from the key, so nothing opens
          await page.mouse.move(b.x + 3, b.y + 3);
          await page.mouse.down();
          await page.waitForTimeout(160);
          const pressed = await k.evaluate((el) => getComputedStyle(el).transform);
          await page.mouse.move(b.x + b.width / 2, b.y + 200);
          await page.mouse.up();
          await page.keyboard.press('Escape');
          if (!pressFollows(pressed, token)) bad.push(`icons: pressing ${sel} does not follow the skin's press (${pressed}, token ${token})`);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(300);
        await shot(page, info, `wall-phone-icons-${skin}-${scheme}`);
        // 2. the long-press name
        const kiosk = (await bar.locator('[data-open-kiosk]').boundingBox())!;
        await page.mouse.move(kiosk.x + kiosk.width / 2, kiosk.y + kiosk.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(800);
        const hint = bar.locator('[data-wall-key-hint]');
        await expect(hint).toBeVisible();
        keep(all, await measureContrast(page, await collectTargets(hint)), 'long-press');
        const hb = (await hint.boundingBox())!;
        if (hb.x < 0 || hb.x + hb.width > 390) bad.push('long-press: the name bubble leaves the screen');
        await shot(page, info, `wall-phone-hint-${skin}-${scheme}`);
        await page.mouse.up();
        // 3. the tag on a phone tile (two columns) and on a narrow one (three columns)
        const tag2 = await tagFacts(page, 'c1');
        for (const [name, t] of [['2 columns', tag2]] as const) {
          if (t.overlaps.length) bad.push(`tag (${name}): covers ${t.overlaps.join(', ')}`);
          if (t.tag.r > t.tile.r + 0.5 || t.tag.x < t.tile.x - 0.5) bad.push(`tag (${name}): leaves its tile`);
          if (Math.abs(t.tile.r - t.tag.r) > 12) bad.push(`tag (${name}): not at the top-start (right) corner`);
          if (t.worst < 4.5) bad.push(`tag (${name}): over a bright picture it reads at ${t.worst} < 4.5`);
        }
        keep(all, await measureContrast(page, await collectTargets(page.locator('live-wall sw-camera-tile[data-cam="c1"] sw-live-player [data-sub-fallback]'))), 'tag');
        await shot(page, info, `wall-phone-tag-${skin}-${scheme}`);
        // 4. two rows of labels
        await page.goto('about:blank');
        await openWall(page, skin, scheme, { bar: 'labels', cols: 3 });
        const lbar = page.locator('live-wall [data-wall-phone-bar]');
        await expect(lbar).toHaveAttribute('data-mode', 'labels');
        await page.waitForTimeout(400);
        const lgeo = await lbar.evaluate((el) => {
          const r = el.getBoundingClientRect();
          // every selected label whole inside its control (measured with the control's own font)
          const cut = [...el.querySelectorAll('select')].map((s) => {
            const cs = getComputedStyle(s);
            const c = document.createElement('canvas').getContext('2d')!;
            c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            const text = s.selectedOptions[0]?.textContent ?? '';
            const room = s.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
            return { text, need: Math.ceil(c.measureText(text).width), room: Math.floor(room), h: s.getBoundingClientRect().height };
          });
          const kiosk = el.querySelector('[data-open-kiosk]')?.getBoundingClientRect();
          return { h: r.height, cut, kiosk: kiosk ? { w: kiosk.width, h: kiosk.height } : null };
        });
        const s2 = await pageScroll(page);
        if (lgeo.h > 120) bad.push(`labels: the bar is ${lgeo.h} px tall (> 120)`);
        if (s2.sideways > 0) bad.push(`labels: sideways scroll ${s2.sideways} px`);
        for (const c of lgeo.cut) {
          if (c.need > c.room + 1) bad.push(`labels: "${c.text}" needs ${c.need} px, has ${c.room}`);
          if (c.h < 44) bad.push(`labels: the select of "${c.text}" is ${Math.round(c.h)} px tall (< 44)`);
        }
        if (lgeo.kiosk && Math.min(lgeo.kiosk.w, lgeo.kiosk.h) < 44) bad.push(`labels: the kiosk key is ${lgeo.kiosk.w}x${lgeo.kiosk.h} (< 44)`);
        keep(all, await measureContrast(page, await collectTargets(lbar, { icons: true })), 'labels');
        const tag3 = await tagFacts(page, 'c1');
        if (tag3.overlaps.length) bad.push(`tag (3 columns): covers ${tag3.overlaps.join(', ')}`);
        if (tag3.tag.r > tag3.tile.r + 0.5 || tag3.tag.x < tag3.tile.x - 0.5) bad.push('tag (3 columns): leaves its tile');
        await shot(page, info, `wall-phone-labels-${skin}-${scheme}`);
        bad.push(...contrastProblems(all, skin, scheme));
        save(info, `wall-phone-${skin}-${scheme}`, { geo, lgeo, ring, tag2, tag3, contrast: [...all.values()], bad });
        console.log(`SKIN-QA-2403 wall phone ${skin} ${scheme}: ${all.size} texts, tag worst ${tag2.worst}, ${bad.length} problems`);
        expect(bad, `wall phone ${skin} ${scheme}`).toEqual([]);
      });

      test(`${skin} ${scheme}: desktop wall - the tag sits top-start, covers nothing, reads over any picture`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the desktop wall');
        test.setTimeout(120_000);
        const bad: string[] = [];
        await openWall(page, skin, scheme);
        const t = await tagFacts(page, 'c2');
        if (t.overlaps.length) bad.push(`tag: covers ${t.overlaps.join(', ')}`);
        if (t.tag.r > t.tile.r + 0.5 || t.tag.x < t.tile.x - 0.5) bad.push('tag: leaves its tile');
        if (Math.abs(t.tile.r - t.tag.r) > 12) bad.push('tag: not at the top-start (right) corner');
        if (t.worst < 4.5) bad.push(`tag: over a bright picture it reads at ${t.worst} < 4.5`);
        const rows = await measureContrast(page, await collectTargets(page.locator('live-wall sw-camera-tile[data-cam="c2"] sw-live-player [data-sub-fallback]')));
        for (const r of failing(rows)) bad.push(`tag: "${r.text}" ${r.ratio} < ${r.need} on the drawn picture`);
        const s = await pageScroll(page);
        if (s.sideways > 0) bad.push(`sideways scroll ${s.sideways} px`);
        await shot(page, info, `wall-desktop-tag-${skin}-${scheme}`);
        save(info, `wall-desktop-${skin}-${scheme}`, { t, rows, bad });
        console.log(`SKIN-QA-2403 wall desktop ${skin} ${scheme}: tag worst ${t.worst}, ${bad.length} problems`);
        expect(bad, `wall desktop ${skin} ${scheme}`).toEqual([]);
      });
    }
  }

  test('remote channel, a phone wall of three columns: the tag and the profile badge do not collide', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the narrowest tile');
    test.setTimeout(120_000);
    await openWall(page, 'classic', 'light', { cols: 3, channel: 'remote' });
    const t = await tagFacts(page, 'c1');
    await shot(page, info, 'wall-phone-remote-tag-classic-light');
    save(info, 'wall-phone-remote', { t });
    console.log(`SKIN-QA-2403 remote tag: ${JSON.stringify(t.others.map((o) => o.cls))}, overlaps ${t.overlaps.join(', ') || 'none'}`);
    expect(t.overlaps, 'the tag covers another overlay').toEqual([]);
    expect(t.tag.r <= t.tile.r + 0.5 && t.tag.x >= t.tile.x - 0.5, 'the tag stays inside its tile').toBe(true);
  });
});
