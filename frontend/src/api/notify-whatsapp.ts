/**
 * NOTIFWA: the ONLY module of the frontend that talks to the WhatsApp notification channel's routes (smplwise_vms/backend/smplwise/
 * routers/notify_whatsapp.py): the master switch (OFF by default), the per-user hourly cap, the de-duplication window, the mapped account,
 * the own-number test and the caller's own opt-out. No route takes a phone number and no answer carries one (`····NN` at most, the
 * caller's own). Without a backend (static preview, design review) the in-memory demo store below answers (fake data only).
 */
import { ApiError, get, post, put } from './client';
import { isApi } from './session';

export interface WaNotifyView {
  enabled: boolean;
  per_user_hour: number;
  dedupe_min: number;
  revision: number;
  ranges: { per_user_hour: [number, number]; dedupe_min: [number, number] };
  account: { mapped: boolean; label: string | null; state: 'connected' | 'disconnected' | 'unknown' | 'missing' | null };
  /** how many active users have a number with consent - a count, never names */
  reachable_users: number;
  accounts_href: string;
  test: { own_number: boolean; masked: string | null };
}
export interface WaNotifyPut { enabled?: boolean; per_user_hour?: number; dedupe_min?: number; revision: number }
export interface WaTestResult { ok: boolean; outcome: 'sent' | 'refused' | 'unknown' | 'not_sent'; code: string | null }
export interface WaMine { channel_enabled: boolean; has_number: boolean; masked: string | null; source: string | null; consent: 'granted' | 'declined' | null; opted_out: boolean }

export interface WaNotifyAdapter {
  view(): Promise<WaNotifyView>;
  save(body: WaNotifyPut): Promise<WaNotifyView>;
  test(): Promise<WaTestResult>;
  mine(): Promise<WaMine>;
  setOptOut(opted_out: boolean): Promise<WaMine>;
}

const http: WaNotifyAdapter = {
  view: () => get<WaNotifyView>('notify/whatsapp'),
  save: (body) => put<WaNotifyView>('notify/whatsapp', body),
  test: () => post<WaTestResult>('notify/whatsapp/test'),
  mine: () => get<WaMine>('me/notify-whatsapp'),
  setOptOut: (opted_out) => put<WaMine>('me/notify-whatsapp', { opted_out }),
};

/** The demo store: the switch starts OFF like the server; the account is mapped so the section can be reviewed in every state. */
export function demoWaNotify(): WaNotifyAdapter {
  let v: WaNotifyView = {
    enabled: false, per_user_hour: 4, dedupe_min: 30, revision: 0, ranges: { per_user_hour: [1, 30], dedupe_min: [0, 1440] },
    account: { mapped: true, label: 'וואטסאפ ····0191', state: 'connected' }, reachable_users: 3, accounts_href: '#/system/messaging-accounts',
    test: { own_number: true, masked: '····91' },
  };
  let mine: WaMine = { channel_enabled: false, has_number: true, masked: '····91', source: 'directory', consent: 'granted', opted_out: false };
  let tests = 0;
  const err = (status: number, code: string, user_message: string) => new ApiError(status, { code, user_message, retryable: status === 429, correlation_id: 'demo', details: {} });
  return {
    view: async () => structuredClone(v),
    save: async (body) => {
      if (body.revision !== v.revision) throw err(412, 'settings_conflict', 'ההגדרות השתנו בינתיים; טען מחדש.');
      const [ulo, uhi] = v.ranges.per_user_hour;
      const [dlo, dhi] = v.ranges.dedupe_min;
      if (body.per_user_hour !== undefined && (body.per_user_hour < ulo || body.per_user_hour > uhi)) throw err(422, 'validation', 'ערך מספרי מחוץ לטווח.');
      if (body.dedupe_min !== undefined && (body.dedupe_min < dlo || body.dedupe_min > dhi)) throw err(422, 'validation', 'ערך מספרי מחוץ לטווח.');
      v = { ...v, ...('enabled' in body ? { enabled: !!body.enabled } : {}), ...(body.per_user_hour !== undefined ? { per_user_hour: body.per_user_hour } : {}),
        ...(body.dedupe_min !== undefined ? { dedupe_min: body.dedupe_min } : {}), revision: v.revision + 1 };
      mine = { ...mine, channel_enabled: v.enabled };
      return structuredClone(v);
    },
    test: async () => {
      if (!v.account.mapped) throw err(409, 'channel_unavailable', 'לא נבחר חשבון וואטסאפ להתראות.');
      if (++tests > 3) throw err(429, 'rate_limited', 'יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר.');
      return { ok: true, outcome: 'sent', code: null };
    },
    mine: async () => ({ ...mine }),
    setOptOut: async (opted_out) => (mine = { ...mine, opted_out }),
  };
}

let demo: WaNotifyAdapter | null = null;
export const waNotify = (): WaNotifyAdapter => (isApi() ? http : (demo ??= demoWaNotify()));
