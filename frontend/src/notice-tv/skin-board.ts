/**
 * NOTICEBOARD-STYLES-2300 - the DOM engine of the two maintenance-area notice-board styles "Ink" and "Sign" (the approved mock-up
 * private/design-system-2026-10-27/round7/noticeboard-styles/nb.js, driven by the board's feed instead of demo data). The page (main.ts) hands it
 * one `SkinInput` per render; the engine owns everything inside `#nbk`: the header, the stage with the rotation and its transitions, the "Up next"
 * list, the footer, the urgent take-over and the voice-announcement overlay.
 *
 * Motion: composite properties only (transform, opacity) - the Ink refresh bar and its counter-moving wipe frame, the Sign rotating strips (prisms
 * turning right to left in Hebrew, left to right in English), fades under prefers-reduced-motion. The next message and the strips are built about
 * 0.9 s before the turn, so the turn itself does no layout. A running transition is finished at once when something else needs the stage (an urgent
 * take-over, the next / previous key): never ignored, never stacked.
 *
 * A long body SHRINKS to fit (owner 2026-10-30), down to FS_MIN of the style's own sizes; only below that is it cut by whole lines with an ellipsis.
 * Nothing scrolls. No inline style attributes are written in markup (the page's CSP): sizes go through the CSSOM.
 */
import { swLogoSvg } from '../design/sw-logo-art';
import { MACHINE_MARK, dirOf, type ScreenAnnouncement } from '../announce/screen-overlay';
import { esc, str, type FeedNotice, type FeedSlide, type Item, type LiveBg, type Net, type SystemsStatus, type UrgentScreen } from './tv-logic';
import { createHx, type Hx } from './hx-engine';
import {
  familyOf, FS_MIN, FS_MIN_TAKE, GHOST_MS, GHOST_OPACITY, LANG_NAME, bestScale, canvasOf, infoIcon, isEventWhen, queueMax, queueRows, slatCount, tickSeconds, weatherIcon,
  type InfoIcon, type Skin,
} from './skin-logic';

export interface SkinInput {
  skin: Skin;
  dark: boolean;
  lang: 'he' | 'en';
  /** the board's own orientation choice (display.layout): '' = the viewport decides */
  force: 'portrait' | 'landscape' | '';
  building: string;
  place: string;
  weather: { t: number; icon: string; text: string; hours?: { at: string; t: number }[] } | null;
  /** LOBBY-STYLES-2300: the lobby styles' behaviour settings and the day's sun times (Prism's sky) */
  liveBg: LiveBg;
  urgentScreen: UrgentScreen;
  systemsStatus: SystemsStatus;
  sun?: { rise: string; set: string };
  /** the luxury styles' building photo (day) and the one at night (blob URLs; '' = none, the day one is darkened at night) */
  photo?: string;
  photoNight?: string;
  info: { kind: string; label: string; state: 'ok' | 'warn' | 'alarm' | 'off'; text: string }[];
  news: { source: string; title: string }[];
  /** the rotation: the urgent notices first, then the others, then the promo slides (no bus-times slide: the styles do not draw one) */
  items: Item[];
  /** the held item (display.hold, or the urgent one under the "stays" rule); -1 = none */
  held: number;
  rotateS: number;
  whenOf: (n: FeedNotice) => string;
  imgOf: (s: FeedSlide) => string;
  /** the urgent notice taking over the whole screen (its first minute after publishing) */
  takeover: FeedNotice | null;
  announcement: { a: ScreenAnnouncement; until: string } | null;
  net: Net;
  /** the "updated" line: the mode of display.updated and its pieces */
  live: { mode: 'place' | 'full' | 'time' | 'issues'; before: string; after: string; time: string };
  clock: () => { t: string; d: string; wd: string; dm: string };
  /** the tenant logo as drawn by the page ('' = none) */
  company: string;
  /** the idle board shows the tenant logo too (display.idle_logo = both) */
  idleCompany: boolean;
  drift: boolean;
  night: boolean;
  nightB: number;
}

/** What a style plug-in (hx-engine.ts) may use of the engine. */
export interface EngineState {
  i: number; items: Item[]; idle: boolean; busy: boolean; take: string; ann: string; timer: number; prepT: number; ready: boolean;
  prep: { i: number; el: HTMLElement; fx: HTMLElement | null } | null;
}
export interface EngineApi {
  root: HTMLElement; S: EngineState; opts: SkinOpts;
  inp(): SkinInput; stage(): HTMLElement; $<T extends HTMLElement>(sel: string): T;
  h(tag: string, cls: string, html?: string): HTMLElement;
  track(a: Animation): Animation; rm(): boolean; paused(): boolean; rotSeconds(): number;
  queue(): void; schedule(): void; dropPrep(): void; cancelAll(): void;
  liveHtml(): string; logo(dark: boolean): string;
}

export interface SkinOpts {
  /** test hook `?clock=fixed` / `?now=`: no timers (rotation, ticker, drift, cleaning); transitions still run when a key / message asks */
  fixed: boolean;
  /** test hook `?nbrot=<s>`: seconds per rotation tick instead of the board's interval */
  rot: number;
}

export interface SkinBoard {
  apply(input: SkinInput): void;
  command(cmd: string): void;
  isPaused(): boolean;
  /** the clock, the date and the network line (called every few seconds by the page) */
  tick(input: Pick<SkinInput, 'clock' | 'net' | 'live'>): void;
  /** the announcement overlay alone (the page re-evaluates its end every second) */
  setAnnouncement(a: SkinInput['announcement']): void;
  fit(): void;
  /** the Heebo files arrived: measure again */
  refit(): void;
  show(): void;
  hide(): void;
  readonly root: HTMLElement;
}

const E_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const E_IO = 'cubic-bezier(0.77, 0, 0.175, 1)';

const PATHS: Record<string, string> = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 3.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tri: '<path d="M12 3 22 20H2Z"/><path d="M12 9.5v4.5"/><rect x="11" y="16" width="2" height="2" class="f"/>',
  oct: '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8Z"/><path d="M12 7v6"/><rect x="11" y="15.5" width="2" height="2" class="f"/>',
  elevator: '<rect x="4" y="3" width="16" height="18"/><path d="M8.5 10 12 6.5 15.5 10Z M8.5 14 12 17.5 15.5 14Z" class="f"/>',
  generator: '<path d="M13 2 4.5 13.5h6.5l-1 8.5 8.5-11.5h-6.5Z"/>',
  parking: '<rect x="3" y="3" width="18" height="18"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  gym: '<path d="M2 12h20M5.5 8v8M8.5 6v12M15.5 6v12M18.5 8v8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  cloudsun: '<path d="M8 3v1.5M3 8h1.5M4.5 4.5l1 1M12.5 4.5l-1 1"/><path d="M5.5 10.5A3.5 3.5 0 0 1 12 8.5"/><path d="M7 20h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 20Z"/>',
  cloud: '<path d="M6.5 19h11a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2A3.6 3.6 0 0 0 6.5 19Z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  speaker: '<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/>',
  unlink: '<path d="M3 3l18 18"/><path d="M9 7h-2a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 3.5 8.5M8 12h3"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><rect x="4" y="17" width="3" height="3" class="f"/>',
  info: '<rect x="3" y="3" width="18" height="18"/><path d="M12 10.5V17"/><rect x="11" y="6.5" width="2" height="2" class="f"/>',
};

const PK: Record<InfoIcon, string> = {
  elevator: '<rect x="20" y="12" width="60" height="76" rx="6" fill="none" stroke="currentColor" stroke-width="7"/><path d="M36 42 50 27 64 42Z M36 58 50 73 64 58Z" fill="currentColor"/>',
  generator: '<path d="M56 8 22 56h24l-6 36 36-50H52Z" fill="currentColor"/>',
  parking: '<path d="M30 86V14h24a20 20 0 0 1 0 40H42v32Z M42 26v16h11a8 8 0 0 0 0-16Z" fill="currentColor" fill-rule="evenodd"/>',
  gym: '<path d="M8 46h84v8H8Z M16 34h10v32H16Z M28 26h10v48H28Z M62 26h10v48H62Z M74 34h10v32H74Z" fill="currentColor"/>',
  info: '<rect x="20" y="20" width="60" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="7"/><rect x="45" y="44" width="10" height="30" fill="currentColor"/><rect x="45" y="27" width="10" height="10" fill="currentColor"/>',
};

const txn = (s: string): string => esc(s).replace(/(\d[\d:.]*\s*[–-]\s*\d[\d:.]*)/g, '<bdi dir="ltr" class="nb-num">$1</bdi>');
const h = (tag: string, cls: string, html?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export function createSkinBoard(root: HTMLElement, opts: SkinOpts): SkinBoard {
  root.innerHTML =
    '<div class="nb-fld" aria-hidden="true"><div class="nb-amb"><i class="nb-l1"></i><i class="nb-l2"></i><i class="nb-l3"></i></div></div><div class="nb-gclock" aria-hidden="true"></div>' +
    '<div class="nb-shift"><div class="nb-pg"><figure class="nb-ph" aria-hidden="true"></figure><div class="nb-scrim" aria-hidden="true"></div><div class="nb-slab" aria-hidden="true"><div class="nb-glass"></div></div><header class="nb-hd"></header><main class="nb-st"></main><aside class="nb-q"></aside><div class="nb-cove" aria-hidden="true"><i></i></div><footer class="nb-ft"></footer></div></div>' +
    '<div class="nb-take" role="alert"></div><div class="nb-ann" role="alert" aria-live="assertive"></div><div class="nb-gone"><b></b><span></span></div>';
  root.setAttribute('role', 'region');

  const S: EngineState & Record<string, any> = {
    inp: null as SkinInput | null,
    sig: '',
    i: 0,
    items: [] as Item[],
    idle: false,
    idleFace: 0,
    busy: false,
    userPaused: false,
    held: -1,
    take: '' as string,
    ann: '' as string,
    timer: 0,
    prepT: 0,
    idleT: 0,
    newsT: 0,
    annT: 0,
    anims: [] as Animation[],
    prep: null as { i: number; el: HTMLElement; fx: HTMLElement | null } | null,
    ready: false,
    W: 1920,
    H: 1080,
    portrait: false,
    ratio10: false,
  };
  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
  const stage = (): HTMLElement => $('.nb-st');
  const inp = (): SkinInput => S.inp as SkinInput;
  const skin = (): Skin => inp().skin;
  const rtl = (): boolean => inp().lang !== 'en';
  const rm = (): boolean => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const paused = (): boolean => S.userPaused || S.held >= 0;
  const fam = (): string => (S.inp ? familyOf(S.inp.skin) : 'station');
  /** the lobby families (hi-tech and luxury) run on the plug-in engine; ink and sign on the station code below */
  const hitech = (): boolean => fam() !== 'station';
  let hx: Hx | null = null;
  const api: EngineApi = {
    root, S: S as EngineState, opts, inp, stage, $, h, rm,
    track: (a) => track(a), paused: () => paused(), rotSeconds: () => (opts.rot > 0 ? opts.rot : tickSeconds(inp().rotateS)),
    queue: () => queue(), schedule: () => schedule(), dropPrep: () => dropPrep(), cancelAll: () => cancelAll(), liveHtml: () => liveHtml(), logo: (d) => logo(d),
  };
  const getHx = (): Hx => (hx ??= createHx(api));
  const W = (): { urgent: string; alert: string; info: string } => ({ urgent: str(inp().lang, 'urgent'), alert: str(inp().lang, 'alert'), info: str(inp().lang, 'infoWord') });

  // ------------------------------------------------------------------ icons
  function ic(name: string, size: number): string {
    const ink = skin() === 'ink';
    return '<svg class="nb-ic nb-ic-' + name + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (ink ? 2.4 : 2.2) +
      '" stroke-linecap="' + (ink ? 'square' : 'round') + '" stroke-linejoin="' + (ink ? 'miter' : 'round') + '" aria-hidden="true">' + (PATHS[name] ?? PATHS.info).replace(/class="f"/g, 'fill="currentColor" stroke="none"') + '</svg>';
  }
  /** The white symbol plate every sign family carries (square = information, triangle = warning, disc = urgent). */
  function picto(sev: string, size: number): string {
    const o = '<svg class="nb-ic nb-pg-' + sev + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">';
    if (sev === 'critical') return o + '<circle cx="50" cy="50" r="46" fill="#fff"/><circle class="nb-s-red" cx="50" cy="50" r="38" fill="none" stroke-width="10"/><rect class="nb-f-red" x="45" y="25" width="10" height="34" rx="2"/><rect class="nb-f-red" x="45" y="66" width="10" height="10" rx="2"/></svg>';
    if (sev === 'alert') return o + '<path class="nb-s-onyel" d="M50 6 96 88H4Z" fill="#fff" stroke-width="8" stroke-linejoin="round"/><rect class="nb-f-onyel" x="45.5" y="36" width="9" height="28" rx="2"/><rect class="nb-f-onyel" x="45.5" y="69" width="9" height="9" rx="2"/></svg>';
    if (sev === 'slide') return o + '<rect class="nb-f-blue" x="4" y="4" width="92" height="92" rx="12"/><path d="M18 74 40 50l16 16 10-10 16 18Z" fill="#fff"/><circle cx="66" cy="34" r="8" fill="#fff"/></svg>';
    return o + '<rect x="4" y="4" width="92" height="92" rx="14" fill="#fff"/><rect class="nb-f-blue" x="43" y="40" width="14" height="40" rx="3"/><circle class="nb-f-blue" cx="50" cy="26" r="8"/></svg>';
  }
  const infoPk = (kind: InfoIcon): string => '<svg width="58" height="58" viewBox="0 0 100 100" aria-hidden="true">' + PK[kind] + '</svg>';
  const logo = (dark: boolean): string => '<span class="nb-sw">' + swLogoSvg('horizontal', dark ? 'white' : 'brand', 'SmplWise') + '</span>';

  // ------------------------------------------------------------------ canvas
  function fitCanvas(): void {
    const vw = window.innerWidth || 1920;
    const vh = window.innerHeight || 1080;
    const c = canvasOf(vw, vh, inp()?.force || undefined);
    S.W = c.w;
    S.H = c.h;
    S.portrait = c.portrait;
    S.ratio10 = c.ratio10;
    root.style.inlineSize = c.w + 'px';
    root.style.blockSize = c.h + 'px';
    const k = Math.min(vw / c.w, vh / c.h);
    root.style.transform = 'translate(' + (vw - c.w * k) / 2 + 'px,' + (vh - c.h * k) / 2 + 'px) scale(' + k + ')';
    root.dataset.orient = c.portrait ? 'p' : 'l';
    root.dataset.ratio = c.ratio10 ? '10' : '9';
    // a viewport that is not the canvas' shape leaves bars: the page draws them black (as on the other designs)
    document.body.classList.toggle('box', Math.abs(vw / vh - c.w / c.h) > 0.02);
  }

  // ------------------------------------------------------------------ header and footer
  function header(): void {
    if (hitech()) { getHx().header(); return; }
    const i = inp();
    const c = i.clock();
    const w = i.weather;
    const ink = i.skin === 'ink';
    const nm = '<div class="nb-nm' + (ink ? '' : ' nb-sgn') + '"><b dir="auto" title="' + esc(i.building) + '">' + esc(i.building) + '</b><span dir="auto">' + esc(i.place) + '</span></div>';
    const ck = '<div class="nb-ck' + (ink ? '' : ' nb-plate') + '"><span class="nb-t nb-num" data-nb-time>' + esc(c.t) + '</span><span class="nb-d" data-nb-date>' + esc(c.d) + '</span></div>';
    const wx = w ? '<div class="nb-wx' + (ink ? '' : ' nb-sgn') + '">' + ic(weatherIcon(w.icon), ink ? 48 : 64) + '<span class="nb-tmp nb-num">' + w.t + '°</span><span class="nb-tx" dir="auto">' + esc(w.text) + '</span></div>' : '';
    const el = $('.nb-hd');
    el.dataset.wx = w ? '1' : '0';
    el.innerHTML = ink ? nm + wx + ck : nm + ck + wx;
  }

  function liveHtml(): string {
    const i = inp();
    const l = i.live;
    const t = '<span class="nb-num" data-nb-updated>' + esc(l.time) + '</span>';
    if (i.net === 'live') return l.mode === 'issues' ? '' : ic('rss', 22) + '<span>' + (l.mode === 'time' ? t : esc(l.before) + t + esc(l.after)) + '</span>';
    if (i.net === 'stale') return ic('unlink', 24) + '<span>' + esc(str(i.lang, 'staleFrom', { t: l.time })) + '</span>';
    return ic('unlink', 24) + '<span>' + esc(str(i.lang, 'offline')) + '</span>';
  }

  function footer(): void {
    if (hitech()) { getHx().footer(); return; }
    const i = inp();
    const ink = i.skin === 'ink';
    const news = i.news.map((n) => '<span class="nb-it">' + txn(n.title) + '<em dir="auto">' + esc(n.source) + '</em></span>').join('');
    const info = i.info.map((x) => {
      const k = infoIcon(x.kind);
      return ink
        ? '<li data-state="' + esc(x.state) + '">' + ic(k, 44) + '<b dir="auto">' + esc(x.label) + '</b><span dir="auto">' + esc(x.text) + '</span></li>'
        : '<li data-state="' + esc(x.state) + '"><i class="nb-pk">' + infoPk(k) + '</i><div class="nb-tx2"><b dir="auto">' + esc(x.label) + '</b><span dir="auto">' + (x.state === 'warn' ? ic('tri', 22) : '') + esc(x.text) + '</span></div></li>';
    }).join('');
    const ft = $('.nb-ft');
    ft.dataset.news = i.news.length ? '1' : '0';
    ft.innerHTML = '<div class="nb-tk"><div class="nb-lb">' + ic('rss', 26) + esc(str(i.lang, 'news')) + '</div><div class="nb-win"><div class="nb-track">' + news + '</div></div></div>' +
      '<div class="nb-row"><ul class="nb-info">' + info + '</ul><div class="nb-live" data-net="' + i.net + '"><span class="nb-st8">' + liveHtml() + '</span>' + i.company + logo(i.dark) + '</div></div>';
  }

  /** One headline at a time, a new one every 8 s: Ink = a two-step partial refresh, Sign = the blank beat of a message sign. */
  function setupTicker(): void {
    if (hitech()) { getHx().setupTicker(); return; }
    clearInterval(S.newsT);
    const its = [...root.querySelectorAll<HTMLElement>('.nb-tk .nb-track .nb-it')];
    if (!its.length) return;
    let k = 0;
    its[0].classList.add('nb-on');
    if (opts.fixed || its.length < 2) return;
    S.newsT = window.setInterval(() => {
      if (paused() || S.take || S.ann) return;
      const old = its[k];
      k = (k + 1) % its.length;
      const nw = its[k];
      if (rm()) {
        old.classList.remove('nb-on');
        nw.classList.add('nb-on');
        return;
      }
      if (skin() === 'ink') {
        old.classList.remove('nb-on');
        nw.classList.add('nb-on');
        nw.animate([{ opacity: 0 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 240, easing: 'steps(2, jump-none)' });
      } else {
        old.classList.remove('nb-on');
        window.setTimeout(() => nw.classList.add('nb-on'), 160);
      }
    }, 8000);
  }

  // ------------------------------------------------------------------ the messages
  function msgHtml(it: Item): string {
    const i = inp();
    const n = it.n;
    const lang = i.lang;
    const ink = i.skin === 'ink';
    const when = i.whenOf(n);
    const whenIc = isEventWhen(when, str(lang, 'permanent')) ? 'cal' : 'clock';
    const src = it.slide ? i.imgOf(it.slide) : '';
    if (ink) {
      if (it.slide && src) return '<div class="nb-tx"><h1 class="nb-ttl" dir="auto">' + txn(n.title) + '</h1><p class="nb-bd" dir="auto">' + txn(n.body) + '</p></div><figure class="nb-pic"><img src="' + esc(src) + '" alt=""></figure>';
      const mk = n.severity === 'critical' ? '<div class="nb-mk">' + ic('oct', 40) + esc(str(lang, 'urgent')) + '</div>' : n.severity === 'alert' ? '<div class="nb-mk">' + ic('tri', 38) + esc(str(lang, 'alert')) + '</div>' : '';
      const wn = it.slide ? '' : '<span class="nb-when">' + ic(whenIc, 34) + '<span dir="auto">' + txn(when) + '</span></span>';
      return mk + '<h1 class="nb-ttl" dir="auto">' + txn(n.title) + '</h1><p class="nb-bd" dir="auto">' + txn(n.body) + '</p>' + wn;
    }
    if (it.slide && src) return '<div class="nb-panel nb-sgn"><div class="nb-txt"><h1 class="nb-ttl" dir="auto">' + txn(n.title) + '</h1><p class="nb-bd" dir="auto">' + txn(n.body) + '</p></div><figure class="nb-pic"><img src="' + esc(src) + '" alt=""></figure></div>';
    const word = it.slide ? str(lang, 'slideWord') : n.severity === 'critical' ? W().urgent : n.severity === 'alert' ? W().alert : W().info;
    const sup = it.slide ? '' : '<div class="nb-sup nb-plate">' + ic(whenIc, 38) + '<span dir="auto">' + txn(when) + '</span></div>';
    return '<div class="nb-panel nb-sgn"><div class="nb-pic-col">' + picto(it.slide ? 'slide' : n.severity === 'critical' ? 'critical' : n.severity === 'alert' ? 'alert' : 'info', 150) + '<b>' + esc(word) +
      '</b></div><div class="nb-txt"><h1 class="nb-ttl" dir="auto">' + txn(n.title) + '</h1><p class="nb-bd" dir="auto">' + txn(n.body) + '</p></div></div>' + sup;
  }

  function idleHtml(face: number): string {
    const i = inp();
    const c = i.clock();
    const w = i.weather;
    if (i.skin === 'ink') {
      return '<span class="nb-big">' + esc(c.wd) + '</span><span class="nb-sub">' + esc(c.dm) + '</span><span class="nb-line">' + esc(str(i.lang, 'empty')) + ' · ' + esc(str(i.lang, 'niceDay')) + '</span>' + (i.idleCompany ? i.company : '');
    }
    if (face === 1 && w) {
      const parts = w.text.split(' · ');
      return '<div class="nb-panel nb-sgn"><div class="nb-pic-col">' + ic(weatherIcon(w.icon), 150) + '</div><div class="nb-txt"><h1 class="nb-ttl"><span class="nb-num">' + w.t + '°</span> ' + esc(parts[0]) + '</h1><p class="nb-bd">' + esc(parts[1] ?? '') +
        '</p></div></div><div class="nb-sup nb-plate">' + ic('clock', 38) + '<span>' + esc(c.d) + '</span></div>';
    }
    return '<div class="nb-panel nb-sgn"><div class="nb-pic-col">' + picto('info', 150) + '</div><div class="nb-txt"><h1 class="nb-ttl">' + esc(str(i.lang, 'empty')) + '</h1><p class="nb-bd">' + esc(str(i.lang, 'niceDay')) +
      '</p></div></div><div class="nb-sup nb-plate">' + ic('cal', 38) + '<span>' + esc(c.wd + ' · ' + c.dm) + '</span></div>';
  }

  function buildMsg(it: Item | null, face = 0): HTMLElement {
    const el = h('article', 'nb-msg');
    if (!it) {
      el.classList.add('nb-idle');
      el.dataset.face = String(face);
      el.innerHTML = idleHtml(face);
      return el;
    }
    const hasPic = !!(it.slide && inp().imgOf(it.slide));
    el.dataset.sev = it.n.severity;
    el.dataset.kind = it.slide ? 'slide' : isEventWhen(inp().whenOf(it.n), str(inp().lang, 'permanent')) ? 'event' : 'perm';
    if (hasPic) el.classList.add('nb-slide');
    el.innerHTML = msgHtml(it);
    return el;
  }

  // ------------------------------------------------------------------ shrink to fit
  /** Does anything of the message run past its box (the text blocks or a child running into the bottom padding)? */
  function overflows(el: HTMLElement): boolean {
    const over = (c: HTMLElement): boolean => {
      if (c.scrollHeight > c.clientHeight + 1) return true;
      const cs = getComputedStyle(c);
      const pb = parseFloat(cs.paddingBottom) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      return ([...c.children] as HTMLElement[]).some((k) => k.offsetParent === c && getComputedStyle(k).position !== 'absolute' && (k.offsetTop + k.offsetHeight > c.clientHeight - pb + 1 || k.offsetTop < pt - 1));
    };
    const els = [el, ...el.querySelectorAll<HTMLElement>('.nb-panel, .nb-txt')];
    const ttl = el.querySelector<HTMLElement>('.nb-ttl');
    return els.some(over) || (!!ttl && ttl.scrollWidth > ttl.clientWidth + 1);
  }

  /** The largest scale (of the style's own type sizes) at which the element fits; at the floor the body is cut by whole lines (the last resort). */
  function fitEl(el: HTMLElement, min: number, measure?: HTMLElement | null): number {
    delete el.dataset.clamp;
    const bd = el.querySelector<HTMLElement>('.nb-bd');
    bd?.style.removeProperty('-webkit-line-clamp');
    const test = (s: number): boolean => {
      el.style.setProperty('--fs', String(s));
      return !overflows(measure ?? el);
    };
    const f = bestScale(test, min);
    if (f) {
      el.style.setProperty('--fs', String(f));
      return f;
    }
    el.style.setProperty('--fs', String(min));
    if (bd) {
      const lh = parseFloat(getComputedStyle(bd).lineHeight) || 40;
      let lines = Math.max(1, Math.round(bd.scrollHeight / lh));
      el.dataset.clamp = '1';
      for (; lines > 1; lines--) {
        bd.style.setProperty('-webkit-line-clamp', String(lines));
        if (!overflows(measure ?? el)) break;
      }
      bd.style.setProperty('-webkit-line-clamp', String(lines));
    }
    return min;
  }

  // ------------------------------------------------------------------ "Up next" and the progress squares
  function queue(): void {
    const q = $('.nb-q');
    const items = S.items;
    const one = items.length <= 1;
    root.dataset.q = one ? '0' : '1';
    if (one) {
      q.innerHTML = '';
      return;
    }
    const i = inp();
    const { rows, more } = queueRows(items, S.i, queueMax(S.portrait, S.ratio10));
    const li = rows.map(({ item }) => {
      const n = item.n;
      if (hitech()) return '<li dir="auto" data-sev="' + n.severity + '">' + txn(n.title) + '</li>';
      const label = item.slide ? esc(str(i.lang, 'slideWord')) : txn(i.whenOf(n));
      return i.skin === 'ink'
        ? '<li data-sev="' + n.severity + '"><i class="nb-sq"></i><b dir="auto">' + txn(n.title) + '</b><span dir="auto">' + label + '</span></li>'
        : '<li data-sev="' + n.severity + '" data-kind="' + (item.slide ? 'slide' : 'msg') + '"><b dir="auto">' + txn(n.title) + '</b><span dir="auto">' + label + '</span></li>';
    }).join('');
    q.innerHTML = hitech() ? '<h2>' + esc(str(i.lang, 'next')) + '<span class="nb-pos nb-num" dir="ltr">' + (S.i + 1) + ' / ' + items.length + '</span></h2><ol>' + li + '</ol>' : '<h2>' + esc(str(i.lang, 'next')) + '<small>' + esc(str(i.lang, 'ofN', { i: S.i + 1, n: items.length })).replace(/(\d+)/g, '<span class="nb-num">$1</span>') + '</small></h2><ol>' + li + '</ol>';
    // drop rows from the end until the list fits its column (never scroll, never clip), then say how many wait
    const ol = q.querySelector('ol') as HTMLElement;
    let hidden = more;
    const moreLi = (): void => {
      ol.querySelector('.nb-more')?.remove();
      if (hidden > 0) ol.insertAdjacentHTML('beforeend', '<li class="nb-more">' + esc(str(i.lang, 'more', { n: hidden })) + '</li>');
    };
    moreLi();
    while (ol.scrollHeight > ol.clientHeight + 1 && ol.querySelectorAll('li:not(.nb-more)').length > 1) {
      const all = ol.querySelectorAll('li:not(.nb-more)');
      all[all.length - 1].remove();
      hidden++;
      moreLi();
    }
  }

  function prog(): void {
    const st = stage();
    let p = st.querySelector('.nb-prog') as HTMLElement | null;
    if (skin() !== 'ink' || S.idle || S.items.length < 2 || S.items.length > 12) {
      p?.remove();
      return;
    }
    if (!p) {
      p = h('div', 'nb-prog');
      st.append(p);
    }
    p.innerHTML = S.items.map((_x, k) => '<i class="' + (k <= S.i ? 'nb-on' : '') + '"></i>').join('');
    st.dataset.sev = S.items[S.i].n.severity;
  }

  // ------------------------------------------------------------------ transitions (composite only)
  const track = (a: Animation): Animation => {
    S.anims.push(a);
    a.finished.then(() => { S.anims = S.anims.filter((x: Animation) => x !== a); }, () => {});
    return a;
  };

  function cancelAll(): void {
    for (const a of S.anims.slice()) {
      try { a.finish(); } catch { /* already done */ }
    }
    S.anims = [];
    root.querySelectorAll<HTMLElement>('.nb-wipe').forEach((w) => {
      const c = w.firstElementChild as HTMLElement | null;
      if (c && c.matches('.nb-take, .nb-ann')) {
        c.style.transform = '';
        w.replaceWith(c);
      } else w.remove();
    });
    root.querySelectorAll('.nb-fx:not(.nb-prepfx), .nb-sweep, .nb-ghost').forEach((e) => e.remove());
  }

  function dropPrep(): void {
    if (!S.prep) return;
    if (S.prep.el.classList.contains('nb-prep')) S.prep.el.remove();
    S.prep.fx?.remove();
    S.prep = null;
  }

  function fade(oldEl: HTMLElement | null, newEl: HTMLElement): Promise<void> {
    newEl.style.zIndex = '2';
    const a = track(newEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease', fill: 'backwards' }));
    if (oldEl) track(oldEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' }));
    return a.finished.then(() => { oldEl?.remove(); newEl.style.zIndex = ''; });
  }

  /** A wipe: the frame moves one way, its content the other way by the same amount, so the content stays put while its edge travels. */
  function wipe(el: HTMLElement, from: number, to: number, T: number): { w: HTMLElement; a: Animation } {
    const w = h('div', 'nb-wipe');
    w.style.cssText = 'position:absolute;inset:0;overflow:hidden;z-index:' + (el.matches('.nb-take, .nb-ann') ? 6 : 2);
    el.replaceWith(w);
    w.append(el);
    track(w.animate([{ transform: 'translateY(' + from + 'px)' }, { transform: 'translateY(' + to + 'px)' }], { duration: T, easing: E_IO, fill: 'both' }));
    return { w, a: track(el.animate([{ transform: 'translateY(' + -from + 'px)' }, { transform: 'translateY(' + -to + 'px)' }], { duration: T, easing: E_IO, fill: 'both' })) };
  }

  function unwrap(w: HTMLElement): void {
    const c = w.firstElementChild as HTMLElement;
    c.getAnimations().forEach((x) => x.cancel());
    c.style.transform = '';
    w.replaceWith(c);
  }

  /** The e-paper refresh: an ink bar sweeps down the panel; above it the new page, below it the old one; a faint ghost of the old title stays for a second. */
  function inkSwap(oldEl: HTMLElement | null, newEl: HTMLElement, host: HTMLElement, o: { red?: boolean; up?: boolean; dur?: number; noGhost?: boolean } = {}): Promise<void> {
    const Hh = host.clientHeight;
    const T = o.dur || 560;
    const bh = o.red ? 40 : 26;
    const bar = h('div', 'nb-sweep' + (o.red ? ' nb-red' : ''));
    host.append(bar);
    newEl.classList.remove('nb-prep');
    newEl.style.visibility = '';
    let ghost: HTMLElement | null = null;
    if (oldEl && !o.noGhost) {
      const tt = oldEl.querySelector<HTMLElement>('.nb-ttl');
      if (tt) {
        ghost = tt.cloneNode(true) as HTMLElement;
        ghost.className = 'nb-ttl nb-ghost';
        Object.assign(ghost.style, { left: tt.offsetLeft + 'px', top: tt.offsetTop + 'px', width: tt.offsetWidth + 'px', margin: '0', fontSize: getComputedStyle(tt).fontSize, fontWeight: '800', lineHeight: '1.04', letterSpacing: '-0.03em', color: 'currentColor' });
      }
    }
    let done: Promise<void>;
    if (oldEl) {
      newEl.style.zIndex = '1';
      const { w, a } = wipe(oldEl, 0, Hh, T);
      track(bar.animate([{ transform: 'translateY(' + -bh + 'px)' }, { transform: 'translateY(' + (Hh - bh) + 'px)' }], { duration: T, easing: E_IO, fill: 'forwards' }));
      done = a.finished.then(() => w.remove());
    } else if (o.up) {
      const { w, a } = wipe(newEl, 0, -Hh, T);
      track(bar.animate([{ transform: 'translateY(' + Hh + 'px)' }, { transform: 'translateY(' + -bh + 'px)' }], { duration: T, easing: E_IO, fill: 'forwards' }));
      done = a.finished.then(() => unwrap(w));
    } else {
      const { w, a } = wipe(newEl, -Hh, 0, T);
      track(bar.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(' + Hh + 'px)' }], { duration: T, easing: E_IO, fill: 'forwards' }));
      done = a.finished.then(() => unwrap(w));
    }
    return done.then(() => {
      bar.remove();
      newEl.style.zIndex = '';
      if (ghost) {
        const g = ghost;
        newEl.append(g);
        track(g.animate([{ opacity: GHOST_OPACITY }, { opacity: 0 }], { duration: GHOST_MS, easing: 'ease', fill: 'forwards' })).finished.then(() => g.remove(), () => g.remove());
      }
    });
  }

  /** Sign trivision: N vertical prisms turn, in the reading direction, each showing a strip of the old and the new face. */
  function buildSlats(host: HTMLElement, faces: (HTMLElement | null)[], o: { enterOnly?: boolean; exitOnly?: boolean }): HTMLElement {
    const Wd = host.clientWidth;
    const Hh = host.clientHeight;
    const N = slatCount(S.portrait);
    const w = Wd / N;
    const fx = h('div', 'nb-fx');
    fx.style.visibility = 'hidden';
    for (let k = 0; k < N; k++) {
      const x = rtl() ? Wd - (k + 1) * w : k * w; // k = 0 is the first slat in the reading direction
      const sl = h('div', 'nb-slat');
      sl.style.left = x + 'px';
      sl.style.width = w + 'px';
      sl.style.transformOrigin = '50% 50% ' + -w / 2.6 + 'px';
      faces.forEach((src, j) => {
        if (!src) return;
        const f = h('div', 'nb-face');
        f.style.left = '0';
        f.style.width = w + 'px';
        const c = src.cloneNode(true) as HTMLElement;
        c.classList.remove('nb-prep');
        c.style.left = -x + 'px';
        c.style.width = Wd + 'px';
        c.style.height = Hh + 'px';
        c.style.right = 'auto';
        c.style.visibility = 'visible';
        c.style.opacity = '';
        if (c.classList.contains('nb-take')) {
          c.style.display = 'grid';
          c.style.top = '0';
          c.style.bottom = 'auto';
        }
        f.append(c);
        if (j === 1) f.style.transform = 'rotateY(' + (o.enterOnly ? 0 : 180) + 'deg)';
        sl.append(f);
      });
      fx.append(sl);
    }
    host.append(fx);
    return fx;
  }

  function runSlats(fx: HTMLElement, o: { enterOnly?: boolean; exitOnly?: boolean; dur?: number; stagger?: number }): Promise<void> {
    const D0 = o.dur || 520;
    const ST = o.stagger ?? 42;
    fx.style.visibility = '';
    fx.classList.remove('nb-prepfx');
    let last: Animation | null = null;
    [...fx.children].forEach((sl, k) => {
      const kf = o.enterOnly ? [{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0deg)' }]
        : o.exitOnly ? [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-90deg)' }]
        : [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }];
      last = track((sl as HTMLElement).animate(kf, { duration: D0, delay: k * ST, easing: o.enterOnly || o.exitOnly ? E_OUT : E_IO, fill: 'both' }));
    });
    return (last as Animation | null)?.finished.then(() => { fx.remove(); }) ?? Promise.resolve();
  }

  function signSwap(oldEl: HTMLElement | null, newEl: HTMLElement, host: HTMLElement, fxIn: HTMLElement | null): Promise<void> {
    if (!oldEl) return fade(null, newEl);
    const fx = fxIn ?? buildSlats(host, [oldEl, newEl], {});
    newEl.classList.remove('nb-prep');
    newEl.style.visibility = 'hidden';
    oldEl.style.visibility = 'hidden';
    return runSlats(fx, {}).then(() => {
      oldEl.remove();
      newEl.style.visibility = '';
    });
  }

  function swap(oldEl: HTMLElement | null, newEl: HTMLElement, host: HTMLElement, fx: HTMLElement | null): Promise<void> {
    newEl.classList.remove('nb-prep');
    if (!oldEl) {
      newEl.style.visibility = '';
      fx?.remove();
      return Promise.resolve();
    }
    if (rm()) {
      fx?.remove();
      newEl.style.visibility = '';
      return fade(oldEl, newEl);
    }
    return skin() === 'ink' ? inkSwap(oldEl, newEl, host) : signSwap(oldEl, newEl, host, fx);
  }

  // ------------------------------------------------------------------ the rotation
  const current = (): HTMLElement | null => stage().querySelector(':scope > .nb-msg:not(.nb-ghost):not(.nb-prep)');

  function makeMsg(i: number): HTMLElement {
    if (hitech()) return getHx().makeMsg(S.idle ? null : S.items[i]);
    const el = S.idle ? buildMsg(null, S.idleFace) : buildMsg(S.items[i]);
    el.classList.add('nb-prep');
    el.style.visibility = 'hidden';
    stage().append(el);
    fitEl(el, FS_MIN);
    return el;
  }

  function prepare(i: number): void {
    if (S.take || S.ann || paused() || S.anims.length) return;
    if (hitech() && S.items[i] && getHx().takes(S.items[i])) return; // an urgent notice that takes the screen is a layer, not a prepared message
    dropPrep();
    const el = makeMsg(i);
    const cur = current();
    const fx = skin() === 'sign' && !rm() && cur ? buildSlats(stage(), [cur, el], {}) : null;
    fx?.classList.add('nb-prepfx');
    S.prep = { i, el, fx };
  }

  function showAt(i: number, animate = true): void {
    // a running transition is finished at once (never ignored, never stacked); the next turn starts on a clean stage
    if (S.anims.length || root.querySelector('.nb-fx:not(.nb-prepfx), .nb-sweep, .nb-wipe')) {
      cancelAll();
      window.setTimeout(() => showAt(i, animate), 0);
      return;
    }
    if (hitech()) { S.i = i; getHx().show(i, animate); return; }
    const st = stage();
    let el: HTMLElement;
    let fx: HTMLElement | null = null;
    if (S.prep && S.prep.i === i && !S.idle) {
      el = S.prep.el;
      fx = S.prep.fx;
      S.prep = null;
    } else {
      dropPrep();
      el = makeMsg(i);
    }
    S.i = i;
    const old = current();
    if (fx && (!old || !fx.isConnected)) {
      fx.remove();
      fx = null;
    }
    if (!S.idle) {
      queue();
      prog();
    } else {
      root.dataset.q = '0';
      st.querySelector('.nb-prog')?.remove();
    }
    S.busy = true;
    let p: Promise<void>;
    if (animate) p = swap(old, el, st, fx);
    else {
      old?.remove();
      fx?.remove();
      el.classList.remove('nb-prep');
      el.style.visibility = '';
      p = Promise.resolve();
    }
    p.then(() => { S.busy = false; schedule(); }, () => { S.busy = false; });
  }

  function schedule(): void {
    clearTimeout(S.timer);
    clearTimeout(S.prepT);
    clearTimeout(S.idleT);
    if (paused() || S.take || S.ann || opts.fixed) return;
    if (S.idle) {
      if (skin() === 'sign' && inp().weather) S.idleT = window.setTimeout(() => { S.idleFace = (S.idleFace + 1) % 2; showAt(0); }, 20_000);
      return;
    }
    if (S.items.length < 2) return;
    const sec = opts.rot > 0 ? opts.rot : tickSeconds(inp().rotateS);
    const ms = S.items[S.i].dwell * sec * 1000;
    const ni = (S.i + 1) % S.items.length;
    S.prepT = window.setTimeout(() => prepare(ni), Math.max(0, ms - 900));
    S.timer = window.setTimeout(() => step(1), ms);
  }

  function step(d: number): void {
    if (S.idle || S.items.length < 2 || S.take || S.ann) return;
    showAt((S.i + d + S.items.length) % S.items.length);
  }

  // ------------------------------------------------------------------ the urgent take-over (a critical notice in its first minute)
  function takeHtml(n: FeedNotice): string {
    const i = inp();
    const c = i.clock();
    const where = esc(i.building + (i.place ? ' · ' + i.place : ''));
    const when = txn(i.whenOf(n));
    const lang = i.lang;
    if (i.skin === 'ink') {
      return '<div class="nb-tb"><span class="nb-w">' + ic('oct', 64) + esc(str(lang, 'urgent')) + '</span><span class="nb-t nb-num" data-nb-time>' + esc(c.t) + '</span></div>' +
        '<div class="nb-tm"><h1 class="nb-ttl" dir="auto">' + txn(n.title) + '</h1><p class="nb-bd" dir="auto">' + txn(n.body) + '</p><span class="nb-when" dir="auto">' + when + '</span></div>' +
        '<div class="nb-tf"><span dir="auto">' + where + '</span>' + logo(true) + '</div>';
    }
    return '<div class="nb-tsg"><div class="nb-tb"><span class="nb-w">' + picto('critical', 96) + esc(str(lang, 'urgent')) + '</span><span class="nb-t nb-num" data-nb-time>' + esc(c.t) + '</span></div>' +
      '<div class="nb-tm"><h1 class="nb-ttl" dir="auto">' + txn(n.title) + '</h1><p class="nb-bd" dir="auto">' + txn(n.body) + '</p><span class="nb-when nb-plate">' + ic('clock', 40) + '<span dir="auto">' + when + '</span></span></div>' +
      '<div class="nb-tf"><span dir="auto">' + where + '</span>' + logo(true) + '</div></div>';
  }

  function pulse(): void {
    // the urgent symbol beats three times, then stays still (no endless flashing)
    if (rm()) return;
    const icn = root.querySelector('.nb-take .nb-tb svg');
    if (!icn) return;
    const kf = skin() === 'ink' ? [{ opacity: 1 }, { opacity: 0.15, offset: 0.5 }, { opacity: 1 }] : [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: 0.45 }, { transform: 'scale(1)' }];
    track(icn.animate(kf, { duration: 900, iterations: 3, easing: skin() === 'ink' ? 'steps(2, jump-none)' : E_IO }));
  }

  function setTake(n: FeedNotice | null): void {
    if (hitech()) { getHx().setTake(n); return; }
    const tk = $('.nb-take');
    const id = n ? n.id : '';
    if (id === S.take) return;
    const was = S.take;
    // whatever is moving finishes at once (an urgent notice arriving mid-transition leaves nothing behind)
    cancelAll();
    clearTimeout(S.timer);
    clearTimeout(S.prepT);
    dropPrep();
    S.busy = false;
    if (n) {
      tk.innerHTML = takeHtml(n);
      S.take = id;
      root.dataset.take = '1';
      fitTake(tk);
      if (was || !S.ready) return; // a different urgent notice replaces the shown one, or the first draw: no entrance
      if (rm()) {
        track(tk.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease', fill: 'backwards' }));
        return;
      }
      if (skin() === 'ink') {
        void inkSwap(null, tk, root, { red: true, dur: 640, noGhost: true }).then(pulse);
        return;
      }
      root.dataset.take = '0';
      void runSlats(buildSlats(root, [null, tk], { enterOnly: true }), { enterOnly: true, dur: 420, stagger: 0 }).then(() => { root.dataset.take = '1'; pulse(); });
      return;
    }
    S.take = '';
    const done = (): void => { root.dataset.take = '0'; tk.innerHTML = ''; schedule(); };
    if (!S.ready) { done(); return; }
    if (rm()) {
      void track(tk.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease' })).finished.then(done);
      return;
    }
    if (skin() === 'ink') {
      void inkSwap(null, tk, root, { up: true, dur: 420, noGhost: true }).then(done);
      return;
    }
    root.dataset.take = '0';
    void runSlats(buildSlats(root, [tk], { exitOnly: true }), { exitOnly: true, dur: 300, stagger: 0 }).then(done);
  }

  function fitTake(el: HTMLElement): void {
    const tm = el.querySelector<HTMLElement>('.nb-tm');
    if (!tm) return;
    const f = bestScale((s) => { el.style.setProperty('--fs', String(s)); return tm.scrollHeight <= tm.clientHeight + 1; }, FS_MIN_TAKE);
    if (f) {
      el.style.setProperty('--fs', String(f));
      return;
    }
    el.style.setProperty('--fs', String(FS_MIN_TAKE));
    const bd = tm.querySelector<HTMLElement>('.nb-bd');
    if (!bd) return;
    const lh = parseFloat(getComputedStyle(bd).lineHeight) || 60;
    let lines = Math.max(1, Math.round(bd.scrollHeight / lh));
    bd.dataset.clamp = '1';
    for (; lines > 1; lines--) {
      bd.style.setProperty('-webkit-line-clamp', String(lines));
      if (tm.scrollHeight <= tm.clientHeight + 1) break;
    }
    bd.style.setProperty('-webkit-line-clamp', String(lines));
  }

  // ------------------------------------------------------------------ the voice announcement (text only: a notice TV has no close)
  function annHtml(a: ScreenAnnouncement, until: string): string {
    const i = inp();
    const ink = i.skin === 'ink';
    const crit = a.critical;
    const head = '<div class="nb-ah' + (ink ? '' : ' nb-sgn') + '">' + ic('speaker', 56) + '<span>' + esc(str(i.lang, crit ? 'annUrgent' : 'annNormal')) + '</span><span class="nb-lock">' + esc(str(i.lang, 'shownUntil', { t: until })) + '</span></div>';
    const blocks = a.texts.map((t) => '<div dir="' + dirOf(t.language) + '" lang="' + t.language + '"><p>' + esc(t.text) + '</p><small>' + esc(LANG_NAME[t.language] ?? t.language) + (t.machine ? ' · ' + esc(MACHINE_MARK[t.language] ?? MACHINE_MARK.en) : '') + '</small></div>').join('');
    return head + '<div class="nb-al">' + blocks + '</div>';
  }

  function setAnn(v: SkinInput['announcement']): void {
    const an = $('.nb-ann');
    const key = v ? v.a.id + '|' + (v.a.critical ? 1 : 0) : '';
    if (key === S.ann) return;
    cancelAll();
    clearTimeout(S.timer);
    if (!v) {
      S.ann = '';
      root.dataset.ann = '0';
      an.innerHTML = '';
      schedule();
      return;
    }
    const first = !S.ann;
    S.ann = key;
    an.dataset.crit = v.a.critical ? '1' : '0';
    an.innerHTML = annHtml(v.a, v.until);
    root.dataset.ann = '1';
    const fits = (s: number): boolean => { an.style.setProperty('--fs', String(s)); return ![...an.querySelectorAll<HTMLElement>('.nb-al > div')].some((d) => d.scrollHeight > d.clientHeight + 1); };
    const f = bestScale(fits, FS_MIN_TAKE);
    an.style.setProperty('--fs', String(f || FS_MIN_TAKE));
    if (!first || !S.ready) return;
    if (rm()) {
      track(an.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease', fill: 'backwards' }));
      return;
    }
    if (skin() === 'ink') {
      void inkSwap(null, an, root, { dur: 560, noGhost: true });
      return;
    }
    track(an.querySelector('.nb-ah')!.animate([{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: E_OUT, fill: 'backwards' }));
    an.querySelectorAll('.nb-al > div').forEach((d, k) => track(d.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 80 + k * 60, easing: E_OUT, fill: 'backwards' })));
  }

  // ------------------------------------------------------------------ ambient: burn-in drift, the ink cleaning sweep
  const DRIFT: readonly (readonly [number, number])[] = [[0, 0], [10, 5], [3, 11], [-8, 8], [-12, 0], [-7, -9], [2, -12], [10, -6]];
  let dk = 0;
  let driftT = 0;
  let cleanT = 0;
  function drift(): void {
    const sh = $('.nb-shift');
    if (!inp().drift) {
      sh.style.transform = '';
      return;
    }
    dk = (dk + 1) % DRIFT.length;
    sh.style.transform = 'translate(' + DRIFT[dk][0] + 'px,' + DRIFT[dk][1] + 'px)';
  }
  function clean(): void {
    // e-paper cleaning cycle (also burn-in care): one sweep over the unchanged screen every 10 minutes
    if (rm() || S.take || S.ann || S.busy || paused() || skin() !== 'ink') return;
    const bar = h('div', 'nb-sweep');
    $('.nb-pg').append(bar);
    void track(bar.animate([{ transform: 'translateY(-26px)' }, { transform: 'translateY(' + S.H + 'px)' }], { duration: 900, easing: E_IO })).finished.then(() => bar.remove(), () => bar.remove());
  }

  // ------------------------------------------------------------------ apply
  function signature(i: SkinInput): string {
    return JSON.stringify([
      i.skin, i.dark, i.lang, i.force, i.urgentScreen, i.systemsStatus, i.photo ?? '', i.photoNight ?? '', S.W, S.H, i.building, i.place, i.weather, i.info, i.news, i.rotateS, i.company, i.idleCompany,
      i.items.map((x) => [x.n.id, x.n.title, x.n.body, x.n.severity, x.dwell, i.whenOf(x.n), x.slide ? i.imgOf(x.slide) : '']),
    ]);
  }

  function rebuild(): void {
    const i = inp();
    const curId = S.items[S.i]?.n.id;
    cancelAll();
    dropPrep();
    clearTimeout(S.timer);
    clearTimeout(S.prepT);
    clearTimeout(S.idleT);
    S.busy = false;
    S.items = i.items;
    S.idle = S.items.length === 0;
    stage().innerHTML = '';
    header();
    footer();
    setupTicker();
    let idx = S.items.findIndex((x) => x.n.id === curId);
    if (idx < 0) idx = Math.min(S.i, Math.max(0, S.items.length - 1));
    if (S.held >= 0) idx = S.held;
    showAt(S.idle ? 0 : idx, false);
  }

  function setNet(): void {
    const i = inp();
    const live = root.querySelector<HTMLElement>('.nb-live');
    if (live) {
      live.dataset.net = i.net;
      const st = live.querySelector('.nb-st8');
      if (st) st.innerHTML = liveHtml();
    }
    root.dataset.net = i.net;
    const gone = $('.nb-gone');
    gone.querySelector('b')!.textContent = str(i.lang, 'gone');
    gone.querySelector('span')!.textContent = str(i.lang, 'goneHint');
  }

  const board: SkinBoard = {
    root,
    apply(input) {
      const first = !S.inp;
      S.inp = input;
      root.dataset.skin = input.skin;
      root.dataset.fam = familyOf(input.skin);
      if (hx && familyOf(input.skin) === 'station') { hx.dispose(); hx = null; }
      root.dataset.theme = input.dark ? 'dark' : 'light';
      root.dir = input.lang === 'en' ? 'ltr' : 'rtl';
      root.lang = input.lang;
      root.dataset.night = input.night ? '1' : '0';
      root.style.setProperty('--night-b', String(input.nightB));
      root.dataset.rm = rm() ? '1' : '0';
      fitCanvas();
      const prevHeld = S.held;
      S.held = input.held;
      const sig = signature(input);
      if (sig !== S.sig) {
        S.sig = sig;
        rebuild();
      } else if (S.held !== prevHeld) schedule();
      setNet();
      setTake(input.takeover);
      setAnn(input.announcement);
      root.dataset.ready = '1';
      if (first) S.ready = true;
      if (hitech()) getHx().applied(first || !root.dataset.fxinit);
      root.dataset.fxinit = hitech() ? '1' : '';
      if (first) {
        if (!opts.fixed) {
          driftT = window.setInterval(drift, 45_000);
          cleanT = window.setInterval(clean, 600_000);
        }
      }
      if (!inp().drift) drift();
    },
    command(cmd) {
      if (!S.inp) return;
      if (cmd === 'next') step(1);
      else if (cmd === 'prev') step(-1);
      else if (cmd === 'pause') { S.userPaused = true; hx?.pause(); }
      else if (cmd === 'play') { S.userPaused = false; S.held = -1; schedule(); hx?.resume(); } else if (cmd === 'toggle') {
        S.userPaused = !paused();
        if (!S.userPaused) S.held = -1;
        schedule();
        if (S.userPaused) hx?.pause(); else hx?.resume();
      }
      root.dataset.paused = paused() ? '1' : '0';
    },
    isPaused() {
      return paused();
    },
    tick(t) {
      if (!S.inp) return;
      const c = t.clock();
      const time = c.t;
      root.querySelectorAll('[data-nb-time]').forEach((e) => { if (e.textContent !== time) e.textContent = time; });
      hx?.tick(c);
      root.querySelectorAll('[data-nb-date]').forEach((e) => { if (e.textContent !== c.d) e.textContent = c.d; });
      if (t.net !== S.inp.net || t.live.time !== S.inp.live.time) {
        S.inp = { ...S.inp, net: t.net, live: t.live };
        setNet();
      }
    },
    setAnnouncement(a) {
      if (!S.inp) return;
      S.inp = { ...S.inp, announcement: a };
      setAnn(a);
    },
    fit() {
      if (S.inp) fitCanvas();
    },
    refit() {
      if (!S.inp) return;
      S.sig = '';
      board.apply(S.inp);
    },
    show() { root.hidden = false; },
    hide() {
      cancelAll();
      clearTimeout(S.timer);
      clearTimeout(S.prepT);
      clearTimeout(S.idleT);
      clearInterval(S.newsT);
      hx?.dispose();
      hx = null;
      root.dataset.fxinit = '';
      clearInterval(driftT);
      clearInterval(cleanT);
      root.hidden = true;
      S.sig = '';
      S.inp = null;
      S.ready = false;
      S.take = '';
      S.ann = '';
      root.dataset.take = '0';
      root.dataset.ann = '0';
    },
  };
  return board;
}
