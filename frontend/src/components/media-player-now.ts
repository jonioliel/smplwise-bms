/**
 * CR-016: what a player's card draws for its "now" - pure (no DOM, no Lit), so the card, the groups page's rows and the specs
 * share ONE reading of `PlayerLive`. Our own hues and neutral glyphs, or the proxied content art: never a brand colour or logo.
 * The screens' counterpart is ./media-now.ts.
 */
import { isPlaying, interpolatePosition, playerStateText, type PlayerDevice } from '../api/media-players';
import { hhmm, hueRgb } from './media-now';

export interface PlayerView {
  /** `un` unavailable, `off`, `rcv` a receiver that is on (its source tile), `idle` on with nothing playing, `music`, `station`. */
  kind: 'un' | 'off' | 'rcv' | 'idle' | 'music' | 'station';
  /** The title line ("Blue in Green") - empty for a member (it plays with its leader) and for anything not playing. */
  title: string;
  /** The artist ("Miles Davis"); empty for a station and for a member. */
  sub: string;
  glyph: string;
  /** The receiver tile's source name. */
  tile: string;
  a1: string;
  a2: string;
  /** "r g b" of the glow, null = no glow. */
  rgb: string | null;
  artwork: string | null;
  /** 0-1, null = no bar (stations, unknown position). */
  prog: number | null;
  playing: boolean;
  paused: boolean;
  /** The card's state line without the room: "מנגן", "מושהה", "מנגן עם סלון", "כבוי", "לא זמין מאז 11:20"... */
  line: string;
}

const tint = (hue: number) => ({ a1: `hsl(${hue} 55% 22%)`, a2: `hsl(${hue} 60% 52%)`, rgb: hueRgb(hue) });

/** The "מנגן עם סלון" label of a member: its leader's room (or name); a group's own name when the leader is not known here. */
export function leaderName(d: Pick<PlayerDevice, 'live'>, leader: Pick<PlayerDevice, 'name' | 'area_name'> | null | undefined): string | null {
  if (d.live.group.role !== 'member') return null;
  if (leader) return leader.area_name || leader.name;
  return d.live.group.name;
}

export function playerView(d: PlayerDevice, leader?: PlayerDevice | null, now: number = Date.now()): PlayerView {
  const l = d.live;
  const n = l.now;
  const base: PlayerView = { kind: 'idle', title: '', sub: '', glyph: d.kind === 'player' ? 'media' : 'speaker', tile: '', a1: '#111827', a2: '#3f4a5c', rgb: null, artwork: null, prog: null, playing: false, paused: false, line: '' };
  if (l.power === 'unavailable' || l.power === 'unknown') {
    return { ...base, kind: 'un', glyph: 'wifiOff', line: l.power === 'unknown' ? 'מצב לא ידוע' : l.since ? `לא זמין מאז ${hhmm(l.since)}` : 'לא זמין' };
  }
  if (l.power === 'off' || l.power === 'standby') return { ...base, kind: 'off', glyph: 'power', line: playerStateText(d) };
  if (d.kind === 'receiver') {
    const tile = (n.label || '').split(' · ')[0] || 'מגבר';
    const line = [n.label, l.sound_output].filter(Boolean).join(' · ') || 'דולק';
    return { ...base, kind: 'rcv', glyph: n.glyph || 'hdmi', tile, line };
  }
  const playing = isPlaying(d);
  const paused = l.power === 'on' && l.play === 'paused';
  const member = l.group.role === 'member';
  const line = playerStateText(d, { leaderLabel: leaderName(d, leader) ?? undefined });
  if (!(playing || paused) || n.kind === 'none') return { ...base, kind: 'idle', line };
  const station = n.kind === 'station';
  const pos = station ? null : interpolatePosition(n, playing, now);
  return {
    ...base, kind: station ? 'station' : 'music', glyph: n.glyph || (station ? 'antenna' : 'music'), ...tint(n.hue ?? 210),
    title: member ? '' : n.title ?? '', sub: member || station ? '' : n.artist ?? '',
    artwork: n.artwork, prog: pos !== null && n.duration_s ? pos / n.duration_s : null, playing, paused, line,
  };
}
