// Builds the entrant-claude deliverable for one or more skins: token exports, self-contained HTML boards, PNG renders.
// Usage: node build.mjs [filter] [--no-render] [--skin=domus|ios|tesla|all]   (default skin: all)
// Skin "domus" writes to boards/, renders/, tokens*.css|json (the round-1 layout); the other skins write to
// boards/<skin>/, renders/<skin>/, tokens-<skin>.json|css.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { setSkin, skinIds, stats } from './src/skin.mjs';
import { cssBlock, tokensJson, tokenMap } from './src/tokens.mjs';
import { homeBoard, areaBoard, wallBoard, homeListBoard, areaListBoard, wallListBoard } from './src/screens.mjs';
import { foundationsColor, foundationsType, foundationsShape, foundationsMotion, componentsSheet, areaStatesBoard, indexPage } from './src/boards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--')) || '';
const noRender = args.includes('--no-render');
const skinArg = (args.find((a) => a.startsWith('--skin=')) || '--skin=all').slice(7);
const todoSkins = skinArg === 'all' ? skinIds : [skinArg];

// TOKEN_MAP.md is shared by every skin
writeFileSync(join(here, 'TOKEN_MAP.md'), `# Token map — new semantic name → old names\n\nGenerated from \`src/tokens.mjs\`. One semantic palette under \`--sw-*\`, the same names in every skin (\`skins/*.mjs\`); engineering aliases the old \`--sw-*\` and \`--dv-*\` names onto it. Every name below has a light and a dark value in \`tokens.json\` (domus), \`tokens-ios.json\` and \`tokens-tesla.json\`.\n\n| New name | Old names / note |\n|---|---|\n${tokenMap.map(([a, b]) => `| \`${a}\` | ${b} |`).join('\n')}\n`);

const allBoards = [];
for (const id of todoSkins) {
  const skin = setSkin(id);
  const root = id === 'domus';
  const boardsDir = root ? join(here, 'boards') : join(here, 'boards', id);
  const rendersDir = root ? join(here, 'renders') : join(here, 'renders', id);
  mkdirSync(boardsDir, { recursive: true });
  mkdirSync(rendersDir, { recursive: true });

  // ---- tokens ----
  const sfx = root ? '' : `-${id}`;
  const lightCss = `:root, [data-scheme="light"] {\n  color-scheme: light;\n${cssBlock('light')}\n}\n`;
  const darkCss = `[data-scheme="dark"] {\n  color-scheme: dark;\n${cssBlock('dark')}\n}\n@media (prefers-color-scheme: dark) {\n  [data-scheme="auto"] {\n    color-scheme: dark;\n${cssBlock('dark').replace(/^/gm, '  ')}\n  }\n}\n`;
  writeFileSync(join(here, `tokens${sfx}.json`), tokensJson());
  writeFileSync(join(here, `tokens${sfx}.css`), `/* Arx · skin "${skin.name}" · both schemes. Switch: data-scheme="light|dark|auto" on <html>. Generated from skins/${id}.mjs */\n${lightCss}${darkCss}`);
  if (root) {
    writeFileSync(join(here, 'tokens-light.css'), `/* Arx · skin "${skin.name}" · light scheme. Generated from skins/${id}.mjs */\n${lightCss}`);
    writeFileSync(join(here, 'tokens-dark.css'), `/* Arx · skin "${skin.name}" · dark scheme (+ auto). Generated from skins/${id}.mjs */\n${darkCss}`);
  }

  // ---- boards ----
  const boards = [];
  const add = (file, html, w, h, full = false, scale = 2) => boards.push({ skin: id, dir: boardsDir, out: rendersDir, file, html, w, h, full, scale });
  add('foundations-color.html', foundationsColor(), 1440, 900, true, 1);
  add('foundations-type.html', foundationsType(), 1440, 900, true, 1);
  add('foundations-shape.html', foundationsShape(), 1440, 900, true, 1);
  add('foundations-motion.html', foundationsMotion(), 1440, 900, true, 1);
  add('components.html', componentsSheet(), 1440, 900, true, 1);
  for (const scheme of ['light', 'dark']) {
    add(`home-1440-${scheme}.html`, homeBoard({ scheme, phone: false }), 1440, 900);
    add(`home-390-${scheme}.html`, homeBoard({ scheme, phone: true }), 390, 844, true);
    add(`area-1440-${scheme}.html`, areaBoard({ scheme, phone: false }), 1440, 900);
    add(`area-390-${scheme}.html`, areaBoard({ scheme, phone: true }), 390, 844, true);
    add(`wall-1440-${scheme}.html`, wallBoard({ scheme, phone: false }), 1440, 900);
    add(`wall-390-${scheme}.html`, wallBoard({ scheme, phone: true }), 390, 844, true);
    add(`home-list-1440-${scheme}.html`, homeListBoard({ scheme, phone: false }), 1440, 900);
    add(`home-list-390-${scheme}.html`, homeListBoard({ scheme, phone: true }), 390, 844, true);
    add(`area-list-1440-${scheme}.html`, areaListBoard({ scheme, phone: false }), 1440, 900);
    add(`area-list-390-${scheme}.html`, areaListBoard({ scheme, phone: true }), 390, 844, true);
    add(`wall-list-1440-${scheme}.html`, wallListBoard({ scheme, phone: false }), 1440, 900);
    add(`wall-list-390-${scheme}.html`, wallListBoard({ scheme, phone: true }), 390, 844, true);
  }
  add('area-states.html', areaStatesBoard(), 1440, 900, true, 1);

  for (const b of boards) writeFileSync(join(boardsDir, b.file), b.html);
  writeFileSync(join(boardsDir, 'index.html'), indexPage(boards, root ? '../renders/' : `../../renders/${id}/`));
  console.log(`[${id}] wrote ${boards.length} boards + index, tokens${sfx}.json, tokens${sfx}.css`);
  allBoards.push(...boards);
}

console.log('skin stats:', stats().map((s) => `${s.id}: ${s.changed}/${s.total} tokens changed, ${s.rules} rules`).join(' · '));

// ---- render ----
if (!noRender) {
  const req = createRequire(resolve(here, '../../../../frontend/node_modules/'));
  const { chromium } = req('playwright');
  const browser = await chromium.launch();
  const todo = allBoards.filter((b) => !filter || b.file.includes(filter));
  for (const b of todo) {
    const ctx = await browser.newContext({ viewport: { width: b.w, height: b.h }, deviceScaleFactor: b.scale, locale: 'he-IL', isMobile: b.w < 768, hasTouch: b.w < 768 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(join(b.dir, b.file)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const out = join(b.out, b.file.replace('.html', '.png'));
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const wOver = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (b.full && b.w < 768) {
      // phone boards: exact width, whole height in one frame (the bottom bar stays at the end)
      await page.setViewportSize({ width: b.w, height: Math.max(b.h, h) });
      await page.waitForTimeout(100);
      await page.screenshot({ path: out, animations: 'disabled' });
    } else {
      await page.screenshot({ path: out, fullPage: b.full, animations: 'disabled' });
    }
    console.log(`[${b.skin}] ${b.file} → ${b.w}×${b.full ? h : b.h}${!b.full && h > b.h ? `  (overflow: ${h})` : ''}${wOver ? '  (HORIZONTAL OVERFLOW)' : ''}`);
    await ctx.close();
  }
  await browser.close();
}
