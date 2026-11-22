import { test } from '@playwright/test';
import { playerCommandOffered, type PlayerCommand, type PlayerDevice } from '../src/api/media-players';
import { resetPlayersMock } from '../src/api/media-players-mock';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of playerCommandOffered (api/media-players.ts) before its split. Every device of both mock houses,
// each as it is and in variants (power states, caps unknown / all off / all on, no power or control right, a second zone on / off / absent,
// no duration), x every command (with and without a zone, levels and positions in and out of range, every transport action, item refs);
// the answers must equal the record taken from the unsplit function (tests/fixtures/cx/player-command-offered.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-player-command-offered-2480.spec.ts --workers=1

type Dev = Pick<PlayerDevice, 'live' | 'caps' | 'can' | 'zones'>;
const REF = 'a'.repeat(24);
const COMMANDS: PlayerCommand[] = [
  { command: 'power_on' }, { command: 'power_off' }, { command: 'volume_set', level: 0 }, { command: 'volume_set', level: 100 }, { command: 'volume_set', level: -1 },
  { command: 'volume_set', level: 101 }, { command: 'volume_step', direction: 'up' }, { command: 'mute', muted: true }, { command: 'source', source_id: 's1' },
  { command: 'sound_output', output: 'tv_speaker' }, { command: 'sound_output', output: 'nope' }, { command: 'app', app_id: 'x' }, { command: 'key', key: 'up' as never },
  { command: 'text', text: 'x' }, ...(['play', 'pause', 'play_pause', 'stop', 'next', 'previous'] as const).map((action) => ({ command: 'transport' as const, action })),
  { command: 'seek', position_s: 0 } as never, { command: 'seek', position_s: 30 } as never, { command: 'seek', position_s: -1 } as never, { command: 'seek', position_s: 1e7 } as never,
  { command: 'shuffle', shuffle: true } as never, { command: 'repeat', repeat: 'all' } as never, { command: 'play_item', item_ref: REF } as never, { command: 'play_item', item_ref: 'nope' } as never,
  { command: 'transfer', from_key: 'mp-x' } as never, { command: 'transfer', from_key: '' } as never, { command: 'unknown_thing' } as never,
];
const ZONES = [undefined, 'z1', 'z2', 'z9'];

const allCaps = (c: Dev['caps'], v: boolean): Dev['caps'] => {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(c)) out[k] = typeof x === 'boolean' ? v : x;
  out.transport = Object.fromEntries(Object.keys(c.transport).map((k) => [k, v]));
  out.sound_outputs = v ? ['tv_speaker', 'arc'] : [];
  return out as unknown as Dev['caps'];
};
const zones = (z2: string | null) => (z2 === null ? null : [{ id: 'z1', name: 'ראשי', power: 'on' }, { id: 'z2', name: 'אזור 2', power: z2 }]) as unknown as Dev['zones'];
const variants = (d: Dev): Array<[string, Dev]> => [
  ['as-is', d],
  ...(['on', 'off', 'standby', 'playing', 'unavailable', 'unknown'] as const).map((p): [string, Dev] => [`power-${p}`, { ...d, live: { ...d.live, power: p as never } }]),
  ['caps-unknown', { ...d, live: { ...d.live, caps_known: false } }],
  ['caps-off', { ...d, live: { ...d.live, power: 'on' }, caps: allCaps(d.caps, false) }], ['caps-on', { ...d, live: { ...d.live, power: 'on' }, caps: allCaps(d.caps, true) }],
  ['caps-on-off', { ...d, live: { ...d.live, power: 'off' }, caps: allCaps(d.caps, true) }],
  ['no-power-right', { ...d, live: { ...d.live, power: 'on' }, caps: allCaps(d.caps, true), can: { ...d.can, power: false } }],
  ['no-control-right', { ...d, live: { ...d.live, power: 'on' }, caps: allCaps(d.caps, true), can: { ...d.can, control: false } }],
  ['zone2-on', { ...d, live: { ...d.live, power: 'on' }, caps: allCaps(d.caps, true), zones: zones('on') }],
  ['zone2-off', { ...d, live: { ...d.live, power: 'off' }, caps: allCaps(d.caps, true), zones: zones('off') }],
  ['zones-empty', { ...d, live: { ...d.live, power: 'on' }, caps: allCaps(d.caps, true), zones: [] }],
  ['no-duration', { ...d, live: { ...d.live, power: 'on', now: { ...d.live.now, duration_s: null } }, caps: allCaps(d.caps, true) }],
  ['duration-60', { ...d, live: { ...d.live, power: 'on', now: { ...d.live.now, duration_s: 60 } }, caps: allCaps(d.caps, true) }],
];

test('playerCommandOffered: every answer equals the record of the unsplit function', async () => {
  const out: string[] = [];
  for (const house of ['ma', 'sonos'] as const) {
    const { devices } = await resetPlayersMock(house).list();
    for (const d of devices) {
      for (const [v, dv] of variants(d)) {
        const bits = COMMANDS.flatMap((c) => ZONES.map((zone) => (playerCommandOffered(dv, zone === undefined ? c : { ...c, zone }) ? '1' : '0'))).join('');
        out.push(`${house} ${d.key} ${v}: ${bits}`);
      }
    }
  }
  expectRecorded('player-command-offered', out);
});
