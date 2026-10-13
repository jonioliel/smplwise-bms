/**
 * CR-040 (WXROT): the pure logic of Settings › בקרת כניסה › "מפתח הגשר" (screens/system-access-trust.ts) - what each state and code
 * says, which tone it gets, when the rotate and check buttons are offered. No DOM, no fetch (tests/unit-bridge-trust.spec.ts).
 * The server decides everything; this only words it.
 */
import type { RotationRow, RotationState, TrustView } from '../api/bridge-trust';
import { tt, ttDynamic, type TtKey } from '../i18n/bridge-trust';

export type Tone = 'ok' | 'warn' | 'err' | 'muted';

const STATE_TONE: Record<RotationState, Tone> = { rotated: 'ok', unknown: 'warn', dispatching: 'warn', not_rotated: 'err', superseded: 'muted' };
const STATE_LABEL: Record<RotationState, TtKey> = { rotated: 'stRotated', unknown: 'stUnknown', dispatching: 'stRunning', not_rotated: 'stNotRotated', superseded: 'stSuperseded' };

export const stateTone = (state: RotationState): Tone => STATE_TONE[state] ?? 'muted';
export const stateLabel = (state: RotationState): string => tt(STATE_LABEL[state] ?? 'stUnknown');

/** The code of a result in words: a bridge refusal names its own reason where one is known, other refusals a general one. */
export function codeText(code: string | null | undefined): string {
  if (!code) return '';
  if (code.startsWith('status_refused:')) return tt('c_status_refused');
  if (code.startsWith('refused:')) {
    const reason = code.split('/')[1] ?? '';
    return ttDynamic(`c_${reason}`, 'c_refused');
  }
  return ttDynamic(`c_${code}`, 'c_invalid_response');
}

/** The first eight characters of a request id: a reference for the log, never the whole id on a phone row. */
export const shortId = (id: string): string => id.slice(0, 8);

export function rowLine(row: RotationRow, when: (iso: string | null) => string): string {
  return tt('rowLine', { when: when(row.requested_at), who: row.initiator, from: row.epoch_from, to: row.epoch_to });
}

/** "0.8.1" >= "0.8.0": numeric parts, a missing part counts as 0. */
export function versionAtLeast(version: string | null | undefined, required: string): boolean {
  if (!version) return false;
  const a = version.split('.').map((p) => parseInt(p, 10) || 0);
  const b = required.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

export interface Line {
  tone: Tone;
  text: string;
}

/** The bridge row: paired, reachable, new enough, able to rotate. */
export function bridgeLine(view: TrustView): Line {
  const b = view.bridge;
  if (view.blocked === 'ha_not_configured') return { tone: 'err', text: tt('noHa') };
  if (!b.paired) return { tone: 'err', text: tt('notPaired') };
  if (b.supported) return { tone: 'ok', text: tt('bridgeOk', { v: b.version ?? '' }) };
  if (!b.version) return { tone: 'warn', text: tt('bridgeOld', { req: b.required }) };
  if (versionAtLeast(b.version, b.required)) return { tone: 'warn', text: tt('bridgeNoCapability') };
  return { tone: 'warn', text: tt('bridgeOldSeen', { v: b.version, req: b.required }) };
}

/** The bridge's own confirmation of the epoch (its last verified push). */
export function seenLine(view: TrustView, when: (iso: string | null) => string): Line {
  const n = view.bridge.epoch_seen;
  if (n === null || n === undefined) return { tone: 'muted', text: tt('seenNever') };
  if (n !== view.epoch) return { tone: 'warn', text: tt('seenMismatch', { n }) };
  return { tone: 'ok', text: tt('seenValue', { n, when: when(view.bridge.seen_at) }) };
}

export type OpenKind = 'running' | 'unknown' | 'neither';

/** What the open request means for the operator: in flight, unknown (check it), or a bridge that accepts neither key (re-pair). */
export function openKind(open: RotationRow | null): OpenKind | null {
  if (!open) return null;
  if (open.state === 'dispatching') return 'running';
  if (open.code === 'neither_key') return 'neither';
  return 'unknown';
}

export function openText(kind: OpenKind): string {
  return tt(kind === 'running' ? 'openRunning' : kind === 'neither' ? 'openNeither' : 'openUnknown');
}

/** The status check is offered for an unknown request only (one in flight answers by itself). */
export const canCheck = (open: RotationRow | null): boolean => !!open && open.state === 'unknown';

/** Why the rotate button is not offered (null: it is). */
export function rotateBlockedText(view: TrustView): string | null {
  if (view.can_rotate) return null;
  switch (view.blocked) {
    case 'ha_not_configured':
      return tt('noHa');
    case 'not_paired':
      return tt('notPaired');
    case 'unsupported':
      return bridgeLine(view).text;
    case 'in_progress':
      return tt('inProgress');
    default:
      return tt('loadFailed');
  }
}
