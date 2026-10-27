import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import '../door-windows/emergency';
import '../door-windows/emergency-grants';
import '../door-windows/event-rules';
import '../door-windows/holidays';
import '../door-windows/open-for';
import type { RouteState } from '../router';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import {
  attest, confirmClosed, createRule, endNow, getEmergencySettings, getEmergencyState, getWindowSettings, getWindowsState, previewRule, putEmergencySettings,
  putWindowSettings, ruleAction, updateRule,
  type CalendarPolicy, type DoorRow, type EmergencySettings, type EmergencyState, type Occurrence, type PreviewReply, type Rule, type WindowsState,
} from '../api/door-windows';
import { dwt, dwtDynamic, type DwtKey } from '../i18n/door-windows';
import {
  OCC_TONE, RULE_TONE, alarms, bodyOf, byDoor, canEndNow, dayRuns, draftOf, draftProblem, emptyDraft, hm, incidentLive, localDay, periodLines, weekdayOf,
  type Draft, type Range,
} from '../door-windows/logic';
import { dwCss } from '../door-windows/styles';
import { dwe } from '../i18n/door-windows-events';
import { limitsOf, openableDoors } from '../door-windows/events-logic';
import { canManageGrants } from '../door-windows/grants-logic';
import { dateInputLang } from '../api/day-format';

const POLL_MS = 15_000;
const EM_POLL_MS = 5_000;
const DAYS = [0, 1, 2, 3, 4, 5, 6];
/** EMROLE-295: the settings of the emergency-open role (who may give it, the expiry, whether holders may retry). */
const GRANT_KEYS = ['doors.emergency.grant.default_hours', 'doors.emergency.grant.max_hours', 'doors.emergency.grant.by_security_manager', 'doors.emergency.retry_open.by_holders'];
const CALENDARS: CalendarPolicy[] = ['skip_holidays', 'holidays_like_friday', 'ignore_calendar'];

type Confirm = { title: string; text: string; btn: string; danger?: boolean; run: () => Promise<unknown> };

/**
 * CR-039 / DOORWIN-295: "חלונות פתיחה" (`#/wiskey/door-windows`) - timed hold-open windows of doors, and the entry to the emergency
 * controls. Built from CR-039 section 10 (no separate mockup exists; the design notes are docs/changes/CR-DOORWIN-295-BUILD-NOTES.md).
 *  - the red emergency strip while an incident is in effect (the only place that releases, hold then confirm);
 *  - "דורש בדיקה": every door whose return to normal was not confirmed, with the manual check (the person says how they checked);
 *  - "היום והשבוע": the planned / running windows per door, the state word of each, "סיום עכשיו" for the guard override;
 *  - "חלונות מוגדרים": the rules (cards; a column grid on wide screens), edit / enable / pause / remove for managers;
 *  - the editor drawer: name, kind, doors (only those the person may manage), days and hours, holidays, preview of the coming week.
 * The emergency sheet opens from the header only. The server decides every action; nothing here opens a door.
 */
@customElement('door-windows-screen')
export class DoorWindowsScreen extends LitElement {
  static styles = [dwCss, css`
    :host { display: block; }
    .stack { display: grid; gap: 18px; }
    section { display: grid; gap: 10px; }
    /* round 2: section titles one step larger and tight; the cards carry the lit top edge of the elevation ladder; a card title is a real heading */
    h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: 700; letter-spacing: -0.01em; color: var(--sw-text); }
    .card { display: grid; gap: 10px; padding: 16px; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0; }
    .card.alarm { border-color: var(--sw-danger); background: var(--sw-danger-soft); }
    .card .top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
    .card .top b { font-size: var(--sw-fs-lg); font-weight: 700; letter-spacing: -0.01em; overflow-wrap: anywhere; }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .doorrow { display: grid; gap: 8px; }
    .occ { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .occ .when { font-variant-numeric: tabular-nums; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 7.5em; }
    .rules { display: grid; gap: 10px; }
    .rule { display: grid; gap: 8px; }
    .rule .hours { display: grid; gap: 2px; font-size: var(--sw-fs-sm); font-variant-numeric: tabular-nums; }
    .rule .acts, .card .top .acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    @media (min-width: 900px) {
      .rule { grid-template-columns: minmax(10em, 1.2fr) minmax(10em, 1.4fr) minmax(9em, 1fr) auto; align-items: center; }
      .rules .head { display: grid; grid-template-columns: minmax(10em, 1.2fr) minmax(10em, 1.4fr) minmax(9em, 1fr) auto; padding-inline: 14px;
        font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); text-transform: none; }
    }
    @media (max-width: 899px) { .rules .head { display: none; } }
    .form { display: grid; gap: 14px; }
    .field { display: grid; gap: 6px; }
    .field > label, .field > .lbl { font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); }
    input[type='text'], input[type='date'], input[type='time'], select, textarea {
      font: inherit; padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text);
      min-inline-size: 0;
    }
    /* POLISH-CONTROL-297: a field shows where the keyboard is (there was no focus style); a choice button answers the press and the
       keyboard, hover is for fine pointers only (transform and colour, token durations - zero under reduced motion) */
    input[type='text']:focus-visible, input[type='date']:focus-visible, input[type='time']:focus-visible, select:focus-visible, textarea:focus-visible {
      outline: none; border-color: var(--sw-accent); box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .seg { display: flex; flex-wrap: wrap; gap: 6px; }
    .seg button, .days button {
      font: inherit; padding: 6px 12px; min-block-size: 32px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); cursor: pointer;
      transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .seg button:active, .days button:active { transform: scale(0.96); }
    .seg button:focus-visible, .days button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) {
      .seg button:hover:not([aria-pressed='true']), .days button:hover:not([aria-pressed='true']) { border-color: var(--sw-border-strong); background: var(--sw-surface-2); }
    }
    @media (pointer: coarse) { .seg button, .days button { min-block-size: 44px; } }
    .seg button[aria-pressed='true'], .days button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .days { display: flex; flex-wrap: wrap; gap: 6px; }
    .range { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .doors { display: grid; gap: 4px; max-block-size: 260px; overflow: auto; padding: 4px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
    .doors label { display: flex; gap: 8px; align-items: center; padding: 4px 6px; border-radius: var(--sw-r-sm); }
    .doors .st { font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding: 6px 6px 0; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .footer { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .preview { display: grid; gap: 8px; }
    .radio { display: grid; gap: 6px; }
    /* the toast is the product's toast (its own tokens, above the phone's bottom bar) and rises in instead of popping (zero under reduced motion) */
    .toast { position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 18px); inset-inline: 0; margin-inline: auto; inline-size: fit-content; max-inline-size: calc(100% - 32px); padding: 8px 16px; border-radius: var(--sw-r-pill);
      background: var(--sw-toast-bg, var(--sw-text)); color: var(--sw-toast-text, var(--sw-surface)); font-size: var(--sw-fs-sm); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2);
      opacity: 1; transform: translateY(0); transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-t-med) var(--sw-ease); }
    @starting-style { .toast { opacity: 0; transform: translateY(8px); } }
  `];

  @property({ attribute: false }) route: RouteState | null = null;
  @state() private data: WindowsState | null = null;
  @state() private em: EmergencyState | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private draft: Draft | null = null;
  @state() private draftError = '';
  @state() private preview: PreviewReply | null = null;
  @state() private busy = false;
  @state() private confirm: Confirm | null = null;
  @state() private manual: { occ: Occurrence; checked: 'camera' | 'door' | '' } | null = null;
  @state() private sheet = false;
  @state() private grantsOpen = false;
  @state() private holidaysOpen = false;
  @state() private openForOpen = false;
  @state() private openForDoor = '';
  @state() private toast = '';
  @state() private settingsOpen = false;
  @state() private ws: Record<string, string> | null = null;
  @state() private wsEdit: Record<string, string> = {};
  /** SPLITSWITCH-297: the door-window program engine may write to the door system (its own flag, independent of emergency buttons). */
  @state() private wLive = false;
  @state() private es: EmergencySettings | null = null;
  @state() private esEdit: Record<string, string> = {};
  @state() private sError = '';
  private timer = 0;
  private emTimer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    if (!isApi()) return;
    void this.load();
    this.timer = window.setInterval(() => void this.load(), POLL_MS);
    this.emTimer = window.setInterval(() => void this.loadEmergency(), EM_POLL_MS);
  }

  disconnectedCallback(): void {
    clearInterval(this.timer);
    clearInterval(this.emTimer);
    super.disconnectedCallback();
  }

  private async load(): Promise<void> {
    try {
      this.data = await getWindowsState();
      this.error = '';
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else this.error = describeError(err);
    }
    await this.loadEmergency();
  }

  private async loadEmergency(): Promise<void> {
    try {
      this.em = await getEmergencyState();
    } catch {
      this.em = null; // no permission to see doors at all: no strip, no button
    }
  }

  private flash(text: string): void {
    this.toast = text;
    window.setTimeout(() => (this.toast = ''), 2500);
  }

  private doorOf(key: string): DoorRow | undefined {
    return this.data?.doors.find((d) => d.key === key);
  }

  private today(): string {
    return localDay(this.data?.now ?? new Date().toISOString(), 'Asia/Jerusalem');
  }

  // ---------------------------------------------------------------- actions

  private async run(c: Confirm): Promise<void> {
    this.busy = true;
    try {
      await c.run();
      this.confirm = null;
      this.flash(dwt('done'));
      await this.load();
    } catch (err) {
      this.flash(`${dwt('failed')}: ${describeError(err)}`);
    } finally {
      this.busy = false;
    }
  }

  private askRule(rule: Rule, action: 'enable' | 'pause' | 'retire'): void {
    const text: Record<typeof action, DwtKey> = { enable: 'confirmEnable', pause: 'confirmPause', retire: 'confirmRetire' };
    this.confirm = { title: dwt('confirmTitle'), text: dwt(text[action]), btn: dwt(action), danger: action === 'retire', run: () => ruleAction(rule.id, action) };
  }

  private askOpenFor(key: string): void {
    this.openForDoor = key;
    this.openForOpen = true;
  }

  private askEndNow(o: Occurrence): void {
    this.confirm = { title: dwt('confirmTitle'), text: dwt('confirmEndNow', { door: o.label }), btn: dwt('endNow'), run: () => endNow(o.id) };
  }

  private async saveManual(): Promise<void> {
    const m = this.manual;
    if (!m || !m.checked) return;
    this.busy = true;
    try {
      await confirmClosed(m.occ.id, m.checked);
      this.manual = null;
      this.flash(dwt('done'));
      await this.load();
    } catch (err) {
      this.flash(`${dwt('failed')}: ${describeError(err)}`);
    } finally {
      this.busy = false;
    }
  }

  private openEditor(rule?: Rule): void {
    this.draft = rule ? draftOf(rule, this.today()) : emptyDraft(this.today());
    this.draftError = '';
    this.preview = null;
  }

  private patch(fn: (d: Draft) => void): void {
    if (!this.draft) return;
    const d: Draft = { ...this.draft, doors: new Set(this.draft.doors), days: new Set(this.draft.days), ranges: this.draft.ranges.map((r) => ({ ...r })),
                       perDay: this.draft.perDay ? new Map([...this.draft.perDay].map(([k, v]) => [k, v.map((r) => ({ ...r }))])) : null };
    fn(d);
    this.draft = d;
    this.preview = null;
    this.draftError = '';
  }

  private problem(): string {
    if (!this.draft) return '';
    const p = draftProblem(this.draft, Number(this.data?.settings.max_hours ?? 4));
    return p ? dwt(p.key as DwtKey, p.vars) : '';
  }

  private async doPreview(): Promise<void> {
    const problem = this.problem();
    if (problem || !this.draft) {
      this.draftError = problem;
      return;
    }
    try {
      this.preview = await previewRule(bodyOf(this.draft, false));
    } catch (err) {
      this.draftError = describeError(err);
    }
  }

  private save(enable: boolean): void {
    const problem = this.problem();
    if (problem || !this.draft) {
      this.draftError = problem;
      return;
    }
    const d = this.draft;
    const go = async () => {
      const body = bodyOf(d, enable);
      if (d.id) await updateRule(d.id, body);
      else await createRule(body);
      this.draft = null;
    };
    if (enable) this.confirm = { title: dwt('confirmTitle'), text: dwt('confirmEnable'), btn: dwt('saveEnable'), run: go };
    else void this.run({ title: '', text: '', btn: '', run: go });
  }

  // ---------------------------------------------------------------- settings (system administrators)

  private async openSettings(): Promise<void> {
    this.settingsOpen = true;
    this.sError = '';
    try {
      const [w, e] = await Promise.all([getWindowSettings(), getEmergencySettings()]);
      this.ws = w.settings;
      this.wsEdit = { ...w.settings };
      this.wLive = w.go_live_permitted === true;
      this.es = e.settings;
      this.esEdit = Object.fromEntries(Object.entries(e.settings).filter(([k, v]) => typeof v === 'string' && ['doors.emergency.enabled', 'doors.emergency.open_enabled', ...GRANT_KEYS].includes(k))) as Record<string, string>;
    } catch (err) {
      this.sError = describeError(err);
    }
  }

  private async saveSettings(): Promise<void> {
    if (!this.ws || !this.es) return;
    this.busy = true;
    this.sError = '';
    try {
      const w = Object.fromEntries(Object.entries(this.wsEdit).filter(([k, v]) => this.ws![k] !== v));
      if (Object.keys(w).length) this.ws = (await putWindowSettings(w)).settings;
      const cur = this.es as unknown as Record<string, string>;
      const e = Object.fromEntries(Object.entries(this.esEdit).filter(([k, v]) => cur[k] !== v));
      if (Object.keys(e).length) this.es = (await putEmergencySettings(e)).settings;
      this.settingsOpen = false;
      this.flash(dwt('saved'));
      await this.load();
    } catch (err) {
      this.sError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async doAttest(): Promise<void> {
    if (!this.es) return;
    try {
      await attest(this.es.attestation.version);
      this.es = (await getEmergencySettings()).settings;
    } catch (err) {
      this.sError = describeError(err);
    }
  }

  private num(key: string, label: DwtKey, min: number, max: number): TemplateResult {
    return html`<div class="field"><label for=${key}>${dwt(label)}</label><input id=${key} type="text" inputmode="numeric" data-dw-setting=${key}
      .value=${this.wsEdit[key] ?? ''} @input=${(e: Event) => {
        const v = (e.target as HTMLInputElement).value.trim();
        this.wsEdit = { ...this.wsEdit, [key]: /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max ? String(Number(v)) : v };
      }}></div>`;
  }

  private hours(key: string, label: DwtKey, min: number, max: number): TemplateResult {
    return html`<div class="field"><label for=${key}>${dwt(label)}</label><input id=${key} type="text" inputmode="numeric" data-dw-setting=${key}
      .value=${this.esEdit[key] ?? ''} @input=${(e: Event) => {
        const v = (e.target as HTMLInputElement).value.trim();
        this.esEdit = { ...this.esEdit, [key]: /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max ? String(Number(v)) : v };
      }}></div>`;
  }

  private check(on: boolean, label: DwtKey, set: (v: boolean) => void, disabled = false, key = ''): TemplateResult {
    return html`<label class="occ" data-dw-switch=${key}><input type="checkbox" .checked=${on} ?disabled=${disabled} @change=${(e: Event) => set((e.target as HTMLInputElement).checked)}> ${dwt(label)}</label>`;
  }

  private renderSettings(): TemplateResult | typeof nothing {
    if (!this.settingsOpen) return nothing;
    const w = this.wsEdit;
    const es = this.es;
    const live = !!es?.go_live_permitted;
    return html`<sw-drawer open modal heading=${dwt('sTitle')} @close=${() => (this.settingsOpen = false)}>
      <div class="form" data-dw-settings>
        <section><h2>${dwt('sWindows')}</h2>
          ${!this.wLive ? html`<div class="callout" data-tone="warn" data-dw-programs-golive><sw-icon name="info"></sw-icon><span>${dwt('sProgramsGoLiveNo')}</span></div>` : nothing}
          ${this.check(w['doors.windows.enabled'] === 'on', 'sWindowsOn', (v) => (this.wsEdit = { ...w, 'doors.windows.enabled': v ? 'on' : 'off' }), false, 'doors.windows.enabled')}
          ${this.num('doors.windows.max_hours', 'sMaxHours', 1, 12)}
          ${this.num('doors.windows.relock_grace_s', 'sGrace', 60, 600)}
          ${this.num('doors.windows.relock_retries', 'sRetries', 0, 5)}
          ${this.num('doors.windows.reraise_min', 'sReraise', 5, 60)}
          ${this.check(w['doors.windows.exterior_allowed'] === 'true', 'sExterior', (v) => (this.wsEdit = { ...w, 'doors.windows.exterior_allowed': v ? 'true' : 'false' }), false, 'doors.windows.exterior_allowed')}
        </section>
        ${es ? html`<section><h2>${dwt('sEmergency')}</h2>
          ${!live ? html`<div class="callout" data-tone="warn" data-dw-golive><sw-icon name="info"></sw-icon><span>${dwt('sGoLiveNo')}</span></div>` : nothing}
          ${this.check(this.esEdit['doors.emergency.enabled'] === 'on', 'sEmergencyOn', (v) => (this.esEdit = { ...this.esEdit, 'doors.emergency.enabled': v ? 'on' : 'off' }), !live, 'doors.emergency.enabled')}
          ${this.check(this.esEdit['doors.emergency.open_enabled'] === 'on', 'sOpenOn', (v) => (this.esEdit = { ...this.esEdit, 'doors.emergency.open_enabled': v ? 'on' : 'off' }),
            !live || !es.open_available || !es.attested, 'doors.emergency.open_enabled')}
          <div class="card" data-dw-attestation><b>${dwt('sAttestTitle')}</b><p class="muted">${es.attestation.text}</p>
            ${es.attested ? html`<span class="chip" data-tone="ok">${dwt('sAttested')}</span>`
              : html`<div><sw-button size="sm" variant="secondary" data-dw-attest @click=${() => void this.doAttest()}>${dwt('sAttest')}</sw-button></div>`}</div>
          <h2>${dwt('sGrants')}</h2>
          ${this.hours('doors.emergency.grant.default_hours', 'sGrantDefault', 0, 8760)}
          ${this.hours('doors.emergency.grant.max_hours', 'sGrantMax', 1, 8760)}
          ${this.check(this.esEdit['doors.emergency.grant.by_security_manager'] === 'on', 'sGrantManager', (v) => (this.esEdit = { ...this.esEdit, 'doors.emergency.grant.by_security_manager': v ? 'on' : 'off' }), false, 'doors.emergency.grant.by_security_manager')}
          ${this.check(this.esEdit['doors.emergency.retry_open.by_holders'] === 'on', 'sRetryHolders', (v) => (this.esEdit = { ...this.esEdit, 'doors.emergency.retry_open.by_holders': v ? 'on' : 'off' }), false, 'doors.emergency.retry_open.by_holders')}
        </section>` : nothing}
        ${this.sError ? html`<div class="err" role="alert">${this.sError}</div>` : nothing}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => (this.settingsOpen = false)}>${dwt('cancel')}</sw-button>
        <sw-button variant="primary" data-dw-settings-save ?disabled=${this.busy || !this.ws} @click=${() => void this.saveSettings()}>${dwt('sSave')}</sw-button>
      </div>
    </sw-drawer>`;
  }

  // ---------------------------------------------------------------- render

  render() {
    const title = dwt('title');
    if (isApi() && this.forbidden) {
      return html`<sw-page heading=${title}><sw-state-panel quiet state="forbidden" heading=${dwt('noPermission')} data-dw-panel="forbidden"></sw-state-panel></sw-page>`;
    }
    if (!this.data) {
      return html`<sw-page heading=${title}>${this.error
        ? html`<sw-state-panel quiet state="error" heading=${dwt('loadError')} actionLabel=${dwt('retry')} data-dw-panel="error" @action=${() => void this.load()}></sw-state-panel>`
        : html`<sw-state-panel quiet state="loading" heading=${dwt('loading')} data-dw-panel="loading"></sw-state-panel>`}</sw-page>`;
    }
    const d = this.data;
    const em = this.em;
    const canEm = !!em && (em.can.lock || em.can.open);
    return html`<sw-page wide heading=${title} subheading=${dwt('sub')} data-dw data-dw-tier=${d.tier} data-dw-enabled=${String(d.enabled)}>
      ${canEm ? html`<sw-button slot="actions" variant="danger" icon="warning" data-dw-emergency @click=${() => (this.sheet = true)}>${dwt('emergency')}</sw-button>` : nothing}
      ${d.can.manage ? html`<sw-button slot="actions" variant="primary" icon="plus" data-dw-new @click=${() => this.openEditor()}>${dwt('newRule')}</sw-button>` : nothing}
      ${openableDoors(d).length ? html`<sw-button slot="actions" variant="secondary" icon="clock" data-dw-openfor-btn @click=${() => this.askOpenFor('')}>${dwe('ofBtn')}</sw-button>` : nothing}
      <sw-button slot="actions" variant="ghost" icon="calendar" data-dw-holidays-btn @click=${() => (this.holidaysOpen = true)}>${dwe('hlBtn')}</sw-button>
      ${canManageGrants(em) ? html`<sw-button slot="actions" variant="ghost" icon="user" data-dw-grants-btn @click=${() => (this.grantsOpen = true)}>${dwt('grBtn')}</sw-button>` : nothing}
      ${d.can.configure ? html`<sw-button slot="actions" variant="ghost" icon="system" data-dw-settings-btn @click=${() => void this.openSettings()}>${dwt('settings')}</sw-button>` : nothing}
      <sw-button slot="actions" variant="ghost" icon="refresh" iconOnly label=${dwt('refresh')} @click=${() => void this.load()}></sw-button>
      <div class="stack">
        ${incidentLive(em?.active) ? html`<door-emergency-strip .incident=${em!.active} .holdMs=${em!.hold_ms} @changed=${() => void this.load()}></door-emergency-strip>` : nothing}
        ${incidentLive(em?.drill) ? html`<door-emergency-strip .incident=${em!.drill} .holdMs=${em!.hold_ms} @changed=${() => void this.load()}></door-emergency-strip>` : nothing}
        ${!d.enabled ? html`<div class="callout" data-tone="off" data-dw-banner="off"><sw-icon name="info"></sw-icon><span><b>${dwt('offTitle')}</b>${dwt('offText')}</span></div>`
          : d.tier === 'prepared' ? html`<div class="callout" data-tone="warn" data-dw-banner="prepared"><sw-icon name="info"></sw-icon><span><b>${dwt('preparedTitle')}</b>${dwt('preparedText')}</span></div>` : nothing}
        ${this.renderAlarms()}
        ${this.renderWeek()}
        ${this.renderRules()}
        <door-event-rules .data=${d} @changed=${() => void this.load()} @notice=${(e: CustomEvent<string>) => this.flash(e.detail)}></door-event-rules>
      </div>
      ${this.renderEditor()}
      ${this.draft ? nothing : this.renderConfirm()}
      ${this.renderManual()}
      ${this.renderSettings()}
      <door-holidays .open=${this.holidaysOpen} .canManage=${d.can.manage} .canConfigure=${d.can.configure} .today=${this.today()}
        @close=${() => (this.holidaysOpen = false)} @changed=${() => void this.load()} @notice=${(e: CustomEvent<string>) => this.flash(e.detail)}></door-holidays>
      <door-open-for .open=${this.openForOpen} .doors=${openableDoors(d)} .preset=${this.openForDoor} .maxHours=${limitsOf(d.settings).maxHours} .nowIso=${d.now}
        @close=${() => (this.openForOpen = false)} @changed=${() => void this.load()} @notice=${(e: CustomEvent<string>) => this.flash(e.detail)}></door-open-for>
      <door-emergency-grants .open=${this.grantsOpen} @close=${() => (this.grantsOpen = false)} @notice=${(e: CustomEvent<string>) => this.flash(e.detail)}></door-emergency-grants>
      <door-emergency-sheet .open=${this.sheet} .data=${em} @close=${() => (this.sheet = false)} @changed=${() => void this.loadEmergency()}></door-emergency-sheet>
      ${this.toast ? html`<div class="toast" role="status">${this.toast}</div>` : nothing}
    </sw-page>`;
  }

  private renderAlarms(): TemplateResult | typeof nothing {
    const list = alarms(this.data!.occurrences);
    if (!list.length) return nothing;
    return html`<section data-dw-alarms><h2>${dwt('alarmsTitle')}</h2>
      ${list.map((o) => {
        const door = this.doorOf(o.door);
        return html`<div class="card alarm" data-dw-alarm=${o.door}>
          <div class="top"><b>${dwt('alarmTitle')}</b><span class="chip" data-tone="err">${dwt('occ_relock_unconfirmed')}</span></div>
          <div>${dwt('alarmText', { door: o.label, end: hm(o.end_at, o.zone) })}</div>
          <div class="muted">${o.last_reason === 'feed_unavailable' ? dwt('alarmFeed') : dwt('alarmRetries', { n: o.retries })}</div>
          ${door?.cancel ? html`<div><sw-button variant="danger" size="sm" data-dw-manual @click=${() => (this.manual = { occ: o, checked: '' })}>${dwt('confirmManual')}</sw-button></div>` : nothing}
        </div>`;
      })}</section>`;
  }

  private occWord(o: Occurrence): string {
    if (o.state === 'closed_confirmed' && o.resolution && o.resolution !== 'engine_idle') return dwtDynamic(`res_${o.resolution}`, 'occ_closed_confirmed');
    return dwtDynamic(`occ_${o.state}`, 'occ_armed', { end: hm(o.end_at, o.zone) });
  }

  private renderWeek(): TemplateResult {
    const groups = byDoor(this.data!.occurrences.filter((o) => o.state !== 'relock_unconfirmed'), this.data!.doors, this.data!.now);
    return html`<section data-dw-week><h2>${dwt('weekTitle')}</h2>
      ${groups.length ? groups.map((g) => html`<div class="card doorrow" data-dw-door=${g.door.key}>
        <div class="top"><b>${g.door.label}</b><span class="acts">${'exterior' in g.door && g.door.exterior ? html`<span class="chip" data-tone="warn">${dwt('exterior')}</span>` : nothing}
          ${openableDoors(this.data!).some((x) => x.key === g.door.key) ? html`<sw-button size="sm" variant="ghost" icon="clock" data-dw-openfor-door-btn @click=${() => this.askOpenFor(g.door.key)}>${dwe('ofBtn')}</sw-button>` : nothing}</span></div>
        ${g.items.slice(0, 8).map((o) => html`<div class="occ" data-dw-occ=${o.state}>
          <span class="when">${dwt(`wd${weekdayOf(localDay(o.start_at, o.zone))}` as DwtKey)} ${hm(o.start_at, o.zone)}–${hm(o.end_at, o.zone)}</span>
          <span class="chip" data-tone=${OCC_TONE[o.state]}>${this.occWord(o)}</span>
          ${canEndNow(o, this.doorOf(o.door)) ? html`<sw-button size="sm" variant="secondary" data-dw-endnow @click=${() => this.askEndNow(o)}>${dwt('endNow')}</sw-button>` : nothing}
        </div>`)}
      </div>`) : html`<div class="muted" data-dw-week-empty>${dwt('weekEmpty')}</div>`}
    </section>`;
  }

  private hoursOf(rule: Rule): TemplateResult {
    return html`<div class="hours">${periodLines(rule).map((l) => html`<span>${l.date
      ? l.date
      : dayRuns(l.days).map(([a, b]) => (a === b ? dwt(`wd${a}` as DwtKey) : `${dwt(`wd${a}` as DwtKey)}–${dwt(`wd${b}` as DwtKey)}`)).join(', ')} · ${l.hours}</span>`)}</div>`;
  }

  private renderRules(): TemplateResult {
    const rules = this.data!.rules.filter((r) => r.kind !== 'event'); // the event rules have their own section (door-event-rules)
    return html`<section data-dw-rules><h2>${dwt('rulesTitle')}</h2>
      ${rules.length ? html`<div class="rules">
        <div class="head"><span>${dwt('colName')}</span><span>${dwt('colDoors')}</span><span>${dwt('colHours')}</span><span>${dwt('colState')}</span></div>
        ${rules.map((r) => html`<div class="card rule" data-dw-rule=${r.id} data-dw-rule-state=${r.state}>
          <div><b>${r.name}</b><div class="muted">${dwt(`kind_${r.kind}` as DwtKey)}</div></div>
          <div class="chips">${r.doors.filter((x) => x.visible).map((x) => html`<span class="chip">${x.label}</span>`)}</div>
          ${this.hoursOf(r)}
          <div class="acts"><span class="chip" data-tone=${RULE_TONE[r.state]}>${dwt(`rs_${r.state}` as DwtKey)}</span>
            ${r.manageable ? html`
              <sw-button size="sm" variant="ghost" icon="edit" data-dw-edit @click=${() => this.openEditor(r)}>${dwt('edit')}</sw-button>
              ${r.state === 'enabled'
                ? html`<sw-button size="sm" variant="ghost" icon="pause" data-dw-pause @click=${() => this.askRule(r, 'pause')}>${dwt('pause')}</sw-button>`
                : html`<sw-button size="sm" variant="secondary" icon="play" data-dw-enable @click=${() => this.askRule(r, 'enable')}>${dwt('enable')}</sw-button>`}
              <sw-button size="sm" variant="ghost" icon="trash" data-dw-retire @click=${() => this.askRule(r, 'retire')}>${dwt('retire')}</sw-button>` : nothing}
          </div>
        </div>`)}
      </div>` : html`<div class="muted" data-dw-rules-empty>${dwt('rulesEmpty')} ${this.data!.can.manage ? dwt('rulesEmptyManage') : ''}</div>`}
    </section>`;
  }

  private renderRanges(ranges: Range[], set: (fn: (rs: Range[]) => void) => void): TemplateResult {
    return html`${ranges.map((r, i) => html`<div class="range" data-dw-range=${i}>
      <label class="muted">${dwt('fFrom')} <input type="time" lang=${dateInputLang()} step="900" .value=${r.start} @change=${(e: Event) => set((rs) => (rs[i].start = (e.target as HTMLInputElement).value))}></label>
      <label class="muted">${dwt('fTo')} <input type="time" lang=${dateInputLang()} step="900" .value=${r.end === '24:00' ? '23:59' : r.end} @change=${(e: Event) => set((rs) => (rs[i].end = (e.target as HTMLInputElement).value))}></label>
      ${ranges.length > 1 ? html`<sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${dwt('fRemove')} @click=${() => set((rs) => rs.splice(i, 1))}></sw-button>` : nothing}
    </div>`)}
    <div><sw-button size="sm" variant="ghost" icon="plus" data-dw-addrange @click=${() => set((rs) => rs.push({ start: '12:00', end: '13:00' }))}>${dwt('fAddRange')}</sw-button></div>`;
  }

  private renderEditor(): TemplateResult | typeof nothing {
    const dr = this.draft;
    if (!dr) return nothing;
    const exteriorOk = this.data!.settings.exterior_allowed === 'true';
    const doors = this.data!.doors.filter((x) => x.manage && (exteriorOk || !x.exterior));
    const stations = [...new Set(doors.map((x) => x.station_name))];
    return html`<sw-drawer open modal heading=${dr.id ? dwt('editorEdit') : dwt('editorNew')} @close=${() => (this.draft = null)}>
      <div class="form" data-dw-editor>
        <div class="field"><label for="dw-name">${dwt('fName')}</label>
          <input id="dw-name" type="text" maxlength="60" placeholder=${dwt('fNamePh')} .value=${dr.name} @input=${(e: Event) => this.patch((d) => (d.name = (e.target as HTMLInputElement).value))}></div>
        <div class="field"><span class="lbl">${dwt('fKind')}</span><div class="seg" role="group">
          ${(['weekly', 'once'] as const).map((k) => html`<button type="button" aria-pressed=${String(dr.kind === k)} ?disabled=${!!dr.id} data-dw-kind=${k}
              @click=${() => this.patch((d) => (d.kind = k))}>${dwt(`kind_${k}` as DwtKey)}</button>`)}</div></div>
        <div class="field"><span class="lbl">${dwt('fDoors')}</span>
          <div class="doors" data-dw-doors>${stations.map((st) => html`${st ? html`<div class="st">${st}</div>` : nothing}
            ${doors.filter((x) => x.station_name === st).map((x) => html`<label><input type="checkbox" data-dw-door=${x.key} .checked=${dr.doors.has(x.key)}
              @change=${(e: Event) => this.patch((d) => ((e.target as HTMLInputElement).checked ? d.doors.add(x.key) : d.doors.delete(x.key)))}>${x.name}</label>`)}`)}</div>
          <span class="muted">${dwt('fDoorsHint')}</span></div>
        ${dr.kind === 'weekly' && !dr.perDay ? html`
          <div class="field"><span class="lbl">${dwt('fDays')}</span><div class="days" role="group">
            ${DAYS.map((wd) => html`<button type="button" aria-pressed=${String(dr.days.has(wd))} data-dw-day=${wd}
              @click=${() => this.patch((d) => (d.days.has(wd) ? d.days.delete(wd) : d.days.add(wd)))}>${dwt(`wd${wd}` as DwtKey)}</button>`)}</div></div>
          <div class="field">${this.renderRanges(dr.ranges, (fn) => this.patch((d) => fn(d.ranges)))}</div>` : nothing}
        ${dr.kind === 'weekly' && dr.perDay ? html`${[...dr.perDay.entries()].sort((a, b) => a[0] - b[0]).map(([wd, rs]) => html`
          <div class="field"><span class="lbl">${dwt(`wd${wd}` as DwtKey)}</span>${this.renderRanges(rs, (fn) => this.patch((d) => fn(d.perDay!.get(wd)!)))}</div>`)}` : nothing}
        ${dr.kind === 'once' ? html`
          <div class="field"><label for="dw-date">${dwt('fDate')}</label><input id="dw-date" type="date" lang=${dateInputLang()} .value=${dr.date} min=${this.today()}
            @change=${(e: Event) => this.patch((d) => (d.date = (e.target as HTMLInputElement).value))}></div>
          <div class="field">${this.renderRanges(dr.ranges, (fn) => this.patch((d) => fn(d.ranges)))}</div>` : nothing}
        ${dr.kind === 'weekly' ? html`<div class="field"><label for="dw-cal">${dwt('fCalendar')}</label>
          <select id="dw-cal" @change=${(e: Event) => this.patch((d) => (d.calendar = (e.target as HTMLSelectElement).value as CalendarPolicy))}>
            ${CALENDARS.map((c) => html`<option value=${c} ?selected=${dr.calendar === c}>${dwt(`cal_${c}` as DwtKey)}</option>`)}</select></div>` : nothing}
        ${this.preview ? html`<div class="preview card" data-dw-preview><b>${dwt('previewTitle')}</b>
          <span class="muted">${this.preview.tier === 'prepared' ? dwt('previewPrepared') : dwt('previewEngine')}</span>
          ${this.preview.doors.map((p) => html`<div><b>${p.label}</b>
            ${p.occurrences.length ? html`<ul class="lines">${p.occurrences.map((o) => html`<li><span>${dwt(`wd${weekdayOf(localDay(o.start_at, p.zone))}` as DwtKey)} ${localDay(o.start_at, p.zone)}</span>
              <span>${hm(o.start_at, p.zone)}–${hm(o.end_at, p.zone)}</span></li>`)}</ul>` : html`<div class="muted">${dwt('previewNone')}</div>`}</div>`)}
        </div>` : nothing}
        ${this.draftError ? html`<div class="err" role="alert" data-dw-error>${this.draftError}</div>` : nothing}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" data-dw-preview-btn @click=${() => void this.doPreview()}>${dwt('preview')}</sw-button>
        <sw-button variant="secondary" data-dw-save-draft ?disabled=${this.busy} @click=${() => this.save(false)}>${dwt('saveDraft')}</sw-button>
        <sw-button variant="primary" data-dw-save-enable ?disabled=${this.busy} @click=${() => this.save(true)}>${dwt('saveEnable')}</sw-button>
      </div>
      ${this.renderConfirm() /* a modal drawer keeps its confirmation inside itself (sw-drawer `modal`) */}
    </sw-drawer>`;
  }

  private renderConfirm(): TemplateResult | typeof nothing {
    const c = this.confirm;
    if (!c) return nothing;
    return html`<sw-dialog open heading=${c.title} @close=${() => (this.confirm = null)} data-dw-confirm>
      <p>${c.text}</p>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => (this.confirm = null)}>${dwt('cancel')}</sw-button>
        <sw-button variant=${c.danger ? 'danger' : 'primary'} data-dw-confirm-btn ?disabled=${this.busy} @click=${() => void this.run(c)}>${c.btn}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderManual(): TemplateResult | typeof nothing {
    const m = this.manual;
    if (!m) return nothing;
    return html`<sw-dialog open heading=${dwt('manualTitle')} @close=${() => (this.manual = null)} data-dw-manual-dialog>
      <p>${dwt('manualText')}</p>
      <div class="radio" role="radiogroup">
        ${(['camera', 'door'] as const).map((k) => html`<label><input type="radio" name="checked" data-dw-checked=${k} .checked=${m.checked === k}
          @change=${() => (this.manual = { ...m, checked: k })}> ${dwt(k === 'camera' ? 'manualCamera' : 'manualDoor')}</label>`)}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => (this.manual = null)}>${dwt('cancel')}</sw-button>
        <sw-button variant="danger" data-dw-manual-confirm ?disabled=${!m.checked || this.busy} @click=${() => void this.saveManual()}>${dwt('manualBtn')}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'door-windows-screen': DoorWindowsScreen;
  }
}
