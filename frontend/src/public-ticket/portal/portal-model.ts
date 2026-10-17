/**
 * VPORTAL: the vendor portal's pure logic (no DOM) - the answers' shapes, the phone input check, the refusal -> message mapping, the
 * money lines. tests/unit-public-portal.spec.ts covers it.
 */
import type { PortalKey } from './portal-text';

export interface PortalQuote { state: string; total_minor: number; currency: string }
export interface PortalDemand { status: string; total_minor: number | null; currency: string; paid: boolean; no_charge: boolean }
export interface PortalItem {
  id: string;
  number: number;
  title: string;
  place: string;
  department: string;
  state: 'open' | 'closed';
  status: string;
  end_reason: 'reassigned' | 'returned' | null;
  created_at: string;
  assigned_at: string;
  ended_at: string | null;
  eta_at: string | null;
  quote: PortalQuote | null;
  demand: PortalDemand | null;
  can_open: boolean;
}
export interface PortalView {
  organization: string;
  logo: string | null;
  lang: string;
  dir: 'rtl' | 'ltr';
  labels: { one: string; many: string; gender: string };
  time_zone: string;
  theme?: 'light' | 'dark' | 'auto';
  closed_months: number;
  expires_in_s: number;
  items: PortalItem[];
}
export interface PortalConfig { organization: string; logo: string | null; theme?: 'light' | 'dark' | 'auto'; code_ttl_s: number; session_ttl_s: number }

export interface Answer { status: number; data: unknown; offline: boolean }

/**
 * While the portal is on, the server also serves the page root as `/support` (no slash) and in any letter case (`/Support`), because
 * people type it. The portal then moves the address bar to the canonical root its own script came from (`/support/assets/...` ->
 * `/support/`), so every call follows the canonical prefix (base.ts reads the path). Null when nothing needs to change (or in a
 * development build, whose script is not under `/<prefix>/assets/`).
 */
export function canonicalRoot(pathname: string, moduleUrl: string): string | null {
  let assets: string;
  try {
    assets = new URL(moduleUrl).pathname;
  } catch {
    return null;
  }
  const m = /^\/(t|[a-z0-9][a-z0-9_-]{1,31})\/assets\//.exec(assets);
  if (!m) return null;
  const root = `/${m[1]}/`;
  if (pathname === root) return null;
  const p = pathname.toLowerCase();
  return p === root || p === root.slice(0, -1) ? root : null;
}

/** A quick shape check before the server judges the number (the server's rule is the only real one: vendor_portal.canonical_phone). */
export function plausiblePhone(raw: string): boolean {
  return /^[0-9٠-٩۰-۹]{8,15}$/.test(raw.replace(/[\s\-().+]/g, ''));
}

/** Six digits from what was typed or pasted (spaces / dashes between groups allowed), or null. */
export function cleanCode(raw: string): string | null {
  const s = raw.trim().replace(/[\s-]/g, '');
  return /^\d{6}$/.test(s) ? s : null;
}

/** The message of a refused call. The sign-in answers never say whether a number is known. */
export function refusal(a: Answer): { key: PortalKey; minutes?: number } {
  if (a.offline) return { key: 'offline' };
  const b = (a.data && typeof a.data === 'object' ? a.data : {}) as Record<string, unknown>;
  if (a.status === 429) {
    const s = typeof b.retry_after_s === 'number' ? b.retry_after_s : 60;
    return { key: 'rateLimited', minutes: Math.max(1, Math.ceil(s / 60)) };
  }
  if (a.status === 422 && b.code === 'code_invalid') return { key: 'badCode' };
  if (a.status === 422) return { key: 'badPhone' };
  return { key: 'error' };
}

export function isView(v: unknown): v is PortalView {
  return !!v && typeof v === 'object' && Array.isArray((v as PortalView).items) && typeof (v as PortalView).expires_in_s === 'number';
}

export function split(items: PortalItem[]): { open: PortalItem[]; closed: PortalItem[] } {
  return { open: items.filter((i) => i.state === 'open'), closed: items.filter((i) => i.state !== 'open') };
}

/** The quote's state word key. */
export function quoteKey(q: PortalQuote): PortalKey {
  return (`q_${q.state}` as PortalKey);
}

/** The payment request's line: its amount (or "not sent yet") and paid / not paid (the status word while it is not approved). */
export function demandKeys(d: PortalDemand): { amount: boolean; key: PortalKey } {
  if (d.no_charge) return { amount: false, key: 'noCharge' };
  if (d.paid) return { amount: d.total_minor !== null, key: 'paid' };
  if (d.status === 'approved') return { amount: d.total_minor !== null, key: 'unpaid' };
  return { amount: d.total_minor !== null, key: (`d_${d.status}` as PortalKey) };
}

const LOCALES: Record<string, string> = { he: 'he-IL', en: 'en-IL', ar: 'ar-IL', ru: 'ru-RU' };

/** An amount in minor units (integer) as money in the page's language. */
export function money(minor: number, currency: string, lang: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(LOCALES[lang] ?? 'he-IL', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}
