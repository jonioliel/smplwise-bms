/** CR-008 P2: the remote sign-ins (SmplWise Arx sessions) - one's own, or everyone's for a system administrator. */
import { api, get } from './client';

export interface RemoteSession {
  /** A hash of the sign-in (never the cookie value); what the revoke endpoint takes. */
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  created_at: string;
  last_seen_at: string;
  /** The last address, masked to /24 (IPv4) or /48 (IPv6). */
  address: string;
  /** Cloudflare's country code for the last request, when the tunnel sent one. */
  country: string | null;
  /** "Chrome · Android"-style family; never the full user agent. */
  agent: string;
  /** cookie = a browser (the Arx session), bearer = a client that sends its token on every request. */
  channel: 'cookie' | 'bearer';
  /** The sign-in this very page runs under (remote channel only). */
  current: boolean;
  live_streams: number;
}

export interface RemoteSessionsList {
  scope: 'own' | 'all';
  can_manage: boolean;
  channel: 'remote' | 'local';
  sessions: RemoteSession[];
}

export interface RevokeResult {
  sessions_ended: number;
  ha_sign_ins_ended: number;
  current_ended: boolean;
}

export const listRemoteSessions = (scope: 'own' | 'all' = 'own') => get<RemoteSessionsList>(`auth/sessions?scope=${scope}`);
export const revokeRemoteSession = (id: string) => api<RevokeResult>(`auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
/** Own: "sign out everywhere". With a user id (system administrators): every sign-in of that user. */
export const revokeAllRemoteSessions = (userId?: string) =>
  api<RevokeResult>(`auth/sessions${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, { method: 'DELETE' });

const COUNTRY = new Intl.DisplayNames(['he'], { type: 'region' });

/** "ישראל · 203.0.113.0/24" - the country when the tunnel sent one, the masked address otherwise. */
export function whereLabel(s: Pick<RemoteSession, 'country' | 'address'>): string {
  let country = '';
  if (s.country && /^[A-Z]{2}$/.test(s.country)) {
    try {
      country = COUNTRY.of(s.country) ?? s.country;
    } catch {
      country = s.country;
    }
  }
  return [country, s.address].filter(Boolean).join(' · ') || 'כתובת לא ידועה';
}

export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 2) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
