/**
 * CR-FLEET215: the ONLY module of the frontend that talks to the installation's health-report routes
 * (smplwise_vms/backend/smplwise/routers/fleet.py, routers/readiness.py): the consent switch and the silence threshold, the last
 * attempts, the exact report that would be sent, the public enrollment facts, the readiness checklist and the demo-data switch.
 * Every route needs system.configure at installation scope AND a system administrator; a 403 is shown as "forbidden", never hidden.
 * The add-on option holding the receiver address is the installer's: the server only says whether it is usable, never its value.
 */
import { get, post, put } from './client';

export type FleetResult = 'ok' | 'rejected' | 'unreachable' | 'schema_refused';

export interface FleetStatus {
  enabled: boolean;
  /** the add-on option `fleet_report_url` is set and usable */
  receiver_configured: boolean;
  receiver_problem: 'receiver_not_configured' | 'receiver_url_invalid' | null;
  /** both keys are on */
  sending: boolean;
  installation_id: string | null;
  kid: string | null;
  alg: string | null;
  last_seq: number;
  last_attempt_at: string | null;
  last_result: FleetResult | null;
  last_ok_at: string | null;
  schema: string;
  period_h: number;
  retry_h: number;
  silent_after_h: number;
  silent_range_h: [number, number];
  silent_default_h: number;
  stopped_at: string | null;
  stopped_result: FleetResult | null;
}

export interface FleetLogRow {
  id: number;
  seq: number | null;
  kid: string | null;
  at: string;
  trigger: 'schedule' | 'manual' | 'stop';
  result: FleetResult;
  http_status: number | null;
  /** the exact body that was signed and sent; null when nothing left the installation */
  payload: Record<string, unknown> | null;
}

export interface FleetPreview {
  preview: true;
  id_assigned: boolean;
  bytes: number;
  payload: Record<string, unknown>;
}

export interface FleetEnrollment {
  installation_id: string;
  kid: string;
  alg: string;
  public_key: string;
  /** one text line: public data only */
  code: string;
}

export interface FleetSendResult {
  sent: boolean;
  result: string;
  http_status?: number | null;
  seq?: number;
}

export interface ReadinessItem {
  id: string;
  /** null = does not apply to this installation (never listed) */
  met: boolean | null;
  required: boolean;
  weight: number;
  label: { he: string; en: string };
  /** present only while the item is unmet */
  hint: { he: string; en: string } | null;
  link: { href: string };
}

export interface ReadinessView {
  score: number;
  ready: boolean;
  met: number;
  total: number;
  /** ids of the unmet applicable items, required first */
  missing: string[];
  items: ReadinessItem[];
  checked_at?: string;
}

const BASE = 'fleet/report';

export const fleetApi = {
  status: () => get<FleetStatus>(BASE),
  setEnabled: (enabled: boolean) => put<FleetStatus>(BASE, { enabled }),
  setSilentAfter: (silent_after_h: number) => put<FleetStatus>(BASE, { silent_after_h }),
  log: () => get<{ items: FleetLogRow[] }>(`${BASE}/log`),
  preview: () => get<FleetPreview>(`${BASE}/preview`),
  enrollment: () => get<FleetEnrollment>(`${BASE}/enrollment`),
  send: () => post<FleetSendResult>(`${BASE}/send`),
  readiness: () => get<ReadinessView>('readiness'),
  demo: () => get<{ enabled: boolean; label?: unknown }>('demo'),
  setDemo: (enabled: boolean) => put<{ enabled: boolean }>('demo', { enabled }),
};
