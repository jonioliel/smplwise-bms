/**
 * CR-NOTICE106 - the TV board page (`/b/<slug>#t=<token>`; Settings previews it in an iframe with `?embed=1&preview=<board id>`).
 *
 * The rendering is the approved mock-up's (docs/design/mockups/notice-106/tv.html, v4 round 4): the same markup, the same classes,
 * the same stylesheet (tv.css is generated from it), the same canvas fit, shrink-to-fit, rotation, remote keys and drift - driven by
 * the board's feed instead of fake data. Differences that the product needs: the data come from the feed (polled every 30 s with
 * If-None-Match), the token from the URL fragment, the clock from the installation's zone, the company logo through the token, the
 * CSP (no inline style attributes: the grid sizes are set through the CSSOM), and the stale / offline / gone states are real.
 *
 * NOTICESAVER-295: the board's screen saver (`display.saver`: off / wash / cycle / wave / ambient, drawn as the mock-up's `#saver` layer),
 * the logo layout (`display.logos`: a / b / c) and the mock-up's drift values. Test hooks `?saver=` and `?logos=` override both.
 *
 * TVOPT-295: the one-row header (`display.header`: a / b; c = as before), the "updated" line (`display.updated`), what the freed
 * height goes to (`display.space`) and the company logo on the dark screen (`display.night_logo`). Test hook `?header=`.
 *
 * Test hooks (never used by a real TV): `?clock=fixed` (09:12 on 23.10.2026 in the board's zone, ticker frozen, no rotation / drift
 * timers), `?now=<ISO>` (a fixed instant).
 */
import './tv.css';
import { overlayHtml, overlayKey, pollMs, visibleNow } from '../announce/screen-overlay'; // ANNOUNCEB-295: the announcement overlay's pure rules
import { swLogoSvg } from '../design/sw-logo-art'; // the approved SmplWise logo (developer kit artwork), inline SVG: the TV page is served at /b/<slug> and reaches no other file
import { LOGO_SCALE, chooseCompanyLogo } from '../design/brand-choice';
import {
  AMBIENT_SPOTS, CYCLE_WASH_MS, DRIFT, DRIFT_MS, HEADERS, NEWS_SPEED, POLL_MS, SAVERS, SEV_LOOK, SIZES, bandNotice, clockIn, dimBrightness, esc, gridPlanExtra, headerOf, heldIndex, logoLayoutOf, netOf, nightDim,
  nightLogoMode, nightLogoOf, onPoll, othersMax, playlist, remoteKey, withSlides, saverOf, sevLabel, slugFrom, spaceExtra, spaceGrow, spaceOf, str, takeoverNotice, themeOf, tickerItemHtml, timeText, tokenFrom, tx, updatedOf, weatherDaysOf, whenText,
  type Clock, type Display, type Feed, type FeedNotice, type FeedSlide, type HeaderLayout, type Item, type LogoLayout, type NetState, type Saver, type UpdatedLine,
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
const ann = cv.querySelector('.ann') as HTMLElement;

let feed: Feed | null = null;
let draftDisplay: Partial<Display> | null = null;
let net: NetState = { lastOk: 0, misses: 0, gone: false };
let etag = '';
let companyUrl: Record<'light' | 'dark', string> = { light: '', dark: '' };
let companySrc: Record<'light' | 'dark', string> = { light: '', dark: '' }; // blob URLs of the loaded logo files (CR-LOGOS295)
const hasCompany = (): boolean => !!(companySrc.light || companySrc.dark);
let companyAlpha = false; // TVOPT-295: the light file has a transparent background (an invert then reads as a logo, not a dark box)
// NOTICESLIDES-295: the slide pictures and the building photo are read with the board token like the logo, so they live as blob URLs
const slideSrc = new Map<string, string>(); // feed image URL -> blob URL
let photoUrl = '';
let photoSrc = '';
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
  if (!draftDisplay) return d;
  // TVOPT-295: a null in the draft = "follow the installation default", which the feed (the preview route) already resolved
  const draft = Object.fromEntries(Object.entries(draftDisplay).filter(([, v]) => v !== null && v !== undefined)) as Partial<Display>;
  return { ...d, ...draft, blocks: { ...d.blocks, ...(draft.blocks ?? {}) } } as Display;
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

/** The two logos of a header / footer (CR-LOGOS295 section 3 P7). `dark` = this surface is dark (the night theme, the urgent take-over):
 * the administrator's dark-background choice decides which company file is drawn and on what (design/brand-choice.ts). The SmplWise logo
 * is the approved mockup artwork (design/sw-logo-art.ts): the light file's wordmark on a light surface, the dark file's on a dark one. */
function logos(dark: boolean): { co: string; sw: string } {
  const b = feed?.board.brand;
  const name = esc(b?.name || feed?.board.building || '');
  // TVOPT-295: the board's choice for the dark screen (night_logo) over the system logo setting
  const mode = nightLogoMode(nightLogoOf(display()), b?.dark_mode ?? 'invert', !!companySrc.dark, companyAlpha);
  const pick = hasCompany() ? chooseCompanyLogo({ light: companySrc.light || null, dark: companySrc.dark || null }, mode, dark) : null;
  const co = pick
    ? '<div class="lg company" data-tr="' + pick.treatment + '"><img alt="' + name + '" src="' + esc(pick.file) + '"></div>'
    : '<div class="lg company"><svg viewBox="0 0 280 64" aria-hidden="true"></svg></div>';
  return { co, sw: '<div class="lg product">' + swLogoSvg('horizontal', dark ? 'white' : 'brand', 'SmplWise') + '</div>' };
}

// ---------------------------------------------------------------- pieces (the mock-up's, driven by the feed)

const ICON_OF: Record<string, string> = { sun: 'sun', cloudsun: 'cloudsun', cloud: 'cloud', moon: 'moon' };

function clockHtml(): string {
  return '<div class="clock"><div class="t num" data-time>' + timeStr() + '</div><div class="d" data-date>' + esc(dateStr()) + '</div><div class="h" data-heb>' + tx(hebDate()) + '</div></div>';
}

function wxHtml(): string {
  const w = feed?.weather;
  if (!w) return '<div class="wx"></div>';
  const now = '<div class="now">' + ic(ICON_OF[w.now.condition] || 'cloud') + '<b class="num">' + w.now.t + '°</b><span>' + esc(w.now.text) + '</span></div>';
  // TVOPT-295 weather_days: 0 = the forecast entries as before, 1 = today only (no row), 2..5 = one cell per day (as many as the source has)
  const n = weatherDaysOf(display());
  if (n === 1) return '<div class="wx" data-days="1">' + now + '</div>';
  if (n >= 2) {
    const days = (w.days ?? []).slice(0, n);
    return '<div class="wx" data-days="' + n + '">' + now + (days.length > 1 ? '<div class="hrs days">' + days.map((x, k) => '<div><span>' + esc(dayLabel(x.date, k === 0)) + '</span>' + ic(ICON_OF[x.condition] || 'cloud') +
      '<b class="num">' + x.t + '°</b>' + (typeof x.lo === 'number' ? '<i class="lo num">' + x.lo + '°</i>' : '') + '</div>').join('') + '</div>' : '') + '</div>';
  }
  return '<div class="wx">' + now + '<div class="hrs">' +
    w.hours.map((x) => '<div><span class="num">' + esc(x.at) + '</span>' + ic(ICON_OF[x.condition] || 'cloud') + '<b class="num">' + x.t + '°</b></div>').join('') + '</div></div>';
}

/** The label of a forecast day: "היום" for today, else the short weekday of the board's language (the date is a local calendar day). */
function dayLabel(date: string, today: boolean): string {
  if (today) return str(lang(), 'today').replace(/^./, (c) => c.toUpperCase());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  try {
    return new Intl.DateTimeFormat(lang() === 'en' ? 'en-GB' : 'he-IL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)));
  } catch {
    return date.slice(8) + '.' + date.slice(5, 7);
  }
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

function slideHtml(x: Item, on: boolean): string {
  const s = x.slide as FeedSlide;
  const src = s.image ? slideSrc.get(s.image) : '';
  return '<article class="it promo' + (on ? ' on' : '') + '"><div class="pic">' + (src ? '<img alt="" src="' + esc(src) + '">' : ic('photo')) + '</div><h1>' + tx(s.title) + '</h1><p>' + tx(s.text) + '</p></article>';
}

function itemHtml(x: Item, on: boolean): string {
  if (x.slide) return slideHtml(x, on);
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
  const max = othersMax(spaceExtra(headerNow(), spaceOf(display())));
  const rest = state.list.filter((_x, k) => k !== state.i);
  let h = rest.slice(0, max).map((x) => cellHtml(x, false)).join('');
  if (rest.length > max) h += '<div class="more">' + esc(str(lang(), 'more', { n: rest.length - max })) + '</div>';
  return h;
}

function tickerHtml(): string {
  const items = feed?.news ?? [];
  return '<div class="tk"><span class="lbl">' + ic('rss') + esc(str(lang(), 'news')) + '</span><div class="win"><div class="track">' +
    items.map((n) => tickerItemHtml(n, n.logo ? slideSrc.get(n.logo) || '' : '')).join('') + '</div></div></div>';
}

function updatedText(): string {
  const at = net.lastOk ? clockIn(feed?.board.tz || 'Asia/Jerusalem', FIXED || NOW_Q ? nowDate() : new Date(net.lastOk)) : clock();
  return timeText(at);
}

/** The logo layout in force: the board's setting, or the `?logos=` test hook. */
function layoutOf(): LogoLayout {
  const q = Q.get('logos');
  return q === 'a' || q === 'b' || q === 'c' ? q : logoLayoutOf(display());
}

/** The header in force: the board's setting, or the `?header=` test hook (TVOPT-295). */
function headerNow(): HeaderLayout {
  const q = Q.get('header');
  return (HEADERS as string[]).includes(q || '') ? (q as HeaderLayout) : headerOf(display());
}

/** TVOPT-295: the "updated" line - the full text, the time with the dot, or nothing while live (the stale / offline notes stay). */
function liveHtml(u: UpdatedLine): string {
  if (u === 'issues') return '';
  const t = '<span class="num" data-updated>' + updatedText() + '</span>';
  return '<span class="live"><i></i>' + (u === 'time' ? t : esc(str(lang(), 'updated')) + ' ' + t + ' · ' + esc(feed?.board.name || '')) + '</span>';
}

/** The network state notes and the "updated" line (the bottom row of the header as before, the header row of a / b). */
function statusHtml(u: UpdatedLine, sp: boolean): string {
  return '<span class="offline">' + ic('offline') + esc(str(lang(), 'offline')) + '</span>' + (sp ? '<span class="sp"></span>' : '') + '<span class="stale">' + ic('clock') +
    '<span data-stale>' + esc(str(lang(), 'staleFrom', { t: updatedText() })) + '</span></span>' + liveHtml(u);
}

function footerHtml(L: { co: string; sw: string }, withChips: boolean, lay: LogoLayout, tpl: number, u: UpdatedLine): string {
  // a: the v4 layout (template 2 carries the SmplWise mark in its header); b: both logos together at the end of the bottom row;
  // c: both logos are in the header, the bottom row says who runs the board
  const mark = lay === 'b' ? '<span class="lgs">' + L.co + L.sw + '</span>' : lay === 'c' ? '<span class="pwr">' + esc(str(lang(), 'poweredBy')) + '</span>' : tpl === 2 ? '' : L.sw;
  return '<footer class="ft">' + (withChips ? chipsHtml() : '') + statusHtml(u, true) + mark + '</footer>';
}

/** TVOPT-295: the one-row header. a = the company logo, a hairline and the greeting at the inline start, SmplWise and the status at
 * the end; b = the greeting centred, SmplWise over the status at the end. The logo layout setting (`logos`) applies to the header as
 * before (c) only. */
function oneRowHeader(L: { co: string; sw: string }, h: 'a' | 'b', u: UpdatedLine): string {
  const welcome = '<div class="hw"><small>' + esc(str(lang(), 'welcome')) + '</small><b>' + esc(feed?.board.building || '') + '</b></div>';
  const st = '<div class="hs">' + L.sw + '<span class="hst">' + statusHtml(u, false) + '</span></div>';
  return '<header class="hd one" data-h="' + h + '">' + L.co + (h === 'a' ? '<span class="hdv" aria-hidden="true"></span>' : '') + welcome + st + '</header>';
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
  cv.dataset.photo = tpl === 2 && photoSrc ? '1' : '0';
  (cv.querySelector('.photo .img') as HTMLElement | null)?.style.setProperty('background-image', photoSrc ? 'url("' + photoSrc + '")' : 'none');
  const anyCritical = notices.some((n) => n.severity === 'critical');
  const dim = nightDim(d, clock(), anyCritical);
  cv.dataset.night = dim ? '1' : '0';
  cv.style.setProperty('--night-b', String(dimBrightness(d.night?.dim ?? 0.5)));
  const flags: Record<string, boolean> = {
    news: !!d.blocks.news && (feed.news?.length ?? 0) > 0,
    promo: !!d.blocks.promo && (feed.slides?.length ?? 0) > 0,
    info: (feed.info?.length ?? 0) > 0,
    weather: !!d.blocks.weather && !!feed.weather,
    clock: d.blocks.clock !== false,
    hebdate: d.blocks.hebdate !== false,
    company: hasCompany() && d.blocks.company_logo !== false,
    welcome: d.blocks.welcome !== false,
  };
  for (const k of Object.keys(flags)) cv.dataset[k] = flags[k] ? '1' : '0';
  cv.style.setProperty('--fs', ((SIZES[d.font_size] ?? SIZES.s) * (d.font_scale || 1)).toFixed(3));
  cv.dataset.size = d.font_size;
  cv.style.setProperty('--lg', String(LOGO_SCALE[feed.board.brand?.size ?? 'm'] ?? 1)); // the administrator's logo size scale
  const own = feed.board.brand?.company_size; // LOGOSIDE-295: the company logo's own scale (absent = it follows the general one)
  if (own && LOGO_SCALE[own]) cv.style.setProperty('--lgco', String(LOGO_SCALE[own]));
  else cv.style.removeProperty('--lgco');

  const prevId = state.currentId;
  state.list = withSlides(playlist(notices, d), feed.slides, d);
  cv.dataset.empty = state.list.length ? '0' : '1';
  state.held = heldIndex(state.list, d);
  state.plan = gridPlanExtra(state.list.length, !portrait && tpl !== 2, portrait, spaceExtra(headerNow(), spaceOf(d)));
  const keep = state.list.findIndex((x) => x.n.id === prevId);
  state.i = state.held >= 0 ? state.held : keep >= 0 ? keep : Math.min(state.i, Math.max(0, state.list.length - 1));
  state.page = state.held >= 0 ? Math.floor(state.held / state.plan.per) : Math.min(state.page, state.plan.pages - 1);
  state.left = state.list.length ? state.list[state.i].dwell : 0;
  state.currentId = state.list[state.i]?.n.id ?? '';
  state.paused = state.userPaused || state.held >= 0;
  cv.dataset.paused = state.paused ? '1' : '0';

  const lay = layoutOf();
  const hdr = headerNow();
  const upd = updatedOf(display());
  const one = hdr !== 'c';
  cv.dataset.header = hdr;
  cv.dataset.updated = upd;
  cv.dataset.space = one ? spaceOf(d) : 'none';
  cv.dataset.logos = one ? 'one' : lay; // the logo layout applies to the header as before only
  let h: string;
  if (one) {
    h = oneRowHeader(L, hdr, upd) + bandHtml(band);
  } else {
    const head = lay === 'b' ? '' : L.co + '<span class="mid"></span>' + (tpl === 2 || lay === 'c' ? L.sw : '');
    h = '<header class="hd">' + head + '</header>' + bandHtml(band);
  }
  const welcome = one ? '' : welcomeHtml(); // the one-row header carries the greeting
  if (tpl === 1) {
    h += '<main class="bd"><div class="side">' + welcome + clockHtml() + wxHtml() + '</div><div class="vrule"></div>' + (portrait ? '<div class="rule"></div>' : '') + stageHtml() + '</main>';
  } else if (tpl === 2) {
    h += '<main class="bd"><div class="side">' + welcome + clockHtml() + wxHtml() + '</div><section class="card">' + stageHtml() + chipsHtml() + '</section></main>';
  } else {
    h += '<main class="bd"><div class="top"><div class="name">' + (one ? '' : esc(feed.board.building || '')) + '<small>' + esc(d.place || '') + '</small></div>' + clockHtml() + '</div><div class="rule"></div>' + stageHtml() + '<div class="rule"></div><div class="bot">' + chipsHtml() + wxHtml() + '</div></main>';
  }
  // the one-row header has no bottom row of its own: only template 1's building chips keep one (the status moved up)
  h += tickerHtml() + (one ? (tpl === 1 && flags.info ? '<footer class="ft">' + chipsHtml() + '</footer>' : '') : footerHtml(L, tpl === 1, lay, tpl, upd));
  pg.innerHTML = h;
  const grow = spaceGrow(hdr, spaceOf(d));
  const bd = pg.querySelector('.bd') as HTMLElement | null;
  if (bd && grow !== 1) bd.style.setProperty('--fs', ((SIZES[d.font_size] ?? SIZES.s) * (d.font_scale || 1) * grow).toFixed(3));
  applyGridVars();
  const D = logos(true);
  const u = urgentNow;
  take.innerHTML = u
    ? '<div class="top">' + D.co + '<span class="tclk num" data-time>' + timeStr() + '</span></div>' +
      '<div class="mid"><span class="tag">' + esc(str(lang(), 'urgent')) + '</span><h1>' + tx(u.title) + '</h1><p>' + tx(u.body) + '</p><div class="until">' + tx(when(u)) + '</div></div>' +
      '<div class="bot"><span>' + esc(feed.board.building || '') + ' · ' + esc(feed.board.name) + '</span>' + D.sw + '</div>'
    : '';
  renderAnn();
  applySaver();
  fitCanvas();
  layoutAfter();
}

// ---------------------------------------------------------------- ANNOUNCEB-295: a voice announcement addressed to this board

let annKey = '';

/** Draw (or clear) the announcement overlay from the feed; it hides itself when its time ends (`annSync`, every tick). */
function renderAnn(): void {
  const a = feed?.announcement ?? null;
  const key = overlayKey(a);
  if (key !== annKey) {
    annKey = key;
    ann.innerHTML = a ? overlayHtml(a, feed?.board.display.lang ?? 'he') : '';
  }
  annSync();
}

function annSync(): void {
  const a = feed?.announcement ?? null;
  const on = visibleNow(a, nowDate().getTime());
  const v = on ? (a?.critical ? 'crit' : '1') : '0';
  if (cv.dataset.ann !== v) cv.dataset.ann = v;
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
    // NOTICERSS-295: a source logo that decodes after this measure changes the track width: measure once more when it has loaded
    tr.querySelectorAll('img').forEach((im) => {
      if (!im.complete) im.addEventListener('load', () => tr.style.setProperty('--dur', Math.max(20, Math.round((ww + tr.scrollWidth) / speed)) + 's'), { once: true });
    });
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
  const plain = timeText(clock());
  cv.querySelectorAll('[data-time-plain]').forEach((e) => {
    if (e.textContent !== plain) e.textContent = plain;
  });
  const dd = dateStr();
  cv.querySelectorAll('[data-date]').forEach((e) => {
    if (e.textContent !== dd) e.textContent = dd;
  });
  annSync();
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

let ph = 0;
function drift(): void {
  if (!display().burn_in?.shift || activeSaver() === 'cycle') {
    // `cycle` moves the whole canvas by its own CSS orbit; a board without the drift stays put
    shift.style.transform = '';
    take.style.transform = '';
    return;
  }
  ph = (ph + 1) % DRIFT.length;
  shift.style.transform = 'translate(' + DRIFT[ph][0] + 'px,' + DRIFT[ph][1] + 'px)';
  take.style.transform = shift.style.transform;
}

// ---------------------------------------------------------------- the screen saver (mock-up v4 + saver: the `#saver` layer over the canvas)

/** The saver in force: the board's setting, or the `?saver=` test hook. */
function activeSaver(): Saver {
  const q = Q.get('saver');
  return q && (SAVERS as string[]).includes(q) ? (q as Saver) : saverOf(display());
}

let svMode: Saver = 'off';
let svRunTimer = 0;
let svMoveTimer = 0;
let svSpot = 0;

function svRun(el: HTMLElement): void {
  el.dataset.run = '0';
  void el.offsetWidth; // restart the CSS animation
  el.dataset.run = '1';
}

function svMove(): void {
  const c = document.querySelector('#saver .svc') as HTMLElement | null;
  if (!c) return;
  c.style.left = AMBIENT_SPOTS[svSpot][0] + '%';
  c.style.top = AMBIENT_SPOTS[svSpot][1] + '%';
  svSpot = (svSpot + 1) % AMBIENT_SPOTS.length;
}

/** Builds / removes the saver layer when the mode changes. The layer survives the re-renders of the same mode, so its animation never restarts. */
function applySaver(): void {
  const m = activeSaver();
  cv.dataset.saver = m;
  if (m === svMode && (m === 'off' || document.getElementById('saver'))) return;
  clearInterval(svRunTimer);
  clearInterval(svMoveTimer);
  document.getElementById('saver')?.remove();
  svMode = m;
  if (m === 'off') return;
  cv.insertAdjacentHTML('beforeend', '<div id="saver" data-m="' + m + '" aria-hidden="true"><div class="svc"><div class="svt num" data-time-plain>' + esc(timeText(clock())) + '</div><div class="svd" data-date>' + esc(dateStr()) + '</div></div></div>');
  const el = document.getElementById('saver') as HTMLElement;
  if (m === 'cycle' && !FIXED && !NOW_Q) {
    window.setTimeout(() => svRun(el), 1500);
    svRunTimer = window.setInterval(() => svRun(el), CYCLE_WASH_MS);
  }
  if (m === 'ambient') {
    svSpot = 0;
    svMove();
    if (!FIXED && !NOW_Q) svMoveTimer = window.setInterval(svMove, 30_000);
  }
}

// ---------------------------------------------------------------- the feed

async function loadCompanyLogo(variant: 'light' | 'dark', url: string | undefined): Promise<void> {
  if (!url) {
    if (companySrc[variant]) URL.revokeObjectURL(companySrc[variant]);
    companySrc[variant] = '';
    companyUrl[variant] = '';
    if (variant === 'light') companyAlpha = false;
    return;
  }
  if (url === companyUrl[variant] && companySrc[variant]) return;
  try {
    const r = await fetch(new URL(url, document.baseURI).toString(), { headers: PREVIEW ? {} : { 'X-Board-Token': TOKEN }, credentials: PREVIEW ? 'same-origin' : 'omit', cache: 'no-store' });
    if (!r.ok) return;
    const blob = await r.blob();
    if (companySrc[variant]) URL.revokeObjectURL(companySrc[variant]);
    companySrc[variant] = URL.createObjectURL(blob);
    companyUrl[variant] = url;
    if (variant === 'light') companyAlpha = await transparentEdge(companySrc.light);
  } catch {
    /* the logo is optional: the header keeps its place */
  }
}

/** TVOPT-295: does the logo have a transparent background? Its border pixels are read on a small canvas (the file is a same-origin
 * blob, so the canvas is readable); a quarter of the border at least partly transparent counts. Any failure reads as opaque (the plate). */
async function transparentEdge(src: string): Promise<boolean> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = 64;
    const h = Math.max(8, Math.min(64, Math.round((w * (img.naturalHeight || 32)) / (img.naturalWidth || 64))));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (!x) return false;
    x.drawImage(img, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data;
    let edge = 0;
    let clear = 0;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (yy !== 0 && yy !== h - 1 && xx !== 0 && xx !== w - 1) continue;
        edge++;
        if (px[(yy * w + xx) * 4 + 3] < 250) clear++;
      }
    }
    return edge > 0 && clear / edge >= 0.25;
  } catch {
    return false;
  }
}

/** NOTICESLIDES-295: fetch what the feed names (slide pictures, the building photo) once per URL; a URL the feed dropped is released. */
async function fetchBlob(url: string): Promise<string> {
  try {
    const r = await fetch(new URL(url, document.baseURI).toString(), { headers: PREVIEW ? {} : { 'X-Board-Token': TOKEN }, credentials: PREVIEW ? 'same-origin' : 'omit', cache: 'no-store' });
    return r.ok ? URL.createObjectURL(await r.blob()) : '';
  } catch {
    return ''; // a picture is optional: the placeholder stays
  }
}

async function loadMedia(doc: Feed): Promise<void> {
  // slide pictures and (NOTICERSS-295) the news sources' logos: both are read with the board token, once per URL
  const want = new Set([...(doc.slides ?? []).map((s) => s.image), ...(doc.news ?? []).map((n) => n.logo)].filter((u): u is string => !!u));
  for (const [url, blob] of slideSrc) {
    if (!want.has(url)) {
      URL.revokeObjectURL(blob);
      slideSrc.delete(url);
    }
  }
  await Promise.all([...want].filter((u) => !slideSrc.has(u)).map(async (u) => {
    const blob = await fetchBlob(u);
    if (blob) slideSrc.set(u, blob);
  }));
  const photo = doc.board.display?.photo || '';
  if (photo !== photoUrl || (photo && !photoSrc)) {
    if (photoSrc) URL.revokeObjectURL(photoSrc);
    photoSrc = photo ? await fetchBlob(photo) : '';
    photoUrl = photo;
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
    await Promise.all([loadCompanyLogo('light', doc.board.logos?.company), loadCompanyLogo('dark', doc.board.logos?.company_dark), loadMedia(doc)]);
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
      weather: { hours: 5 }, news: { feeds: [], speed: 'normal' }, night: { enabled: true, from: '23:00', to: '06:00', dim: 0.5 }, burn_in: { shift: true }, saver: 'off', logos: 'a',
      header: 'c', updated: 'full', space: 'bigger', night_logo: 'auto', weather_days: 0,
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
  // the board asks every 30 s, or every `announce_poll_s` seconds while it is an announcement screen (an announcement is not worth waiting half a minute for)
  const pollLoop = (): void => {
    window.setTimeout(() => void poll().finally(pollLoop), pollMs(feed?.board.announce_poll_s, POLL_MS));
  };
  pollLoop();
  setInterval(tickClock, 5000);
  setInterval(annSync, 1000);
  setInterval(drift, DRIFT_MS);
}
