/**
 * CR-015: what a screen's card draws for its "now" - pure (no DOM, no Lit), so the card, the area card (S3) and the unit specs
 * share ONE reading of `MediaLive`. Our own hues and neutral glyphs: never a brand colour or logo.
 */
import type { MediaDevice, NowShowing } from '../api/media-screens';

/** HSL (our own hue) to an "r g b" triplet, the form the `--art` custom property takes (like `--dv-tile-on-*`). */
export function hueRgb(hue: number, s = 0.62, l = 0.52): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)} ${f(8)} ${f(4)}`;
}

/** What the card draws for one screen's "now": the label / sub line, the poster's colours and glyph, the glow colour. */
export interface NowView {
  kind: 'un' | 'off' | 'art' | 'app' | 'tv' | 'src' | 'home' | 'saver' | 'none';
  label: string;
  sub: string;
  glyph: string | null;
  a1: string;
  a2: string;
  rgb: string | null;
  channel: string | null;
  prog: number | null;
  artwork: string | null;
}

export const hhmm = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/** The position of the playing item now: the reported one plus the time since it was reported (only while playing). */
export function positionNow(n: NowShowing, playing: boolean, now = Date.now()): number | null {
  if (n.position_s === null || !n.duration_s) return null;
  const since = playing && n.position_at ? Math.max(0, (now - Date.parse(n.position_at)) / 1000) : 0;
  return Math.min(n.duration_s, n.position_s + (Number.isFinite(since) ? since : 0));
}

/** The one place that turns a device's live state into what the card shows (used by the card; exported for the specs and the
 * area card). Our own hues, neutral glyphs: never a brand colour or logo. */
export function nowView(d: Pick<MediaDevice, 'live'>, now = Date.now()): NowView {
  const l = d.live;
  const base: NowView = { kind: 'none', label: '', sub: '', glyph: null, a1: '#111827', a2: '#3f4a5c', rgb: null, channel: null, prog: null, artwork: null };
  if (l.power === 'unavailable') return { ...base, kind: 'un', label: 'לא זמין', sub: l.since ? `מאז ${hhmm(l.since)}` : '' };
  if (l.power === 'unknown') return { ...base, kind: 'un', label: 'מצב לא ידוע' };
  if (l.power === 'art' || l.now.kind === 'art') return { ...base, kind: 'art', label: 'מצב אמנות', rgb: '214 160 104' };
  if (l.power === 'off' || l.power === 'standby') return { ...base, kind: 'off', label: 'כבוי' };
  const n = l.now;
  const playing = l.play === 'playing';
  const pos = positionNow(n, playing, now);
  const prog = pos !== null && n.duration_s ? pos / n.duration_s : null;
  const artwork = n.artwork;
  const tint = (hue: number) => ({ a1: `hsl(${hue} 55% 22%)`, a2: `hsl(${hue} 60% 52%)`, rgb: hueRgb(hue) });
  if (n.kind === 'app') return { ...base, kind: 'app', label: n.label, sub: n.title ?? '', glyph: n.glyph, ...tint(n.hue ?? 210), prog, artwork };
  if (n.kind === 'channel' || (n.kind === 'source' && n.channel)) {
    return { ...base, kind: 'tv', label: 'טלוויזיה', sub: n.channel ? `ערוץ ${n.channel}` : '', glyph: 'antenna', a1: '#0f172a', a2: '#3b4a66', rgb: '64 118 214', channel: n.channel, artwork };
  }
  if (n.kind === 'source') return { ...base, kind: 'src', label: n.label, sub: n.title ?? '', glyph: n.glyph, rgb: n.hue !== null ? hueRgb(n.hue) : '110 124 150', ...(n.hue !== null ? tint(n.hue) : {}), prog, artwork };
  if (n.kind === 'home') return { ...base, kind: 'home', label: n.label || 'מסך הבית', glyph: 'apps', a1: '#1e1b4b', a2: '#4f46e5', rgb: '79 70 229' };
  if (n.kind === 'saver') return { ...base, kind: 'saver', label: n.label || 'שומר מסך', rgb: '70 92 170' };
  return { ...base, kind: 'none', label: n.label || 'דולק', rgb: '110 124 150' };
}

/** The state line under the name: the room, then what is on (or why nothing is). */
export function stateLine(d: MediaDevice, v: NowView): string {
  const tail = v.kind === 'tv' ? v.sub || v.label : v.label;
  const paused = d.live.power === 'on' && d.live.play === 'paused' && v.kind !== 'un' ? ' · מושהה' : '';
  return [d.area_name, `${tail}${paused}`].filter(Boolean).join(' · ');
}
