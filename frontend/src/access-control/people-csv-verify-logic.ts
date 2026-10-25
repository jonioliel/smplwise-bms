/**
 * WKR5ADOPT-295 (W-006): the pure logic of the WisKey-verified people CSV preview inside the bulk people dialog (no DOM, no fetch).
 * The server decides every permission, every row and every refusal; nothing here grants anything. Unit-tested in Node
 * (tests/unit-people-csv-verify.spec.ts).
 */
import type { BulkSettings, CsvOperation, VerifiedPreview } from '../api/bulk-people';
import type { BtKey } from '../i18n/bulk-people';

export const PAGE_SIZE = 8;
export const POLL_MS = 1500;
export const POLL_MAX = 20;

export type VerifyMode = 'off' | 'blocked' | 'ready';

/** `off` = the switch is off (the ordinary dry-run flow stays); `blocked` = switched on but something is missing; `ready` = verify may run. */
export function verifyMode(settings: Pick<BulkSettings, 'wiskey_csv' | 'may_import'> | null): VerifyMode {
  const w = settings?.wiskey_csv;
  if (!w || w.enabled !== 'on') return 'off';
  return w.available && settings?.may_import === true ? 'ready' : 'blocked';
}

const BLOCKERS: Record<string, BtKey> = {
  switch_off: 'v_blocker_switch_off',
  bulk_people_off: 'v_blocker_bulk_people_off',
  binding_not_configured: 'v_blocker_binding_not_configured',
  direct_not_installed: 'v_blocker_direct_not_installed',
  direct_not_selected: 'v_blocker_direct_not_selected',
};

/** The word key of a blocker code (an unknown code falls back to the generic "unavailable"). */
export function blockerKey(code: string): BtKey {
  return BLOCKERS[code] ?? 'v_blocker_direct_not_selected';
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** One page of rows (0-based page, clamped) - long lists page instead of scrolling. */
export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): T[] {
  const last = pageCount(rows.length, size) - 1;
  const at = Math.min(Math.max(0, page), last);
  return rows.slice(at * size, at * size + size);
}

/** Whether the confirm button may be pressed: something to write, the exact count typed, the preview still in date. */
export function canConfirm(preview: VerifiedPreview, typed: string, nowMs: number): boolean {
  if (preview.writes <= 0) return false;
  if (typed.trim() !== String(preview.writes)) return false;
  const end = Date.parse(preview.expires_at);
  return Number.isFinite(end) && end > nowMs;
}

/** The word key (and count) that tells the state of the started operation. */
export function resultWords(op: CsvOperation): { key: BtKey; n?: number } {
  switch (op.state) {
    case 'running':
      return { key: 'v_result_running' };
    case 'finished':
      return typeof op.saved === 'number' ? { key: 'v_result_finished', n: op.saved } : { key: 'v_result_done' };
    case 'cancelled':
      return { key: 'v_result_cancelled' };
    case 'not_started':
      return { key: 'v_none' };
    default:
      return { key: 'v_result_unknown' };
  }
}

/** Poll the completion read again only while the operation runs and the budget is not spent. An unknown state is never polled into "success". */
export function shouldPoll(op: CsvOperation | null, polls: number): boolean {
  return op !== null && op.state === 'running' && polls < POLL_MAX;
}

/** The expiry as a short local time (HH:MM) for the chip; the raw string when it does not parse. */
export function expiryText(iso: string, lang?: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}
