/**
 * VPORTALRFQ: the pure logic of the portal's two extra sections (no DOM) - the answers' shapes and the refusal -> message mapping.
 * tests/unit-public-portal.spec.ts covers it.
 */
import type { MoreKey } from './portal-more-text';

export interface RfqItem {
  id: string;
  ref: string;
  title: string | null;
  department: string;
  due_at: string;
  state: 'open' | 'declined';
  quote: { state: 'submitted' | 'withdrawn'; total_minor: number; currency: string } | null;
  code_first: boolean;
}
export interface TechRequest {
  id: string;
  action: 'add' | 'replace';
  name: string;
  phone: string | null;
  replaces: string | null;
  state: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  decided_at: string | null;
}
export interface Company { id: string; name: string; techs: { id: string; name: string }[]; requests: TechRequest[] }
export interface TechView { companies: Company[]; limits: { name: number; pending: number } }

export function isRfqs(v: unknown): v is { items: RfqItem[] } {
  return !!v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items);
}

export function isTechs(v: unknown): v is TechView {
  return !!v && typeof v === 'object' && Array.isArray((v as { companies?: unknown }).companies);
}

/** The message of a refused technician request (the server answers one fixed code; a 404 means the session or the section ended). */
export function techRefusal(status: number, data: unknown, offline: boolean): MoreKey | 'gone' {
  if (offline) return 'offline';
  if (status === 404) return 'gone';
  const b = (data && typeof data === 'object' ? data : {}) as { code?: unknown; fields?: { field?: unknown }[] };
  if (status === 429) return 'rate';
  if (status === 409 && b.code === 'tech_limit') return 'limit';
  if (status === 422) {
    const f = Array.isArray(b.fields) ? b.fields[0]?.field : null;
    return f === 'phone' ? 'badPhone' : f === 'replaces' ? 'badReplace' : 'badName';
  }
  return 'error';
}

/** A quick shape check of a name before the server judges it (the server's rule is the only real one: portal_more.clean_name). */
export function plausibleName(raw: string): boolean {
  const s = raw.trim();
  return s.length >= 2 && s.length <= 80 && (s.match(/\p{L}/gu) ?? []).length >= 2;
}
