import { html, nothing, type TemplateResult } from 'lit';
import '../components/sw-icon';
import '../components/sw-button';
import { bidi } from '../i18n/bidi';
import { AGENDA_CALENDARS_MAX, AGENDA_DAYS, AGENDA_DAYS_LABEL, agendaWhen, LABEL_MAX, QUICK_ACTION_LABEL, QUICK_ACTIONS, TILE_STYLE_LABEL, TILE_STYLES, type HomeCandidates, type HomeConfig, type LaunchItemCfg, type TileStyle } from '../api/home-config';
import { LAUNCH_KIND_LABEL, LAUNCH_ROUTES, LAUNCHER_ITEMS_MAX, launchRoute, idLabel } from '../api/launcher';

/**
 * BV1 (2026-10-05): the edit-panel bodies of the new widgets - the tile style of the clock / weather, the agenda's calendars and
 * horizon, the launcher's items - as functions over the panel's draft (home-edit-panel.ts wires them in). Every change goes
 * through the panel's `setConfig`, so one `home-draft` event carries the whole new draft, as for every other widget.
 */
export interface Bv1EditHost {
  config: HomeConfig;
  candidates: HomeCandidates | null;
  now: Date;
  zone: string;
  setConfig(fn: (c: HomeConfig) => void): void;
}

/** "כרטיס | אריח" for the clock / weather (drawn by the Bubble skin only; the hint says so). */
export function styleRow(h: Bv1EditHost, id: 'clock' | 'weather'): TemplateResult {
  const cur = h.config[id].style;
  return html`<div class="f">תצוגה בסגנון Bubble<span class="seg" role="group" aria-label=${`תצוגת ${id === 'clock' ? 'השעון' : 'מזג האוויר'}`}>${TILE_STYLES.map((s: TileStyle) => html`<button type="button" data-home-style=${`${id}:${s}`} aria-pressed=${String(cur === s)} @click=${() => h.setConfig((c) => (c[id].style = s))}>${TILE_STYLE_LABEL[s]}</button>`)}</span></div>`;
}

/** The agenda: a checklist of the mirrored calendars (each with its next event as a hint), up to six, and the horizon. */
export function agendaBody(h: Bv1EditHost): TemplateResult {
  const cfg = h.config.agenda;
  const cals = h.candidates?.calendars ?? [];
  const chosen = cfg.calendars;
  const toggle = (id: string, on: boolean) =>
    h.setConfig((c) => {
      const cur = c.agenda.calendars.filter((x) => x !== id);
      c.agenda.calendars = on ? [...cur, id].slice(0, AGENDA_CALENDARS_MAX) : cur;
    });
  const full = chosen.length >= AGENDA_CALENDARS_MAX;
  return html`<div class="f wide" data-home-agenda-calendars>יומנים (עד ${AGENDA_CALENDARS_MAX})
      ${cals.length
        ? html`<div class="fields">${cals.map((c) => {
            const on = chosen.includes(c.entity_id);
            return html`<label class="check" data-home-agenda-cal-row=${c.entity_id}><input type="checkbox" data-home-agenda-cal=${c.entity_id} .checked=${on} ?disabled=${!on && full} @change=${(e: Event) => toggle(c.entity_id, (e.target as HTMLInputElement).checked)} />${bidi(c.name)}${c.event ? html`<span class="val">${agendaWhen(c.event, h.now, h.zone)}</span>` : nothing}</label>`;
          })}</div>`
        : html`<div class="err" data-home-agenda-none>לא נמצאו יומנים בקטלוג.</div>`}
      ${chosen.filter((id) => !cals.some((c) => c.entity_id === id)).map((id) => html`<label class="check" data-home-agenda-cal-row=${id}><input type="checkbox" data-home-agenda-cal=${id} checked @change=${(e: Event) => toggle(id, (e.target as HTMLInputElement).checked)} />${id}<span class="val">לא בקטלוג</span></label>`)}
    </div>
    <div class="f">טווח<span class="seg" role="group" aria-label="טווח היומן">${AGENDA_DAYS.map((d) => html`<button type="button" data-home-agenda-days=${d} aria-pressed=${String(cfg.days === d)} @click=${() => h.setConfig((c) => (c.agenda.days = d))}>${AGENDA_DAYS_LABEL[d]}</button>`)}</span></div>`;
}

/** The launcher: the items in order (move / rename / remove) and a row of "add" selects for screens, scenes, scripts and quick actions. */
export function launcherBody(h: Bv1EditHost): TemplateResult {
  const items = h.config.launcher.items;
  const scenes = h.candidates?.scenes ?? [];
  const scripts = h.candidates?.scripts ?? [];
  const has = (kind: LaunchItemCfg['kind'], id: string) => items.some((x) => x.kind === kind && x.id === id);
  const full = items.length >= LAUNCHER_ITEMS_MAX;
  const add = (kind: LaunchItemCfg['kind'], id: string) => {
    if (!id || has(kind, id) || full) return;
    h.setConfig((c) => c.launcher.items.push({ kind, id, label: '' }));
  };
  const move = (i: number, to: number) =>
    h.setConfig((c) => {
      const list = c.launcher.items;
      if (to < 0 || to >= list.length) return;
      const [x] = list.splice(i, 1);
      list.splice(to, 0, x);
    });
  const nameOf = (x: LaunchItemCfg) =>
    x.kind === 'route' ? launchRoute(x.id)?.label ?? x.id : x.kind === 'quick' ? QUICK_ACTION_LABEL[x.id as 'lights_off' | 'all_off'] ?? x.id : (x.kind === 'scene' ? scenes : scripts).find((s) => s.entity_id === x.id)?.name ?? idLabel(x.id);
  const addSelect = (kind: LaunchItemCfg['kind'], label: string, options: { id: string; name: string }[]) => html`<label class="f">${label}
    <select data-home-launch-add=${kind} ?disabled=${full || !options.length} @change=${(e: Event) => { const s = e.target as HTMLSelectElement; add(kind, s.value); s.value = ''; }}>
      <option value="">${options.length ? 'הוסף…' : 'אין'}</option>
      ${options.filter((o) => !has(kind, o.id)).map((o) => html`<option value=${o.id}>${o.name}</option>`)}
    </select></label>`;
  return html`<div class="f wide" data-home-launch-items>פריטים (עד ${LAUNCHER_ITEMS_MAX})
      ${items.length
        ? items.map(
            (x, i) => html`<div class="extra" data-home-launch-item=${`${x.kind}:${x.id}`}>
              <span class="val" style="direction:inherit"><b>${LAUNCH_KIND_LABEL[x.kind]}</b> · ${bidi(nameOf(x))}</span>
              <input type="text" aria-label="כותרת" data-home-launch-label=${i} maxlength=${LABEL_MAX} .value=${x.label} placeholder=${nameOf(x)} @input=${(e: Event) => h.setConfig((c) => (c.launcher.items[i].label = (e.target as HTMLInputElement).value))} />
              <span style="display:inline-flex;gap:4px">
                <button type="button" class="ib" data-home-launch-up=${i} aria-label="הקדם" ?disabled=${i === 0} @click=${() => move(i, i - 1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-down=${i} aria-label="אחר" ?disabled=${i === items.length - 1} @click=${() => move(i, i + 1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-remove=${i} aria-label="הסר פריט" @click=${() => h.setConfig((c) => c.launcher.items.splice(i, 1))}><sw-icon name="close" size=${13}></sw-icon></button>
              </span>
            </div>`,
          )
        : html`<span class="val" style="direction:inherit" data-home-launch-empty>אין פריטים: הווידג׳ט מוסתר עד שיתווסף פריט.</span>`}
    </div>
    ${addSelect('route', 'מסך', LAUNCH_ROUTES.map((r) => ({ id: r.id, name: r.label })))}
    ${addSelect('scene', 'סצנה', scenes.map((s) => ({ id: s.entity_id, name: s.name })))}
    ${addSelect('script', 'סקריפט', scripts.map((s) => ({ id: s.entity_id, name: s.name })))}
    ${addSelect('quick', 'פעולה מהירה', QUICK_ACTIONS.map((a) => ({ id: a, name: QUICK_ACTION_LABEL[a] })))}`;
}
