/**
 * LOBBY-STYLES-2300 - the hi-tech lobby styles (Lumen, Axis, Prism) as a plug-in of the notice-board engine (skin-board.ts). The engine keeps what
 * every style shares (the canvas, the rotation timer, the "Up next" data, the announcement overlay, the network line, the burn-in drift); this module
 * draws the hi-tech header / footer / messages and runs their motion, ported from the owner-approved mock-up
 * private/design-system-2026-10-27/round7/noticeboard-hitech/hx.js (MOTION_HE.md has the exact names and values).
 *
 * Motion: composite properties only (transform, opacity, clip-path). Prefers-reduced-motion = fades only. The ambient background (Lumen's light pools,
 * Prism's colour field) has three levels - high / low (frozen) / off - set by the administrator or, on "auto", measured on the screen itself and
 * degraded on a slow device (skin-logic.ts: fxStep). Nothing scrolls; no inline style attributes are written in markup (the page's CSP).
 */
import { esc, str, type FeedNotice, type Item } from './tv-logic';
import { HX_STEPS, colsFor, fxLevelFor, fxStart, fxStep, greetingKey, skyOf, urgentInRotation, type FxLevel, type FxState } from './skin-logic';
import { digitsHtml, hoursRow, metaHtml, tx, words } from './hx-parts';
import type { EngineApi } from './skin-board';

const E_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const E_IO = 'cubic-bezier(0.77, 0, 0.175, 1)';
const E_SOFT = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

/** A critically damped (zeta 1) or slightly under-damped spring solved once and sampled into a CSS linear() curve (the mock-up's `spring()`). */
export function spring(zeta: number, response: number): { ease: string; ms: number } {
  const w = (2 * Math.PI) / response;
  const x = (t: number): number => {
    if (zeta >= 1) return 1 - (1 + w * t) * Math.exp(-w * t);
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
  };
  let T = 0.05;
  const dt = 1 / 120;
  for (; T < 4; T += dt) {
    let ok = true;
    for (let s = T; s < T + 0.25; s += dt) if (Math.abs(1 - x(s)) > 0.003) { ok = false; break; }
    if (ok) break;
  }
  const N = 40;
  const pts: number[] = [];
  for (let k = 0; k <= N; k++) pts.push(+x((T * k) / N).toFixed(4));
  pts[N] = 1;
  return { ease: 'linear(' + pts.join(', ') + ')', ms: Math.round(T * 1000) };
}

export interface Hx {
  header(): void;
  footer(): void;
  setupTicker(): void;
  /** build a message, put it (hidden) on the stage and fit it */
  makeMsg(it: Item | null): HTMLElement;
  /** show the item at index i (the engine's showAt for the hi-tech family) */
  show(i: number, animate: boolean): void;
  /** the external (first-minute) urgent take-over, or none */
  setTake(n: FeedNotice | null): void;
  /** the clock moved (called every few seconds by the page) */
  tick(c: { t: string }): void;
  /** the input changed: the sky, the ambient level, the cove */
  applied(first: boolean): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

export function createHx(api: EngineApi): Hx {
  const { root, S, h } = api;
  const inp = api.inp;
  const skin = (): string => inp().skin;
  const sp = (() => {
    const lin = typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)');
    const m = { reveal: spring(1, 0.62), settle: spring(1, 0.9), word: spring(0.82, 0.5), panel: spring(1, 0.5) };
    if (!lin) for (const k of Object.keys(m) as (keyof typeof m)[]) m[k].ease = E_OUT;
    return m;
  })();
  const X = {
    coveAnim: null as Animation | null,
    ghostX: 0,
    poolK: 0,
    rtake: '',
    leaving: false,
    fx: 'high' as FxLevel,
    measured: 'high' as FxLevel,
    st: { level: 'high', slow: 0, fast: 0 } as FxState,
    fxRun: 0,
    fxT: 0,
    newsT: 0,
    img: null as HTMLImageElement | null,
  };

  // ------------------------------------------------------------------ clock digits (each digit sits in its own mask and rolls)
  function setDigits(el: HTMLElement | null, t: string): void {
    if (!el) return;
    const old = el.dataset.t;
    if (!old || old.length !== t.length || !S.ready || api.opts.fixed) {
      el.innerHTML = digitsHtml(t);
      el.dataset.t = t;
      el.setAttribute('aria-label', t);
      return;
    }
    if (old === t) return;
    el.dataset.t = t;
    el.setAttribute('aria-label', t);
    const cells = el.querySelectorAll<HTMLElement>('.nb-dg');
    [...t].forEach((c, k) => {
      if (c === old[k] || c === ':') return;
      const cell = cells[k];
      const prev = cell.querySelector<HTMLElement>('.nb-dv');
      const nw = h('span', 'nb-dv', esc(c));
      cell.append(nw);
      if (!prev) return;
      if (api.rm()) {
        prev.remove();
        api.track(nw.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: E_SOFT }));
        return;
      }
      const d = (t.length - k) * 50;
      // odometer: the old digit leaves upward, the new one rises in from below the mask (right-most first)
      api.track(prev.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-105%)' }], { duration: 420, delay: d, easing: E_IO, fill: 'forwards' })).finished.then(() => prev.remove(), () => prev.remove());
      api.track(nw.animate([{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], { duration: sp.reveal.ms, delay: d + 90, easing: sp.reveal.ease, fill: 'backwards' }));
    });
  }

  function hourOf(t: string): number {
    return Number(t.slice(0, 2)) || 0;
  }
  function setSky(): void {
    const t = inp().clock().t;
    root.dataset.sky = skyOf(hourOf(t) * 60 + (Number(t.slice(3, 5)) || 0), inp().sun);
  }

  // ------------------------------------------------------------------ header and footer
  function header(): void {
    const i = inp();
    const c = i.clock();
    const w = i.weather;
    const hd = api.$('.nb-hd');
    hd.dataset.wx = w ? '1' : '0';
    const hours = i.skin === 'prism' && w?.hours ? hoursRow(w.hours, str(i.lang, 'next')) : '';
    hd.innerHTML =
      '<div class="nb-brand">' + i.company + '<div class="nb-nm"><b dir="auto" title="' + esc(i.building) + '">' + esc(i.building) + '</b><span dir="auto" title="' + esc(i.place) + '">' + esc(i.place) + '</span></div></div>' +
      '<div class="nb-time"><span class="nb-t nb-num" dir="ltr" data-nb-digits></span><span class="nb-d" data-nb-date>' + esc(c.d) + '</span></div>' +
      '<div class="nb-wx" data-has="' + (w ? '1' : '0') + '">' + (w ? '<span class="nb-tmp nb-num" dir="ltr">' + w.t + '°</span><span class="nb-tx" dir="auto">' + esc(w.text) + '</span>' + hours : '') + '</div>';
    setDigits(hd.querySelector('.nb-t'), c.t);
    const gc = api.$('.nb-gclock');
    gc.innerHTML = i.skin === 'axis' ? '<span class="nb-gt nb-num" dir="ltr"></span>' : '';
    ghostDigits(c.t);
  }
  function ghostDigits(t: string): void {
    const g = root.querySelector<HTMLElement>('.nb-gclock .nb-gt');
    if (g) setDigits(g, root.dataset.orient === 'p' ? t.replace(':', '') : t);
  }

  function footer(): void {
    const i = inp();
    const news = i.news.map((n) => '<span class="nb-it" dir="auto"><em dir="auto">' + esc(n.source) + '</em><span class="nb-tl" dir="auto">' + tx(n.title) + '</span></span>').join('');
    const info = i.info.map((x) => '<li data-state="' + esc(x.state) + '"><i aria-hidden="true"></i><b dir="auto">' + esc(x.label) + '</b><span dir="auto">' + esc(x.text) + '</span></li>').join('');
    const ft = api.$('.nb-ft');
    ft.dataset.news = i.news.length ? '1' : '0';
    ft.innerHTML = '<ul class="nb-info">' + info + '</ul><div class="nb-news" aria-label="' + esc(str(i.lang, 'news')) + '"><div class="nb-track">' + news + '</div></div>' +
      '<div class="nb-live" data-net="' + i.net + '"><span class="nb-st8">' + api.liveHtml() + '</span>' + api.logo(i.dark) + '</div>';
    fitInfo(ft);
  }
  /** The building-systems row never runs past the footer: the healthy entries go first, then the last one. */
  function fitInfo(ft: HTMLElement): void {
    const ul = ft.querySelector<HTMLElement>('.nb-info');
    if (!ul) return;
    let guard = 0;
    while ((ft.scrollWidth > ft.clientWidth + 1 || ul.scrollWidth > ul.clientWidth + 1) && ul.children.length > 1 && guard++ < 8) {
      const ok = ([...ul.children] as HTMLElement[]).reverse().find((li) => li.dataset.state === 'ok');
      (ok ?? (ul.lastElementChild as HTMLElement)).remove();
    }
    const nw = ft.querySelector<HTMLElement>('.nb-news');
    if (nw) nw.hidden = nw.clientWidth < 300 && ft.dataset.news === '1' && root.dataset.orient !== 'p';
  }

  /** One headline at a time: the old one leaves up, the next rises from behind the line's mask (reduced motion: a fade). */
  function setupTicker(): void {
    clearInterval(X.newsT);
    const its = [...root.querySelectorAll<HTMLElement>('.nb-ft .nb-it')];
    if (!its.length) return;
    let k = 0;
    its[0].classList.add('nb-on');
    if (api.opts.fixed || its.length < 2) return;
    X.newsT = window.setInterval(() => {
      if (api.paused() || document.hidden || S.take || S.ann) return;
      const old = its[k];
      k = (k + 1) % its.length;
      const nw = its[k];
      old.classList.remove('nb-on');
      nw.classList.add('nb-on');
      if (api.rm()) {
        nw.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: E_SOFT });
        return;
      }
      old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-60%)', opacity: 0 }], { duration: 380, easing: E_IO });
      nw.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: sp.reveal.ms, delay: 160, easing: sp.reveal.ease, fill: 'backwards' });
    }, 9000);
  }

  // ------------------------------------------------------------------ the messages
  function msgHtml(it: Item): string {
    const i = inp();
    const n = it.n;
    const word = it.slide ? '' : n.severity === 'critical' ? str(i.lang, 'urgent') : n.severity === 'alert' ? str(i.lang, 'alert') : '';
    const when = it.slide ? str(i.lang, 'fromMgmt') : i.whenOf(n) || str(i.lang, 'permanent');
    const src = it.slide ? i.imgOf(it.slide) : '';
    const img = src ? '<figure class="nb-pic"><img src="' + esc(src) + '" alt=""></figure>' : '';
    return '<div class="nb-txt">' + metaHtml({ severity: n.severity, word, when }) + '<h1 class="nb-ttl" dir="auto" data-src="' + esc(n.title) + '">' + words(i.skin, n.title) + '</h1><p class="nb-bd" dir="auto">' + tx(n.body) + '</p></div>' + img;
  }
  function idleHtml(): string {
    const i = inp();
    const hr = hourOf(i.clock().t);
    const greet = str(i.lang, greetingKey(hr));
    return '<div class="nb-txt"><h1 class="nb-ttl nb-big" dir="auto" data-src="' + esc(greet) + '">' + words(i.skin, greet) + '</h1><p class="nb-bd">' + esc(str(i.lang, 'empty')) + ' · ' + esc(str(i.lang, 'niceDay')) + '</p></div>';
  }
  function buildMsg(it: Item | null): HTMLElement {
    const el = h('article', 'nb-msg');
    if (!it) {
      el.classList.add('nb-idle');
      el.innerHTML = idleHtml();
      return el;
    }
    el.dataset.sev = it.n.severity;
    el.dataset.kind = it.slide ? 'slide' : 'perm';
    if (it.slide && inp().imgOf(it.slide)) el.classList.add('nb-slide');
    el.innerHTML = msgHtml(it);
    return el;
  }

  /** Lumen: group the title's words into their rendered lines, each line in its own mask. */
  function maskLines(el: HTMLElement): void {
    const t = el.querySelector<HTMLElement>('.nb-ttl');
    if (!t) return;
    const ws = [...t.querySelectorAll<HTMLElement>('.nb-wd')];
    if (!ws.length) return;
    const lines: string[][] = [];
    let top: number | null = null;
    for (const w of ws) {
      const y = Math.round(w.offsetTop);
      if (top === null || Math.abs(y - top) > 4) { lines.push([]); top = y; }
      lines[lines.length - 1].push(w.outerHTML);
    }
    t.innerHTML = lines.map((l) => '<span class="nb-ln"><span class="nb-li">' + l.join(' ') + '</span></span>').join('');
  }

  /** Does anything run past its box? A bottom-anchored text overflows upwards, which scrollHeight does not report, so the boxes are compared too. */
  function overflows(el: HTMLElement): boolean {
    const boxes = [el, ...el.querySelectorAll<HTMLElement>('.nb-txt')];
    if (boxes.some((c) => c.scrollHeight > c.clientHeight + 1)) return true;
    for (const c of boxes) {
      const r = c.getBoundingClientRect();
      for (const k of c.children) {
        const q = k.getBoundingClientRect();
        if (q.height && (q.top < r.top - 1 || q.bottom > r.bottom + 1)) return true;
      }
    }
    return [...el.querySelectorAll<HTMLElement>('.nb-ttl, .nb-bd, .nb-meta')].some((t) => t.scrollWidth > t.clientWidth + 1);
  }
  function resplit(el: HTMLElement): void {
    const t = el.querySelector<HTMLElement>('.nb-ttl');
    if (!t) return;
    t.innerHTML = words(inp().skin, t.dataset.src ?? t.textContent ?? '');
    if (skin() === 'lumen') maskLines(el);
  }
  function tryFs(el: HTMLElement, f: number): boolean {
    el.style.setProperty('--fs', String(f));
    if (skin() === 'lumen') resplit(el);
    return !overflows(el);
  }
  /** Owner 2026-10-30: a long notice SHRINKS until it fits (to 55 %), then two columns (three on a long landscape one); no pages, no cut. */
  function fitInto(el: HTMLElement): number {
    delete el.dataset.cols;
    for (const f of HX_STEPS) if (tryFs(el, f)) return f;
    const chars = (el.querySelector('.nb-bd')?.textContent || '').length;
    const land = root.dataset.orient === 'l';
    if (colsFor(chars, land) >= 2) {
      el.dataset.cols = '2';
      for (const f of HX_STEPS) if (tryFs(el, f)) return f;
      if (colsFor(chars, land) === 3) {
        el.dataset.cols = '3';
        for (const f of HX_STEPS) if (tryFs(el, f)) return f;
      }
    }
    return 0;
  }
  function fitAll(el: HTMLElement, it: Item | null): number {
    const keep = root.dataset.long;
    root.dataset.long = '0';
    delete el.dataset.long;
    let f = fitInto(el);
    // still too long: measure it against the larger stage it gets when the queue steps aside (set and reset in one task: never painted)
    if (f < 0.77 && it) {
      root.dataset.long = '1';
      el.dataset.long = '1';
      delete el.dataset.cols;
      const f2 = fitInto(el);
      if (f2 >= f) f = f2;
      else {
        delete el.dataset.long;
        delete el.dataset.cols;
        root.dataset.long = '0';
        f = fitInto(el);
      }
    }
    root.dataset.long = keep || '0';
    return f;
  }
  function makeMsg(it: Item | null): HTMLElement {
    const el = buildMsg(it);
    el.classList.add('nb-prep');
    el.style.visibility = 'hidden';
    api.stage().append(el);
    const f = fitAll(el, it);
    el.dataset.fit = String(f);
    return el;
  }

  // ------------------------------------------------------------------ choreography per style
  const track = api.track;
  const parts = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.nb-txt > .nb-meta, .nb-txt > .nb-bd, .nb-pic')];

  function enter(el: HTMLElement): Promise<void> {
    if (api.rm()) return track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: E_SOFT, fill: 'backwards' })).finished.then(() => undefined, () => undefined);
    let last: Animation | undefined;
    const s = skin();
    // ambient level 'off' (a device measured too slow): one composited move for the whole notice instead of per-line / per-word
    if (X.fx === 'off') {
      last = track(el.animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 200, easing: E_OUT, fill: 'backwards' }));
      if (s === 'lumen') cove();
      return last.finished.then(() => undefined, () => undefined);
    }
    if (s === 'lumen') {
      // masked line reveal: each line rises out of its own mask, 80 ms apart; meta and body follow as one quiet fade-rise
      const lines = [...el.querySelectorAll<HTMLElement>('.nb-ttl .nb-li')];
      lines.forEach((l, j) => { last = track(l.animate([{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }], { duration: sp.reveal.ms, delay: 260 + j * 80, easing: sp.reveal.ease, fill: 'backwards' })); });
      parts(el).forEach((p, j) => { last = track(p.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 420 + lines.length * 80 + j * 70, easing: E_OUT, fill: 'backwards' })); });
      cove();
    } else if (s === 'axis') {
      // kinetic type: the words assemble one after another with a small spring; the giant clock slides 14 px the other way (depth)
      const ws = [...el.querySelectorAll<HTMLElement>('.nb-ttl .nb-wi')];
      const step = Math.max(30, Math.min(55, 620 / Math.max(1, ws.length)));
      ws.forEach((w, j) => { last = track(w.animate([{ transform: 'translateY(112%)' }, { transform: 'translateY(0)' }], { duration: sp.word.ms, delay: 200 + j * step, easing: sp.word.ease, fill: 'backwards' })); });
      parts(el).forEach((p, j) => { last = track(p.animate([{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 300 + ws.length * step * 0.6 + j * 80, easing: E_OUT, fill: 'backwards' })); });
      ghostShift();
    } else {
      // prism: the sheet text is uncovered top-down, the field drifts to its next position
      last = track(el.animate([{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(24px)' }, { clipPath: 'inset(0 0 0% 0)', transform: 'none' }], { duration: sp.reveal.ms * 1.25, delay: 240, easing: sp.reveal.ease, fill: 'backwards' }));
      const pic = el.querySelector<HTMLElement>('.nb-pic');
      if (pic) track(pic.animate([{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 1100, easing: E_OUT, fill: 'backwards' }));
      fieldShift();
    }
    return (last as Animation | undefined)?.finished.then(() => undefined, () => undefined) ?? Promise.resolve();
  }

  function leave(el: HTMLElement): Promise<void> {
    if (el.dataset.leaving) return Promise.resolve();
    el.dataset.leaving = '1';
    // a notice cut short mid-entrance leaves from where it is on screen: its running entrance is frozen in place, then the whole notice fades out
    const live = +getComputedStyle(el).opacity || 1;
    for (const a of el.getAnimations({ subtree: true })) {
      try { a.commitStyles(); } catch { /* not rendered */ }
      a.cancel();
    }
    const rm = api.rm();
    const d = rm ? 280 : 380;
    const s = skin();
    let a: Animation;
    if (rm) a = el.animate([{ opacity: live }, { opacity: 0 }], { duration: d, easing: E_SOFT, fill: 'forwards' });
    else if (s === 'lumen') a = el.animate([{ opacity: live, transform: 'none' }, { opacity: 0, transform: 'translateY(-28px)' }], { duration: d, easing: E_OUT, fill: 'forwards' });
    else if (s === 'axis') a = el.animate([{ opacity: live, transform: 'none' }, { opacity: 0, transform: 'translateX(40px)' }], { duration: d, easing: E_OUT, fill: 'forwards' });
    else a = el.animate([{ opacity: live, clipPath: 'inset(0 0 0 0)' }, { opacity: 0.2, clipPath: 'inset(100% 0 0 0)' }], { duration: d * 1.1, easing: E_OUT, fill: 'forwards' });
    return track(a).finished.then(() => el.remove(), () => el.remove());
  }

  /** Lumen: the recessed light line measures the notice's time on the wall (linear: progress must not ease). */
  function cove(): void {
    const bar = root.querySelector<HTMLElement>('.nb-cove i');
    if (!bar) return;
    bar.getAnimations().forEach((a) => a.cancel());
    X.coveAnim = null;
    if (api.opts.fixed) { bar.style.transform = 'scaleX(0.42)'; return; }
    if (api.paused() || S.idle || S.items.length < 2) { bar.style.transform = 'scaleX(0)'; return; }
    bar.style.transform = '';
    const sec = api.rotSeconds();
    const ms = S.items[S.i].dwell * sec * 1000;
    X.coveAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
  }
  function ghostShift(): void {
    const g = root.querySelector<HTMLElement>('.nb-gclock');
    if (!g || api.rm() || X.fx === 'off') return;
    const from = X.ghostX;
    X.ghostX = X.ghostX ? 0 : 14;
    track(g.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + X.ghostX + 'px)' }], { duration: sp.settle.ms, easing: sp.settle.ease, fill: 'forwards' }));
  }
  const POOL: readonly (readonly [number, number])[] = [[0, 0], [-180, 40], [140, -30], [-60, 70]];
  function fieldShift(): void {
    // lumen: the light pool on the wall; prism: the colour field. Moved by a critically damped spring from where it is now.
    const m = root.querySelector<HTMLElement>('.nb-amb');
    if (!m || api.rm() || X.fx === 'off') return;
    const cur = getComputedStyle(m).transform;
    X.poolK = (X.poolK + 1) % POOL.length;
    const [x, y] = POOL[X.poolK];
    m.getAnimations().forEach((a) => a.cancel());
    track(m.animate([{ transform: cur === 'none' ? 'none' : cur }, { transform: 'translate(' + x + 'px, ' + y + 'px)' }], { duration: sp.settle.ms * 1.6, easing: sp.settle.ease, fill: 'forwards' }));
  }
  /** Prism: a slide's picture takes the place of the colour field (cross-fade; the field keeps drifting underneath). */
  function fieldImage(src: string, animate: boolean): void {
    let im = X.img && X.img.isConnected ? X.img : root.querySelector<HTMLImageElement>('.nb-fld .nb-fimg');
    if (!im) {
      if (!src) return;
      im = document.createElement('img');
      im.className = 'nb-fimg';
      im.alt = '';
      root.querySelector('.nb-fld .nb-amb')?.after(im);
    }
    X.img = im;
    const on = !!src;
    const was = im.dataset.on === '1';
    if (on) im.src = src;
    im.dataset.on = on ? '1' : '0';
    root.dataset.pic = on ? '1' : '0';
    im.style.opacity = on ? '1' : '0';
    if (on === was || !animate) return;
    track(im.animate([{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], { duration: 900, easing: E_SOFT }));
  }

  // ------------------------------------------------------------------ the rotation
  const wantsRotTake = (it: Item | undefined): boolean => !!it && it.n.severity === 'critical' && urgentInRotation(inp().skin, inp().urgentScreen);

  function show(i: number, animate: boolean): void {
    const st = api.stage();
    S.i = i;
    const it = S.idle ? null : S.items[i];
    if (!S.idle) api.queue();
    else root.dataset.q = '0';
    if (it && wantsRotTake(it)) {
      // an urgent notice in the rotation takes the whole screen for its turn (hi-tech: as the mock-up); the rotation goes on under it
      X.rtake = it.n.id;
      root.dataset.kind = 'critical';
      if (!S.take) layerShow(it.n, animate);
      cove();
      api.schedule();
      return;
    }
    X.rtake = '';
    if (!S.take && root.dataset.take === '1') layerHide(animate);
    // every notice still on the stage leaves (a turn cut short by urgent or by a fast next can leave more than one)
    const olds = [...st.querySelectorAll<HTMLElement>(':scope > .nb-msg:not(.nb-prep)')];
    let el: HTMLElement;
    if (S.prep && S.prep.i === i && !S.idle && S.prep.el.isConnected) {
      el = S.prep.el;
      S.prep = null;
    } else {
      api.dropPrep();
      el = makeMsg(it);
    }
    el.classList.remove('nb-prep');
    el.style.visibility = '';
    if (!S.idle && animate && !api.opts.fixed && X.fx !== 'off') queueIn();
    root.dataset.kind = S.idle ? 'idle' : (el.dataset.kind ?? 'perm');
    root.dataset.long = !S.idle && el.dataset.long === '1' ? '1' : '0';
    // the stage is laid out for real now (fonts, kind, long): when the prepared fit no longer holds, fit again
    if (!S.idle && overflows(el)) { el.dataset.fit = String(fitAll(el, it)); root.dataset.long = el.dataset.long === '1' ? '1' : '0'; }
    if (skin() === 'prism') fieldImage(it?.slide ? inp().imgOf(it.slide) : '', animate);
    if (!animate) {
      olds.forEach((o) => o.remove());
      api.schedule();
      cove();
      return;
    }
    olds.forEach((o) => { void leave(o); });
    void enter(el).then(() => api.schedule(), () => undefined);
  }

  /** The "Up next" rows arrive one after another (60 ms apart, 12 px rise), timed to land with the notice's title; reduced motion: a plain fade. */
  function queueIn(): void {
    const rm = api.rm();
    [...root.querySelectorAll<HTMLElement>('.nb-q ol li, .nb-q .nb-pos')].forEach((r, k) => {
      track(r.animate(rm ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: rm ? 400 : 520, delay: 360 + k * 60, easing: E_OUT, fill: 'backwards' }));
    });
  }

  // ------------------------------------------------------------------ the urgent take-over layer
  function takeHtml(n: FeedNotice): string {
    const i = inp();
    const c = i.clock();
    const word = esc(str(i.lang, 'urgent'));
    return '<div class="nb-tbg" aria-hidden="true"><i></i><i></i><i></i></div><div class="nb-lsweep" aria-hidden="true"></div>' + (i.skin === 'axis' ? '<div class="nb-tg" aria-hidden="true">' + esc(str(i.lang, 'urgentWord')) + '</div>' : '') +
      '<div class="nb-tw"><div class="nb-th"><span class="nb-tl"><i class="nb-sq" aria-hidden="true"></i>' + word + '</span><span class="nb-tt nb-num" data-nb-time>' + esc(c.t) + '</span></div>' +
      '<div class="nb-tm"><h1 class="nb-ttl" dir="auto" data-src="' + esc(n.title) + '">' + words(i.skin, n.title) + '</h1><p class="nb-bd" dir="auto">' + tx(n.body) + '</p><p class="nb-when" dir="auto">' + tx(i.whenOf(n)) + '</p></div>' +
      '<div class="nb-tf"><span dir="auto">' + esc(i.building + (i.place ? ' · ' + i.place : '')) + '</span>' + api.logo(true) + '</div></div>';
  }
  function fitTake(el: HTMLElement): void {
    const tm = el.querySelector<HTMLElement>('.nb-tm');
    if (!tm) return;
    const t = tm.querySelector<HTMLElement>('.nb-ttl');
    const SZ = [1, 0.9, 0.8, 0.72, 0.64, 0.57, 0.5];
    const fits = (): boolean => tm.scrollHeight <= tm.clientHeight + 1 && ![...tm.children].some((c) => c.scrollWidth > c.clientWidth + 1);
    let k = 0;
    for (; k < SZ.length; k++) { el.style.setProperty('--fs', String(SZ[k])); if (fits()) break; }
    if (skin() === 'lumen' && t) {
      maskLines(tm);
      while (!fits() && k < SZ.length - 1) {
        k++;
        el.style.setProperty('--fs', String(SZ[k]));
        t.innerHTML = words('lumen', t.dataset.src ?? '');
        maskLines(tm);
      }
    }
  }
  /** Prism: the urgent field grows out of the colour field (its own rectangle on this canvas). */
  function fieldRect(): string {
    const f = root.querySelector<HTMLElement>('.nb-fld');
    if (!f) return 'inset(0 0 0 0)';
    return root.dataset.orient === 'p' ? 'inset(0 0 ' + Math.max(0, root.clientHeight - f.offsetHeight) + 'px 0)' : 'inset(0 ' + Math.max(0, root.clientWidth - f.offsetWidth) + 'px 0 0)';
  }
  function liveStyle(el: HTMLElement): { opacity: string; transform: string } {
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform === 'none' ? 'none' : cs.transform };
  }

  function layerShow(n: FeedNotice, animate: boolean): void {
    const tk = api.$('.nb-take');
    const was = root.dataset.take === '1' && !X.leaving;
    const live = liveStyle(tk);
    tk.getAnimations().forEach((a) => a.cancel());
    X.leaving = false;
    tk.innerHTML = takeHtml(n);
    root.dataset.take = '1';
    fitTake(tk);
    if (was || !animate || !S.ready) return;
    if (api.rm()) {
      track(tk.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: E_SOFT }));
      return;
    }
    // faster than the ordinary turn: the change is felt at once, with no flash and no shake
    const s = skin();
    if (s === 'prism') track(tk.animate([{ clipPath: fieldRect() }, { clipPath: 'inset(0 0 0 0)' }], { duration: 760, easing: sp.panel.ease }));
    else if (s === 'axis') track(tk.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: sp.panel.ms, easing: sp.panel.ease }));
    else track(tk.animate([{ opacity: +live.opacity < 1 && root.dataset.take === '1' ? +live.opacity : 0 }, { opacity: 1 }], { duration: 420, easing: E_OUT }));
    const sw = tk.querySelector<HTMLElement>('.nb-lsweep');
    if (sw && X.fx !== 'off') track(sw.animate([{ transform: 'translateX(120%)' }, { transform: 'translateX(-220%)' }], { duration: 1400, delay: 250, easing: E_IO }));
    [...tk.querySelectorAll<HTMLElement>('.nb-ttl .nb-li, .nb-ttl .nb-wi')].forEach((l, j) => {
      track(l.animate([{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }], { duration: sp.reveal.ms, delay: 220 + j * (s === 'axis' ? 30 : 60), easing: s === 'axis' ? sp.word.ease : sp.reveal.ease, fill: 'backwards' }));
    });
    [tk.querySelector('.nb-th'), tk.querySelector('.nb-tm .nb-bd'), tk.querySelector('.nb-tm .nb-when'), tk.querySelector('.nb-tf'), tk.querySelector('.nb-tg')].filter(Boolean).forEach((p, j) => {
      track((p as HTMLElement).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 300 + j * 70, easing: E_OUT, fill: 'backwards' }));
    });
  }
  function layerHide(animate: boolean): void {
    const tk = api.$('.nb-take');
    if (root.dataset.take !== '1') return;
    if (!animate || !S.ready) { root.dataset.take = '0'; return; }
    const live = liveStyle(tk);
    tk.getAnimations().forEach((a) => a.cancel());
    X.leaving = true;
    let a: Animation;
    if (api.rm()) a = tk.animate([{ opacity: live.opacity }, { opacity: 0 }], { duration: 280, easing: E_SOFT, fill: 'forwards' });
    else if (skin() === 'axis') a = tk.animate([{ transform: live.transform }, { transform: 'translateY(100%)' }], { duration: 480, easing: E_IO, fill: 'forwards' });
    else a = tk.animate([{ opacity: live.opacity }, { opacity: 0 }], { duration: 460, easing: E_SOFT, fill: 'forwards' });
    void track(a).finished.then(() => {
      if (!S.take && !X.rtake) root.dataset.take = '0';
      X.leaving = false;
      a.cancel();
    }, () => { X.leaving = false; });
  }

  function setTake(n: FeedNotice | null): void {
    const id = n ? n.id : '';
    if (id === S.take) return;
    const was = S.take;
    // whatever is moving finishes at once (an urgent notice arriving mid-transition leaves nothing behind)
    api.cancelAll();
    clearTimeout(S.timer);
    clearTimeout(S.prepT);
    api.dropPrep();
    S.busy = false;
    S.take = id;
    if (n) {
      layerShow(n, !was);
      return;
    }
    // the first minute is over: the rotation's own take (if the notice is the current one) goes on, else the layer leaves
    const cur = S.idle ? undefined : S.items[S.i];
    if (wantsRotTake(cur) && cur) {
      X.rtake = cur.n.id;
      layerShow(cur.n, false);
    } else layerHide(S.ready);
    api.schedule();
  }

  // ------------------------------------------------------------------ the ambient level (measured, and degraded on slow devices)
  function setFx(): void {
    const lvl = fxLevelFor(inp().liveBg, X.measured, api.rm());
    X.fx = lvl;
    root.dataset.fx = lvl;
  }
  function measureFrames(ms: number): Promise<number> {
    return new Promise((res) => {
      const f: number[] = [];
      let last = performance.now();
      const end = last + ms;
      const loop = (t: number): void => {
        f.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(loop);
        else { f.sort((a, b) => a - b); res(f[Math.floor(f.length * 0.9)] || 16.7); }
      };
      requestAnimationFrame(loop);
    });
  }
  /** On "auto": sample 1.5 s after start and every 30 s; the verdict of fxStep moves the level one step down (or back up after a long fast run). */
  function fxWatch(): void {
    const run = ++X.fxRun;
    const cores = navigator.hardwareConcurrency || 4;
    X.st = { level: fxStart(cores), slow: 0, fast: 0 };
    X.measured = X.st.level;
    setFx();
    let n = 0;
    const loop = (): void => {
      X.fxT = window.setTimeout(() => {
        if (run !== X.fxRun) return;
        if (document.hidden || api.paused() || inp().liveBg !== 'auto') { loop(); return; }
        void measureFrames(1200).then((p90) => {
          if (run !== X.fxRun) return;
          X.st = fxStep(X.st, p90, cores);
          if (X.st.level !== X.measured) { X.measured = X.st.level; setFx(); }
          loop();
        });
      }, n++ ? 30000 : 1500);
    };
    loop();
  }

  // ------------------------------------------------------------------ the clock, the input, the pauses
  function tick(c: { t: string }): void {
    setDigits(root.querySelector('.nb-hd .nb-t'), c.t);
    ghostDigits(c.t);
    setSky();
  }
  function applied(first: boolean): void {
    setSky();
    if (first) {
      X.measured = api.opts.fixed ? 'low' : fxStart(navigator.hardwareConcurrency || 4);
      if (!api.opts.fixed) fxWatch();
    }
    setFx();
  }
  // the lobby fonts load after the first fit (the page is built before the glyphs arrive): fit the shown notice again once they are in
  const refit = (): void => {
    for (const el of api.stage().querySelectorAll<HTMLElement>('.nb-msg:not(.nb-prep)')) {
      if (el.dataset.fit === undefined) continue;
      el.dataset.fit = String(fitInto(el));
    }
  };
  try { void document.fonts?.ready.then(refit); document.fonts?.addEventListener?.('loadingdone', refit); } catch { /* no font API: keep the first fit */ }
  return {
    header,
    footer,
    setupTicker,
    makeMsg,
    show,
    setTake,
    tick,
    applied,
    pause() {
      X.coveAnim?.pause();
    },
    resume() {
      X.coveAnim?.play();
    },
    dispose() {
      try { document.fonts?.removeEventListener?.('loadingdone', refit); } catch { /* ignore */ }
      X.fxRun++;
      clearTimeout(X.fxT);
      clearInterval(X.newsT);
      X.rtake = '';
      X.leaving = false;
    },
  };
}
