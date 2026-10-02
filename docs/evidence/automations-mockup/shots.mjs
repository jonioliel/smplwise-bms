// Playwright evidence for the CR-017 automations mockup. Serves the file on a local port (4561), walks the key states, saves
// PNGs next to this script and runs a click-through smoke test (JS errors + horizontal overflow fail the run).
// Run from frontend/ (needs its node_modules): node ../docs/evidence/automations-mockup/shots.mjs [name-filter]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// The checkout this script lives in (docs/evidence/automations-mockup/ -> repo root); ARX_WT points at another worktree.
const WT = process.env.ARX_WT || fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');
const { chromium } = createRequire(`${WT}/frontend/package.json`)('playwright');
const FILE = `${WT}/docs/design/mockups/automations/index.html`;
const OUT = `${WT}/docs/evidence/automations-mockup`;
const PORT = Number(process.env.PORT || 4561);
const only = process.argv[2] || '';
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); fs.createReadStream(FILE).pipe(res); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
const errors = [];
async function shot(name, { dev = 'd1440', scheme = 'light', setup = async () => {}, full = false, clip = null } = {}) {
  if (only && !name.includes(only)) return;
  const vp = dev === 'phone' ? { width: 390 + 40, height: 812 + 80 } : { width: 1440 + 40, height: 900 + 80 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: console ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${PORT}/#f=${dev}&sc=${scheme}`);
  await page.waitForSelector('#frame .main');
  await page.evaluate(() => { document.getElementById('bar').style.display = 'none'; document.getElementById('stage').style.padding = '12px'; });
  await setup(page);
  await page.waitForTimeout(450);
  const fr = page.locator('#frame');
  // overflow check: any element wider than the frame?
  // elements inside an intentionally scrollable row (overflow-x auto/scroll) are allowed to extend past the frame
  const ov = await page.evaluate(() => { const f = document.getElementById('frame').getBoundingClientRect(); const bad = []; const scrollable = (el) => { for (let p = el.parentElement; p && p.id !== 'frame'; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; }; for (const el of document.querySelectorAll('#frame *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.left < f.left - 1 || r.right > f.right + 1) && !scrollable(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.')); } return bad.slice(0, 4); });
  if (ov.length) errors.push(`${name}: horizontal overflow: ${ov.join(', ')}`);
  const outPath = path.join(OUT, `${name}.png`);
  if (full) await page.screenshot({ path: outPath, fullPage: true }); else await fr.screenshot({ path: outPath });
  console.log('saved', outPath);
  await ctx.close();
}
// helpers run inside the page: drive the mock through its own state (S) + render()
const run = (code) => async (page) => { await page.evaluate(code); await page.waitForTimeout(200); };
const J = (j, extra = '') => run(`jump('${j}'); ${extra} render();`);

// 1 lists
await shot('01-list-1440-light');
await shot('02-list-1440-dark', { scheme: 'dark' });
await shot('03-list-390-light', { dev: 'phone' });
await shot('04-list-390-dark', { dev: 'phone', scheme: 'dark' });
await shot('05-list-household-1440-light', { setup: run(`S.user='household'; render();`) });
await shot('06-list-viewer-390-light', { dev: 'phone', setup: run(`S.user='viewer'; render();`) });
await shot('07-scenes-1440-light', { setup: run(`S.kind='scn'; render();`) });
await shot('08-scenes-390-dark', { dev: 'phone', scheme: 'dark', setup: run(`S.kind='scn'; render();`) });
await shot('09-scripts-1440-dark', { scheme: 'dark', setup: run(`S.kind='scr'; render();`) });
await shot('10-scripts-390-light', { dev: 'phone', setup: run(`S.kind='scr'; render();`) });
// 2 detail + card menu
await shot('11-detail-1440-light', { setup: J('detail') });
await shot('12-detail-390-dark', { dev: 'phone', scheme: 'dark', setup: J('detail') });
await shot('13-cardmenu-1440-light', { setup: run(`S.pop='a3'; render();`) });
// 3 builder
await shot('14-builder-1440-light', { setup: J('builder') });
await shot('15-builder-1440-dark', { scheme: 'dark', setup: J('builder') });
await shot('16-builder-390-light', { dev: 'phone', setup: J('builder') });
await shot('17-builder-locked-1440-light', { setup: run(`jump('code'); S.view='builder'; S.open=S.draft.tr[0].uid; render();`) });
await shot('18-code-1440-dark', { scheme: 'dark', setup: J('code') });
await shot('19-code-390-light', { dev: 'phone', setup: J('code') });
await shot('20-builder-typepop-1440-light', { setup: run(`jump('builder'); S.open=null; S.typePop={sec:'tr',parent:null,slot:null}; render();`) });
await shot('21-builder-picker-1440-light', { setup: run(`jump('builder'); S.pick={uid:S.draft.ac[0].uid,v:'ctl',q:''}; render();`) });
await shot('22-builder-picker-household-390-light', { dev: 'phone', setup: run(`S.user='household'; jump('builder'); S.draft=startDraft(autById('a2')); S.open=S.draft.ac[0].uid; S.pick={uid:S.draft.ac[0].uid,v:'ctl',q:''}; render();`) });
await shot('23-builder-validation-1440-light', { setup: run(`jump('tpl'); S.sheet=null; S.draft=startDraft({name:'',desc:'',mode:'single',on:true,tr:[{k:'state',ent:[],to:'on'}],co:[],ac:[{k:'notify',target:'הטלפון של יוני',msg:''}],tpl:'דלת או חלון פתוחים זמן רב'}); S.view='builder'; S.open=S.draft.tr[0].uid; S.sheet={t:'builder'}; render();`) });
await shot('24-builder-household-nocode-1440-light', { setup: run(`S.user='household'; S.draft=startDraft(autById('a2')); S.view='builder'; S.open=null; S.sheet={t:'builder'}; render();`) });
await shot('25-builder-delegation-off-1440-dark', { scheme: 'dark', setup: run(`S.user='household'; S.deleg=false; S.draft=startDraft(autById('a2')); S.view='builder'; S.open=null; S.sheet={t:'builder'}; render();`) });
await shot('26-builder-grant-missing-1440-light', { setup: run(`S.user='household'; S.draft=startDraft(autById('a3')); S.draft.ac[0].ent=['light.kids']; S.draft.ac[1].ent=['climate.bed']; S.view='builder'; S.open=S.draft.ac[2].uid; S.sheet={t:'builder'}; render();`) });
await shot('27-builder-conflict-1440-light', { setup: run(`jump('builder'); S.open=null; S.conflict=true; render();`) });
await shot('28-suggest-schedule-1440-light', { setup: J('sugg') });
await shot('29-suggest-schedule-dialog-390-light', { dev: 'phone', setup: run(`jump('sugg'); openDlg({ h: 'ליצור כתזמון?', p: '"תאורה בשקיעה" היא שעון + שליטה במכשירים – בתזמונים זה פשוט יותר. חלון התזמון ייפתח עם הנתונים שכבר הזנתם.', icon: 'calendar', ring: 'acc', ok: 'פתח תזמון חדש', cancel: 'השאר אוטומציה' });`) });
await shot('30-templates-1440-light', { setup: J('tpl') });
await shot('31-templates-390-dark', { dev: 'phone', scheme: 'dark', setup: J('tpl') });
await shot('32-dryrun-1440-light', { setup: run(`dryRun(autById('a13'));`) });
await shot('33-run-sensitive-confirm-390-light', { dev: 'phone', setup: run(`doRun(autById('a3'));`) });
// 4 trace
await shot('34-trace-1440-light', { setup: J('trace') });
await shot('35-trace-1440-dark', { scheme: 'dark', setup: J('trace') });
await shot('36-trace-390-light', { dev: 'phone', setup: J('trace') });
await shot('37-trace-error-1440-light', { setup: run(`jump('trace'); S.runSel='r4'; render();`) });
await shot('38-trace-choose-1440-dark', { scheme: 'dark', setup: run(`jump('trace'); S.sheet={t:'trace',id:'a5'}; S.runSel='r1'; render();`) });
// 5 scenes capture + scripts runner
await shot('39-capture-1440-light', { setup: J('capture') });
await shot('40-capture-390-dark', { dev: 'phone', scheme: 'dark', setup: J('capture') });
await shot('41-capture-empty-1440-light', { setup: run(`S.kind='scn'; S.capName=''; S.capEnts=[]; S.capRows=null; S.sheet={t:'capture'}; render();`) });
await shot('42-runner-1440-light', { setup: J('runner') });
await shot('43-runner-390-dark', { dev: 'phone', scheme: 'dark', setup: J('runner') });
await shot('44-script-editor-1440-light', { setup: run(`S.kind='scr'; S.draft=startDraft(scrById('s4'),'script'); S.view='builder'; S.open=null; S.sheet={t:'builder'}; render();`) });
// 6 trash, versions, states
await shot('45-trash-1440-light', { setup: J('trash') });
await shot('46-delete-dialog-1440-dark', { scheme: 'dark', setup: run(`openDlg({ h: 'למחוק את "תאורת כניסה בשקיעה"?', p: 'עוברת לסל המחזור ל־30 יום.', icon: 'trash', ok: 'מחק', danger: true });`) });
await shot('47-versions-390-light', { dev: 'phone', setup: J('versions') });
await shot('48-state-loading-1440-light', { setup: run(`S.state='loading'; render();`) });
await shot('49-state-empty-1440-dark', { scheme: 'dark', setup: run(`S.state='empty'; render();`) });
await shot('50-state-error-390-light', { dev: 'phone', setup: run(`S.state='error'; render();`) });
await shot('51-state-offline-1440-light', { setup: run(`S.state='offline'; render();`) });
await shot('52-state-yaml-viewonly-1440-light', { setup: J('yaml') });
await shot('53-state-noperm-detail-390-light', { dev: 'phone', setup: run(`S.user='viewer'; S.sheet={t:'detail',id:'a2'}; render();`) });
await shot('54-state-delegation-off-list-390-light', { dev: 'phone', setup: run(`S.user='household'; S.deleg=false; render();`) });
// 7 settings
await shot('55-settings-1440-light', { setup: run(`S.screen='settings'; render();`), full: true });
await shot('56-settings-1440-dark', { scheme: 'dark', setup: run(`S.screen='settings'; render();`) });
await shot('57-settings-390-light', { dev: 'phone', setup: run(`S.screen='settings'; render();`) });
await shot('58-usermenu-390-light', { dev: 'phone', setup: run(`S.menu=true; render();`) });

// click-through smoke test: real clicks across the flows, collecting JS errors
if (!only) {
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 980 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`clickthrough: ${e.message}`));
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForSelector('#frame .main');
  const click = async (sel, i = 0) => { for (let t = 0; t < 3; t++) { try { const l = page.locator(sel).nth(i); await l.waitFor({ state: 'visible', timeout: 3000 }); await l.click({ timeout: 3000 }); await page.waitForTimeout(260); return; } catch (e) { if (t === 2) throw new Error(`click ${sel}[${i}] failed: ${e.message.split('\n')[0]}`); await page.waitForTimeout(400); } } };
  await click('[data-a="open"]'); await click('[data-a="edit"]'); await click('[data-a="openblk"]'); await click('[data-a="addblk"]', 2); await click('[data-a="addtype"][data-v="notify"]');
  await page.locator('[data-fld$="|msg"]').fill('בדיקה'); await page.waitForTimeout(150);
  await click('[data-a="view"][data-v="code"]'); await click('[data-a="view"][data-v="builder"]'); await click('[data-a="dry"]'); await click('button[data-a="closedlg"]'); await click('[data-a="save"]');
  await page.waitForTimeout(300);
  await click('[data-a="cardmenu"]', 1); await click('[data-a="versions"]'); await click('button[data-a="closesheet"]');
  await click('[data-a="trace"]'); await click('[data-a="runsel"]', 1); await click('button[data-a="closesheet"]');
  await click('[data-a="new"]'); await click('[data-a="tpl"][data-v="t6"]'); await click('[data-a="assched"]'); await click('[data-a="dlgok"]');
  await click('[data-a="kind"][data-v="scn"]'); await click('[data-a="applyscene"]', 2); await click('[data-a="capture"]'); await click('[data-a="pick"]'); await click('[data-a="pickent"]'); await click('[data-a="pickent"]', 1); await click('button[data-a="closepick"]'); await click('[data-a="docap"]');
  await page.locator('[data-fld="capName"]').fill('סצנת בדיקה'); await page.waitForTimeout(150); await click('[data-a="savecap"]');
  await click('[data-a="kind"][data-v="scr"]'); await click('[data-a="runscript"]', 2); await click('[data-a="fstep"]'); await click('[data-a="dorun"]');
  await click('[data-a="kind"][data-v="aut"]'); await click('[data-a="cardmenu"]'); await click('[data-a="askdel"]'); await click('[data-a="dlgok"]'); await click('[data-a="undo"]');
  await click('[data-a="menu"]'); await click('.usermenu [data-a="nav"][data-v="set"]'); await click('[data-a="setstep"]'); await click('[data-a="set"]'); await click('[data-a="trash"]'); await click('[data-a="restore"]');
  console.log('click-through done');
  await ctx.close();
}
await browser.close(); server.close();
if (errors.length) { console.log('ERRORS:'); errors.forEach((e) => console.log(' -', e)); process.exitCode = 1; } else console.log('no JS errors, no horizontal overflow');
