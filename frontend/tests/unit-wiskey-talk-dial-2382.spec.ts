import { test, expect } from '@playwright/test';
import {
  READINESS_CODES,
  TALK_REASONS,
  dialState,
  parseProvider,
  readinessSummary,
  talkReason,
  type StationMedia,
  type StationMediaReadiness,
} from '../src/api/station-media';
import { enStationMediaText, heStationMediaText } from '../src/i18n/wiskey-station-media';

// WISKEY-TALK-DIAL-2382: the pure parts of "dial the station" and of the media source choice - which dial the drawer offers for a media read,
// every talk reason and readiness code has words in both languages, and the readiness summary of the Settings row.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-talk-dial-2382.spec.ts

const media = (over: Partial<StationMedia> = {}): StationMedia => ({
  station_id: 'gate',
  mode: 'video_talk',
  state: 'ready',
  reason: null,
  video: null,
  talk: { available: true, reason: null },
  listen: false,
  expires_at: null,
  ...over,
});

const ready = (over: Partial<StationMediaReadiness> = {}): StationMediaReadiness => ({
  choice: 'auto',
  active: 'wiskey',
  mode: 'video_talk',
  wiskey: { reachable: true, video_listed: true, talk_listed: true, signing: true },
  missing: [],
  video_ready: true,
  talk_ready: true,
  ...over,
});

test.describe('dial state per media read', () => {
  test('the setting off or nothing read yet: the classic link exactly as before', () => {
    expect(dialState('off', media())).toEqual({ kind: 'legacy' });
    expect(dialState('video_talk', undefined)).toEqual({ kind: 'legacy' });
  });

  test('talk available: Arx dials natively', () => {
    expect(dialState('video_talk', media())).toEqual({ kind: 'native' });
  });

  test('every other answer names its reason - never silent', () => {
    expect(dialState('video_talk', null)).toEqual({ kind: 'reason', reason: 'unavailable' });
    expect(dialState('video_talk', media({ state: 'unavailable', reason: 'offline', talk: null }))).toEqual({ kind: 'reason', reason: 'unavailable' });
    expect(dialState('video', media({ mode: 'video', talk: { available: false, reason: 'off' } }))).toEqual({ kind: 'reason', reason: 'off' });
    for (const r of ['provider_local', 'pairing', 'not_listed', 'unsupported', 'wiskey_unavailable', 'forbidden'] as const) {
      expect(dialState('video_talk', media({ talk: { available: false, reason: r } }))).toEqual({ kind: 'reason', reason: r });
    }
    expect(dialState('video_talk', media({ talk: { available: false, reason: 'something_new' } }))).toEqual({ kind: 'reason', reason: 'unavailable' });
    expect(dialState('video_talk', media({ talk: null }))).toEqual({ kind: 'reason', reason: 'unavailable' });
    expect(talkReason(undefined)).toBe('unavailable');
  });

  test('provider local and "WisKey does not list talk" read differently', () => {
    const he = heStationMediaText.dial.reasons;
    expect(he.provider_local).not.toBe(he.not_listed);
    // owner 04.11 (Q21 "b"): the drawer's "no talk" reasons that describe WisKey itself name it, like the Settings row (an exception to
    // UI_COPY_RULES for exactly these four strings); every other word of the drawer's dial still never names the integration
    expect(he.not_listed).toBe('WisKey לא מפרסם פקודות דיבור ל-Arx');
    expect(heStationMediaText.source.codes.talk_not_listed).toBe('WisKey לא מפרסם פקודות דיבור ל-Arx');
    const NAMED = ['pairing', 'not_listed', 'capabilities_unread', 'wiskey_unavailable'] as const;
    for (const t of [heStationMediaText, enStationMediaText]) {
      for (const r of NAMED) expect(t.dial.reasons[r], r).toMatch(/WisKey/);
      const rest = Object.entries(t.dial.reasons).filter(([k]) => !(NAMED as readonly string[]).includes(k)).map(([, v]) => v);
      expect(JSON.stringify([t.dial.dial, t.dial.talk, t.dial.inCall, t.dial.hangUp, t.dial.classic, ...rest])).not.toMatch(/wiskey/i); // the words, not the keys
      expect(JSON.stringify(t.dial)).not.toMatch(/מערכת האינטרקום|the intercom/i);
    }
    expect(he.unsupported).not.toBe(he.not_listed);
  });
});

test.describe('words for every code', () => {
  test('each talk reason and readiness code has Hebrew and English text, and none names the platform', () => {
    for (const t of [heStationMediaText, enStationMediaText]) {
      for (const r of TALK_REASONS) expect(t.dial.reasons[r], r).toBeTruthy();
      for (const c of READINESS_CODES) expect(t.source.codes[c], c).toBeTruthy();
      expect(JSON.stringify(t)).not.toMatch(/home assistant/i);
    }
    expect(heStationMediaText.dial.dial).toBe('חיוג לעמדה');
    expect(heStationMediaText.source.local).toContain('Arx');
    expect(heStationMediaText.source.auto).toContain('WisKey');
  });
});

test.describe('media source setting and readiness', () => {
  test('the source reads local unless it says auto', () => {
    expect(parseProvider({ 'access.station_media_provider': 'auto' })).toBe('auto');
    for (const v of ['local', 'wiskey', '', null, 1]) expect(parseProvider({ 'access.station_media_provider': v })).toBe('local');
    expect(parseProvider(null)).toBe('local');
  });

  test('the summary: ready, video only, or missing - unknown codes dropped, the server order kept', () => {
    expect(readinessSummary(null)).toBeNull();
    expect(readinessSummary(ready())).toEqual({ state: 'ok', codes: [] });
    expect(readinessSummary(ready({ missing: ['talk_not_listed'], talk_ready: false }))).toEqual({ state: 'partial', codes: ['talk_not_listed'] });
    // the lab case of 03.11 (WisKey 2.0.1-rc.10): neither the video nor the talk commands are listed for Arx
    expect(readinessSummary(ready({ missing: ['video_not_listed', 'talk_not_listed', 'brand_new'], video_ready: false, talk_ready: false }))).toEqual({
      state: 'missing',
      codes: ['video_not_listed', 'talk_not_listed'],
    });
    expect(readinessSummary(ready({ missing: ['pairing_missing'], video_ready: false, talk_ready: false, active: 'local' }))?.state).toBe('missing');
  });
});
