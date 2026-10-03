/**
 * Installation capabilities (NN1 P2, docs/architecture/CAPABILITIES.md): what this installation HAS - derived by the server
 * from its connection settings and sent on `/me` (booleans for every signed-in user). Configured, not reachable: a media
 * server that is down is a health fact and never changes the navigation. Capabilities are not authorization (the server
 * still checks every route); they decide what the shell offers.
 *
 * Without a backend (the static demo) every capability is on. An older backend that sends no `capabilities` block is read
 * through its `mode` (`ha_only` = no NVR), which is what the shell did before this block existed.
 */
export type CapabilityName = 'nvr' | 'go2rtc' | 'ha' | 'live_video' | 'playback' | 'events_recorder' | 'events_ha' | 'ha_cameras_still' | 'ha_cameras_live';

export interface RecorderCaps {
  id: string;
  vendor: string;
  live: boolean;
  playback: boolean;
  events: boolean;
  write_encodings: boolean;
}

export interface Capabilities extends Record<CapabilityName, boolean> {
  /** false (with `unsupported_reason`) when the installation has an NVR but no media server: it never reaches "ready". */
  supported: boolean;
  unsupported_reason: string | null;
  /** Only for callers who may read the NVR configuration. */
  recorders?: RecorderCaps[];
}

export const ALL_CAPABILITIES: Capabilities = {
  nvr: true, go2rtc: true, ha: true, live_video: true, playback: true, events_recorder: true, events_ha: true, ha_cameras_still: true, ha_cameras_live: true,
  supported: true, unsupported_reason: null,
};

/** The capability set of a `/me` answer (see the file header for the two fallbacks). */
export function resolveCapabilities(me: { capabilities?: Partial<Capabilities> | null; mode?: 'full' | 'ha_only' } | null | undefined): Capabilities {
  if (!me) return ALL_CAPABILITIES;
  if (me.capabilities) return { ...ALL_CAPABILITIES, ...me.capabilities };
  if (me.mode === 'ha_only') return { ...ALL_CAPABILITIES, nvr: false, live_video: false, playback: false, events_recorder: false };
  return ALL_CAPABILITIES;
}

/** Operator wording (no infrastructure branding) for the installation that has an NVR but no media server. */
export const UNSUPPORTED_NVR_WITHOUT_GO2RTC = 'התקנה עם NVR אינה נתמכת בלי שרת המדיה (go2rtc): בלעדיו אין וידאו חי ואין ניגון הקלטות.';

/** A notification source that exists only with an NVR (the recorder's own faults, a camera channel that lost its video): the
 * notification matrix does not list it without one. */
export const needsNvrSource = (source: string): boolean => source.startsWith('nvr.') || source === 'camera.offline';
