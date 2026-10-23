/**
 * CR-NOTICE106 - the TV board page (`/b/<slug>#t=<token>`; Settings previews it in an iframe with `?embed=1&preview=<board id>`).
 *
 * The rendering is the approved mock-up's (docs/design/mockups/notice-106/tv.html, v4 round 4): the same markup, the same classes,
 * the same stylesheet (tv.css is generated from it), the same canvas fit, shrink-to-fit, rotation, remote keys and drift - driven by
 * the board's feed instead of fake data. Differences that the product needs: the data come from the feed (polled every 30 s with
 * If-None-Match), the token from the URL fragment, the clock from the installation's zone, the company logo through the token, the
 * CSP (no inline style attributes: the grid sizes are set through the CSSOM), and the stale / offline / gone states are real.
 *
 * Test hooks (never used by a real TV): `?clock=fixed` (09:12 on 23.10.2026 in the board's zone, ticker frozen, no rotation / drift
 * timers), `?now=<ISO>` (a fixed instant).
 */
import './tv.css';
import {
  NEWS_SPEED, POLL_MS, SEV_LOOK, SIZES, bandNotice, clockIn, dimBrightness, esc, gridPlan, heldIndex, netOf, nightDim, onPoll,
  playlist, remoteKey, sevLabel, slugFrom, str, takeoverNotice, themeOf, timeText, tokenFrom, tx, whenText,
  type Clock, type Display, type Feed, type FeedNotice, type Item, type NetState,
} from './tv-logic';

const Q = new URLSearchParams(location.search);
const root = document.documentElement;
const body = document.body;
const EMBED = Q.get('embed') === '1';
const PREVIEW = /^[A-Za-z0-9_-]{1,64}$/.test(Q.get('preview') || '') ? (Q.get('preview') as string) : '';
const FIXED = Q.get('clock') === 'fixed';
const NOW_Q = Q.get('now');
const SLUG = slugFrom(location.pathname, location.search);
const TOKEN = tokenFrom(location.hash);
const API = new URL('api/v1/', document.baseURI).toString();
if (FIXED) body.classList.add('frozen');
if (EMBED) body.classList.add('embed'); // inside the Settings preview iframe (no other difference: the preview IS the TV)

const cv = document.getElementById('cv') as HTMLElement;
const shift = cv.querySelector('.shift') as HTMLElement;
const pg = cv.querySelector('.pg') as HTMLElement;
const take = cv.querySelector('.take') as HTMLElement;

let feed: Feed | null = null;
let draftDisplay: Partial<Display> | null = null;
let net: NetState = { lastOk: 0, misses: 0, gone: false };
let etag = '';
let companyUrl = '';
let companySrc = '';
let lastControl = -1;
let forceTheme = '';

function nowDate(): Date {
  if (NOW_Q) {
    const t = Date.parse(NOW_Q);
    if (Number.isFinite(t)) return new Date(t);
  }
  if (FIXED) return fixedInstant();
  return new Date();
}

/** 09:12 on Friday 23.10.2026 in the board's zone (the mock-up's `clock=fixed`). */
function fixedInstant(): Date {
  const tz = feed?.board.tz || 'Asia/Jerusalem';
  const guess = Date.UTC(2026, 9, 23, 9, 12);
  const c = clockIn(tz, new Date(guess));
  const off = (c.h * 60 + c.m - (9 * 60 + 12)) * 60_000;
  return new Date(guess - off);
}

function display(): Display {
  const d = (feed?.board.display ?? {}) as Display;
  return draftDisplay ? ({ ...d, ...draftDisplay, blocks: { ...d.blocks, ...(draftDisplay.blocks ?? {}) } } as Display) : d;
}

function lang(): 'he' | 'en' {
  return display().lang === 'en' ? 'en' : 'he';
}

function clock(): Clock {
  return clockIn(feed?.board.tz || 'Asia/Jerusalem', nowDate());
}

function ic(n: string): string {
  return '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
}

function timeStr(): string {
  return timeText(clock()).replace(':', '<i>:</i>');
}

function dateStr(): string {
  const d = nowDate();
  const tz = feed?.board.tz || 'Asia/Jerusalem';
  const loc = lang() === 'en' ? 'en-GB' : 'he-IL';
  try {
    const w = new Intl.DateTimeFormat(loc, { weekday: 'long', timeZone: tz }).format(d);
    const m = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(d);
    return w + ', ' + m;
  } catch {
    return d.toLocaleDateString();
  }
}

function hebDate(): string {
  let h = '';
  try {
    h = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: feed?.board.tz || 'Asia/Jerusalem' }).format(nowDate());
  } catch {
    h = '';
  }
  const c = feed?.sun?.candles;
  return [h, c ? str(lang(), 'candles', { t: c }) : ''].filter(Boolean).join(' · ');
}

function logos(dark: boolean): { co: string; sw: string } {
  const name = esc(feed?.board.building || '');
  const co = companySrc
    ? '<div class="lg company"><img alt="' + name + '" src="' + esc(companySrc) + '"></div>'
    : '<div class="lg company"><svg viewBox="0 0 280 64" aria-hidden="true"></svg></div>';
  return { co, sw: '<div class="lg product"><svg viewBox="0 0 236 64" role="img" aria-label="SmplWise"><use href="' + (dark ? '#sw-word-dark' : '#sw-word') + '"/></svg></div>' };
}

// ---------------------------------------------------------------- pieces (the mock-up's, driven by the feed)

const ICON_OF: Record<string, string> = { sun: 'sun', cloudsun: 'cloudsun', cloud: 'cloud', moon: 'moon' };

function clockHtml(): string {
  return '<div class="clock"><div class="t num" data-time>' + timeStr() + '</div><div class="d" data-date>' + esc(dateStr()) + '</div><div class="h" data-heb>' + tx(hebDate()) + '</div></div>';
}

function wxHtml(): string {
  const w = feed?.weather;
  if (!w) return '<div class="wx"></div>';
  return '<div class="wx"><div class="now">' + ic(ICON_OF[w.now.condition] || 'cloud') + '<b class="num">' + w.now.t + '°</b><span>' + esc(w.now.text) + '</span></div><div class="hrs">' +
    w.hours.map((x) => '<div><span class="num">' + esc(x.at) + '</span>' + ic(ICON_OF[x.condition] || 'cloud') + '<b class="num">' + x.t + '°</b></div>').join('') + '</div></div>';
}

function chipsHtml(): string {
  return '<div class="chips">' + (feed?.info ?? []).map((x) => '<span class="ch" data-look="' + esc(x.state) + '"><i></i><b>' + esc(x.label) + '</b>' + esc(x.text) + '</span>').join('') + '</div>';
}

function welcomeHtml(): string {
  return '<div class="welcome"><small>' + esc(str(lang(), 'welcome')) + '</small><b>' + esc(feed?.board.building || '') + '</b></div>';
}

function when(n: FeedNotice): string {
  return whenText(n, feed?.board.tz || 'Asia/Jerusalem', nowDate(), lang());
}

function itemHtml(x: Item, on: boolean): string {
  const n = x.n;
  const look = SEV_LOOK[n.severity] || 'acc';
  const sev = sevLabel(lang(), n.severity);
  const meta = sev ? '<div class="meta"><span class="sev">' + esc(sev) + '</span>' + ic('calendar') + '<span>' + tx(when(n)) + '</span></div>' : '';
  const w = sev ? '' : '<div class="when">' + ic('calendar') + '<span>' + tx(when(n)) + '</span></div>';
  return '<article class="it ' + look + (on ? ' on' : '') + '" data-look="' + look + '">' + (look === 'alarm' ? '<div class="bar"></div>' : '') + meta + '<h1>' + tx(n.title) + '</h1><p>' + tx(n.body) + '</p>' + w + '</article>';
}

function cellHtml(x: Item, held: boolean): string {
  const n = x.n;
  const look = SEV_LOOK[n.severity] || 'acc';
  const sev = sevLabel(lang(), n.severity);
  return '<article class="cell ' + look + (held ? ' held' : '') + '">' + (sev ? '<div class="meta"><span class="sev">' + esc(sev) + '</span></div>' : '') + '<h2>' + tx(n.title) + '</h2><p>' + tx(n.body) + '</p><div class="when">' + ic('calendar') + '<span>' + tx(when(n)) + '</span></div></article>';
}

function dotsHtml(count: number, cur: number): string {
  return '<div class="dots" aria-hidden="true"><span class="pz">' + ic('pause') + esc(str(lang(), 'paused')) + '</span>' + (count > 1 ? Array.from({ length: count }, (_x, k) => '<span' + (k === cur ? ' class="on"' : '') + '></span>').join('') : '') + '</div>';
}

function tailHtml(): string {
  return '<div class="empty"><p>' + esc(str(lang(), 'empty')) + '</p><span>' + esc(feed?.board.building || '') + ' · ' + esc(str(lang(), 'niceDay')) + '</span></div><div class="gone"><p>' + esc(str(lang(), 'gone')) + '</p><span>' + esc(str(lang(), 'goneHint')) + '</span></div>';
}

interface State {
  i: number;
  list: Item[];
  left: number;
  page: number;
  plan: { per: number; cols: number; rows: number; pages: number };
  held: number;
  paused: boolean;
  userPaused: boolean;
  currentId: string;
}

const state: State = { i: 0, list: [], left: 0, page: 0, plan: { per: 1, cols: 1, rows: 1, pages: 1 }, held: -1, paused: false, userPaused: false, currentId: '' };

function stageHtml(): string {
  const d = display();
  const list = state.list;
  if (d.mode === 'all') {
    const plan = state.plan;
    const slice = list.slice(state.page * plan.per, state.page * plan.per + plan.per);
    return '<div class="stage all">' + slice.map((x, k) => cellHtml(x, state.page * plan.per + k === state.held)).join('') + dotsHtml(plan.pages, state.page) + tailHtml() + '</div>';
  }
  if (d.mode === 'focus') {
    return '<div class="stage focus"><div class="fst">' + list.map((x, k) => itemHtml(x, k === state.i)).join('') + dotsHtml(list.length, state.i) + '</div><div class="vrule"></div><div class="others">' + othersHtml() + '</div>' + tailHtml() + '</div>';
  }
  return '<div class="stage">' + list.map((x, k) => itemHtml(x, k === state.i)).join('') + dotsHtml(list.length, state.i) + tailHtml() + '</div>';
}

function othersHtml(): string {
  const max = 3;
  const rest = state.list.filter((_x, k) => k !== state.i);
  let h = rest.slice(0, max).map((x) => cellHtml(x, false)).join('');
  if (rest.length > max) h += '<div class="more">' + esc(str(lang(), 'more', { n: rest.length - max })) + '</div>';
  return h;
}

function tickerHtml(): string {
  const items = feed?.news ?? [];
  return '<div class="tk"><span class="lbl">' + ic('rss') + esc(str(lang(), 'news')) + '</span><div class="win"><div class="track">' +
    items.map((n) => '<span class="h" dir="rtl">' + tx(n.title) + '</span><em dir="auto">' + esc(n.source) + '</em><i class="sep" aria-hidden="true"></i>').join('') + '</div></div></div>';
}

function updatedText(): string {
  const at = net.lastOk ? clockIn(feed?.board.tz || 'Asia/Jerusalem', FIXED || NOW_Q ? nowDate() : new Date(net.lastOk)) : clock();
  return timeText(at);
}

function footerHtml(L: { sw: string }, withChips: boolean): string {
  return '<footer class="ft">' + (withChips ? chipsHtml() : '') + '<span class="offline">' + ic('offline') + esc(str(lang(), 'offline')) + '</span><span class="sp"></span><span class="stale">' + ic('clock') +
    '<span data-stale>' + esc(str(lang(), 'staleFrom', { t: updatedText() })) + '</span></span><span class="live"><i></i>' + esc(str(lang(), 'updated')) + ' <span class="num" data-updated>' + updatedText() + '</span> · ' + esc(feed?.board.name || '') + '</span>' + L.sw + '</footer>';
}

function bandHtml(u: FeedNotice | null): string {
  if (!u) return '<div class="band" role="alert"></div>';
  return '<div class="band" role="alert">' + ic('warning') + '<div class="bt"><b>' + tx(u.title) + '</b><span>' + tx(u.body.replace(/\n/g, ' ')) + '</span></div><span class="until">' + tx(when(u)) + '</span></div>';
}

// ---------------------------------------------------------------- render: one function for the TV and the Settings preview iframe

function portraitNow(): boolean {
  const o = display().layout;
  if (o === 'portrait') return true;
  if (o === 'landscape') return false;
  return innerHeight > innerWidth;
}

function currentTheme(): 'day' | 'night' {
  if (forceTheme === 'day' || forceTheme === 'night') return forceTheme;
  return themeOf(display(), clock(), feed?.sun);
}

function render(): void {
  if (!feed) return;
  const d = display();
  const notices = feed.notices;
  const theme = currentTheme();
  root.setAttribute('data-theme', theme);
  root.lang = lang();
  const portrait = portraitNow();
  const tpl = d.template;
  const L = logos(theme === 'night');
  const urgentNow = takeoverNotice(notices, d, nowDate().getTime());
  const band = bandNotice(notices, d);
  cv.classList.toggle('portrait', portrait);
  cv.dataset.tpl = String(tpl);
  cv.dataset.mode = d.mode;
  cv.dataset.urgent = urgentNow ? 'full' : band ? 'band' : d.urgent;
  cv.dataset.net = netOf(net, Date.now());
  cv.dataset.photo = '0';
  const anyCritical = notices.some((n) => n.severity === 'critical');
  const dim = nightDim(d, clock(), anyCritical);
  cv.dataset.night = dim ? '1' : '0';
  cv.style.setProperty('--night-b', String(dimBrightness(d.night?.dim ?? 0.5)));
  const flags: Record<string, boolean> = {
    news: !!d.blocks.news && (feed.news?.length ?? 0) > 0,
    promo: false,
    info: (feed.info?.length ?? 0) > 0,
    weather: !!d.blocks.weather && !!feed.weather,
    clock: d.blocks.clock !== false,
    hebdate: d.blocks.hebdate !== false,
    company: !!companySrc && d.blocks.company_logo !== false,
    welcome: d.blocks.welcome !== false,
  };
  for (const k of Object.keys(flags)) cv.dataset[k] = flags[k] ? '1' : '0';
  cv.style.setProperty('--fs', ((SIZES[d.font_size] ?? SIZES.s) * (d.font_scale || 1)).toFixed(3));
  cv.dataset.size = d.font_size;

  const prevId = state.currentId;
  state.list = playlist(notices, d);
  cv.dataset.empty = state.list.length ? '0' : '1';
  state.held = heldIndex(state.list, d);
  state.plan = gridPlan(state.list.length, !portrait && tpl !== 2, portrait);
  const keep = state.list.findIndex((x) => x.n.id === prevId);
  state.i = state.held >= 0 ? state.held : keep >= 0 ? keep : Math.min(state.i, Math.max(0, state.list.length - 1));
  state.page = state.held >= 0 ? Math.floor(state.held / state.plan.per) : Math.min(state.page, state.plan.pages - 1);
  state.left = state.list.length ? state.list[state.i].dwell : 0;
  state.currentId = state.list[state.i]?.n.id ?? '';
  state.paused = state.userPaused || state.held >= 0;
  cv.dataset.paused = state.paused ? '1' : '0';

  let h = '<header class="hd">' + L.co + '<span class="mid"></span>' + (tpl === 2 ? L.sw : '') + '</header>' + bandHtml(band);
  if (tpl === 1) {
    h += '<main class="bd"><div class="side">' + welcomeHtml() + clockHtml() + wxHtml() + '</div><div class="vrule"></div>' + (portrait ? '<div class="rule"></div>' : '') + stageHtml() + '</main>';
  } else if (tpl === 2) {
    h += '<main class="bd"><div class="side">' + welcomeHtml() + clockHtml() + wxHtml() + '</div><section class="card">' + stageHtml() + chipsHtml() + '</section></main>';
  } else {
    h += '<main class="bd"><div class="top"><div class="name">' + esc(feed.board.building || '') + '<small>' + esc(d.place || '') + '</small></div>' + clockHtml() + '</div><div class="rule"></div>' + stageHtml() + '<div class="rule"></div><div class="bot">' + chipsHtml() + wxHtml() + '</div></main>';
  }
  h += tickerHtml() + footerHtml(tpl === 2 ? { sw: '' } : L, tpl === 1); // template 2 carries the SmplWise mark in its header (CR 8.1 logos)
  pg.innerHTML = h;
  applyGridVars();
  const D = logos(true);
  const u = urgentNow;
  take.innerHTML = u
    ? '<div class="top">' + D.co + '<span class="tclk num" data-time>' + timeStr() + '</span></div>' +
      '<div class="mid"><span class="tag">' + esc(str(lang(), 'urgent')) + '</span><h1>' + tx(u.title) + '</h1><p>' + tx(u.body) + '</p><div class="until">' + tx(when(u)) + '</div></div>' +
      '<div class="bot"><span>' + esc(feed.board.building || '') + ' · ' + esc(feed.board.name) + '</span>' + D.sw + '</div>'
    : '';
  fitCanvas();
  layoutAfter();
}

/** The grid of "all together": the mock-up wrote --cols / --rows in a style attribute; the CSP allows only the CSSOM. */
function applyGridVars(): void {
  const st = cv.querySelector('.stage.all') as HTMLElement | null;
  if (st) {
    st.style.setProperty('--cols', String(state.plan.cols));
    st.style.setProperty('--rows', String(state.plan.rows));
  }
}

// ---------------------------------------------------------------- the canvas: a fixed design size zoomed to the viewport

const useZoom = !!(window.CSS && CSS.supports && CSS.supports('zoom', '2'));
function fitCanvas(): void {
  const portrait = cv.classList.contains('portrait');
  const W0 = portrait ? 1080 : 1920;
  const H0 = portrait ? 1920 : 1080;
  const vw = innerWidth || W0;
  const vh = innerHeight || H0;
  const s = Math.min(vw / W0, vh / H0);
  let W = W0;
  let H = H0;
  const sameOrient = (vh > vw) === portrait;
  if (sameOrient) {
    W = Math.max(W0, Math.round(vw / s));
    H = Math.max(H0, Math.round(vh / s));
  }
  body.classList.toggle('box', !sameOrient);
  cv.style.inlineSize = W + 'px';
  cv.style.blockSize = H + 'px';
  if (useZoom) {
    cv.classList.remove('tf');
    cv.style.setProperty('zoom', String(s));
    cv.style.transform = '';
  } else {
    cv.classList.add('tf');
    cv.style.transform = 'translate(' + Math.round((vw - W * s) / 2) + 'px,' + Math.round((vh - H * s) / 2) + 'px) scale(' + s + ')';
  }
}

// ---------------------------------------------------------------- after layout: shrink-to-fit, the ticker's speed

function fit(el: HTMLElement | null, min: number): void {
  if (!el) return;
  el.style.setProperty('--k', '1');
  let k = 1;
  let i = 0;
  while (el.scrollHeight > el.clientHeight + 2 && k > min && i < 24) {
    k -= 0.04;
    el.style.setProperty('--k', k.toFixed(2));
    i++;
  }
}

function layoutAfter(): void {
  const side = cv.querySelector('.side') as HTMLElement | null;
  if (side) {
    side.classList.remove('c1', 'c2', 'c3');
    for (const c of ['c1', 'c2', 'c3']) if (side.scrollHeight > side.clientHeight + 1) side.classList.add(c);
  }
  cv.querySelectorAll<HTMLElement>('.stage .it').forEach((c) => fit(c, 0.6));
  cv.querySelectorAll<HTMLElement>('.stage .cell').forEach((c) => fit(c, 0.6));
  if (cv.dataset.urgent === 'full') fit(take.querySelector('.mid') as HTMLElement | null, 0.6);
  const win = cv.querySelector('.tk .win') as HTMLElement | null;
  const tr = cv.querySelector('.tk .track') as HTMLElement | null;
  if (win && tr && cv.dataset.news === '1') {
    const ww = win.clientWidth;
    const tw = tr.scrollWidth;
    const speed = NEWS_SPEED[display().news?.speed ?? 'normal'] || 120;
    tr.style.setProperty('--winw', ww + 'px');
    tr.style.setProperty('--dur', Math.max(20, Math.round((ww + tw) / speed)) + 's');
  }
}

// ---------------------------------------------------------------- the rotation: the timer tick, manual next / previous, pause

function showItem(i: number): void {
  if (!state.list.length) return;
  state.i = (i + state.list.length) % state.list.length;
  state.left = state.list[state.i].dwell;
  state.currentId = state.list[state.i].n.id;
  cv.querySelectorAll('.stage .it').forEach((c, k) => c.classList.toggle('on', k === state.i));
  cv.querySelectorAll('.stage .dots > span:not(.pz)').forEach((d, k) => d.classList.toggle('on', k === state.i));
  const others = cv.querySelector('.stage .others') as HTMLElement | null;
  if (others) {
    others.innerHTML = othersHtml();
    others.querySelectorAll<HTMLElement>('.cell').forEach((c) => fit(c, 0.6));
  }
}

function showPage(p: number): void {
  state.page = (p + state.plan.pages) % state.plan.pages;
  state.left = 2;
  const st = cv.querySelector('.stage.all');
  if (!st) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = stageHtml();
  st.replaceWith(wrap.firstChild as Node);
  applyGridVars();
  cv.querySelectorAll<HTMLElement>('.stage .cell').forEach((c) => fit(c, 0.6));
}

function move(dir: number): void {
  if (!state.list.length || cv.dataset.net === 'gone') return;
  if (display().mode === 'all') {
    if (state.plan.pages > 1) showPage(state.page + dir);
    return;
  }
  if (state.list.length > 1) showItem(state.i + dir);
}

function step(): void {
  if (state.paused) return;
  if (--state.left > 0) return;
  move(1);
}

function setPaused(p: boolean): void {
  state.paused = p;
  state.userPaused = p;
  cv.dataset.paused = p ? '1' : '0';
}

function command(cmd: string): void {
  if (cmd === 'next') move(1);
  else if (cmd === 'prev') move(-1);
  else if (cmd === 'pause') setPaused(true);
  else if (cmd === 'play') {
    state.held = -1;
    if (draftDisplay) draftDisplay = { ...draftDisplay, hold: '' };
    setPaused(false);
  } else if (cmd === 'toggle') {
    if (state.paused) command('play');
    else setPaused(true);
  }
}

addEventListener('keydown', (e) => {
  const c = remoteKey(e.key);
  if (c) {
    e.preventDefault();
    command(c);
  }
});

addEventListener('message', (e: MessageEvent) => {
  if (e.origin !== location.origin) return;
  const d = e.data as { smplwise?: string; cmd?: string; display?: Partial<Display>; theme?: string } | null;
  if (!d || d.smplwise !== 'tv') return;
  if (d.cmd) command(d.cmd);
  if (d.display && PREVIEW) {
    draftDisplay = d.display;
    void poll(true);
  }
});

// ---------------------------------------------------------------- the clock, the day / night switch, the drift

let lastThemeSwitch = 0;
function tickClock(): void {
  const t = timeStr();
  cv.querySelectorAll('[data-time]').forEach((e) => {
    if (e.innerHTML !== t) e.innerHTML = t;
  });
  const dd = dateStr();
  cv.querySelectorAll('[data-date]').forEach((e) => {
    if (e.textContent !== dd) e.textContent = dd;
  });
  const st = cv.querySelector('[data-stale]');
  const before = cv.dataset.net;
  const now = netOf(net, Date.now());
  if (before !== now) {
    cv.dataset.net = now;
    if (st) st.textContent = str(lang(), 'staleFrom', { t: updatedText() });
  }
  if (!feed) return;
  // the product debounces the automatic switch to one per 10 minutes so dusk never flickers
  const th = currentTheme();
  const dim = nightDim(display(), clock(), feed.notices.some((n) => n.severity === 'critical')) ? '1' : '0';
  const urgent = takeoverNotice(feed.notices, display(), nowDate().getTime()) ? 'full' : null;
  const urgentChanged = (urgent === 'full') !== (cv.dataset.urgent === 'full');
  if ((th !== root.getAttribute('data-theme') && Date.now() - lastThemeSwitch > 600_000) || dim !== cv.dataset.night || urgentChanged) {
    lastThemeSwitch = Date.now();
    render();
  }
}

const DRIFT = [[0, 0], [6, 3], [0, 6], [-6, 3], [-6, -3], [0, -6], [6, -3]];
let ph = 0;
function drift(): void {
  if (!display().burn_in?.shift) {
    shift.style.transform = '';
    take.style.transform = '';
    return;
  }
  ph = (ph + 1) % DRIFT.length;
  shift.style.transform = 'translate(' + DRIFT[ph][0] + 'px,' + DRIFT[ph][1] + 'px)';
  take.style.transform = shift.style.transform;
}

// ---------------------------------------------------------------- the feed

async function loadCompanyLogo(url: string | undefined): Promise<void> {
  if (!url) {
    if (companySrc) URL.revokeObjectURL(companySrc);
    companySrc = '';
    companyUrl = '';
    return;
  }
  if (url === companyUrl && companySrc) return;
  try {
    const r = await fetch(new URL(url, document.baseURI).toString(), { headers: PREVIEW ? {} : { 'X-Board-Token': TOKEN }, credentials: PREVIEW ? 'same-origin' : 'omit', cache: 'no-store' });
    if (!r.ok) return;
    const blob = await r.blob();
    if (companySrc) URL.revokeObjectURL(companySrc);
    companySrc = URL.createObjectURL(blob);
    companyUrl = url;
  } catch {
    /* the logo is optional: the header keeps its place */
  }
}

let rotTimer = 0;
function restartRotation(): void {
  clearInterval(rotTimer);
  if (FIXED || NOW_Q) return;
  rotTimer = window.setInterval(step, Math.max(6, Math.min(60, display().rotate_s || 12)) * 1000);
}

async function poll(force = false): Promise<void> {
  if (net.gone && !PREVIEW) return;
  let status = 0;
  let doc: Feed | null = null;
  try {
    let r: Response;
    if (PREVIEW) {
      r = await fetch(API + 'notices/boards/' + encodeURIComponent(PREVIEW) + '/preview', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display: draftDisplay ?? null }),
      });
    } else {
      if (!SLUG || !TOKEN) {
        status = 404;
        throw new Error('no link');
      }
      const h: Record<string, string> = { 'X-Board-Token': TOKEN };
      if (etag && !force) h['If-None-Match'] = etag;
      r = await fetch(API + 'notices/display/' + encodeURIComponent(SLUG), { headers: h, credentials: 'omit', cache: 'no-store' });
    }
    status = r.status;
    if (r.status === 200) {
      doc = (await r.json()) as Feed;
      etag = r.headers.get('ETag') || '';
    }
  } catch {
    if (!status) status = 0;
  }
  const wasNet = netOf(net, Date.now());
  net = onPoll(net, status, Date.now());
  if (doc) {
    const changed = !feed || feed.board.version !== doc.board.version || force || PREVIEW;
    const rotate = !feed || feed.board.display.rotate_s !== doc.board.display.rotate_s;
    feed = doc;
    if (doc.control && doc.control.seq !== lastControl) {
      if (lastControl >= 0) command(doc.control.cmd);
      lastControl = doc.control.seq;
    } else if (!doc.control && lastControl < 0) {
      lastControl = 0;
    }
    await loadCompanyLogo(doc.board.logos?.company);
    if (changed) render();
    if (rotate) restartRotation();
  } else if (net.gone && !feed) {
    feed = emptyFeed();
    render();
  } else if (netOf(net, Date.now()) !== wasNet) {
    if (!feed) feed = emptyFeed();
    render();
  }
}

function emptyFeed(): Feed {
  return {
    board: { name: '', slug: SLUG, version: 0, building: '', tz: 'Asia/Jerusalem', logos: {}, display: {
      template: 1, lang: 'he', theme: 'auto', day_hours: '', layout: 'auto', urgent: 'stage', mode: 'rotation', rotate_s: 12, hold: '', font_size: 's', font_scale: 1, place: '',
      blocks: { clock: true, hebdate: true, welcome: true, weather: false, info: [], promo: false, news: false, company_logo: false },
      weather: { hours: 5 }, news: { feeds: [], speed: 'normal' }, night: { enabled: true, from: '23:00', to: '06:00', dim: 0.5 }, burn_in: { shift: true },
    } },
    now: new Date().toISOString(),
    notices: [],
  };
}

// test / preview hook: the theme override of the Settings preview (`?theme=day|night`)
forceTheme = Q.get('theme') === 'day' || Q.get('theme') === 'night' ? (Q.get('theme') as string) : '';

let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(render, 120);
});

void poll(true).then(() => {
  if (document.fonts && document.fonts.ready) void document.fonts.ready.then(() => layoutAfter());
  restartRotation();
});
if (!FIXED && !NOW_Q) {
  setInterval(() => void poll(), POLL_MS);
  setInterval(tickClock, 5000);
  setInterval(drift, 60_000);
}
