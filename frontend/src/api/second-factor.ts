/** K11: the optional TOTP second factor (routes/second_factor.py). The secret is shown once, at enrolment, and never again. */
import { api, get, post, put } from './client';

export interface SecondFactorStatus {
  enabled: boolean;
  enabled_at: string | null;
  last_used_at: string | null;
  policy: 'optional' | 'admins';
}

export interface Enrolment {
  /** Base32, for typing into the authenticator app by hand. */
  secret: string;
  otpauth_uri: string;
  issuer: string;
}

export interface FactorUsers {
  policy: 'optional' | 'admins';
  users: { user_id: string; enabled_at: string | null; last_used_at: string | null }[];
}

export const secondFactorStatus = () => get<SecondFactorStatus>('auth/second-factor');
export const startEnrolment = () => post<Enrolment>('auth/second-factor/enroll');
export const confirmEnrolment = (code: string) => post<SecondFactorStatus>('auth/second-factor/confirm', { code });
export const disableSecondFactor = (code: string) => post<SecondFactorStatus>('auth/second-factor/disable', { code });
export const factorUsers = () => get<FactorUsers>('auth/second-factor/users');
/** An administrator who has a factor sends their own current code (security review 2.2.0 M1); never their own user id (that is `disable`). */
export const resetFactor = (userId: string, ownCode?: string) =>
  api<{ user_id: string; removed: boolean }>(`auth/second-factor/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    ...(ownCode ? { headers: { 'X-Arx-Second-Factor': ownCode } } : {}),
  });

/** TFA2: per-user and per-role override on top of the global policy (inherit = no stored row). system.configure. */
export type FactorOverride = 'inherit' | 'optional' | 'required';
export interface FactorOverrides {
  policy: 'optional' | 'admins';
  user: Record<string, 'optional' | 'required'>;
  role: Record<string, 'optional' | 'required'>;
}
export const factorOverrides = () => get<FactorOverrides>('auth/second-factor/overrides');
export const setFactorOverride = (kind: 'user' | 'role', subjectId: string, policy: FactorOverride) =>
  put<FactorOverrides & { kind: string; subject_id: string }>(`auth/second-factor/overrides/${kind}/${encodeURIComponent(subjectId)}`, { policy });
