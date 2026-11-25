/**
 * MFA-T095-REST-2530 (CR-011 option D and 4E / Q6): the two action-bound step-up methods.
 * - `push`: approve on the phone (routers/push_approval.py). The requesting screen opens a request and shows its number; the Android app
 *   of the same user lists it with three numbers, the person picks the one on the requesting screen and the phone key signs the pick; the
 *   requester then spends the approval with `auth/step-up/verify {method: "push"}` - a proof for ONE request of exactly that action.
 * - `alarm_pin`: the personal alarm code proves one alarm disarm / zone bypass (`auth/step-up/verify {method: "alarm_pin"}`).
 * Shapes: generated from smplwise/wire/push_approval.py and second_factor.py.
 */
import { api, get, post } from './client';
import type { PushApprovalChallenge, PushApprovalList, PushApprovalPending, PushApprovalStarted, PushApprovalState } from './generated/wire-push-approval';
import type { StepUpProof } from './generated/wire-second-factor';
import { DeviceKeyCancelled } from './factor-screens';

export type { PushApprovalPending };

const enc = encodeURIComponent;

/* ---- the requester */
export const startPushApproval = (action: string) => post<PushApprovalStarted>('auth/step-up/push', { action });
export const pushApprovalState = (id: string) => get<PushApprovalState>(`auth/step-up/push/${enc(id)}`);
export const cancelPushApproval = (id: string) => api<PushApprovalState>(`auth/step-up/push/${enc(id)}`, { method: 'DELETE' });
export const verifyPushApproval = (id: string, action: string) =>
  post<StepUpProof>('auth/step-up/verify', { method: 'push', challenge_id: id, action });

/** The personal alarm code as the proof of one alarm action (the server refuses it for anything else). */
export const alarmPinStepUp = (code: string, action: string) => post<StepUpProof>('auth/step-up/verify', { method: 'alarm_pin', code, action });

/* ---- the phone */
export const listPushApprovals = () => get<PushApprovalList>('auth/push-approvals');
export const denyPushApproval = (id: string) => post<PushApprovalState>(`auth/push-approvals/${enc(id)}/deny`);

interface DeviceKeySigner {
  sign(payload: string, text: string): Promise<{ signature?: string }>;
}

/** The pick: a phone-key challenge for `number`, the app's prompt (shows `text`) signs it, the server approves - or, for a number that is
 * not the requester's, denies the request (409 `push_approval_number_mismatch`). Throws DeviceKeyCancelled when the prompt is cancelled. */
export async function approvePushApproval(id: string, keyId: string, number: number, text: string, signer: DeviceKeySigner): Promise<PushApprovalState> {
  const ch = await post<PushApprovalChallenge>(`auth/push-approvals/${enc(id)}/challenge`, { key_id: keyId, number });
  let signature = '';
  try {
    signature = (await signer.sign(ch.payload, text)).signature ?? '';
  } catch (err) {
    throw new DeviceKeyCancelled(err instanceof Error ? err.message : 'failed');
  }
  if (!signature) throw new DeviceKeyCancelled('failed');
  return post<PushApprovalState>(`auth/push-approvals/${enc(id)}/approve`, { challenge_id: ch.challenge_id, key_id: keyId, signature });
}
