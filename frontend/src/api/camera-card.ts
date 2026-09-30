/**
 * The camera card of the area screens (owner 2026-09-30): the card's source, what the server resolves it to for this
 * caller, the cameras the picker may offer, and the shared live-stream budget of the cards on one screen.
 *
 * Nothing here opens a stream: the live player (components/sw-live-player.ts) does, through the relay of
 * routers/media.py, and the server authorizes, caps and audits it. The budget only decides WHICH cards hold a slot,
 * with the arithmetic of the camera wall (api/live-budget.ts).
 */
import { apiUrl, get } from './client';
import { RELEASE_MS, REFUSED_MS, allocateLive, effectiveLiveCap, sameSet } from './live-budget';
import type { ProductSettings } from './media';
import type { Me } from './types';
import { remoteVideo } from './video-policy';

/** A card's source: an NVR channel of the camera catalogue, or a Home Assistant camera entity. */
export type CameraSource = { kind: 'nvr'; recorder_id: string; channel: number } | { kind: 'ha'; entity_id: string };

export type CameraCardState = 'live' | 'still_only' | 'forbidden' | 'missing' | 'disabled';

/** `GET /devices/camera-card/resolve`: one card's source for THIS caller. `forbidden` names nothing else. */
export interface CameraResolved {
  state: CameraCardState;
  kind?: 'nvr' | 'ha';
  camera_id?: string;
  recorder_id?: string;
  channel?: number;
  name?: string;
  status?: 'online' | 'offline' | 'unknown';
  encoding?: import('./types').CameraEncoding | null;
  entity_id?: string;
  /** A Home Assistant entity that is one NVR channel: which of the channel's two streams the entity is (a hint only). */
  profile_hint?: 'main' | 'sub';
}

export interface PickerNvrCamera {
  recorder_id: string;
  channel: number;
  camera_id: string;
  name: string;
  status: 'online' | 'offline' | 'unknown';
  entity_id: string | null;
}

export interface PickerRecorder {
  recorder_id: string;
  name: string;
  cameras: PickerNvrCamera[];
}

export interface PickerHaCamera {
  entity_id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  /** `live`: one of the NVR's own channels (streams as that channel); `still_only`: a picture only. */
  mode: 'live' | 'still_only';
  recorder_id: string | null;
  channel: number | null;
}

export interface CameraSources {
  recorders: PickerRecorder[];
  ha_cameras: PickerHaCamera[];
}

const BASE = 'devices/camera-card';

export function resolveQuery(source: CameraSource): string {
  return source.kind === 'nvr'
    ? `kind=nvr&recorder_id=${encodeURIComponent(source.recorder_id)}&channel=${source.channel}`
    : `kind=ha&entity_id=${encodeURIComponent(source.entity_id)}`;
}

export const resolveCameraSource = (source: CameraSource) => get<CameraResolved>(`${BASE}/resolve?${resolveQuery(source)}`);
export const cameraSources = () => get<CameraSources>(`${BASE}/sources`);

/** A Home Assistant camera that is not an NVR channel: its still picture (`bust` forces the browser past its cache;
 * the server keeps its own window of at least 10 s). */
export function stillUrl(entityId: string, bust?: number): string {
  return apiUrl(`${BASE}/still?entity_id=${encodeURIComponent(entityId)}${bust ? `&t=${bust}` : ''}`);
}

/** Whether a value read from a layout is a usable source (the server validates it again on every write). */
export function isCameraSource(v: unknown): v is CameraSource {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (s.kind === 'nvr') return typeof s.recorder_id === 'string' && !!s.recorder_id && Number.isInteger(s.channel) && (s.channel as number) >= 1 && (s.channel as number) <= 256;
  if (s.kind === 'ha') return typeof s.entity_id === 'string' && /^camera\.[A-Za-z0-9_]{1,200}$/.test(s.entity_id);
  return false;
}

export function sameSource(a: CameraSource | null | undefined, b: CameraSource | null | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return !a && !b;
  return a.kind === 'nvr' ? a.recorder_id === (b as typeof a).recorder_id && a.channel === (b as typeof a).channel : a.entity_id === (b as typeof a).entity_id;
}

// ------------------------------------------------------------------------------------------------ the live budget

/** The stream the wall (and so a card) plays by default: this channel's setting - `remote.wall_profile` on the remote channel,
 * `media.wall_profile` on LAN / Ingress (the same rule as screens/live-wall.ts). */
export function wallProfileOf(settings: ProductSettings | null, me?: Me | null): 'sub' | 'main' {
  if (remoteVideo(me)) return settings?.['remote.wall_profile'] === 'main' ? 'main' : 'sub';
  return settings?.['media.wall_profile'] === 'main' ? 'main' : 'sub';
}

/** The live-stream budget of this channel: the installation's `media.max_live_sessions`, and on the remote channel also
 * the sign-in's `remote.max_live_streams` (whichever is smaller). */
export function liveCapOf(settings: ProductSettings | null, me?: Me | null): number {
  const remoteCap = remoteVideo(me) ? Number(settings?.['remote.max_live_streams'] ?? 16) : null;
  return effectiveLiveCap(Number(settings?.['media.max_live_sessions'] ?? 16), remoteCap);
}

/** A card's own stream quality (owner 2026-09-30, stored in the layout item as `profile`): auto = today's rule below. */
export type CardQuality = 'auto' | 'sub' | 'main';
export const CARD_QUALITIES: CardQuality[] = ['auto', 'sub', 'main'];
export const CARD_QUALITY_LABEL: Record<CardQuality, string> = { auto: 'אוטומטי', sub: 'משני', main: 'ראשי' };

export function isCardQuality(v: unknown): v is CardQuality {
  return v === 'auto' || v === 'sub' || v === 'main';
}

/** The profile a card plays: its own choice when it made one (`sub` / `main`, at any size); otherwise (auto, or none - an
 * older layout) a large card plays the main stream, else the installation's wall profile (this channel's). */
export function cardProfile(size: 's' | 'm' | 'l', wallProfile: 'sub' | 'main', quality: CardQuality | null | undefined = 'auto'): 'sub' | 'main' {
  if (quality === 'sub' || quality === 'main') return quality;
  return size === 'l' ? 'main' : wallProfile;
}

/**
 * The live streams of the camera cards on one screen. A card asks for a slot while it is in view (with a card of margin)
 * and the tab is visible; it keeps its slot RELEASE_MS after it stops asking (a quick scroll back does not reconnect); the
 * free slots go to the cards that ask, in the order they registered. A card the server refused for the remote cap sits out
 * REFUSED_MS as a snapshot and the working budget drops to what really streams (the wall's rule, screens/live-wall.ts).
 * One instance per screen (module singleton below); pure state + a listener per card, timers injected for the unit spec.
 */
export class CardLiveBudget {
  private order: string[] = [];
  private wanted = new Set<string>();
  private live: ReadonlySet<string> = new Set();
  private listeners = new Map<string, (live: boolean) => void>();
  private grace = new Map<string, ReturnType<typeof setTimeout>>();
  private refused = new Map<string, ReturnType<typeof setTimeout>>();
  private ceiling: number | undefined;
  cap = 16;

  constructor(private timers: { set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; clear: (t: ReturnType<typeof setTimeout>) => void } = { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t) }) {}

  /** A card joins; `onChange(true)` = it may stream now, `onChange(false)` = it must let go. */
  register(id: string, onChange: (live: boolean) => void): void {
    if (!this.listeners.has(id)) this.order.push(id);
    this.listeners.set(id, onChange);
    onChange(this.live.has(id));
  }

  unregister(id: string): void {
    this.order = this.order.filter((x) => x !== id);
    this.listeners.delete(id);
    this.wanted.delete(id);
    for (const map of [this.grace, this.refused]) {
      const t = map.get(id);
      if (t !== undefined) this.timers.clear(t);
      map.delete(id);
    }
    this.reallocate();
  }

  /** The installation / remote cap for this screen (api/live-budget.ts effectiveLiveCap). */
  setCap(cap: number): void {
    if (cap === this.cap) return;
    this.cap = cap;
    this.reallocate();
  }

  /** A card is in view and the tab is visible (true), or is not (false: released after RELEASE_MS). */
  setVisible(id: string, visible: boolean): void {
    const timer = this.grace.get(id);
    if (visible) {
      if (timer !== undefined) this.timers.clear(timer);
      this.grace.delete(id);
      this.wanted.add(id);
    } else if (this.wanted.has(id) && timer === undefined) {
      this.grace.set(
        id,
        this.timers.set(() => {
          this.grace.delete(id);
          this.wanted.delete(id);
          this.reallocate();
        }, RELEASE_MS),
      );
    }
    this.reallocate();
  }

  /** The card lets go now, without the grace (it opens its own bigger view: one stream, not two). */
  drop(id: string): void {
    const timer = this.grace.get(id);
    if (timer !== undefined) this.timers.clear(timer);
    this.grace.delete(id);
    this.wanted.delete(id);
    this.reallocate();
  }

  /** The relay refused this card's stream for the remote cap (player-status code `remote_live_cap`). */
  refuse(id: string): void {
    if (this.refused.has(id)) return;
    this.ceiling = Math.min(this.ceiling ?? Infinity, Math.max(1, this.live.size - (this.live.has(id) ? 1 : 0)));
    this.refused.set(
      id,
      this.timers.set(() => {
        this.refused.delete(id);
        if (!this.refused.size) this.ceiling = undefined; // try the full budget again
        this.reallocate();
      }, REFUSED_MS),
    );
    this.reallocate();
  }

  has(id: string): boolean {
    return this.live.has(id);
  }

  get size(): number {
    return this.live.size;
  }

  private reallocate(): void {
    const cap = Math.min(this.cap, this.ceiling ?? this.cap);
    const wanted = new Set([...this.wanted].filter((id) => !this.refused.has(id) && this.listeners.has(id)));
    const next = allocateLive(this.order, wanted, this.live, cap);
    if (sameSet(next, this.live)) return;
    const prev = this.live;
    this.live = next;
    for (const id of this.order) if (prev.has(id) !== next.has(id)) this.listeners.get(id)?.(next.has(id));
  }
}

/** The camera cards of the screen share this budget. */
export const cardBudget = new CardLiveBudget();
