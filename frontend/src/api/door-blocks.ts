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
import type * as Wire from './generated/wire-doors';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/doors.py), generated into
 * ./generated/wire-doors.ts (code review 07:F8 step 2). Narrowed on purpose: an item's `kind` to the saved-item kinds. */
export type BlockState = Wire.DoorBlockEntity['state'];

/** One entity: `door` = mapped to an intercom door, never released here; `stale` = a release whose entity is gone (or no longer
 * blocked), listed so it can be taken back; `override` = who released it (the name, the id when no name was known), when (UTC) and why;
 * `used_by` = names of the saved items that use it (alphabetical, a few), `used_more` how many more there are. */
export type DoorBlockEntity = Wire.DoorBlockEntity;

export type DoorBlockDevice = Wire.DoorBlockDevice;

/** One saved item the door path refuses: `blocked` = still refused now (after the releases; false: only released devices stood in its
 * way); `opens_door` = a real WisKey door step (stays refused whatever is released); `guard` / `why` / `reasons` are the server's Hebrew. */
export interface DoorBlockItem extends Omit<Wire.DoorBlockItem, 'kind'> {
  kind: 'automation' | 'script' | 'scene' | 'schedule' | 'launcher';
}

export type DoorBlocks = Omit<Wire.DoorBlocks, 'items'> & { items: DoorBlockItem[] };

export type EntityBlockReply = Wire.DoorEntityBlock;

export const getDoorBlocks = () => get<DoorBlocks>('doors/blocks');

/** Release (`unblocked: true`, a note saying why is required) or block again (`unblocked: false`, a note is optional). The caller's
 * confirmation step has already happened - the server refuses a write without `confirmed: true`. */
export const setEntityBlock = (entityId: string, unblocked: boolean, note?: string) =>
  put<EntityBlockReply>(`doors/blocks/entities/${encodeURIComponent(entityId)}`, { unblocked, ...(note ? { note } : {}), confirmed: true });
