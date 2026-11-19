import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';

// CR-TV-FONTS-ESCAPE-2443 (code review 08:F04): the lobby fonts are split per style family (tv-fonts-hitech.css, tv-fonts-luxury.css) and
// main.ts loads only the active family's sheet before it draws the style. What the board shows must not change: per design, the computed
// font of every text element, the faces the page really loaded and the width of the titles are recorded (test-results/notice-tv-fonts/
// <design>.json, compared with the same file taken before the split) and checked: a lobby style uses its own faces, and a board on any other
// design defines no lobby face at all.
//   npx playwright test tests/notice-tv-fonts-2443.spec.ts --project=desktop --workers=1

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/notice-tv-fonts');

interface Probe {
  defined: string[];
  loaded: string[];
  computed: string[];
  widths: number[];
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const faces = [...document.fonts];
    const face = (f: FontFace) => `${f.family.replace(/"/g, '')} ${f.weight} ${f.unicodeRange.includes('U+590') ? 'hebrew' : 'latin'} ${f.unicodeRange.length}`;
    const lobby = faces.filter((f) => f.family.replace(/"/g, '').startsWith('Lobby'));
    const rootEl = document.querySelector('#nbk:not([hidden])') && (document.getElementById('nbk') as HTMLElement).childElementCount ? document.getElementById('nbk') : document.getElementById('cv');
    const computed = new Set<string>();
    for (const el of rootEl ? [...rootEl.querySelectorAll<HTMLElement>('*')] : []) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())) continue;
      const cs = getComputedStyle(el);
      computed.add(`${cs.fontFamily} | ${cs.fontWeight}`);
    }
    const widths = [...(rootEl?.querySelectorAll<HTMLElement>('h1, .nb-ttl, .nb-t, .nb-tmp') ?? [])].map((e) => Math.round(e.getBoundingClientRect().width * 10) / 10);
    return { defined: [...new Set(lobby.map(face))].sort(), loaded: [...new Set(lobby.filter((f) => f.status === 'loaded').map(face))].sort(), computed: [...computed].sort(), widths };
  });
}

async function open(page: Page, design: string): Promise<Probe> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({ urgent: 'band' }));
  await page.goto(tvUrl(`design=${design}`));
  await page.waitForFunction(() => !!document.querySelector('#cv[data-tpl] .pg .hd, #cv[data-tpl] .pg .b2hd, #nbk[data-ready="1"]'), null, { timeout: 15_000 });
  await page.waitForTimeout(2500); // the first turn's entrance
  const p = await probe(page);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, design + '.json'), JSON.stringify(p, null, 1));
  return p;
}

const LOBBY: Record<string, string[]> = {
  lumen: ['LobbySans', 'LobbyMono'], axis: ['LobbySans', 'LobbyMono'], prism: ['LobbySans', 'LobbyMono'],
  gallery: ['LobbyFrank', 'LobbyDavid', 'LobbyBodoni'], concierge: ['LobbyFrank', 'LobbyDavid', 'LobbyBodoni'], stone: ['LobbyFrank', 'LobbyDavid', 'LobbyBodoni'],
};
const USED: Record<string, string> = { lumen: 'LobbySans', axis: 'LobbySans', prism: 'LobbySans', gallery: 'LobbyFrank', concierge: 'LobbyDavid' };

for (const design of ['classic', 'v2', 'ink', 'sign', 'lumen', 'axis', 'prism', 'gallery', 'concierge', 'stone']) {
  test(`fonts of the ${design} board`, async ({ page }) => {
    const p = await open(page, design);
    const fams = [...new Set(p.defined.map((f) => f.split(' ')[0]))].sort();
    expect(fams, 'the lobby families defined on the page').toEqual((LOBBY[design] ?? []).slice().sort());
    if (USED[design]) {
      expect(p.loaded.some((f) => f.startsWith(USED[design] + ' ')), 'the style really draws with its own face').toBe(true);
      expect(p.computed.some((c) => c.includes(USED[design])), 'a text element asks for the face').toBe(true);
      if (USED[design] === 'LobbySans') {
        // CR-FE-SMALL-2440: Latin letters and digits draw in IBM Plex (the Latin face carries the Latin range), not in the Heebo fallback
        expect(p.defined.filter((f) => /^LobbySans \S+ latin /.test(f)).length, 'one Latin LobbySans face per weight').toBe(5);
        expect(p.loaded.some((f) => /^LobbySans \S+ latin /.test(f)), 'a Latin LobbySans face really loads').toBe(true);
      }
    } else {
      expect(p.loaded.filter((f) => f.startsWith('LobbySans') || f.startsWith('LobbyFrank') || f.startsWith('LobbyDavid')), 'no lobby face drawn').toEqual([]);
    }
  });
}
