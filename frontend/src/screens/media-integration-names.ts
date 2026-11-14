/**
 * Friendly names of the integrations a media device comes from (0.1.164, board MS3). The settings lists of the multimedia screens show the
 * registry platform of each device (a raw domain id such as `samsungtv_smart` or `cast`); this table is the ONE place that turns the common ids
 * into names a person recognises. An id that is not in the table is shown exactly as it is (never guessed, never dropped). Settings screens only:
 * the operator screens show no integration at all. Pure and tested: tests/unit-media-integration-names.spec.ts.
 */
import { tr } from '../i18n/msg/media';

/** The platform id -> the name shown in the settings lists. Brand names stay in Latin script; the device kind is added in Hebrew where the brand alone is ambiguous. */
export const INTEGRATION_NAMES: Readonly<Record<string, string>> = {
  // speakers, players, music servers
  sonos: 'Sonos',
  spotify: 'Spotify',
  spotifyplus: 'Spotify',
  music_assistant: 'Music Assistant',
  squeezebox: 'Squeezebox (Lyrion)',
  slimproto: 'Squeezebox (Slimproto)',
  heos: 'Denon HEOS',
  bluesound: 'Bluesound',
  yamaha_musiccast: 'Yamaha MusicCast',
  mpd: 'Music Player Daemon (MPD)',
  forked_daapd: 'OwnTone (forked-daapd)',
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  emby: 'Emby',
  kodi: 'Kodi',
  // casting and streaming boxes
  cast: 'Google Cast (Chromecast)',
  apple_tv: 'Apple TV',
  roku: 'Roku',
  androidtv: 'Android TV (ADB)',
  androidtv_remote: 'Android TV',
  // television makers
  samsungtv: tr('Samsung (טלוויזיה)'),
  samsungtv_smart: tr('Samsung (טלוויזיה, Smart)'),
  webostv: tr('LG webOS (טלוויזיה)'),
  philips_js: tr('Philips (טלוויזיה)'),
  braviatv: tr('Sony Bravia (טלוויזיה)'),
  bravia: tr('Sony Bravia (טלוויזיה)'),
  vizio: tr('Vizio (טלוויזיה)'),
  // receivers and amplifiers
  denonavr: tr('Denon / Marantz (מגבר)'),
  onkyo: tr('Onkyo (מגבר)'),
  yamaha: tr('Yamaha (מגבר)'),
  // generic protocols and helpers
  dlna_dmr: tr('DLNA (נגן)'),
  dlna_dms: tr('DLNA (שרת מדיה)'),
  upnp: 'UPnP',
  universal: tr('נגן מורכב (Universal)'),
  group: tr('קבוצה'),
  esphome: 'ESPHome',
  mqtt: 'MQTT',
  homekit_controller: 'HomeKit',
};

/**
 * The name to show for one platform id: the table entry, or the raw id when the id is not in the table. The lookup ignores case and
 * surrounding blanks; the fallback returns the id as it was given (trimmed only when it is a non-empty string). An empty or non-string
 * value yields an empty string, never a crash.
 */
export function integrationName(id: string | null | undefined): string {
  if (typeof id !== 'string') return '';
  const raw = id.trim();
  if (!raw) return '';
  return Object.prototype.hasOwnProperty.call(INTEGRATION_NAMES, raw.toLowerCase()) ? INTEGRATION_NAMES[raw.toLowerCase()] : raw;
}

/** True when the id has a friendly name in the table (a row can then show the raw id as a tooltip). */
export function hasIntegrationName(id: string | null | undefined): boolean {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(INTEGRATION_NAMES, id.trim().toLowerCase());
}

/** The hover text of an integration: the friendly name and the raw id behind it when they differ ("Sonos (sonos)"), else the raw id alone. */
export function integrationTitle(id: string): string {
  const name = integrationName(id);
  return name && name !== id.trim() ? `${name} (${id.trim()})` : id;
}
