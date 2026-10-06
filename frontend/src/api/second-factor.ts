/** K11: the optional TOTP second factor (routes/second_factor.py). The secret is shown once, at enrolment, and never again. */
import { api, get, post } from './client';

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
export const resetFactor = (userId: string) => api<{ user_id: string; removed: boolean }>(`auth/second-factor/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
