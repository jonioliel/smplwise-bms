import { test, expect, type Page } from '@playwright/test';
import { ADMIN, fresh, install, open } from './media-players-harness';

// Owner report 2026-10-02 (Android Chrome, 390 px): on "נגנים ורמקולים" the sticky header oscillated between expanded and compact while
// scrolling, the list jumped and the first group heading slid over the search field. Cause: the shared page chrome (styles/media-page.ts)
// folded the room chips (display: none) and the filter row (max-height 0) at scrollTop > 60, so the header shrank in the flow, every card
// moved under the finger, the scroll was clamped back under the threshold and the header expanded again. Compacting is now purely visual
// (the header keeps its height; the same fix the screens page got in 0.1.150).
//   SW_BASE_URL=http://127.0.0.1:5190/ npx playwright test tests/evidence-mobile-scroll-players.spec.ts --project=mobile

const DEEP = `const deep = (root, sel) => { const f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) { if (e.shadowRoot) { const r = deep(e.shadowRoot, sel); if (r) return r; } } return null; };`;

interface Probe { st: number; cardTop: number; hdr: number; compact: boolean; max: number }
const probe = (page: Page, tag: string, card: string) =>
  page.evaluate(`(() => { ${DEEP}
    const host = deep(document, '${tag}'); const root = host.shadowRoot;
    const card = root.querySelector('${card}'); const dh = root.querySelector('.dh');
    return { st: host.scrollTop, cardTop: card.getBoundingClientRect().top, hdr: dh.getBoundingClientRect().height,
      compact: dh.classList.contains('compact'), max: host.scrollHeight - host.clientHeight };
  })()`) as Promise<Probe>;

for (const [w, h] of [[390, 844], [360, 740]] as const) {
  for (const [name, hash, tag, card] of [
    ['players', '/multimedia/players', 'multimedia-players', 'media-player-card'],
    ['groups', '/multimedia/groups', 'multimedia-groups', '[data-group-card]'],
  ] as const) {
    test.describe(`${name} page scroll, ${w}x${h}`, () => {
      test.use({ viewport: { width: w, height: h } });

      test('stepping down and up never jumps: a card moves exactly as far as the scroll, the header keeps its height', async ({ page }, info) => {
        test.skip(info.project.name !== 'mobile', 'phone only');
        await install(page, fresh(ADMIN));
        await open(page, hash, '390');
        await page.setViewportSize({ width: w, height: h });
        await page.waitForSelector(`${tag} ${card}`);
        await page.waitForTimeout(800);
        await page.mouse.move(w / 2, h / 2);
        const first = await probe(page, tag, card);
        expect(first.max).toBeGreaterThan(150);
        let prev = first;
        let worst = 0;
        let compacted = false;
        const walk = async (dy: number, steps: number) => {
          for (let i = 0; i < steps; i++) {
            await page.mouse.wheel(0, dy);
            await page.waitForTimeout(260);
            const p = await probe(page, tag, card);
            worst = Math.max(worst, Math.abs(p.cardTop - prev.cardTop + (p.st - prev.st)));
            expect(Math.abs(p.hdr - first.hdr), `header height at scrollTop ${p.st}`).toBeLessThanOrEqual(2);
            compacted ||= p.compact;
            prev = p;
          }
        };
        await walk(15, 14);
        await walk(40, 4);
        for (let i = 0; i < 80 && prev.st > 0; i++) await walk(-30, 1);
        expect(compacted).toBe(true);
        expect(prev.compact).toBe(false);
        info.annotations.push({ type: 'worst-shift-px', description: String(worst) });
        expect(worst).toBeLessThanOrEqual(2);
      });
    });
  }
}
