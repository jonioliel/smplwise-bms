import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
await p.goto('http://127.0.0.1:4187/?design=a#/devices/building');
await p.waitForSelector('devices-building sw-kpi');
await p.waitForTimeout(1500);
const rows = await p.evaluate(() => [...document.querySelector('sw-app').shadowRoot.querySelector('devices-building').shadowRoot.querySelectorAll('sw-kpi')].map((e) => {
  const r = e.getBoundingClientRect();
  const sr = e.shadowRoot;
  const q = (s) => sr.querySelector(s);
  return { kind: e.dataset.tileKind, h: Math.round(r.height), w: Math.round(r.width), value: q('.value')?.textContent?.trim(), vh: Math.round(q('.value')?.getBoundingClientRect().height ?? 0), lh: Math.round(q('.label')?.getBoundingClientRect().height ?? 0), dh: Math.round(q('.detail')?.getBoundingClientRect().height ?? 0), fit: q('.value')?.dataset.fit };
}));
console.log(JSON.stringify(rows));
await p.screenshot({ path: 'p8-measure.png' });
await b.close();
