/** CR-022: the NVR connection stored by Arx - the vendor catalogue, the stored connection (never a password), the read-only
 * connection test, "remove NVR" and the system restart that applies a change. Every route needs `system.configure`
 * (installation scope) and none exists on the remote channel. The password is write-only: a response never carries it. */
import { ApiError, api, get, post, put } from './client';

export type VendorId = 'hikvision' | 'provision_isr' | 'frigate' | 'none';

export interface VendorField {
  key: string;
  label: string;
  kind: 'host' | 'port' | 'text' | 'password' | 'bool';
  required: boolean;
  secret: boolean;
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
  /** ok | incomplete | unreadable | not_chosen (the stored state of the row). */
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
  /** ok | source_unavailable | source_forbidden | source_error | timeout */
  code: string;
  model?: string | null;
  firmware?: string | null;
  channels?: number | null;
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
export const saveNvrConnection = (body: ConnectionBody & { save_untested?: boolean; confirm_text?: string; if_revision?: number }) => put<SaveResult>('nvr/connection', body);
/** `DELETE` carries a body (the typed word); the shared `del` helper does not. */
type Removed = { removed: true; restart_required: true; revision: number; cameras_disabled: number };
const deleteConnection = (body: Record<string, unknown>) => api<Removed>('nvr/connection', { method: 'DELETE', body: JSON.stringify(body) });
/** The server requires `if_revision` (security review) - a stale one answers 409 `stale`. Compatibility: the slice-B backend (before the
 * security fixes) refuses the unknown key with 422 `validation` naming `if_revision`; then the same request is sent without it.
 * Remove the fallback once the security-fix branch is merged. */
export const removeNvrConnection = async (confirm_text: string, if_revision: number): Promise<Removed> => {
  try {
    return await deleteConnection({ confirm_text, if_revision });
  } catch (err) {
    const fields = err instanceof ApiError && err.status === 422 && err.code === 'validation' ? (err.body.details?.fields as string[] | undefined) : undefined;
    if (fields?.includes('if_revision')) return deleteConnection({ confirm_text });
    throw err;
  }
};
/** 202 = accepted; the process ends after the answer, so its outcome is only seen by the system coming back. */
export const restartSystem = () => post<{ restarting: true }>('system/restart', { confirm: true });
