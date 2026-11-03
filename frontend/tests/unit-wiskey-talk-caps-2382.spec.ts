import { test, expect } from '@playwright/test';
import {
  CAPS_REASON_KINDS,
  READINESS_CODES,
  TALK_REASONS,
  capsReasonKind,
  dialState,
  readinessSummary,
  type StationMedia,
  type StationMediaReadiness,
} from '../src/api/station-media';
import { enStationMediaText, fill, heStationMediaText } from '../src/i18n/wiskey-station-media';

// WISKEY-TALK-CAPS-2382: the pure parts of the signed-capabilities source - the new readiness code `capabilities_unread` and talk reason, the
// grouped reason of a failed signed read, and that every new word exists in both languages without naming the platform in the drawer.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-talk-caps-2382.spec.ts

const caps = (over: Partial<NonNullable<StationMediaReadiness['wiskey']['capabilities']>> = {}) => ({
  state: 'read' as const,
  video_listed: true,
  talk_listed: true,
  reason: null,
  reason_kind: null,
  source: 'read' as const,
  read_at: '2026-11-03T20:00:00Z',
  ...over,
});

const ready = (over: Partial<StationMediaReadiness> = {}): StationMediaReadiness => ({
  choice: 'auto',
  active: 'wiskey',
  mode: 'video_talk',
  wiskey: { reachable: true, video_listed: true, talk_listed: true, signing: true, listed_in: 'capabilities', capabilities: caps() },
  missing: [],
  video_ready: true,
  talk_ready: true,
  ...over,
});

const media = (reason: string): StationMedia => ({
  station_id: 'gate',
  mode: 'video_talk',
  state: 'ready',
  reason: null,
  video: null,
  talk: { available: false, reason },
  listen: false,
  expires_at: null,
});

test('W10 listed only in the signed capabilities reads as ready', () => {
  expect(readinessSummary(ready())).toEqual({ state: 'ok', codes: [] });
});

test('a failed signed read is its own code, in the server order, and names its reason kind', () => {
  expect(READINESS_CODES).toContain('capabilities_unread');
  const unread = ready({
    active: 'local',
    wiskey: { reachable: true, video_listed: false, talk_listed: false, signing: true, listed_in: null, capabilities: caps({ state: 'unread', video_listed: false, talk_listed: false, reason: 'discovery_refused:Unauthorized', reason_kind: 'refused' }) },
    missing: ['capabilities_unread'],
    video_ready: false,
    talk_ready: false,
  });
  expect(readinessSummary(unread)).toEqual({ state: 'missing', codes: ['capabilities_unread'] });
  expect(capsReasonKind(unread)).toBe('refused');
  const he = heStationMediaText.source;
  expect(fill(he.codes.capabilities_unread, { kind: he.capsKinds[capsReasonKind(unread)] })).toBe('בדיקת היכולות החתומה מול WisKey נכשלה (WisKey דחה את החיבור החתום)');
});

test('an unknown or missing reason kind reads as "failed", never as a code', () => {
  expect(capsReasonKind(null)).toBe('failed');
  expect(capsReasonKind(ready({ wiskey: { reachable: true, video_listed: false, talk_listed: false, signing: true } }))).toBe('failed'); // an older server
  expect(capsReasonKind(ready({ wiskey: { ...ready().wiskey, capabilities: caps({ reason_kind: 'brand_new' }) } }))).toBe('failed');
  for (const k of CAPS_REASON_KINDS) expect(capsReasonKind(ready({ wiskey: { ...ready().wiskey, capabilities: caps({ reason_kind: k }) } }))).toBe(k);
});

test('the drawer names capabilities_unread apart from not_listed, without naming the platform', () => {
  expect(TALK_REASONS).toContain('capabilities_unread');
  expect(dialState('video_talk', media('capabilities_unread'))).toEqual({ kind: 'reason', reason: 'capabilities_unread' });
  for (const t of [heStationMediaText, enStationMediaText]) {
    expect(t.dial.reasons.capabilities_unread).toBeTruthy();
    expect(t.dial.reasons.capabilities_unread).not.toBe(t.dial.reasons.not_listed);
    expect(t.dial.reasons.capabilities_unread).not.toMatch(/wiskey|home assistant/i);
    expect(t.source.codes.capabilities_unread).toContain('{kind}');
    for (const k of CAPS_REASON_KINDS) expect(t.source.capsKinds[k], k).toBeTruthy();
  }
});
