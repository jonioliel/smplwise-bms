/** CR-022: the NVR connection stored by Arx - the vendor catalogue, the stored connection (never a password), the read-only
 * connection test, "remove NVR" and the system restart that applies a change. Every route needs `system.configure`
 * (installation scope) and none exists on the remote channel. The password is write-only: a response never carries it. */
import { api, get, post, put } from './client';

export type VendorId = 'hikvision' | 'provision_isr' | 'frigate' | 'none';

export interface VendorField {
  key: string;
  label: string;
  kind: 'host' | 'port' | 'text' | 'password' | 'bool' | 'select';
  required: boolean;
  secret: boolean;
  /** CR-025: `select` choices as [value, label]; the first is the default. */
  options?: [string, string][];
  /** CR-025: shown under "הגדרות מתקדמות". */
  advanced?: boolean;
}

export interface Vendor {
  id: VendorId | string;
  label: string;
  /** available: selectable. planned: listed as "coming soon", not selectable. */
  status: 'available' | 'planned';
  default_ports: { http_port?: number; rtsp_port?: number };
  fields: VendorField[];
}

/** `GET /nvr/connection`. Keys of 0.1.71 kept (`user`, `has_password`, `placeholder`, `in_addon`). */
export interface NvrConnection {
  vendor: VendorId | string | null;
  host: string | null;
  http_port: number | null;
  rtsp_port: number | null;
  username: string | null;
  user: string | null;
  extra: Record<string, string | number | boolean>;
  has_password: boolean;
  /** ok | incomplete | unreadable | refused | not_chosen. `refused`: the stored host failed the source policy at start-up
   * (security review F5) - the NVR is treated as not configured until a new address is saved. */
  state: string;
  source: 'ui' | 'addon_import' | 'legacy' | null;
  revision: number | null;
  updated_at: string | null;
  updated_by: string | null;
  pending_restart: boolean;
  legacy_options_differ: boolean;
  placeholder?: boolean;
  in_addon: boolean;
  /** addon: the restart button works; manual: the service has to be restarted by hand. */
  restart: 'addon' | 'manual';
  cameras: number;
  /** A vendor change with cameras present needs "Remove NVR" first (D7). */
  vendor_locked: boolean;
}

export interface ConnectionBody {
  vendor: string;
  host?: string | null;
  http_port?: number | null;
  rtsp_port?: number | null;
  username?: string | null;
  /** Write-only. Omitted = keep the stored one. */
  password?: string;
  extra?: Record<string, string | number | boolean>;
}

export interface TestResult {
  ok: boolean;
  /** ok | source_unavailable | source_forbidden | source_error | timeout. Field problems (host_refused, port_refused,
   * username_invalid, password_required with details.reason = destination_changed) are 422 errors, not results. */
  code: string;
  model?: string | null;
  firmware?: string | null;
  channels?: number | null;
  /** CR-025 (Provision-ISR): how the candidate authenticates; `insecure` = Basic over plain HTTP. */
  transport?: { scheme: string; auth: string | null; insecure: boolean };
  /** CR-025: warning codes for the settings screen (basic_over_http, tls_trust_any, vendor_auth_version). */
  warnings?: string[];
  /** CR-025: the device's HTTPS certificate (SHA-256) so the form can pin it; `matches_pin` null = nothing pinned yet. */
  certificate?: { sha256: string; self_signed: boolean | null; matches_pin: boolean | null };
  /** CR-025: "pin" chosen and no fingerprint yet - pin the certificate shown before saving. */
  pin_required?: boolean;
}

export interface SaveResult extends NvrConnection {
  saved: true;
  restart_required: true;
  restarting: boolean;
  revision: number;
  device: { model?: string | null; firmware?: string | null; channels?: number | null } | null;
  untested: boolean;
}

/** The two typed words (CR-022 D6 / D7). Kept next to the API so the dialogs and the tests share them. */
export const SAVE_WORD = 'שמור';
export const REMOVE_WORD = 'הסר';

export const nvrVendors = () => get<{ vendors: Vendor[] }>('nvr/vendors').then((r) => r.vendors);
export const nvrConnection = () => get<NvrConnection>('nvr/connection');
export const testNvrConnection = (body: ConnectionBody & { use_stored_password?: boolean }) => post<TestResult>('nvr/connection/test', body);
export const saveNvrConnection = (body: ConnectionBody & { save_untested?: boolean; confirm_text?: string; if_revision: number }) => put<SaveResult>('nvr/connection', body);
/** `DELETE` carries a body (the typed word and the revision); the shared `del` helper does not. */
type Removed = { removed: true; restart_required: true; revision: number; cameras_disabled: number };
/** `if_revision` is required (the `revision` of the loaded view, 0 before any save): absent = 422 `revision_required`,
 * another revision = 409 `stale` (`details.revision`) - the form then offers "טען מחדש". */
export const removeNvrConnection = (confirm_text: string, if_revision: number): Promise<Removed> =>
  api<Removed>('nvr/connection', { method: 'DELETE', body: JSON.stringify({ confirm_text, if_revision }) });
/** 202 = accepted; the process ends after the answer, so its outcome is only seen by the system coming back. */
export const restartSystem = () => post<{ restarting: true }>('system/restart', { confirm: true });
