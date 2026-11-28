/**
 * MFA-T095-REST-2530 (CR-011 option D and 4E / Q6): the two action-bound step-up methods.
 * - `push`: approve on the phone (routers/push_approval.py). The requesting screen opens a request and shows its number; the Android app
 *   of the same user lists it, the person types the number of the requesting screen and the phone key signs it; the
 *   requester then spends the approval with `auth/step-up/verify {method: "push"}` - a proof for ONE request of exactly that action.
 * - `alarm_pin`: the personal alarm code proves one alarm disarm / zone bypass (`auth/step-up/verify {method: "alarm_pin"}`).
 * Shapes: generated from smplwise/wire/push_approval.py and second_factor.py.
 */
import { ApiError, api, get, post } from './client';
import type { PushApprovalChallenge, PushApprovalList, PushApprovalPending, PushApprovalStarted, PushApprovalState } from './generated/wire-push-approval';
import type { StepUpProof } from './generated/wire-second-factor';
import { signPayload } from './factor-screens';

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
  sign(payload: string, text?: string): Promise<{ signature?: string }>;
}

/** The typed number: a phone-key challenge for `number`, the app's prompt signs it, the server approves - or, for a number that is not
 * the requester's, denies the request (409 `push_approval_number_mismatch`). FIX-PHONEKEY-2570 (SA2-02): the phone is told the SIGNED
 * payload's own words ("approve a request from another screen, number NN" - the number inside the signed action), never a text of the
 * page. Throws DeviceKeyCancelled when the prompt is cancelled. */
export async function approvePushApproval(id: string, keyId: string, number: number, signer: DeviceKeySigner): Promise<PushApprovalState> {
  const ch = await post<PushApprovalChallenge>(`auth/push-approvals/${enc(id)}/challenge`, { key_id: keyId, number });
  const signature = await signPayload(signer, ch.payload);
  return post<PushApprovalState>(`auth/push-approvals/${enc(id)}/approve`, { challenge_id: ch.challenge_id, key_id: keyId, signature });
}

/** SA-01 (FIX-PUSH-APPROVAL-2560): the requesting screen's poll meets a temporary 429 -> wait and ask again (a few times) instead of dropping
 * the request. Answers the delay in ms, or null when the error is final (any other error, or too many refusals in a row). */
export const PUSH_POLL_RETRY_MAX = 8;
export function pushPollRetryDelay(err: unknown, refusals: number): number | null {
  if (!(err instanceof ApiError) || err.status !== 429 || refusals >= PUSH_POLL_RETRY_MAX) return null;
  return Math.min(10000, 3000 + refusals * 1000);
}
