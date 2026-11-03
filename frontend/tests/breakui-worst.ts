import type { Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// BREAKUI-295: shared worst-case strings and the measuring helper of the stress specs (evidence-breakui-*.spec.ts). Everything here is
// INVENTED sample text; nothing reaches a device, a door or a station.

export const LONG_HE = 'פתיחת בוקר לכניסה הראשית של הלובי בקומת הקרקע של המבנה הצפוני כולל חניון תת קרקעי ושער הולכי רגל מערבי';
export const UNBREAK = 'A'.repeat(90);
export const UNBREAK_HE = 'א'.repeat(70);
export const EMAIL = 'very.long.mailbox.name.for.the.operations.team@subdomain.example-company-name.co.il';
export const MIXED = 'דלת Lobby-12 (קומה 3) — ‏Gate B7 מחסן 🚪 2026';
export const AR = 'بوابة المدخل الرئيسي للمبنى الشمالي والمرآب تحت الأرض';
export const RU = 'Главный вход северного корпуса и подземной парковки очень-длинное-название';
export const ONE = 'א';
export const EMOJI = '🚪🔒🏢🅰️👨‍👩‍👧‍👦🏳️‍🌈';
export const BIDI = '‮evil‬ ⁧עברית mixed⁩ ‏123‏';
export const CASES = [LONG_HE, UNBREAK, UNBREAK_HE, EMAIL, MIXED, AR, RU, ONE, EMOJI, BIDI, '', '   '];

export const SKIP = '.skl, sw-icon, svg, .vh, option, sw-toggle, [role="switch"]'; // the shared toggle is a known 42x24 control with its own hit area

/** Horizontal page scroll + the layout guard (escape / overflow / clipped / target) over the named element. */
export async function measure(page: Page, ctx: string, within: string, bubble = ''): Promise<{ scroll: number; found: Finding[]; targets: Finding[] }> {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const all = await page.evaluate(inPageCheck, { ctx, bubble, skip: SKIP, roots: [], within });
  const own = await page.evaluate(inPageClip, { ctx, within: within.split(' ').pop() as string });
  return { scroll, found: [...all.filter((f) => f.cls !== 'target' && f.cls !== 'floating'), ...own], targets: all.filter((f) => f.cls === 'target') };
}

export function digest(label: string, r: { scroll: number; found: Finding[]; targets: Finding[] }): string {
  const s = summarize(r.found, 12).lines;
  const t = summarize(r.targets, 6).lines;
  return `${label}: pageScroll=${r.scroll}px findings=${r.found.length} targets<44=${r.targets.length}\n  ${s.join('\n  ')}\n  ${t.join('\n  ')}`;
}

/**
 * Runs inside the page (self-contained). Reports what the shared guard does not see: an element whose content is wider than its own box
 * (text cut or pushed out sideways, a box that scrolls sideways) outside form fields, and a child that sticks out of its parent's box.
 */
export function inPageClip(args: { ctx: string; within: string }): Finding[] {
  const out: Finding[] = [];
  const all: Element[] = [];
  const collect = (root: Document | ShadowRoot | Element) => {
    for (const el of root.querySelectorAll('*')) {
      all.push(el);
      if (el.shadowRoot) collect(el.shadowRoot);
    }
  };
  collect(document);
  const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  const inside = (el: Element) => {
    for (let p: Node | null = el; p; p = p instanceof ShadowRoot ? p.host : (p as Element).assignedSlot ?? p.parentNode) if (p instanceof Element && p.matches(args.within)) return true;
    return false;
  };
  // GATE2370-A: an invisible hit ring - an empty, unpainted, absolutely placed ::before / ::after on a positioned key (the corner pill's
  // `.float button::after { inset: -8px }`, 28 + 16 = 44 px, POLISH4-WP1 D1) - draws nothing, yet Chromium counts its end-side bleed in
  // scrollWidth of the key and of every box around it. The check already skips a box with an absolutely placed ELEMENT inside; it cannot
  // see pseudo-elements. So the sideways overflow that such rings explain - and only that much - is not "content wider than its box".
  const ringBleed = (el: HTMLElement): number => {
    const er = el.getBoundingClientRect();
    const ecs = getComputedStyle(el);
    const boxLeft = er.left + parseFloat(ecs.borderLeftWidth);
    const boxRight = boxLeft + el.clientWidth;
    const rtl = ecs.direction === 'rtl';
    let bleed = 0;
    for (const host of [el, ...Array.from(el.querySelectorAll('*'))]) {
      const hcs = getComputedStyle(host);
      if (hcs.position === 'static') continue; // the ring's containing block must be the host's own padding box
      const hr = host.getBoundingClientRect();
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(host, pseudo);
        if (p.content !== '""' || !/absolute/.test(p.position)) continue;
        const unpainted = /^(transparent|rgba\(0, 0, 0, 0\))$/.test(p.backgroundColor) && p.backgroundImage === 'none' && p.boxShadow === 'none'
          && ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(p.getPropertyValue(`border-${s.toLowerCase()}-width`)) === 0 || p.getPropertyValue(`border-${s.toLowerCase()}-style`) === 'none')
          && (p.outlineStyle === 'none' || parseFloat(p.outlineWidth) === 0);
        if (!unpainted || p.left === 'auto' || p.right === 'auto') continue;
        const left = hr.left + parseFloat(hcs.borderLeftWidth) + parseFloat(p.left);
        const right = hr.right - parseFloat(hcs.borderRightWidth) - parseFloat(p.right);
        bleed = Math.max(bleed, rtl ? boxLeft - left : right - boxRight);
      }
    }
    return bleed;
  };
  const seen = new Set<string>();
  for (const el of all) {
    if (!(el instanceof HTMLElement) || /^(INPUT|TEXTAREA|SELECT|OPTION|STYLE|SCRIPT)$/.test(el.tagName) || el.closest('svg') || el.classList.contains('vh') || el.classList.contains('sr') || el.classList.contains('reg') || el.classList.contains('handle') || el.classList.contains('ghost') || !inside(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'contents') continue;
    const rail = /auto|scroll/.test(cs.overflowX) && cs.display === 'flex' && cs.flexDirection === 'row'; // a designed swipe rail
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !rail && !Array.from(el.querySelectorAll('*')).some((c) => /absolute|fixed/.test(getComputedStyle(c).position)) && cs.textOverflow !== 'ellipsis' && !/^(sw-|html|body)/i.test(el.tagName) && cs.display !== 'inline' && el.scrollWidth - el.clientWidth > ringBleed(el) + 1) {
      const k = `scroll|${name(el)}`;
      if (!seen.has(k)) { seen.add(k); out.push({ cls: 'clipped', el: name(el), detail: `content ${el.scrollWidth}px wider than box ${el.clientWidth}px (overflow-x ${cs.overflowX})`, ctx: args.ctx }); }
    }
    const pe = el.parentElement;
    if (pe && cs.display !== 'inline') {
      const pr = pe!.getBoundingClientRect();
      const pcs = getComputedStyle(pe!);
      if (/auto|scroll/.test(pcs.overflowX) && pcs.display === 'flex' && pcs.flexDirection === 'row') continue;
      if (pr.width > 0 && pcs.display !== 'contents' && (r.left < pr.left - 1.5 || r.right > pr.right + 1.5) && cs.position !== 'fixed' && cs.position !== 'absolute' && !/^(sw-drawer|sw-dialog)$/i.test(pe!.tagName.toLowerCase())) {
        const k = `out|${name(el)}|${name(pe!)}`;
        if (!seen.has(k)) { seen.add(k); out.push({ cls: 'escape', el: name(el), detail: `sticks out of ${name(pe!)} by ${Math.round(Math.max(pr.left - r.left, r.right - pr.right))}px`, ctx: args.ctx }); }
      }
    }
  }
  return out;
}
