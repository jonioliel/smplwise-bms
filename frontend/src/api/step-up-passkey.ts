/**
 * MFA-PASSKEYS-2490 (second-factor train, slice 4): a passkey as the step-up proof (routers/local_passkeys.step_up_challenge +
 * routers/second_factor.step_up_verify, services/user_passkeys.py). The server binds the challenge to the user, this session and the
 * action (60 s, single use); the proof it records is the same server-side proof as the authenticator code's. Kept apart from
 * ./second-factor.ts so the step-up dialog (slice 2) can import it without the account screens.
 */
import { post } from './client';
import type * as PkWire from './generated/wire-local-passkeys';
import type * as SfWire from './generated/wire-second-factor';
import { getPasskey } from '../arx/webauthn';

export type StepUpChallenge = PkWire.StepUpChallenge;
export type StepUpProof = SfWire.StepUpProof;

/** What a 403 `step_up_required` carries (the central gate, or a factor change of My Account). */
interface StepUpNeed {
  action?: string;
  methods?: string[];
  minutes?: number;
  verify_path?: string;
  challenge_path?: string;
}

const stepUpChallenge = (action?: string) => post<StepUpChallenge>('auth/step-up/challenge', action ? { action } : {});

const verifyPasskeyStepUp = (challengeId: string, assertion: Record<string, unknown>, action?: string) =>
  post<StepUpProof>('auth/step-up/verify', { method: 'passkey', challenge_id: challengeId, assertion, ...(action ? { action } : {}) });

/** MFA-TRAIN-2500: the code proof is slice 2's `verifyStepUp` (./second-factor.ts) - one call, two names. */
export { verifyStepUp as verifyCodeStepUp } from './second-factor';

/** The whole passkey ceremony: a challenge, the device (fingerprint / device PIN), the verification. Throws PasskeyCancelled
 * (arx/webauthn.ts) when the device side is cancelled or finds no passkey, ApiError when the server refuses. */
export async function passkeyStepUp(action?: string): Promise<StepUpProof> {
  const ch = await stepUpChallenge(action);
  const assertion = await getPasskey(ch.webauthn.publicKey);
  return verifyPasskeyStepUp(ch.challenge_id, assertion, action);
}

/** The step-up need of an error, or null when it is not a 403 `step_up_required`. */
export function stepUpNeed(err: unknown): StepUpNeed | null {
  const e = err as { status?: number; body?: { code?: string; details?: unknown } } | null;
  if (!e || e.status !== 403 || e.body?.code !== 'step_up_required') return null;
  const d = e.body.details;
  return d && typeof d === 'object' ? (d as StepUpNeed) : {};
}
