import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PRESSES, PRESS_WORD, type ActionBlock, type Block, type ConditionBlock, type PressKind, type TriggerBlock } from '../api/automations';
import { detectPress, deviceButtons, wallDevices, type DeviceButtons, type WallDevice } from '../api/automations-ext';
import { icon } from './automation-builder-icons';
import { FORMS, formFor, type FormCtx } from './automation-block-forms';
import { CONDITION_TYPES, TRIGGER_TYPES, wallDeviceNames, type BlockTypeDef } from './automation-editor-logic';
import { newUid } from '../api/automations';

/**
 * KAV079-295 (mockup r079 states 2 and 6): the new forms of the automation builder, registered the way automation-block-forms.ts documents it - ONE
 * entry in `FORMS` and one in the type chooser per typed schema; the builder itself does not change.
 *
 *   trigger:button      a wall button / switch press: the switch (only wall buttons are offered), the button number ("בשימוש" when another item
 *                       already uses one of its presses), the press kind (its timing from הגדרות › אוטומציות › כפתורי קיר) and "זיהוי בלחיצה על
 *                       הכפתור" (one real press fills button and press). Offered only while `automations.wall_buttons_editable` is on.
 *   condition:presence  "מי במבנה": someone / nobody in the whole building, by the site's presence sources (Wi-Fi only in server mode, owner 364).
 *   action:service      (wrapped) a notify step gains the critical-sound switch, allowed only for safety event types enabled in הגדרות › התראות (363).
 *
 * The button form keeps async state (the switches, one switch's buttons, the listening), so it renders into the editor's light DOM through a
 * per-block holder; everything else is a pure function of the FormCtx.
 */

// ------------------------------------------------------------------------------------------------ the type chooser

const typed = <T extends object>(b: T): Block => ({ uid: newUid(), kind: 'typed', raw: null, sentence: '', ...b }) as unknown as Block;

export const BUTTON_TYPE: BlockTypeDef = {
  id: 'button', label: 'כפתור קיר', hint: 'לחיצה על מפסק', icon: 'button', available: (e) => !!e.catalog.extension?.wall_buttons,
  make: () => typed({ type: 'button', device_id: '', domain: '', ha_type: 'remote_button_short_press', ha_subtype: 'button_1', button: 1, press: 'short', extra: {} }),
};
export const PRESENCE_TYPE: BlockTypeDef = {
  id: 'presence_in', label: 'מי במבנה', hint: 'יש מישהו · אין אף אחד', icon: 'users', available: (e) => !!e.catalog.extension?.presence,
  make: () => typed({ type: 'presence', mode: 'nobody', where: 'building' }),
};
if (!TRIGGER_TYPES.some((t) => t.id === BUTTON_TYPE.id)) TRIGGER_TYPES.splice(1, 0, BUTTON_TYPE);
if (!CONDITION_TYPES.some((t) => t.id === PRESENCE_TYPE.id)) CONDITION_TYPES.splice(5, 0, PRESENCE_TYPE);

// ------------------------------------------------------------------------------------------------ the button form (state 2)

type ButtonBlock = Extract<TriggerBlock, { type: 'button' }>;
let devicesCache: Promise<WallDevice[]> | null = null;
const buttonsCache = new Map<string, Promise<DeviceButtons>>();
/** Forget the cached switches (a test, or the settings changed). */
export function resetButtonCaches(): void { devicesCache = null; buttonsCache.clear(); }
const devices = (): Promise<WallDevice[]> => (devicesCache ??= wallDevices().then((r) => { r.devices.forEach((d) => wallDeviceNames.set(d.device_id, d.name)); return r.devices; }).catch(() => []));
const buttonsOf = (id: string, itemId: string | null): Promise<DeviceButtons> => {
  const key = `${id}|${itemId ?? ''}`;
  let p = buttonsCache.get(key);
  if (!p) { p = deviceButtons(id, itemId).catch(() => ({ device_id: id, buttons: [], source: 'stored' as const })); buttonsCache.set(key, p); }
  return p;
};

/** The words of `press` on `button` of the loaded switch (the integration's own `type` / `subtype`), or null when it does not offer it. */
export function wordsFor(info: DeviceButtons | null, button: number, press: PressKind): { ha_type: string; ha_subtype: string; domain: string; discovery_id?: string } | null {
  const p = info?.buttons.find((b) => b.button === button)?.presses.find((x) => x.press === press);
  return p ? { ha_type: p.ha_type, ha_subtype: p.ha_subtype, domain: p.domain, ...(p.discovery_id ? { discovery_id: p.discovery_id } : {}) } : null;
}

function applyChoice(fc: FormCtx, info: DeviceButtons | null, button: number, press: PressKind): void {
  const w = wordsFor(info, button, press);
  fc.patch((x: ButtonBlock) => {
    x.button = button; x.press = press;
    if (w) { x.ha_type = w.ha_type; x.ha_subtype = w.ha_subtype; if (w.domain && w.domain !== 'unknown') x.domain = w.domain; x.extra = w.discovery_id ? { discovery_id: w.discovery_id } : {}; }
  });
}

/** The button form: a light-DOM element (the editor's shadow styles apply) that keeps the switches, one switch's buttons and the listening state. */
@customElement('kav-button-form')
export class KavButtonForm extends LitElement {
  @property({ attribute: false }) fc: FormCtx | null = null;
  @state() private devices: WallDevice[] | null = null;
  @state() private buttons: DeviceButtons | null = null;
  @state() private listening = false;
  @state() private note = '';
  private loadedFor = '';

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    void devices().then((d) => { this.devices = d; });
  }

  protected willUpdate() {
    const b = this.fc?.block as ButtonBlock | undefined;
    const key = b?.device_id ? `${b.device_id}|${this.fc?.itemId ?? ''}` : '';
    if (key && key !== this.loadedFor) {
      this.loadedFor = key;
      void buttonsOf(b!.device_id, this.fc?.itemId ?? null).then((info) => { if (this.loadedFor === key) this.buttons = info; });
    }
  }

  private async detect() {
    const fc = this.fc; const b = fc?.block as ButtonBlock | undefined;
    if (!fc || !b?.device_id || this.listening) return;
    this.listening = true; this.note = '';
    try {
      const r = await detectPress(b.device_id);
      if (r.detected && r.button && r.press) applyChoice(this.fc!, this.buttons, r.button, r.press);
      else this.note = 'לא זוהתה לחיצה';
    } catch { this.note = 'לא זוהתה לחיצה'; }
    this.listening = false;
  }

  private async pickDevice(id: string) {
    const fc = this.fc;
    if (!fc) return;
    this.buttons = null;
    const info = id ? await buttonsOf(id, fc.itemId ?? null) : null;
    this.buttons = info; this.loadedFor = id ? `${id}|${fc.itemId ?? ''}` : '';
    const first = info?.buttons[0]?.presses[0];
    this.fc!.patch((x: ButtonBlock) => {
      x.device_id = id;
      if (first && info) { x.domain = first.domain; x.ha_type = first.ha_type; x.ha_subtype = first.ha_subtype; x.button = info.buttons[0].button; x.press = first.press; x.extra = first.discovery_id ? { discovery_id: first.discovery_id } : {}; }
    });
  }

  render() {
    const fc = this.fc;
    if (!fc) return nothing;
    const b = fc.block as ButtonBlock;
    const timing = fc.env.catalog.extension?.wall_timing;
    const dev = this.devices?.find((d) => d.device_id === b.device_id) ?? null;
    const info = this.buttons;
    const rows = info?.buttons.length ? info.buttons : Array.from({ length: Math.max(b.button || 1, 1) }, (_v, i) => ({ button: i + 1, presses: [], used: false }));
    const offered = (n: number, p: PressKind) => !info?.buttons.length || !!wordsFor(info, n, p);
    return html`<div class="kav-tools"><span class="sp"></span>
        <button class="btn sm" type="button" data-kav-detect ?disabled=${!b.device_id || this.listening} @click=${() => void this.detect()}>${icon('flask')}${this.listening ? 'מאזינים ללחיצה…' : 'זיהוי בלחיצה על הכפתור'}</button></div>
      ${this.note ? html`<div class="err" role="status" data-kav-detect-note>${icon('info')}${this.note}</div>` : nothing}
      <div class="fld"><label>מפסק או כפתור קיר</label>
        <select class="selx" data-kav-device aria-label="מפסק" @change=${(e: Event) => void this.pickDevice((e.target as HTMLSelectElement).value)}>
          ${!b.device_id ? html`<option value="" selected>בחרו מפסק</option>` : nothing}
          ${(this.devices ?? []).map((d) => html`<option value=${d.device_id} ?selected=${d.device_id === b.device_id}>${d.name}${d.area ? ` · ${d.area}` : ''}</option>`)}
          ${b.device_id && !dev ? html`<option value=${b.device_id} selected>${wallDeviceNames.get(b.device_id) ?? 'מפסק'}</option>` : nothing}
        </select></div>
      <div class="fld"><label>כפתור</label>
        <div class="kav-btns" role="group" aria-label="כפתור" data-kav-buttons>${rows.map((r) => html`<button type="button" aria-pressed=${String(r.button === b.button)} data-kav-button=${r.button}
          @click=${() => applyChoice(fc, info, r.button, offered(r.button, b.press) ? b.press : (info?.buttons.find((x) => x.button === r.button)?.presses[0]?.press ?? b.press))}>${r.button}${r.used ? html`<small>בשימוש</small>` : nothing}</button>`)}</div></div>
      <div class="fld"><label>סוג לחיצה</label>
        <div class="kav-press" role="group" aria-label="סוג לחיצה" data-kav-press>${PRESSES.map((p) => html`<button type="button" aria-pressed=${String(p === b.press)} ?disabled=${!offered(b.button, p)} data-kav-press-kind=${p}
          @click=${() => applyChoice(fc, info, b.button, p)}><span class="pi ${p}"><i></i>${p === 'double' ? html`<i></i>` : nothing}</span>${PRESS_WORD[p].replace('לחיצה ', '')}
          <small>${p === 'short' ? 'לחיצה אחת' : p === 'double' ? html`עד <bdi>${timing?.double_ms ?? 400}</bdi> מ״ש בין לחיצות` : html`מעל <bdi>${timing?.long_ms ?? 800}</bdi> מ״ש`}</small></button>`)}</div>
        <span class="kav-note">הזמנים נקבעים בהגדרות ‹ אוטומציות · <a href="#/system/automations">שינוי</a></span></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kav-button-form': KavButtonForm;
  }
}

const buttonForm = (fc: FormCtx): TemplateResult => html`<kav-button-form .fc=${fc} data-kav-button-form></kav-button-form>`;

// ------------------------------------------------------------------------------------------------ "מי במבנה" (state 6)

function presenceForm(fc: FormCtx): TemplateResult {
  const b = fc.block as Extract<ConditionBlock, { type: 'presence' }>;
  const src = fc.env.catalog.extension?.presence_sources;
  const chip = (on: boolean, ic: string, label: string, extra: TemplateResult | typeof nothing = nothing, off = false) =>
    html`<span class="kav-src" aria-pressed=${String(on && !off)} aria-disabled=${String(off)} data-kav-source=${label}>${icon(ic)}${label}${extra}</span>`;
  return html`<div class="frow">
      <div class="fld"><label>מצב</label><select class="selx" data-kav-presence-mode aria-label="מצב" @change=${(e: Event) => fc.patch((x) => { x.mode = (e.target as HTMLSelectElement).value; })}>
        <option value="nobody" ?selected=${b.mode === 'nobody'}>אין אף אחד</option><option value="someone" ?selected=${b.mode === 'someone'}>יש מישהו</option></select></div>
      <div class="fld"><label>איפה</label><select class="selx" aria-label="איפה" data-kav-presence-where><option value="building" selected>כל המבנה</option></select></div></div>
    <div class="fld"><label>לפי</label><div class="kav-srcs">
      ${chip(!!src?.geofence, 'home', 'גיאו־גדר')}${chip(!!src?.beacon, 'sensor', 'משואה')}
      ${chip(!!src?.wifi, 'sensor', 'Wi‑Fi', src?.wifi_mode === 'server' ? nothing : html`<small>רק כשהאתר במצב שרת</small>`, src?.wifi_mode !== 'server')}</div></div>`;
}

// ------------------------------------------------------------------------------------------------ critical sound on a notify step (state 6)

const SOURCE_WORD: Record<string, string> = { 'sensor.leak': 'הצפה', 'sensor.smoke': 'עשן', 'sensor.gas': 'גז', 'sensor.co': 'פחמן חד־חמצני', 'alarm.triggered': 'אזעקה' };
export function criticalReason(sources: readonly string[]): string {
  const words = sources.map((s) => SOURCE_WORD[s] ?? s);
  return words.length ? `מותר כי ״${words.join('״, ״')}״ ${words.length === 1 ? 'מסומנת' : 'מסומנות'} כאירוע בטיחות בהגדרות ‹ התראות.` : 'רק לאירועי בטיחות שהופעלו בהגדרות ‹ התראות.';
}

function criticalRow(fc: FormCtx): TemplateResult {
  const b = fc.block as Extract<ActionBlock, { type: 'service' }>;
  const allow = fc.ext?.critical;
  const on = !!b.critical;
  const can = !!allow?.allowed || on;
  return html`<div class="kav-swrow" data-kav-critical>${icon('bell')}<div class="t">צליל קריטי שעוקף ״נא לא להפריע״<small>${criticalReason(allow?.allowed ? allow.sources : [])}</small></div>
    <sw-toggle label="צליל קריטי" labelHidden .checked=${on} ?disabled=${!can} @change=${(e: CustomEvent<{ checked: boolean }>) => fc.patch((x) => { if (e.detail.checked) x.critical = true; else delete x.critical; })}></sw-toggle></div>`;
}

// ------------------------------------------------------------------------------------------------ registration

const baseService = FORMS['action:service'];
FORMS['trigger:button'] = buttonForm;
FORMS['condition:presence'] = presenceForm;
FORMS['action:service'] = (fc) => {
  const b = fc.block as Extract<ActionBlock, { type: 'service' }>;
  const inner = baseService ? baseService(fc) : formFor(fc);
  return b.role === 'notify' && fc.kind === 'automation' && (fc.ext?.critical || b.critical) ? html`${inner}${criticalRow(fc)}` : inner;
};

/** The styles of the new forms (added to the editor's shadow root). */
export const extFormStyles = css`
  .kav-tools { display: flex; gap: 8px; align-items: center; }
  .kav-tools .sp { flex: 1; }
  .kav-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .kav-btns button { min-inline-size: 52px; min-block-size: 44px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border-strong); background: var(--dv-surface-2, transparent);
    color: var(--dv-text); font: inherit; font-weight: 700; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; }
  .kav-btns button small { font-size: var(--sw-fs-xs); font-weight: 500; color: var(--sw-warning-text); }
  .kav-btns button[aria-pressed='true'], .kav-press button[aria-pressed='true'] { border-color: var(--dv-accent); background: color-mix(in srgb, var(--dv-accent) 14%, transparent); color: var(--dv-accent); }
  .kav-press { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .kav-press button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border-strong);
    background: var(--dv-surface-2, transparent); color: var(--dv-text); font: inherit; font-weight: 600; cursor: pointer; }
  .kav-press button:disabled { opacity: 0.4; cursor: not-allowed; }
  .kav-press small { font-size: var(--sw-fs-xs); font-weight: 400; color: var(--dv-text-2); }
  .kav-press .pi { display: inline-flex; gap: 3px; block-size: 10px; align-items: center; }
  .kav-press .pi i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: currentColor; }
  .kav-press .pi.long i { inline-size: 26px; border-radius: var(--sw-r-xs); }
  .kav-note { font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
  .kav-note a { color: var(--dv-accent); }
  .kav-srcs { display: flex; gap: 8px; flex-wrap: wrap; }
  .kav-src { display: inline-flex; align-items: center; gap: 6px; min-block-size: 34px; padding-inline: 12px; border-radius: 999px; border: 1px solid var(--dv-border-strong); font-size: var(--sw-fs-sm); }
  .kav-src[aria-pressed='true'] { border-color: var(--dv-accent); color: var(--dv-accent); }
  .kav-src[aria-disabled='true'] { opacity: 0.55; }
  .kav-src small { font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
  .kav-swrow { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border); }
  .kav-swrow > .ic { color: var(--dv-danger); }
  .kav-swrow .t { flex: 1; display: flex; flex-direction: column; font-weight: 600; }
  .kav-swrow .t small { font-weight: 400; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
`;
