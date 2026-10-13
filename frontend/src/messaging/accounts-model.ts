/**
 * CR-038 slice 5a: the pure model of Settings › ערוץ ההודעות (no DOM, unit-tested in tests/unit-messaging-accounts.spec.ts): the draft an
 * administrator edits (account labels, the "used outside" mark, pacing, manual accounts, the use mapping), the PUT body built from it,
 * the options of a use's picker, the warnings that belong to a row and their words. The server validates everything again
 * (routers/messaging_accounts.py); this only keeps the screen honest.
 */
import type { AccountState, Pacing, PacingKey, PutAccount, PutBody, WaAccount, WaUse, WaWarning, WhatsappView } from '../api/messaging-accounts';
import { wt, type WaTextKey } from '../i18n/messaging-accounts';

export const DEPT_SEP = '@dept:';
export const PACING_KEYS: readonly PacingKey[] = ['min_gap_s', 'jitter_s', 'per_hour', 'per_day', 'per_recipient_hour', 'hold_when_down_min'];
/** The server's MANUAL_VALUE_RE (services/messaging_accounts.py). */
export const MANUAL_VALUE_RE = /^[A-Za-z0-9_\-.:@+]{1,64}$/;
export const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
export const LABEL_MAX = 40;

export interface DraftAccount {
  key: string;
  kind: 'discovered' | 'manual';
  /** '' = keep the suggestion */
  label: string;
  shared_outside: boolean;
  pacing: Pacing;
  account?: string;
  status_entity_id?: string | null;
}
export interface Draft {
  accounts: DraftAccount[];
  uses: Record<string, string | null>;
}

export function draftFrom(view: WhatsappView): Draft {
  return {
    accounts: view.accounts.filter((a) => !a.removed).map((a) => ({
      key: a.key, kind: a.kind, label: a.label_set ? a.label : '', shared_outside: a.shared_outside, pacing: { ...a.pacing },
      ...(a.kind === 'manual' ? { account: a.account ?? '', status_entity_id: a.status_entity_id ?? null } : {}),
    })),
    uses: { ...view.mapping },
  };
}

const norm = (uses: Record<string, string | null>) => JSON.stringify(Object.entries(uses).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)));

export function isDirty(view: WhatsappView, draft: Draft): boolean {
  return JSON.stringify(draftFrom(view).accounts) !== JSON.stringify(draft.accounts) || norm(view.mapping) !== norm(draft.uses);
}

export function toPutBody(view: WhatsappView, draft: Draft, confirmQueued = false): PutBody {
  const accounts: PutAccount[] = draft.accounts.map((a) => {
    const out: PutAccount = { key: a.key, kind: a.kind, label: a.label.trim(), shared_outside: a.shared_outside, pacing: { ...a.pacing } };
    if (a.kind === 'manual') {
      out.account = (a.account ?? '').trim();
      out.status_entity_id = a.status_entity_id?.trim() || null;
    }
    return out;
  });
  const uses: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(draft.uses)) uses[k] = v || null;
  return { revision: view.revision, accounts, uses, ...(confirmQueued ? { confirm_queued: true } : {}) };
}

/** A fresh manual key (`manual:<8 of [a-z0-9]>`, the server's KEY_RE), never one already in the draft. */
export function newManualKey(draft: Draft, rnd: () => number = Math.random): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (;;) {
    let id = '';
    for (let i = 0; i < 8; i++) id += abc[Math.floor(rnd() * abc.length) % abc.length];
    const key = `manual:${id}`;
    if (!draft.accounts.some((a) => a.key === key)) return key;
  }
}

/** The problem of a typed manual value, or null (9.9.2: equal to a discovered entry id is refused). */
export function manualProblem(value: string, view: WhatsappView): 'manual_value_invalid' | 'manual_equals_discovered' | null {
  const v = value.trim();
  if (!MANUAL_VALUE_RE.test(v)) return 'manual_value_invalid';
  if (view.accounts.some((a) => a.kind === 'discovered' && a.key === `entry:${v}`)) return 'manual_equals_discovered';
  return null;
}

export function pacingProblem(view: WhatsappView, p: Pacing): { field: PacingKey; code: 'pacing_out_of_range' | 'pacing_day_below_hour' } | null {
  for (const k of PACING_KEYS) {
    const [lo, hi] = view.pacing_ranges[k];
    if (!Number.isInteger(p[k]) || p[k] < lo || p[k] > hi) return { field: k, code: 'pacing_out_of_range' };
  }
  return p.per_day < p.per_hour ? { field: 'per_day', code: 'pacing_day_below_hour' } : null;
}

/** Keys the draft maps (directly) to an account: such an account cannot be removed until its uses move. */
export function usesOf(draft: Draft, key: string): string[] {
  return Object.entries(draft.uses).filter(([, v]) => v === key).map(([k]) => k);
}

export function accountOf(view: WhatsappView, key: string | null | undefined): WaAccount | undefined {
  return key ? view.accounts.find((a) => a.key === key) : undefined;
}

export function displayLabel(view: WhatsappView, draft: Draft, key: string): string {
  const d = draft.accounts.find((a) => a.key === key);
  if (d?.label.trim()) return d.label.trim();
  const v = accountOf(view, key);
  if (v && !v.label_set) return v.label; // the server's suggestion ("וואטסאפ ····1234")
  return v?.kind === 'discovered' ? v.label : wt('manualTag');
}

export function stateWord(state: AccountState): string {
  return wt(`st_${state}` as WaTextKey);
}

export interface Option { value: string; label: string }

/** The picker of a use row: "כמו ..." for an inheriting use, "ברירת המחדל" for a department row, else "ללא"; then the accounts,
 * discovered first, each with its last four digits and (when not connected) its state. */
export function useOptions(view: WhatsappView, draft: Draft, use: WaUse, department = false): Option[] {
  const first: Option = department ? { value: '', label: wt('deptDefault') } : use.inherits ? { value: '', label: wt('same', { use: use.inherits_label ?? use.inherits }) } : { value: '', label: wt('none') };
  const known = new Set(draft.accounts.map((a) => a.key));
  const keys = [...draft.accounts.map((a) => a.key), ...view.accounts.filter((a) => !known.has(a.key) && !a.removed).map((a) => a.key)];
  const order = (k: string) => (k.startsWith('entry:') ? 0 : 1);
  const opts = keys.sort((a, b) => order(a) - order(b)).map((k) => {
    const v = accountOf(view, k);
    const parts = [displayLabel(view, draft, k)];
    if (v?.last4 && !parts[0].includes(v.last4)) parts.push(`····${v.last4}`);
    if (v && v.state !== 'connected') parts.push(stateWord(v.state));
    return { value: k, label: parts.join(' · ') };
  });
  return [first, ...opts];
}

/** The warnings of one use row (department null = the installation row). */
export function useWarnings(view: WhatsappView, use: string, department: string | null): WaWarning[] {
  return view.warnings.filter((w) => w.use === use && (w.department_id ?? null) === department);
}

export function accountWarnings(view: WhatsappView, key: string): WaWarning[] {
  const seen = new Set<string>();
  return view.warnings.filter((w) => {
    if (w.account_key !== key || !(w.code === 'shared_module' || w.code === 'shared_outside' || w.code === 'maybe_same_number')) return false;
    const sig = `${w.code}:${w.module ?? ''}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

export function warningText(w: WaWarning, modules: Record<string, string>): string {
  if (w.code === 'account_down') return wt(w.state === 'missing' ? 'w_down_missing' : w.state === 'unknown' ? 'w_down_unknown' : 'w_down_disconnected');
  if (w.code === 'shared_module') return wt('w_shared_module', { module: modules[w.module ?? ''] ?? w.module ?? '' });
  return wt(`w_${w.code}` as WaTextKey);
}

/** "<the use label> · ניקיון" - the uses an account carries, in words. */
export function usesText(view: WhatsappView, keys: string[]): string {
  return keys.map((k) => {
    const [base, dept] = k.split(DEPT_SEP);
    const use = view.uses.find((u) => u.key === base);
    if (!use) return '';
    const d = dept ? use.departments?.find((x) => x.id === dept)?.name : '';
    return d ? `${use.label} · ${d}` : use.label;
  }).filter(Boolean).join(', ');
}

export function chipTone(state: AccountState): 'ok' | 'bad' | 'mute' {
  return state === 'connected' ? 'ok' : state === 'unknown' ? 'mute' : 'bad';
}
