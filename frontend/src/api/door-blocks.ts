/**
 * Settings › חיבורים › "חסימות פתיחת דלתות" (WXUNBLK, owner 2026-10-13): what the door path blocks and the one audited switch per
 * entity. Backend routers/doors.py `GET /doors/blocks` (read only) and `PUT /doors/blocks/entities/{entity_id}`; system
 * administrator (`system.configure`), a confirmation on every write, a note (why) required to release.
 *
 * The list has two parts: the ENTITIES (template / universal ones, blocked while a WisKey door exists - released ones say why, who
 * and when) and the saved ITEMS the door path refuses to run or enable (a real WisKey door step stays refused whatever is released).
 * The switch is on the entity only. Entity ids are keys here; the item rows carry names only.
 */
import { get, put } from './client';

export type BlockState = 'blocked' | 'unblocked' | 'door';

export interface DoorBlockOverride {
  note: string;
  /** The administrator's name (the id when no name was known). */
  by: string;
  /** UTC instant. */
  at: string;
}

export interface DoorBlockEntity {
  entity_id: string;
  name: string;
  domain: string;
  platform: string | null;
  area: string | null;
  /** `door`: mapped to an intercom door - never released here. */
  state: BlockState;
  overridable: boolean;
  /** A release whose entity is gone (or no longer blocked): listed so it can be taken back. */
  stale: boolean;
  override: DoorBlockOverride | null;
  /** Names of the saved items that use it (alphabetical, a few) and how many more there are. */
  used_by: string[];
  used_more: number;
}

export interface DoorBlockDevice {
  name: string;
  state: 'blocked' | 'unblocked';
}

export interface DoorBlockItem {
  key: string;
  kind: 'automation' | 'script' | 'scene' | 'schedule' | 'launcher';
  kind_text: string;
  name: string;
  state: string;
  /** Still refused now (after the releases). False: only released devices stood in its way. */
  blocked: boolean;
  /** Has a real WisKey door step: stays refused whatever is released. */
  opens_door: boolean;
  /** The server's Hebrew for what the guard does and, for a door item, why (`why`). */
  guard: string;
  why: string | null;
  /** Why it cannot be resolved (the server's Hebrew, deduplicated). */
  reasons: string[];
  devices: DoorBlockDevice[];
  devices_more: number;
}

export interface DoorBlocks {
  wiskey_present: boolean;
  generated_at: string;
  entities: DoorBlockEntity[];
  items: DoorBlockItem[];
  counts: { entities: number; blocked: number; unblocked: number; items: number; items_blocked: number };
  truncated: boolean;
}

export interface EntityBlockReply {
  entity_id: string;
  state: 'blocked' | 'unblocked';
  override: DoorBlockOverride | null;
  changed: boolean;
}

export const getDoorBlocks = () => get<DoorBlocks>('doors/blocks');

/** Release (`unblocked: true`, a note saying why is required) or block again (`unblocked: false`, a note is optional). The caller's
 * confirmation step has already happened - the server refuses a write without `confirmed: true`. */
export const setEntityBlock = (entityId: string, unblocked: boolean, note?: string) =>
  put<EntityBlockReply>(`doors/blocks/entities/${encodeURIComponent(entityId)}`, { unblocked, ...(note ? { note } : {}), confirmed: true });
