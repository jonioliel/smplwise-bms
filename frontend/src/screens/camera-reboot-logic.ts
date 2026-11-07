/**
 * CAMERA-REBOOT-2407: the pure rules of the camera's "restart" action - when the section is shown, whether the button is enabled,
 * the one line that says why not, and the words of a refusal. No internal code reaches the face.
 */
import type { CameraRebootState } from '../api/nvr';
import { crt, type CrKey } from '../i18n/camera-reboot';

export interface RebootView {
  /** The section is shown at all (a recorder type without the action shows nothing). */
  shown: boolean;
  enabled: boolean;
  /** The reason the button is disabled, in words; '' when enabled. */
  reason: string;
}

const REASON_KEY: Record<string, CrKey> = {
  not_supported: 'reasonNotSupported',
  no_permission: 'reasonNoPermission',
  writes_off: 'reasonWritesOff',
  cooldown: 'reasonCooldown',
};

export function rebootView(s: CameraRebootState | null, busy = false): RebootView {
  if (!s || !s.supported) return { shown: false, enabled: false, reason: '' };
  if (s.can_reboot) return { shown: true, enabled: !busy, reason: '' };
  const key = REASON_KEY[s.reason ?? ''] ?? 'errorGeneric';
  const min = Math.max(1, Math.ceil((s.cooldown_s || 0) / 60));
  return { shown: true, enabled: false, reason: crt(key, { min }) };
}

/** A refused or failed press, in words (never the server's code). */
export function rebootErrorText(err: unknown): string {
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 0;
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code ?? '') : '';
  if (code === 'nvr_writes_off') return crt('reasonWritesOff');
  if (code === 'camera_reboot_not_supported' || code === 'nvr_not_supported') return crt('reasonNotSupported');
  if (code === 'rate_limited' || status === 429) return crt('errorRateLimited');
  if (code === 'nvr_rejected') return crt('errorRejected');
  if (code.startsWith('source_') || status === 503) return crt('errorUnavailable');
  if (status === 403) return crt('errorForbidden');
  return crt('errorGeneric');
}
