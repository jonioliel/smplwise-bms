import type { Notice } from '../api/notices';

/**
 * NOTICEDEL-295: the pure rules of the delete dialog (no DOM). A notice that is on air (state `active`) needs the extra explicit tick, and
 * the request then carries `confirm_live`; any other state (draft, scheduled, expired, archived) is one confirmation. An urgent notice on
 * air gets its own wording; the server refuses it for a caller without the emergency right (403 `emergency_notice`).
 */
export type DeleteTarget = Pick<Notice, 'id' | 'title' | 'state' | 'severity'>;

export const isLive = (n: Pick<Notice, 'state'>): boolean => n.state === 'active';
export const isUrgentLive = (n: Pick<Notice, 'state' | 'severity'>): boolean => n.state === 'active' && n.severity === 'critical';

/** Whether the "delete" button of the dialog may be pressed: the tick is needed for a live notice only. */
export const canConfirmDelete = (n: Pick<Notice, 'state'> | null, ticked: boolean, busy: boolean): boolean => !!n && !busy && (!isLive(n) || ticked);

/** Whether the row offers a delete action: a draft is the writer's own; anything else needs `notices.delete`. */
export function canDeleteRow(n: Pick<Notice, 'state' | 'status'>, canDelete: boolean): boolean {
  return n.state === 'draft' || n.status === 'draft' ? true : canDelete;
}
