/** K11: the optional TOTP second factor (routes/second_factor.py). The secret is shown once, at enrolment, and never again. */
import { api, get, post, put } from './client';
import type * as SfWire from './generated/wire-second-factor';

/* The shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/second_factor.py, generated into
 * ./generated/wire-second-factor.ts; code review 07:F8 step 2). */
export type SecondFactorStatus = SfWire.OwnFactor;

export type Enrolment = SfWire.Enrolment;

export const secondFactorStatus = () => get<SecondFactorStatus>('auth/second-factor');
export const startEnrolment = () => post<Enrolment>('auth/second-factor/enroll');
export const confirmEnrolment = (code: string) => post<SfWire.FactorStatus>('auth/second-factor/confirm', { code });
export const disableSecondFactor = (code: string) => post<SfWire.FactorStatus>('auth/second-factor/disable', { code });
export const factorUsers = () => get<SfWire.EnrolledUsers>('auth/second-factor/users');
/** An administrator who has a factor sends their own current code (security review 2.2.0 M1); never their own user id (that is `disable`). */
export const resetFactor = (userId: string, ownCode?: string) =>
  api<SfWire.FactorReset>(`auth/second-factor/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    ...(ownCode ? { headers: { 'X-Arx-Second-Factor': ownCode } } : {}),
  });

/** TFA2: per-user and per-role override on top of the global policy (inherit = no stored row). system.configure. */
export type FactorOverride = 'inherit' | 'optional' | 'required';
/** Narrowed on purpose: a stored override is `optional` or `required` (`inherit` deletes the row; the server types the value as a string). */
export type FactorOverrides = Omit<SfWire.Overrides, 'user' | 'role'> & {
  user: Record<string, Exclude<FactorOverride, 'inherit'>>;
  role: Record<string, Exclude<FactorOverride, 'inherit'>>;
};
export const factorOverrides = () => get<FactorOverrides>('auth/second-factor/overrides');
export const setFactorOverride = (kind: 'user' | 'role', subjectId: string, policy: FactorOverride) =>
  put<FactorOverrides & Pick<SfWire.OverrideSet, 'kind' | 'subject_id' | 'policy'>>(`auth/second-factor/overrides/${kind}/${encodeURIComponent(subjectId)}`, { policy });

/** MFA-STEPUP-TRAIN-2490: step-up before a change of settings, users or permissions. The status says whether it applies to this
 * session and until when the current proof counts; `verifyStepUp` turns a current code into a proof on this session (server-side). */
export type StepUpStatus = SfWire.StepUpStatus;
export const stepUpStatus = () => get<StepUpStatus>('auth/step-up');
export const verifyStepUp = (code: string, action?: string) => post<SfWire.StepUpProof>('auth/step-up/verify', { method: 'totp', code, ...(action ? { action } : {}) });
