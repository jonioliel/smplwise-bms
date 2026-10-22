/**
 * CR-WA-PACING-295: the module of the frontend that talks to `/api/v1/messaging/whatsapp/pacing`
 * (smplwise_vms/backend/smplwise/routers/messaging_accounts.py) - the shared WhatsApp send budget: the mode, WisKey sharing the number,
 * the queue age limits, and per account the counters of the last 24 hours. Installation-level (Settings > messaging channel). Without a
 * backend the in-memory demo below answers (fake data only: no number, no recipient).
 */
import { get, put } from './client';
import { isApi } from './session';

export type PacingMode = 'conservative' | 'standard' | 'off';
export type PacingClass = 'alert' | 'code' | 'ticket' | 'reminder';
export const PACING_MODES: PacingMode[] = ['conservative', 'standard', 'off'];
export const PACING_CLASSES: PacingClass[] = ['alert', 'code', 'ticket', 'reminder'];

export interface PacingCounters { sent: number; deferred: number; backoff: number; pair_backoff: number; expired: number }
export interface PacingWiskey {
  mapped: boolean;
  verified: boolean;
  /** WisKey's own counters are missing for a mapped sender: unknown, never zero */
  unknown: boolean;
  charged: { '1m': number; '1h': number; '24h': number } | null;
  throttled_until: string | null;
  leases_active: number;
  /** PACING12-295: whether the last pacing read covered this account's WisKey sender (null: no sender mapped) */
  coverage?: 'covered' | 'not_covered' | null;
  /** PACING12-295: why `unknown` (a closed read's reason, `truncated`, `sender_absent`, `unverified`, `counters_incomplete`, ...) */
  reason?: string | null;
}
/** PACING12-295: what the last `whatsapp/pacing_status_v1` read covered; `truncated` = it did not cover every WisKey sender */
export interface PacingWiskeyCoverage {
  closed_reason: string | null;
  total: number | null;
  received: number;
  returned: number;
  invalid: number;
  truncated: boolean;
}
export interface PacingAccount {
  account_key: string;
  wiskey: PacingWiskey;
  sends_1h: number;
  sends_24h: number;
  wiskey_1h: number;
  wiskey_24h: number;
  waiting: number;
  waiting_by_class: Partial<Record<PacingClass, number>>;
  oldest_wait_s: number | null;
  counters_24h: PacingCounters;
  backoff: { level: number; until: string } | null;
  pairs_in_backoff: number;
}
export interface PacingView {
  mode: PacingMode;
  wiskey_shared: boolean;
  max_wait_min: Record<PacingClass, number>;
  budget: { per_minute: number; burst: number; burst_window_s: number } | null;
  share_pct: Record<PacingClass, number>;
  per_minute: number | null;
  burst: number | null;
  shared_budget_guaranteed: boolean;
  wiskey_coverage?: PacingWiskeyCoverage;
  accounts: PacingAccount[];
  can_manage: boolean;
  /** false while the tickets module is off or the mode is `off`: nothing is governed */
  applies: boolean;
}
export interface PacingPut { mode?: PacingMode; wiskey_shared?: boolean; per_minute?: number; burst?: number; max_wait_min?: Partial<Record<PacingClass, number>> }

export interface MessagingPacingBackend {
  view(): Promise<PacingView>;
  save(body: PacingPut): Promise<PacingView>;
}

const URL = 'messaging/whatsapp/pacing';
const rest: MessagingPacingBackend = { view: () => get<PacingView>(URL), save: (body) => put<PacingView>(URL, body) };

function demoView(): PacingView {
  return {
    mode: 'conservative', wiskey_shared: true, max_wait_min: { alert: 60, code: 5, ticket: 360, reminder: 720 },
    budget: { per_minute: 10, burst: 5, burst_window_s: 10 }, per_minute: null, burst: null, shared_budget_guaranteed: false, share_pct: { alert: 100, code: 95, ticket: 80, reminder: 60 },
    can_manage: true, applies: true,
    accounts: [{
      account_key: 'entry:01JDEMOOFFICE', wiskey: { mapped: true, verified: false, unknown: true, charged: null, throttled_until: null, leases_active: 0 }, sends_1h: 7, sends_24h: 41, wiskey_1h: 2, wiskey_24h: 9, waiting: 3, waiting_by_class: { ticket: 1, reminder: 2 }, oldest_wait_s: 540,
      counters_24h: { sent: 41, deferred: 12, backoff: 1, pair_backoff: 0, expired: 0 }, backoff: null, pairs_in_backoff: 0,
    }],
  };
}

let demo: PacingView | null = null;
const demoBackend: MessagingPacingBackend = {
  async view() {
    demo ??= demoView();
    return structuredClone(demo);
  },
  async save(body) {
    demo ??= demoView();
    if (body.mode) demo.mode = body.mode;
    if (body.wiskey_shared !== undefined) demo.wiskey_shared = body.wiskey_shared;
    if (body.max_wait_min) demo.max_wait_min = { ...demo.max_wait_min, ...body.max_wait_min } as Record<PacingClass, number>;
    if (body.per_minute !== undefined) demo.per_minute = body.per_minute;
    if (body.burst !== undefined) demo.burst = body.burst;
    demo.applies = demo.mode !== 'off';
    const base = demo.mode === 'standard' ? { per_minute: 20, burst: 8 } : { per_minute: 10, burst: 5 };
    demo.budget = demo.mode === 'off' ? null : { per_minute: demo.per_minute ?? base.per_minute, burst: demo.burst ?? base.burst, burst_window_s: 10 };
    return structuredClone(demo);
  },
};

export function messagingPacingApi(): MessagingPacingBackend {
  return isApi() ? rest : demoBackend;
}

/** Tests only: forget the demo store's edits. */
export function resetDemoMessagingPacing(): void {
  demo = null;
}
