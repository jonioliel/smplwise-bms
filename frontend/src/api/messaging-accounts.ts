/**
 * CR-038 slice 5a: the ONLY module of the frontend that talks to `/api/v1/messaging/whatsapp` (smplwise_vms/backend/smplwise/routers/
 * messaging_accounts.py) - which linked WhatsApp account sends for which use (section 9.9). Installation-level (not behind the tickets
 * module switch). Without a backend (static preview, design review) the in-memory demo store below answers (fake data only: no real
 * number, entry id or person).
 *
 * Read: system.configure (read-only; a manual account's typed value is masked to its last four) or messaging.accounts.manage (edit).
 */
import { ApiError, get, post, put } from './client';
import { isApi } from './session';

export type AccountState = 'connected' | 'disconnected' | 'unknown' | 'missing';
export type AccountKind = 'discovered' | 'manual';

export interface Pacing {
  min_gap_s: number;
  jitter_s: number;
  per_hour: number;
  per_day: number;
  per_recipient_hour: number;
  hold_when_down_min: number;
}
export type PacingKey = keyof Pacing;

export interface WaAccount {
  key: string;
  kind: AccountKind;
  label: string;
  /** false = the label is the suggestion ("וואטסאפ ····1234"), not one an administrator typed */
  label_set: boolean;
  last4: string | null;
  state: AccountState;
  state_source: 'entity' | 'status_entity' | 'sends' | 'registry';
  in_mirror: boolean;
  stored: boolean;
  shared_outside: boolean;
  removed: boolean;
  pacing: Pacing;
  /** the use keys mapped to it directly (incl. `<use>@dept:<id>` overrides and inheriting uses that follow it) */
  uses: string[];
  sends_24h: number;
  last_send_at: string | null;
  has_status_entity: boolean;
  /** manual only; null for a reader without messaging.accounts.manage */
  account?: string | null;
  status_entity_id?: string | null;
  connected_states?: string[];
}

export interface WaUseDepartment { id: string; name: string; value: string | null; resolved: string | null }
export interface WaUse {
  key: string;
  module: string;
  label: string;
  inherits: string | null;
  inherits_label: string | null;
  per_department: boolean;
  required: boolean;
  value: string | null;
  resolved: string | null;
  queued: number;
  departments?: WaUseDepartment[];
}

export type WarningCode = 'shared_module' | 'shared_outside' | 'account_down' | 'required_unmapped' | 'maybe_same_number';
export interface WaWarning {
  code: WarningCode;
  use?: string;
  department_id?: string | null;
  account_key?: string;
  module?: string;
  state?: AccountState;
  severity: 'red' | 'amber' | 'grey';
}

export interface WaChannel { key: 'whatsapp' | 'email' | 'inapp' | 'sms'; state: 'active' | 'down' | 'not_configured' | 'idle' | 'soon' }

export interface WhatsappView {
  revision: number;
  can_manage: boolean;
  ws_connected: boolean;
  accounts: WaAccount[];
  uses: WaUse[];
  mapping: Record<string, string | null>;
  warnings: WaWarning[];
  channels: WaChannel[];
  modules: Record<string, string>;
  pacing_ranges: Record<PacingKey, [number, number]>;
  pacing_default: Pacing;
  test_send: { enabled: boolean };
}

export interface PutAccount {
  key: string;
  kind: AccountKind;
  label: string;
  shared_outside: boolean;
  removed?: boolean;
  pacing?: Partial<Pacing>;
  account?: string;
  status_entity_id?: string | null;
}
export interface PutBody { revision: number; accounts: PutAccount[]; uses: Record<string, string | null>; confirm_queued?: boolean }

/** 409 `queued_messages`: what would leave from the new account (shown before a confirm, 9.9.3). */
export interface QueuedMove { use: string; department_id: string | null; count: number }

export interface MessagingAccountsBackend {
  view(): Promise<WhatsappView>;
  save(body: PutBody): Promise<WhatsappView>;
  refresh(): Promise<WhatsappView>;
  test(accountKey: string, target: string): Promise<{ id: string; state: string }>;
}

const URL = 'messaging/whatsapp';

const rest: MessagingAccountsBackend = {
  view: () => get<WhatsappView>(URL),
  save: (body) => put<WhatsappView>(URL, body),
  refresh: () => post<WhatsappView>(`${URL}/refresh`),
  test: (account_key, target) => post<{ id: string; state: string }>(`${URL}/test`, { account_key, target }),
};

// ---------------------------------------------------------------- the demo store (no backend; fake data only)

const PACE: Pacing = { min_gap_s: 15, jitter_s: 10, per_hour: 30, per_day: 150, per_recipient_hour: 4, hold_when_down_min: 15 };
const RANGES: Record<PacingKey, [number, number]> = { min_gap_s: [5, 600], jitter_s: [0, 300], per_hour: [1, 200], per_day: [1, 1000], per_recipient_hour: [1, 30], hold_when_down_min: [1, 240] };

function demoView(): WhatsappView {
  return {
    revision: 3, can_manage: true, ws_connected: true,
    accounts: [
      { key: 'entry:01JDEMOOFFICE', kind: 'discovered', label: 'משרד הניהול', label_set: true, last4: '0099', state: 'connected', state_source: 'entity', in_mirror: true, stored: true,
        shared_outside: false, removed: false, pacing: { ...PACE }, uses: ['tickets.codes', 'tickets.messages'], sends_24h: 12, last_send_at: '2026-10-13T09:58:00Z', has_status_entity: true },
      { key: 'entry:01JDEMOINTERC', kind: 'discovered', label: 'אינטרקום', label_set: true, last4: '0098', state: 'connected', state_source: 'entity', in_mirror: true, stored: true,
        shared_outside: true, removed: false, pacing: { ...PACE }, uses: ['tickets.messages@dept:dept-cleaning'], sends_24h: 41, last_send_at: '2026-10-13T10:31:00Z', has_status_entity: true },
      { key: 'manual:demo01', kind: 'manual', label: 'מספר ישן', label_set: true, last4: '0097', state: 'disconnected', state_source: 'status_entity', in_mirror: false, stored: true,
        shared_outside: false, removed: false, pacing: { ...PACE }, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: true, account: '15555550097', status_entity_id: 'binary_sensor.old_phone_online', connected_states: ['on'] },
    ],
    uses: [
      { key: 'tickets.messages', module: 'tickets', label: 'הודעות בקשות שירות', inherits: null, inherits_label: null, per_department: true, required: true, value: 'entry:01JDEMOOFFICE', resolved: 'entry:01JDEMOOFFICE', queued: 2,
        departments: [
          { id: 'dept-maintenance', name: 'אחזקה', value: null, resolved: 'entry:01JDEMOOFFICE' },
          { id: 'dept-cleaning', name: 'ניקיון', value: 'entry:01JDEMOINTERC', resolved: 'entry:01JDEMOINTERC' },
        ] },
      { key: 'tickets.codes', module: 'tickets', label: 'קודי אימות לבקשות שירות', inherits: 'tickets.messages', inherits_label: 'הודעות בקשות שירות', per_department: false, required: false, value: null, resolved: 'entry:01JDEMOOFFICE', queued: 0 },
    ],
    mapping: { 'tickets.messages': 'entry:01JDEMOOFFICE', 'tickets.codes': null, 'tickets.messages@dept:dept-cleaning': 'entry:01JDEMOINTERC' },
    warnings: [{ code: 'shared_outside', use: 'tickets.messages', department_id: 'dept-cleaning', account_key: 'entry:01JDEMOINTERC', severity: 'amber' }],
    channels: [{ key: 'whatsapp', state: 'active' }, { key: 'email', state: 'active' }, { key: 'inapp', state: 'active' }, { key: 'sms', state: 'soon' }],
    modules: { tickets: 'ניהול השירות' },
    pacing_ranges: RANGES, pacing_default: { ...PACE }, test_send: { enabled: true },
  };
}

let demo: WhatsappView | null = null;

const demoBackend: MessagingAccountsBackend = {
  async view() {
    demo ??= demoView();
    return structuredClone(demo);
  },
  async save(body) {
    demo ??= demoView();
    if (body.revision !== demo.revision) throw new ApiError(409, { code: 'settings_stale', user_message: 'ההגדרות השתנו בינתיים. טענו מחדש.', retryable: false, correlation_id: 'demo', details: {} });
    const byKey = new Map(demo.accounts.map((a) => [a.key, a]));
    demo.accounts = body.accounts.map((a) => {
      const old = byKey.get(a.key);
      return { ...(old ?? { state: 'unknown', state_source: 'sends', in_mirror: false, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: !!a.status_entity_id, last4: null, removed: false }),
        key: a.key, kind: a.kind, label: a.label || old?.label || 'וואטסאפ (ידני)', label_set: !!a.label, stored: true, shared_outside: a.shared_outside,
        pacing: { ...PACE, ...(a.pacing ?? {}) }, ...(a.kind === 'manual' ? { account: a.account ?? null, status_entity_id: a.status_entity_id ?? null, last4: (a.account ?? '').replace(/\D/g, '').slice(-4) || null } : {}) } as WaAccount;
    });
    demo.mapping = { ...body.uses };
    for (const u of demo.uses) {
      u.value = body.uses[u.key] ?? null;
      u.resolved = u.value ?? (u.inherits ? body.uses[u.inherits] ?? null : null);
      for (const d of u.departments ?? []) {
        d.value = body.uses[`${u.key}@dept:${d.id}`] ?? null;
        d.resolved = d.value ?? u.resolved;
      }
    }
    for (const a of demo.accounts) a.uses = Object.entries(body.uses).filter(([, v]) => v === a.key).map(([k]) => k);
    demo.revision += 1;
    return structuredClone(demo);
  },
  async refresh() {
    demo ??= demoView();
    return structuredClone(demo);
  },
  async test() {
    // demo: nothing leaves the browser - the answer of a queued test row
    return { id: 'demo-test', state: 'queued' };
  },
};

export function messagingAccountsApi(): MessagingAccountsBackend {
  return isApi() ? rest : demoBackend;
}

/** Tests only: forget the demo store's edits. */
export function resetDemoMessagingAccounts(): void {
  demo = null;
}
