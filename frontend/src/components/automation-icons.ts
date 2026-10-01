import { svg, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { Block } from '../api/automations';

/**
 * CR-017: the stroke icons of the automations area (24x24, stroke 1.8, round caps; the same family as components/media-icons.ts).
 * `aIcon('bolt')` returns an inline <svg class="ic"> whose size is the `font-size` of the place it sits in (styles/media-glass.ts).
 * `blockIcon(block)` picks the pictogram of one block of an automation (trigger, condition, action) from its type and entities.
 */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronBack: '<path d="m15 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  lockOpen: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.9M6.5 7.6A16.8 16.8 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.5-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9L6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  warning: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3 8.2 7.5 9.5 4.5-1.3 7.5-4.9 7.5-9.5V6z"/><path d="M12 8.5v4M12 15.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 6.2-.6M5 12.5a10 10 0 0 1 4-2.3M16.5 10.5a10 10 0 0 1 2.5 2M2 9a15 15 0 0 1 5-3M11 5.1A15 15 0 0 1 22 9"/><path d="M12 19.5h.01"/>',
  bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9.5 2.5h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  sunset: '<path d="M12 9V3M5.6 11.6 4.2 10.2M18.4 11.6l1.4-1.4M3 17h3M18 17h3"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M4 21h16"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-5"/>',
  power: '<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6-2-3 1.5-4 3.5 1.5 2.5 3M11.5 15l3 2v4"/>',
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><path d="M14 12h.01"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5 5"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  cover: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M4 14h16"/>',
  tv: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  siren: '<path d="M7 19v-6a5 5 0 0 1 10 0v6"/><path d="M5 19h14M12 3v2M4.5 6.5 6 8M19.5 6.5 18 8"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C12 6 14 3.5 16 4.5s1 4.5-2.3 6M13.8 12.9c3.6 2.1 4.2 4.8 2.6 6s-4.4-.6-5-4M10.2 12.9c-3.6 2.1-6.3 1.4-6.4-.6s2.6-3.4 6.4-1.9"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  script: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
  repeat: '<path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/>',
  branch: '<path d="M6 3v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9c0 4-6 3-12 6"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5 10.5 19"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
} as const;

export type AutomationIconName = keyof typeof ICONS;

/** An inline icon; its size is the `font-size` of the place it sits in (or `size` px). */
export function aIcon(name: AutomationIconName, size?: number, cls = ''): TemplateResult {
  // the path strings above are static, trusted markup of this file (never user data), hence unsafeSVG
  return svg`<svg class=${cls ? `ic ${cls}` : 'ic'} viewBox="0 0 24 24" aria-hidden="true" style=${size ? `font-size:${size}px` : ''}>${unsafeSVG(ICONS[name])}</svg>`;
}

const DOMAIN_ICON: Record<string, AutomationIconName> = {
  light: 'bulb', switch: 'power', climate: 'thermo', cover: 'cover', fan: 'fan', media_player: 'tv', lock: 'lock', alarm_control_panel: 'shield', siren: 'siren',
  person: 'users', zone: 'home', scene: 'sparkle', script: 'script', notify: 'bell', automation: 'bolt', sun: 'sunset', sensor: 'gauge', input_boolean: 'power',
};
/** The pictogram of an entity id / service by its domain (and a hint from the name: motion, door, leak). */
export function domainIcon(idOrService: string): AutomationIconName {
  const domain = idOrService.split('.')[0];
  if (domain === 'binary_sensor') return /motion|occupancy|presence/.test(idOrService) ? 'walk' : /door|window/.test(idOrService) ? 'door' : /leak|water/.test(idOrService) ? 'drop' : 'bolt';
  return DOMAIN_ICON[domain] ?? 'bolt';
}

/** One block of an automation (trigger / condition / action): its pictogram. Locked blocks carry the padlock. */
export function blockIcon(b: Block): AutomationIconName {
  if (b.kind === 'locked') return 'lock';
  const t = b as { type: string; entity_ids?: string[]; action?: string };
  switch (t.type) {
    case 'time': return 'clock';
    case 'time_pattern': return 'timer';
    case 'sun': return 'sunset';
    case 'numeric_state': return 'gauge';
    case 'homeassistant': return 'power';
    case 'trigger': return 'bolt';
    case 'shabbat': return 'star';
    case 'and': case 'or': case 'not': case 'choose': case 'if': return 'branch';
    case 'delay': return 'timer';
    case 'repeat_count': return 'repeat';
    case 'condition': return 'help';
    case 'stop': return 'stop';
    case 'service': return domainIcon(t.action ?? t.entity_ids?.[0] ?? '');
    case 'state': return domainIcon(t.entity_ids?.[0] ?? '');
    default: return 'bolt';
  }
}
