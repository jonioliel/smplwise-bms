/**
 * WISKEY-WA-QUEUE-2400 (T12): the module of the frontend that talks to `/api/v1/access-control/messaging/installed`
 * (smplwise_vms/backend/smplwise/routers/access_control_wa_queue.py) - WhatsApp on the installed WisKey client: what the direct join
 * selects now, the template registry by source and its refresh, the durable queue's journal, and the opt-in for WisKey's versioned
 * paced send. Installation-level (Settings > access control > messages, system.configure). Without a backend the in-memory demo
 * below answers (fake data only: no number, no recipient, no message text).
 */
import { get, post, put } from './client';
import { isApi } from './session';

export const INSTALLED_COMMANDS = [
  'whatsapp/template_registry_v1',
  'whatsapp/template_enqueue_v1',
  'whatsapp/template_job_v1',
  'whatsapp/template_cancel_v1',
  'whatsapp/template_send_v3',
  'whatsapp/send_pacing_v1',
] as const;
export type InstalledCommand = (typeof INSTALLED_COMMANDS)[number];

export type JobState = 'queued' | 'dispatching' | 'completed' | 'cancelled' | 'unknown';
export type JobOutcome = 'pending' | 'accepted' | 'not_sent' | 'unknown';
export type SyncOutcome = 'synced' | 'not_sent' | 'refused' | 'invalid' | 'unknown';

export interface InstalledTemplate {
  id: string;
  name: string;
  language: string;
  purpose: string;
  source: 'wiskey' | 'arx';
  account: string | null;
  template_revision: number | null;
  bound: boolean;
}
export interface InstalledJob {
  operation_id: string;
  template_id: string | null;
  person_id: string | null;
  state: JobState;
  outcome: JobOutcome;
  code: string | null;
  created_at: string;
  updated_at: string;
}
export interface InstalledSync {
  outcome: SyncOutcome;
  code: string | null;
  native: number | null;
  at?: string;
}
export interface InstalledView {
  settings: { send_pacing_v1: boolean };
  gates: { messaging_enabled: boolean; template_switch: boolean; permit: boolean };
  commands: Record<InstalledCommand, boolean>;
  registry: {
    templates: InstalledTemplate[];
    wiskey_rows: number;
    arx_rows: number;
    native_accounts: number;
    native_sendable: boolean;
    last_sync: InstalledSync | null;
  };
  jobs: InstalledJob[];
  queue_ttl_s: number;
  delivery_receipts: boolean;
  excluded: string[];
  sync?: InstalledSync;
}

export interface WaInstalledBackend {
  view(): Promise<InstalledView>;
  save(body: { send_pacing_v1: boolean }): Promise<InstalledView>;
  sync(): Promise<InstalledView>;
}

const URL = 'access-control/messaging/installed';
const rest: WaInstalledBackend = {
  view: () => get<InstalledView>(URL),
  save: (body) => put<InstalledView>(URL, body),
  sync: () => post<InstalledView>(`${URL}/registry-sync`, {}),
};

export function demoInstalledView(): InstalledView {
  return {
    settings: { send_pacing_v1: false },
    gates: { messaging_enabled: true, template_switch: true, permit: false },
    commands: {
      'whatsapp/template_registry_v1': true,
      'whatsapp/template_enqueue_v1': true,
      'whatsapp/template_job_v1': true,
      'whatsapp/template_cancel_v1': true,
      'whatsapp/template_send_v3': true,
      'whatsapp/send_pacing_v1': false,
    },
    registry: {
      templates: [
        { id: 'access', name: 'access_notice', language: 'he', purpose: 'notice', source: 'arx', account: null, template_revision: 3, bound: true },
        { id: 'native_0a1b2c3d4e5f6a7b8c9d0e1f', name: 'door_code', language: 'he', purpose: 'notice', source: 'wiskey', account: 'office', template_revision: 2, bound: true },
      ],
      wiskey_rows: 1,
      arx_rows: 1,
      native_accounts: 1,
      native_sendable: false,
      last_sync: { outcome: 'synced', code: null, native: 1, at: '2026-11-04T08:00:00+00:00' },
    },
    jobs: [
      { operation_id: 'tplq-demo00000001', template_id: 'access', person_id: 'p1', state: 'completed', outcome: 'accepted', code: 'provider_accepted', created_at: '2026-11-04T08:10:00+00:00', updated_at: '2026-11-04T08:10:20+00:00' },
      { operation_id: 'tplq-demo00000002', template_id: 'access', person_id: 'p2', state: 'cancelled', outcome: 'not_sent', code: 'cancelled_before_dispatch', created_at: '2026-11-04T08:05:00+00:00', updated_at: '2026-11-04T08:05:30+00:00' },
    ],
    queue_ttl_s: 120,
    delivery_receipts: false,
    excluded: ['whatsapp/history', 'whatsapp/media', 'whatsapp/templates_get', 'whatsapp/templates_update'],
  };
}

let demoState: InstalledView = demoInstalledView();
export function resetDemoWaInstalled(): void {
  demoState = demoInstalledView();
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const demo: WaInstalledBackend = {
  view: async () => clone(demoState),
  save: async (body) => {
    demoState.settings.send_pacing_v1 = body.send_pacing_v1 === true;
    return clone(demoState);
  },
  sync: async () => {
    demoState.registry.last_sync = { outcome: 'synced', code: null, native: demoState.registry.wiskey_rows, at: new Date().toISOString() };
    return { ...clone(demoState), sync: clone(demoState.registry.last_sync) };
  },
};

export function waInstalledApi(): WaInstalledBackend {
  return isApi() ? rest : demo;
}
