import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAZY_SCREENS, WARM_SCREENS, screenWarmupAllowed, setScreenWarmup, warmOrder } from '../src/shell/lazy-screens';
import { PAGER_H, attentionFit } from '../src/screens/live-overview-logic';

// WARMUP-POLISH-2421 (docs/changes/WARMUP-POLISH-2421.md): the idle warm-up of the common screens' chunks, the attention card's fit
// count, and the camera player's plain words. No browser page.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => fs.readFileSync(path.join(HERE, '..', 'src', f), 'utf8');

test.describe('idle warm-up of the common screens', () => {
  test('every warmed tag is a lazy screen, and the list is bounded', () => {
    for (const tag of WARM_SCREENS) expect(LAZY_SCREENS[tag], tag).toBeTruthy();
    expect(WARM_SCREENS.length).toBeLessThanOrEqual(8);
    expect(new Set(WARM_SCREENS).size).toBe(WARM_SCREENS.length);
  });

  test('the order: the route-specific tags first, no duplicates, unknown tags dropped', () => {
    const order = warmOrder(['live-wall', 'not-a-screen']);
    expect(order[0]).toBe('live-wall');
    expect(order).not.toContain('not-a-screen');
    expect(new Set(order).size).toBe(order.length);
    expect([...order].sort()).toEqual([...WARM_SCREENS].sort());
  });

  test('the switch: the setting, the data saver and a hidden tab keep it off', () => {
    const visible = { visibilityState: 'visible' };
    expect(screenWarmupAllowed(true, {}, visible)).toBe(true);
    expect(screenWarmupAllowed(false, {}, visible)).toBe(false);
    expect(screenWarmupAllowed(true, { connection: { saveData: true } }, visible)).toBe(false);
    expect(screenWarmupAllowed(true, {}, { visibilityState: 'hidden' })).toBe(false);
    setScreenWarmup('false');
    expect(screenWarmupAllowed(undefined, {}, visible)).toBe(false);
    setScreenWarmup(undefined); // unset reads as on
    expect(screenWarmupAllowed(undefined, {}, visible)).toBe(true);
    setScreenWarmup('true');
    expect(screenWarmupAllowed(undefined, {}, visible)).toBe(true);
  });

  test('the shell starts it once the first screen is ready and reads the setting', () => {
    const app = src('shell/sw-app.ts');
    expect(app).toMatch(/if \(this\.hasAttribute\('data-shell-ready'\)\) warmCommonScreens\(\);/);
    expect(app).toMatch(/setScreenWarmup\(ps\['server\.startup_warmup'\]\)/);
  });
});

test.describe('attention card fit (no scrolling inside the card)', () => {
  test('all items when they all fit', () => {
    expect(attentionFit(300, [100, 200, 300])).toBe(3);
  });
  test('as many as fit above the pager otherwise, at least one', () => {
    expect(attentionFit(300, [100, 200, 300, 400])).toBe(2); // 300 - pager leaves room for two
    expect(attentionFit(300, [100, 300 - PAGER_H, 350])).toBe(2);
    expect(attentionFit(100, [180, 260])).toBe(1);
  });
  test('the card is a clipped fill card on both render paths (live data and demo)', () => {
    const s = src('screens/live-overview.ts');
    expect(s.match(/this\.renderAttention\(/g)?.length).toBe(2);
    expect(s).toContain('<sw-card fill clip data-overview-attention');
    expect(src('components/sw-card.ts')).toMatch(/:host\(\[fill\]\[clip\]\) \.body \{\s*overflow: hidden;/);
  });
});

test.describe('camera player words and bounds', () => {
  const player = src('components/sw-live-player.ts');
  test('no internal component name in a user-visible string', () => {
    expect(player).not.toContain('go2rtc לא זמין');
    // every Hebrew string literal of the player is free of internal names
    for (const m of player.matchAll(/'([^'\n]*[֐-׿][^'\n]*)'/g)) expect(m[1], m[1]).not.toMatch(/go2rtc|Home Assistant/i);
  });
  test('a socket that never opens and a stuck attempt are bounded; a retry is offered', () => {
    expect(player).toMatch(/export const SOCKET_OPEN_MS = 10000;/);
    expect(player).toMatch(/export const CONNECTING_CAP_MS = 60000;/);
    expect(player).toContain("export const CONNECT_TIMEOUT_HE = 'שרת הווידאו אינו עונה';");
    expect(player).toContain('data-player-retry');
    // the bounds are cleared with every other timer of an attempt
    expect(player).toMatch(/window\.clearTimeout\(this\.openTimer\);\s*window\.clearTimeout\(this\.capTimer\);/);
  });
});
