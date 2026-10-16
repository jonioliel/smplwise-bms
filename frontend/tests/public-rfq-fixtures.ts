import type { Page, Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TKRFQVP: the fake public listener of the RFQ vendor-page specs (evidence-public-rfq / layout-public-rfq). The page is BUILT into a temp
// folder (so the specs always test the current source) and served by route interception on an invented https origin with the public
// listener's own security headers; GET /t/api/rfq and the writes of contract section 15 are answered by a small stateful fake that
// follows the contract's rules (minimal card before the code, server-side amounts, base_version, can.* flags). Fake data only.

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIGIN = 'https://t-demo.arx.example.test';
export const TOKEN = 'QrStUvWxYz012345AbCdEfGhIjKlMnOp';
export const SESSION = 's'.repeat(43);
export const RID = 'c'.repeat(32);
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; form-action 'none'; "
  + "frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'";
const HEADERS = { 'content-security-policy': CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');

export type Json = Record<string, unknown>;

let BUNDLE = '';

export function buildBundle(): void {
  BUNDLE = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-public-rfq-'));
  const vite = path.resolve(HERE, '../node_modules/vite/bin/vite.js');
  execFileSync(process.execPath, [vite, 'build', '-c', 'vite.public.config.ts', '--outDir', BUNDLE], { cwd: path.resolve(HERE, '..'), env: { ...process.env, SW_PUBLIC_OUT: BUNDLE }, stdio: 'pipe' });
}

export function dropBundle(): void {
  if (BUNDLE) fs.rmSync(BUNDLE, { recursive: true, force: true });
}

const FORM = {
  currencies: ['ILS'], allowed_kinds: ['labor', 'parts'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: 15000,
  limits: { lines: 30, description: 120, note: 1000, vendor_ref: 40, message: 2000, decline_reason: 200, max_total_minor: 0 },
};

/** The full answer of GET /t/api/rfq (15.3) for an open request. */
export function rfqView(over: Json = {}): Json {
  const now = Date.now();
  return {
    kind: 'rfq', ref: 'RFQ-07', organization: 'מגדלי הדר', department: 'אחזקה', lang: 'he', dir: 'rtl', theme: 'light', time_zone: 'Asia/Jerusalem',
    code_required: false, code_ok: true, code_locked_s: 0, read_only: false, read_only_until: null, page_state: 'open',
    rfq: {
      title: 'החלפת מזגן בחדר הישיבות (קומה 2)', description: 'היחידה הפנימית הישנה דולפת; נדרשת החלפה ליחידה 2.5 כ״ס כולל פינוי הישנה והפעלה.',
      place_text: 'קומה 2 · חדר ישיבות גדול', due_at: iso(now + 2 * DAY + 3 * HOUR), work_from: iso(now + 3 * DAY), work_to: iso(now + 10 * DAY),
      allowed_line_kinds: ['labor', 'parts'], attachments: [],
    },
    quote: null, declined: null, messages: [], form: FORM, can: { quote: true, withdraw: false, decline: true, ask: true }, ...over,
  };
}

/** One live quote as the server presents it (15.3), its amounts computed by the server. */
export function quoteOf(over: Json = {}): Json {
  const now = Date.now();
  return {
    id: 'q-1', version: 1, state: 'submitted', currency: 'ILS', vat_mode: 'excluded', vat_rate_bp: 1800,
    lines: [{ index: 0, kind: 'labor', description: 'התקנה והפעלה', total_minor: 120000, hours: '8', rate_minor: 15000 },
      { index: 1, kind: 'parts', description: 'יחידה 2.5 כ״ס', total_minor: 640000, quantity: '1', unit_minor: 640000 }],
    subtotal_minor: 760000, vat_minor: 136800, total_minor: 896800, net_minor: 760000, work_from: iso(now + 4 * DAY), work_to: iso(now + 5 * DAY), in_window: true,
    valid_until: iso(now + 30 * DAY), note: 'כולל פינוי', vendor_ref: 'Q-2231', submitted_at: iso(now - 2 * HOUR), approved: null, ...over,
  };
}

const MINIMAL = ['kind', 'ref', 'organization', 'department', 'lang', 'dir', 'theme', 'time_zone', 'code_required', 'code_ok', 'code_locked_s', 'read_only', 'read_only_until'];

const minor = (s: unknown) => Math.round(parseFloat(String(s ?? '0')) * 100);

export interface Call { method: string; path: string; body: Json | null; headers: Record<string, string> }

/** The stateful fake. `failNext` answers the next call to a path with a refusal (once). */
export class RfqFake {
  view: Json;
  calls: Call[] = [];
  failNext: { path: string; status: number; body: Json } | null = null;
  redeemKind = 'rfq';

  constructor(view: Json = rfqView()) {
    this.view = view;
  }

  posts(p: string): Call[] {
    return this.calls.filter((c) => c.method === 'POST' && c.path === p);
  }

  private answer(headers: Record<string, string>): Json {
    const v = this.view;
    if (v.code_required && headers['x-ticket-session'] !== SESSION) {
      const out: Json = {};
      for (const k of MINIMAL) out[k] = v[k];
      out.code_ok = false;
      return out;
    }
    return { ...v, code_ok: true };
  }

  async handle(route: Route): Promise<void> {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const headers = req.headers();
    let body: Json | null = null;
    try {
      body = req.postDataJSON() as Json;
    } catch {
      body = null;
    }
    const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (p.startsWith('/t/assets/')) {
      const file = path.join(BUNDLE, 'assets', path.basename(p));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml';
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': type }, body: fs.readFileSync(file) });
    }
    if (p === '/t/' || p.startsWith('/t/r/')) {
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }, body: fs.readFileSync(path.join(BUNDLE, 'index.html')) });
    }
    this.calls.push({ method: req.method(), path: p, body, headers });
    if (p === '/t/api/redeem') return body?.rid === RID ? json(200, this.redeemKind === 'rfq' ? { token: TOKEN, kind: 'rfq' } : { token: TOKEN }) : json(404, { code: 'link_unavailable' });
    if (headers['x-ticket-token'] !== TOKEN || !p.startsWith('/t/api/rfq')) return json(404, { code: 'link_unavailable' });
    if (this.failNext && this.failNext.path === p && req.method() === 'POST') {
      const f = this.failNext;
      this.failNext = null;
      return json(f.status, f.body);
    }
    const v = this.view;
    if (p === '/t/api/rfq') return json(200, this.answer(headers));
    if (p === '/t/api/rfq/code/send') return json(200, { sent: true, channel: 'whatsapp', expires_in_s: 600 });
    if (p === '/t/api/rfq/code/verify') return body?.code === '123456' ? json(200, { session: SESSION, expires_in_s: 3600 }) : json(422, { code: 'code_invalid', attempts_left: 2 });
    if (v.code_required && headers['x-ticket-session'] !== SESSION) return json(403, { code: 'code_required' });
    const can = v.can as Json;
    const q = v.quote as Json | null;
    if (p === '/t/api/rfq/quote') {
      const live = q && q.state !== 'withdrawn' ? (q.version as number) : null;
      if ((body?.base_version ?? null) !== live) return json(409, { code: 'quote_changed', version: live });
      const lines = ((body?.lines ?? []) as Json[]).map((l, index) => {
        const total = l.kind === 'labor' ? Math.round(parseFloat(String(l.hours)) * minor(l.rate)) : l.kind === 'parts' ? Math.round(parseFloat(String(l.quantity)) * minor(l.unit_price)) : minor(l.amount);
        return { index, kind: l.kind, description: l.description ?? null, total_minor: total, ...(l.kind === 'labor' ? { hours: l.hours, rate_minor: minor(l.rate) } : l.kind === 'parts'
          ? { quantity: l.quantity, unit_minor: minor(l.unit_price) } : { amount_minor: minor(l.amount) }) };
      });
      const sub = lines.reduce((n, l) => n + l.total_minor, 0);
      const incl = body?.amounts_include_vat === true;
      const vat = incl ? Math.round((sub * 1800) / 11800) : Math.round((sub * 1800) / 10000);
      const quote = quoteOf({ id: `q-${(q?.version as number ?? 0) + 1}`, version: ((q?.version as number) ?? 0) + 1, lines, vat_mode: incl ? 'included' : 'excluded', subtotal_minor: sub, vat_minor: vat,
        total_minor: incl ? sub : sub + vat, net_minor: incl ? sub - vat : sub, work_from: body?.work_from ?? null, work_to: body?.work_to ?? null, valid_until: body?.valid_until ?? null,
        note: body?.note ?? null, vendor_ref: body?.vendor_ref ?? null, submitted_at: iso(Date.now()), in_window: true });
      this.view = { ...v, quote, page_state: 'open', declined: null, can: { ...can, withdraw: true, decline: false } };
      return json(201, { ok: true, quote });
    }
    if (p === '/t/api/rfq/withdraw') {
      if (!q || q.id !== body?.quote_id) return json(409, { code: 'quote_closed', reason: 'not_found' });
      this.view = { ...v, quote: { ...q, state: 'withdrawn' }, can: { ...can, withdraw: false, decline: true } };
      return json(200, { ok: true });
    }
    if (p === '/t/api/rfq/decline') {
      if (q && q.state === 'submitted') return json(409, { code: 'quote_exists' });
      this.view = { ...v, page_state: 'declined', declined: { at: iso(Date.now()), reason: body?.reason ?? null }, can: { ...can, decline: false } };
      return json(200, { ok: true });
    }
    if (p === '/t/api/rfq/message') {
      const message = { id: `m-${this.calls.length}`, mine: true, text: body?.text, at: iso(Date.now()) };
      this.view = { ...v, messages: [...((v.messages as Json[]) ?? []), message] };
      return json(201, { ok: true, message });
    }
    return json(404, { code: 'link_unavailable' });
  }
}

export async function serve(page: Page, fake: RfqFake): Promise<RfqFake> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(`${ORIGIN}/**`, (route) => fake.handle(route));
  return fake;
}

/** Opens the page with the RFQ fragment (or another address) and waits for its first screen. */
export async function open(page: Page, fake: RfqFake, opts: { url?: string; scheme?: 'light' | 'dark' } = {}): Promise<RfqFake> {
  await serve(page, fake);
  await page.emulateMedia({ colorScheme: opts.scheme ?? 'light', reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(opts.url ?? `${ORIGIN}/t/#q.${TOKEN}`);
  await page.waitForSelector('[data-rfq-screen], [data-state-title], [data-redeem]');
  return fake;
}
