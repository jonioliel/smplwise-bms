import { test, type BrowserContext, type Frame, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// T091 — the Hebrew user guide's screenshots, captured from a REAL installation (the owner's add-on through its
// Ingress session) instead of the demo backend. Sibling of guide-screenshots.spec.ts: same screens.json, same file
// name rule, but no seeding, no dev identities, and a privacy pipeline in front of every picture.
//
// Opt-in only: skipped unless SW_GUIDE_LIVE=1. Never run directly - scripts/guide_live_capture.py prepares the
// environment below from the workstation's private settings at run time (nothing here, nor in any committed file,
// holds a host, a cookie or a token), keeps the Ingress session alive and scans the result afterwards.
//
//   SW_GUIDE_LIVE_BASE     the add-on's Ingress URL (ends with '/')
//   SW_GUIDE_LIVE_SESSION  the Ingress session cookie value (sent as cookie `ingress_session` on the base's host)
//   SW_GUIDE_LIVE_RAW      folder for the UNREDACTED pictures (private-evidence/guide-live/raw - gitignored)
//   SW_GUIDE_LIVE_OUT      folder for the redacted pictures (the runner copies them into docs/user-guide/he/img/)
//   SW_GUIDE_LIVE_TEXT     folder for the visible-text dump of every captured page (outside the repository)
//   SW_GUIDE_LIVE_PRIVATE  JSON list of literal strings that must never be visible (hosts, addresses)
//   SW_GUIDE_LIVE_ROLE     the Arx role the session's user holds (default system_admin): a screen is captured only
//                          for that role; the other role variants keep their demo pictures
//   SW_GUIDE_LIVE_ONLY     optional comma list of screen ids to capture (default: all)
//
// Read-only by construction: every request that is not GET/HEAD/OPTIONS is aborted and recorded, except the
// WebRTC offer a live tile makes to watch video. Setup steps only open things (a 3D toggle, a menu); nothing is
// saved, acknowledged or sent.
//
// Privacy: before the redacted screenshot, every text node, input value and attribute that is painted as text in
// the page (and in same-origin frames) is rewritten: IPv4 addresses, MAC addresses, serial-like tokens, e-mail
// addresses, runs of 7+ digits (ID / employee / phone numbers), the private literals, and any host name. Host names
// become `your-site.example`, the rest `•••`. People's names (WisKey residents, the platform's users other than the
// capturing account), read from the installation at run time, become pseudonyms (`דייר 1`, `משתמש 2`), and their
// avatar initials follow. Site, building, floor, area and room names become generic ones (`האתר`, `בניין א`,
// `קומה 0`, `אזור 1`). Camera pictures and camera names stay as they are (owner decisions for T091, 2026-09-29);
// the floor plans themselves are not published - screens that draw the plan keep their demo pictures.
// The page's visible text is then dumped and scanned again; a hit left after three attempts fails the test and
// no redacted picture is written for that screen.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENS_JSON = path.resolve(HERE, '..', '..', 'docs', 'user-guide', 'he', 'screens.json');
const BASE = process.env.SW_GUIDE_LIVE_BASE || '';
const SESSION = process.env.SW_GUIDE_LIVE_SESSION || '';
const RAW_DIR = process.env.SW_GUIDE_LIVE_RAW || '';
const OUT_DIR = process.env.SW_GUIDE_LIVE_OUT || '';
const TEXT_DIR = process.env.SW_GUIDE_LIVE_TEXT || '';
const PRIVATE: string[] = JSON.parse(process.env.SW_GUIDE_LIVE_PRIVATE || '[]');
const LIVE_ROLE = process.env.SW_GUIDE_LIVE_ROLE || 'system_admin';
const ONLY = (process.env.SW_GUIDE_LIVE_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

type Viewport = 'desktop' | 'phone';
type SetupStep = { type: 'click' | 'waitFor'; selector: string } | { type: 'waitMs'; ms: number };

interface ScreenSpec {
  id: string;
  route: string;
  viewports: Viewport[];
  roles: string[];
  setup: SetupStep[];
}

const VIEWPORT_SIZE: Record<Viewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

/** Same rule as guide-screenshots.spec.ts (README_HE.md): `<id>[-phone][--<role> when the entry lists >1 role].png`. */
function fileNameFor(screen: ScreenSpec, role: string, viewport: Viewport): string {
  const roleSuffix = screen.roles.length > 1 ? `--${role}` : '';
  const viewportSuffix = viewport === 'phone' ? '-phone' : '';
  return `${screen.id}${viewportSuffix}${roleSuffix}.png`;
}

/** The role a live screen is captured as: the session user's role when the entry lists it; a single-role entry
 * whose role the user does not hold is captured anyway only for the phone navigation bar (the bar looks the same
 * shape for every role). Anything else stays demo. */
function liveRoleFor(screen: ScreenSpec): string | null {
  if (screen.roles.includes(LIVE_ROLE)) return LIVE_ROLE;
  if (screen.id === 'phone-bottom-nav') return LIVE_ROLE;
  return null;
}

interface Ids {
  floor: string;
  camera: string;
  area: string;
}

// ---------------------------------------------------------------------------------------------------------------
// In-page helpers (serialised into the page, so plain JS inside template strings).

/** Rewrites private data in every text node / input value / title-less painted attribute, through shadow roots.
 * Returns the number of replacements. `priv` = literal strings; `pairs` = [from, to, mode] name replacements, applied
 * first (longest first) - mode `site` / `word`: the name as a whole word anywhere (`site` also inside a camera
 * name), `segment`: a whole segment of a text between separators (· › – / , : parentheses), so a room called like an
 * ordinary word never rewrites the product's own copy, `exact`: the whole text (avatar initials). `keep` = camera
 * names (owner-approved): a text that is exactly a camera name only gets the `site` replacements. */
const MASK_JS = String.raw`(priv, pairs, keep) => {
  const esc = (s) => s.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
  const word = (from) => new RegExp('(?<![\\p{L}\\p{N}])' + esc(from) + '(?![\\p{L}\\p{N}])', 'gu');
  const named = (pairs || []).filter((p) => p[2] === 'site' || p[2] === 'word').map(([from, to, mode]) => [word(from), to, mode]);
  const segs = new Map((pairs || []).filter((p) => p[2] === 'segment').map(([from, to]) => [from, to]));
  const exact = new Map((pairs || []).filter((p) => p[2] === 'exact').map(([from, to]) => [from, to]));
  const kept = new Set(keep || []);
  const SEP = /(\s*[·•|›‹\/,:()–—]\s*|\s+-\s+)/;
  const LONGNUM = /(?<!\d)\d{7,}(?!\d)/g;
  const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?::\d{1,5})?\b/g;
  const MAC = /\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b/g;
  const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
  const SERIAL = /\b(?=[A-Z0-9-]*\d{6})(?=[A-Z0-9-]*[A-Z]{2})[A-Z0-9][A-Z0-9-]{15,}\b/g;
  const HOST = /\b(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|dev|app|me|co|il|info|biz|cloud|site|online|xyz|duckdns\.org|nabu\.casa|local|lan|home|internal)(?::\d{1,5})?(?:\/[^\s]*)?\b/gi;
  const SAFE_HOST = /^(?:https?:\/\/)?your-site\.example/i;
  let n = 0;
  const fix = (s) => {
    if (!s) return s;
    let t = s;
    const isCamera = kept.has(s.trim());
    for (const [re, to, mode] of named) if (!isCamera || mode === 'site') t = t.replace(re, to);
    if (!isCamera && segs.size) {
      t = t.split(SEP).map((part) => {
        const k = part.trim();
        return k && segs.has(k) ? part.replace(k, segs.get(k)) : part;
      }).join('');
    }
    if (exact.has(t.trim())) t = t.replace(t.trim(), exact.get(t.trim()));
    for (const p of priv) if (p && t.includes(p)) { t = t.split(p).join(/[a-z]/i.test(p) && p.includes('.') ? 'your-site.example' : '•••'); }
    t = t.replace(EMAIL, '•••').replace(MAC, '•••').replace(IPV4, '•••').replace(SERIAL, '•••').replace(LONGNUM, '•••');
    t = t.replace(HOST, (m) => (SAFE_HOST.test(m) ? m : 'your-site.example'));
    if (t !== s) n++;
    return t;
  };
  const walk = (root) => {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const v = node.nodeValue;
      const f = fix(v);
      if (f !== v) node.nodeValue = f;
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) {
        const f = fix(el.value);
        if (f !== el.value) el.value = f;
      }
      for (const a of ['placeholder', 'value', 'label', 'data-label']) {
        const v = el.getAttribute && el.getAttribute(a);
        if (v) { const f = fix(v); if (f !== v) el.setAttribute(a, f); }
      }
    }
  };
  walk(document);
  return n;
}`;

/** Visible text of the page, through shadow roots, plus input values (what a screenshot can show). */
const TEXT_JS = String.raw`() => {
  const out = [];
  const visible = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const walk = (root) => {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const t = (node.nodeValue || '').trim();
      if (t && node.parentElement && visible(node.parentElement)) out.push(t);
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value && visible(el)) out.push('[value] ' + el.value);
      const ph = el.getAttribute && el.getAttribute('placeholder');
      if (ph && visible(el)) out.push('[placeholder] ' + ph);
    }
  };
  walk(document);
  return out.join('\n');
}`;

/** Loading indicators still on screen (spinners, skeletons, loading state panels), through shadow roots. */
const BUSY_JS = String.raw`() => {
  let busy = 0;
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const tag = el.tagName.toLowerCase();
      if ((tag === 'sw-state-panel' && el.getAttribute('state') === 'loading') || tag === 'sw-spinner' || el.getAttribute('aria-busy') === 'true' || el.hasAttribute('data-loading') || (tag === 'sw-skeleton')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) busy++;
      }
    }
  };
  walk(document);
  return busy;
}`;

/** Media not yet painted: visible <video> without a frame yet, visible <img> not decoded. */
const MEDIA_JS = String.raw`() => {
  let pending = 0;
  const walk = (root) => {
    for (const el of root.querySelectorAll('video, img, *')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const r = el.getBoundingClientRect && el.getBoundingClientRect();
      if (!r || !r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      // A live tile shows its poster while it connects: wait for a real frame (the settle deadline bounds tiles that
      // never play, e.g. beyond the session cap).
      if (el.tagName === 'VIDEO' && el.readyState < 2) pending++;
      if (el.tagName === 'IMG' && el.getAttribute('src') && !(el.complete && el.naturalWidth > 0)) pending++;
    }
  };
  walk(document);
  return pending;
}`;

/** People's names on this installation (WisKey residents, platform users other than the capturing account), their
 * avatar initials, employee numbers, and the names of sites, buildings, floors, areas and rooms - read at run time
 * and replaced by pseudonyms / generic names in memory only; they never reach a file. */
type NameMode = 'site' | 'word' | 'segment' | 'exact';
type NamePair = [string, string, NameMode];
let NAME_PAIRS: NamePair[] = [];
let CAMERA_NAMES: string[] = [];
const SEP = /(\s*[·•|›‹/,:()–—]\s*|\s+-\s+)/;

/** Independent scan of a text dump (Node side): the same families as MASK_JS plus the private literals and names. */
function scanText(text: string): string[] {
  const hits: string[] = [];
  const families: [string, RegExp][] = [
    ['ipv4', /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g],
    ['mac', /\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b/g],
    ['email', /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g],
    ['serial', /\b(?=[A-Z0-9-]*\d{6})(?=[A-Z0-9-]*[A-Z]{2})[A-Z0-9][A-Z0-9-]{15,}\b/g],
    ['longnum', /(?<!\d)\d{7,}(?!\d)/g],
  ];
  for (const [name, re] of families) for (const m of text.match(re) ?? []) hits.push(`${name}#${m.length}`);
  PRIVATE.forEach((p, i) => {
    if (p && text.includes(p)) hits.push(`private-literal-${i}`);
  });
  // The dump has one line per text node, as the masker saw them.
  const cams = new Set(CAMERA_NAMES);
  const lines = text.split('\n');
  NAME_PAIRS.forEach(([from, , mode], i) => {
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'u');
    for (const line of lines) {
      const l = line.trim();
      const camera = cams.has(l);
      const hit =
        mode === 'site' ? re.test(l)
        : mode === 'word' ? !camera && re.test(l)
        : mode === 'segment' ? !camera && l.split(SEP).some((p) => p.trim() === from)
        : l === from;
      if (hit) {
        hits.push(`name-${mode}-${i}`);
        break;
      }
    }
  });
  return hits;
}

/** sw-avatar's rule: the first letters of the first two words, else the first two characters. */
const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
};

/** Places: site / building names anywhere (whole words), floors, areas and rooms as whole text segments. Names equal
 * to a camera name stay (camera names are owner-approved). */
async function discoverPlaces(page: Page): Promise<{ pairs: NamePair[]; cameras: string[] }> {
  const get = async (p: string) => {
    const r = await page.request.get(new URL(p, BASE).toString());
    return r.ok() ? r.json() : null;
  };
  const cams = await get('api/v1/cameras');
  const cameras = ((cams?.cameras ?? []) as { alias?: string | null; name?: string }[]).map((c) => (c.alias || c.name || '').trim()).filter(Boolean);
  const camSet = new Set(cameras);
  const pairs: NamePair[] = [];
  const seen = new Set<string>();
  const add = (name: string | null | undefined, to: string, mode: NameMode) => {
    const n = (name ?? '').trim();
    if (!n || n === to || seen.has(n) || camSet.has(n)) return;
    seen.add(n);
    pairs.push([n, to, mode]);
  };
  const tree = await get('api/v1/sites?tree=true');
  const floorIds: string[] = [];
  const letters = 'אבגדהוזחטי';
  let b = 0;
  ((tree?.sites ?? []) as { name: string; buildings?: { name: string; floors?: { id: string; name: string; level: number }[] }[] }[]).forEach((s, si, all) => {
    add(s.name, all.length > 1 ? `אתר ${si + 1}` : 'האתר', 'site');
    for (const bl of s.buildings ?? []) {
      add(bl.name, `בניין ${letters[b++ % letters.length]}`, 'site');
      for (const f of bl.floors ?? []) {
        floorIds.push(f.id);
        add(f.name, `קומה ${f.level}`, 'segment');
      }
    }
  });
  let area = 0;
  const dt = await get('api/v1/devices/tree');
  for (const f of (dt?.floors ?? []) as { name: string; level: number | null; areas?: { name: string }[] }[]) {
    if (f.level !== null && f.level !== undefined) add(f.name, `קומה ${f.level}`, 'segment');
    for (const a of f.areas ?? []) add(a.name, `אזור ${++area}`, 'segment');
  }
  for (const id of floorIds) {
    const z = await get(`api/v1/floors/${id}/zones`);
    for (const zone of (z?.zones ?? []) as { name: string }[]) add(zone.name, `אזור ${++area}`, 'segment');
  }
  // WisKey door stations are named after the rooms they guard.
  const feed = await get('api/v1/intercom/overview');
  ((feed?.overview?.stations ?? []) as { name: string }[]).forEach((st, i) => add(st.name, `עמדה ${i + 1}`, 'segment'));
  return { pairs, cameras };
}

async function discoverNames(page: Page): Promise<NamePair[]> {
  const get = async (p: string) => {
    const r = await page.request.get(new URL(p, BASE).toString());
    return r.ok() ? r.json() : null;
  };
  const me = await get('api/v1/me');
  const self = new Set([me?.user?.username, me?.user?.display_name].filter(Boolean));
  const pairs: NamePair[] = [];
  const tokens = new Set<string>();
  // Service accounts named like the product itself stay: replacing them would rewrite the product's own name.
  const product = /^(smplwise|arx|wiskey|admin|system|vms)$/i;
  const initials: [string, string][] = [];
  const keptInitials = new Set<string>();
  const add = (name: string | null | undefined, pseudonym: string) => {
    const n = (name ?? '').trim();
    if (!n) return;
    if (self.has(n) || product.test(n)) {
      keptInitials.add(initialsOf(n));
      return;
    }
    pairs.push([n, pseudonym, 'word']);
    initials.push([initialsOf(n), initialsOf(pseudonym)]);
    for (const tok of n.split(/\s+/)) if (tok.length >= 2 && tok !== n) tokens.add(tok);
  };
  for (const n of self) keptInitials.add(initialsOf(n));
  const people = await get('api/v1/intercom/people?offset=0&limit=200');
  ((people?.people?.records ?? []) as { display_name?: string; employee_no?: string }[]).forEach((p, i) => {
    add(p.display_name, `דייר ${i + 1}`);
    if (p.employee_no && p.employee_no.length >= 3) pairs.push([p.employee_no, '•••', 'word']);
  });
  const users = await get('api/v1/identity/users');
  ((users?.users ?? []) as { name?: string; username?: string }[]).forEach((u, i) => {
    if (self.has(u.username ?? '') || self.has(u.name ?? '')) {
      if (u.name) keptInitials.add(initialsOf(u.name));
      return;
    }
    add(u.name, `משתמש ${i + 1}`);
    if (u.username && u.username !== u.name) add(u.username, `user${i + 1}`);
  });
  // Remaining single words of a name (a first name alone in an event row), after the full names.
  for (const tok of tokens) if (!pairs.some(([from]) => from === tok)) pairs.push([tok, '•••', 'word']);
  // Avatar initials of a pseudonymised person, unless someone shown under a real name has the same initials.
  for (const [from, to] of initials) if (!keptInitials.has(from) && !pairs.some(([f, , m]) => m === 'exact' && f === from)) pairs.push([from, to, 'exact']);
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

async function inAllFrames<T>(page: Page, js: string, ...args: unknown[]): Promise<T[]> {
  const results: T[] = [];
  const argList = args.map((a) => JSON.stringify(a)).join(', ');
  for (const frame of page.frames()) {
    try {
      results.push(await (frame as Frame).evaluate(`(${js})(${argList})`) as T);
    } catch {
      /* a cross-origin or detached frame: nothing readable, nothing to mask (the scan below still sees the top page) */
    }
  }
  return results;
}

async function settle(page: Page): Promise<void> {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const busy = (await inAllFrames<number>(page, BUSY_JS)).reduce((a, b) => a + b, 0);
    const media = (await inAllFrames<number>(page, MEDIA_JS)).reduce((a, b) => a + b, 0);
    if (!busy && !media) break;
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1500);
}

async function runSetup(page: Page, steps: SetupStep[]): Promise<void> {
  for (const step of steps) {
    if (step.type === 'click') await page.locator(step.selector).click();
    else if (step.type === 'waitFor') await page.locator(step.selector).waitFor({ state: 'visible', timeout: 45_000 });
    else if (step.type === 'waitMs') await page.waitForTimeout(step.ms);
  }
}

// ---------------------------------------------------------------------------------------------------------------

const blocked: { screen: string; method: string; path: string }[] = [];
let currentScreen = '';

async function guard(context: BrowserContext): Promise<void> {
  await context.route('**/*', async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.continue();
    const u = new URL(req.url());
    // Watching live video: the go2rtc WebRTC offer (an SDP exchange, no configuration change).
    if (method === 'POST' && /\/webrtc(\b|\?|$)/.test(u.pathname + u.search)) return route.continue();
    blocked.push({ screen: currentScreen, method, path: u.pathname.replace(/\/api\/hassio_ingress\/[^/]+/, '<ingress>') });
    return route.abort('blockedbyclient');
  });
}

function readScreens(): ScreenSpec[] {
  return JSON.parse(fs.readFileSync(SCREENS_JSON, 'utf8')) as ScreenSpec[];
}

async function discoverIds(page: Page): Promise<Ids> {
  const get = async (p: string) => {
    const r = await page.request.get(new URL(p, BASE).toString());
    if (!r.ok()) throw new Error(`GET ${p} -> ${r.status()}`);
    return r.json();
  };
  const tree = await get('api/v1/sites?tree=true');
  const floors = (tree.sites ?? []).flatMap((s: { buildings?: { floors?: { id: string; camera_count: number; has_plan: boolean; level: number }[] }[] }) => (s.buildings ?? []).flatMap((b) => b.floors ?? []));
  // The richest floor with a plan: most cameras, ground floor first on a tie.
  floors.sort((a: { camera_count: number; level: number }, b: { camera_count: number; level: number }) => b.camera_count - a.camera_count || Math.abs(a.level) - Math.abs(b.level));
  const floor = floors.find((f: { has_plan: boolean }) => f.has_plan)?.id ?? floors[0]?.id ?? '';
  const cams = await get('api/v1/cameras');
  const list = (cams.cameras ?? []) as { id: string; status: string; enabled: boolean }[];
  const camera = (list.find((c) => c.enabled && c.status === 'online') ?? list[0])?.id ?? '';
  let area = 'unassigned';
  try {
    const dt = await get('api/v1/devices/tree');
    const areas = ((dt.floors ?? []) as { areas?: { area_id: string; can_bulk?: boolean; counts?: { entities?: number } }[] }[]).flatMap((f) => f.areas ?? []);
    // An area the bulk menu opens on (devices-bulk), with the most devices.
    areas.sort((a, b) => Number(!!b.can_bulk) - Number(!!a.can_bulk) || (b.counts?.entities ?? 0) - (a.counts?.entities ?? 0));
    if (areas[0]) area = areas[0].area_id;
  } catch {
    /* keep the unassigned bucket */
  }
  return { floor, camera, area };
}

function fillRoute(route: string, ids: Ids): string {
  return route.replace('{floor}', ids.floor).replace('{camera}', ids.camera).replace('{area}', encodeURIComponent(ids.area));
}

test.describe.serial('user guide screenshots - live installation (T091)', () => {
  test.skip(process.env.SW_GUIDE_LIVE !== '1', 'opt-in: run through scripts/guide_live_capture.py');

  let ids: Ids;

  test.beforeAll(async () => {
    for (const d of [RAW_DIR, OUT_DIR, TEXT_DIR]) if (d) fs.mkdirSync(d, { recursive: true });
  });

  test.afterAll(async () => {
    if (TEXT_DIR) fs.writeFileSync(path.join(TEXT_DIR, 'blocked-requests.json'), JSON.stringify(blocked, null, 2));
  });

  const jobs: { screen: ScreenSpec; role: string; viewport: Viewport }[] = [];
  for (const screen of readScreens()) {
    if (ONLY.length && !ONLY.includes(screen.id)) continue;
    const role = liveRoleFor(screen);
    if (!role) continue;
    for (const viewport of screen.viewports) jobs.push({ screen, role, viewport });
  }

  for (const { screen, role, viewport } of jobs) {
    const file = fileNameFor(screen, role, viewport);
    test(`${screen.id} [${role}/${viewport}]`, async ({ browser }) => {
      test.setTimeout(180_000);
      currentScreen = file;
      const base = new URL(BASE);
      const context = await browser.newContext({ viewport: VIEWPORT_SIZE[viewport], locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: 'light', ignoreHTTPSErrors: true, ...(viewport === 'phone' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });
      await context.addCookies([{ name: 'ingress_session', value: SESSION, domain: base.hostname, path: '/api/hassio_ingress/', httpOnly: true, secure: base.protocol === 'https:', sameSite: 'Lax' }]);
      await guard(context);
      const page = await context.newPage();
      try {
        if (!ids) {
          ids = await discoverIds(page);
          const places = await discoverPlaces(page);
          NAME_PAIRS = [...(await discoverNames(page)), ...places.pairs].sort((a, b) => b[0].length - a[0].length);
          CAMERA_NAMES = places.cameras;
        }
        await page.goto(BASE + fillRoute(screen.route, ids), { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('sw-app', { timeout: 60_000 });
        await page.waitForTimeout(2500);
        await runSetup(page, screen.setup);
        await settle(page);

        if (RAW_DIR) await page.screenshot({ path: path.join(RAW_DIR, file) });

        let hits: string[] = [];
        let text = '';
        for (let attempt = 0; attempt < 3; attempt++) {
          await inAllFrames<number>(page, MASK_JS, PRIVATE, NAME_PAIRS, CAMERA_NAMES);
          await page.waitForTimeout(100);
          await page.screenshot({ path: path.join(OUT_DIR, `${file}.pending`), type: 'png' });
          text = (await inAllFrames<string>(page, TEXT_JS)).join('\n----- frame -----\n');
          hits = scanText(text);
          if (!hits.length) break;
        }
        if (TEXT_DIR) fs.writeFileSync(path.join(TEXT_DIR, `${file}.txt`), text, 'utf8');
        const pending = path.join(OUT_DIR, `${file}.pending`);
        if (hits.length) {
          fs.rmSync(pending, { force: true });
          throw new Error(`private data still visible on ${file}: ${hits.join(', ')}`);
        }
        fs.renameSync(pending, path.join(OUT_DIR, file));
      } finally {
        await context.close();
      }
    });
  }
});
