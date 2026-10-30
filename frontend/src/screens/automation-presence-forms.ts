import { html, type TemplateResult } from 'lit';
import { newUid, type Block } from '../api/automations';
import { MAX_MINUTES } from '../api/automations-presence';
import { FORMS, type FormCtx } from './automation-block-forms';
import { CONDITION_TYPES, TRIGGER_TYPES, type BlockTypeDef } from './automation-editor-logic';

/**
 * PRESENCE-2280 (mockup round 7, state "cockpit"): the two presence blocks of the automation builder, registered the way automation-block-forms.ts
 * documents it - one entry in `FORMS` and one in the type chooser per schema; the builder itself does not change.
 *
 *   trigger:building_empty    "נוכחות במבנה": the building is empty for N minutes (over the tagged sensors; all of them by default).
 *   condition:room_occupied   "נוכחות במבנה": only if there is / is no presence (the whole building, or the sensors picked).
 *
 * Offered only while the owner switched building presence ON and tagged sensors (the server adds `extension.building_presence`; otherwise absent).
 */
const typed = <T extends object>(b: T): Block => ({ uid: newUid(), kind: 'typed', raw: null, sentence: '', ...b }) as unknown as Block;
const tagged = (e: { catalog: { extension?: { building_presence?: { sensors: string[] } } } }): string[] => e.catalog.extension?.building_presence?.sensors ?? [];

export const BUILDING_EMPTY_TYPE: BlockTypeDef = {
  id: 'building_empty', label: 'נוכחות במבנה', hint: 'מבנה ריק · חדר פעיל', icon: 'users', available: (e) => tagged(e).length > 0,
  make: (e) => typed({ type: 'building_empty', sensors: tagged(e), minutes: 15 }),
};
export const ROOM_OCCUPIED_TYPE: BlockTypeDef = {
  id: 'room_occupied', label: 'נוכחות במבנה', hint: 'המבנה ריק / יש נוכחות', icon: 'users', available: (e) => tagged(e).length > 0,
  make: (e) => typed({ type: 'room_occupied', mode: 'occupied', sensors: tagged(e) }),
};
if (!TRIGGER_TYPES.some((t) => t.id === BUILDING_EMPTY_TYPE.id)) TRIGGER_TYPES.push(BUILDING_EMPTY_TYPE);
if (!CONDITION_TYPES.some((t) => t.id === ROOM_OCCUPIED_TYPE.id)) CONDITION_TYPES.push(ROOM_OCCUPIED_TYPE);

/** The sensors as checkboxes (a short list: the owner tags a handful), names from the catalogue. */
function sensorPicker(fc: FormCtx, current: readonly string[]): TemplateResult {
  const all = tagged(fc.env);
  const toggle = (id: string, on: boolean) => fc.patch((x) => { const set = new Set<string>(x.sensors); if (on) set.add(id); else set.delete(id); x.sensors = all.filter((s) => set.has(s)); });
  return html`<div class="fld full"><label>חיישנים</label><div class="frow" data-presence-sensors>
    ${all.map((id) => html`<label class="chk"><input type="checkbox" data-presence-sensor=${id} .checked=${current.includes(id)} @change=${(e: Event) => toggle(id, (e.target as HTMLInputElement).checked)} />${fc.env.ctx.names?.(id) ?? id}</label>`)}</div></div>`;
}

function buildingEmptyForm(fc: FormCtx): TemplateResult {
  const b = fc.block as unknown as { sensors: string[]; minutes: number };
  return html`<div class="frow"><div class="fld"><label>מה</label><select class="selx" aria-label="מה" data-fld="presence.what"><option selected>המבנה התרוקן</option></select></div>
    <div class="fld sm"><label>במשך (דקות)</label><label class="inp"><input class="n" type="number" min="1" max=${MAX_MINUTES} step="1" data-fld="presence.minutes" aria-label="דקות" .value=${String(b.minutes)}
      @change=${(e: Event) => fc.patch((x) => { const n = Math.round(Number((e.target as HTMLInputElement).value)); x.minutes = Number.isFinite(n) ? Math.min(MAX_MINUTES, Math.max(1, n)) : 15; })} /></label></div></div>
    ${sensorPicker(fc, b.sensors)}`;
}

function roomOccupiedForm(fc: FormCtx): TemplateResult {
  const b = fc.block as unknown as { mode: string; sensors: string[] };
  return html`<div class="frow"><div class="fld"><label>מצב</label><select class="selx" aria-label="מצב" data-fld="presence.mode" @change=${(e: Event) => fc.patch((x) => { x.mode = (e.target as HTMLSelectElement).value; })}>
      <option value="occupied" ?selected=${b.mode === 'occupied'}>יש נוכחות</option><option value="empty" ?selected=${b.mode === 'empty'}>אין נוכחות</option></select></div></div>
    ${sensorPicker(fc, b.sensors)}`;
}

FORMS['trigger:building_empty'] = buildingEmptyForm;
FORMS['condition:room_occupied'] = roomOccupiedForm;
