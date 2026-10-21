import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-dialog';
import { ApiError, describeError } from '../api/client';
import { armRule, createRule, newToken, ruleAction, updateRule, type Rule, type RuleSaved, type TriggerLogRow, type WindowsState } from '../api/door-windows';
import { dwt, type DwtKey } from '../i18n/door-windows';
import { dwe, dweDynamic, type DweKey } from '../i18n/door-windows-events';
import { hm, localDay, RULE_TONE } from './logic';
import {
  DECISION_TONE, RULE_SOURCES, STORM_PER_HOUR, armView, emptyEventDraft, eventBodyOf, eventDraftOf, eventProblem, eventRules, limitsOf, reasonKey, triggerFacts,
  type EventDraft,
} from './events-logic';
import { dwCss } from './styles';
import { dweCss } from './events-styles';

type Confirm = { title: string; text: string; btn: string; danger?: boolean; run: () => Promise<unknown> };

/**
 * DOORWIN3-295 / CR-039 9: "חלונות לפי אירוע" - the event-rule editor and list of the door-windows screen.
 *  - the cards of the event rules: source, doors, length / hours / day cap / cooldown, and the simulate / armed state in plain chips;
 *  - the editor drawer: name, source (external event | automation), doors (only those the person manages), length, allowed hours, caps;
 *  - the one-time event code (and the action text that carries it) after a save or a new code;
 *  - the last starts (`triggers` of the state): started / extended / simulated / refused with the reason.
 * A rule is SIMULATED unless a person armed it, and arming is refused by the server today (no verified automation identity): the card says so
 * with a chip, never a paragraph, and offers no arming button then. Gated like the API: `door_windows_manager` (state.can.manage; every write
 * names the doors it touches and the server re-checks each one). Nothing here opens a door.
 */
@customElement('door-event-rules')
export class DoorEventRules extends LitElement {
  static styles = [dwCss, dweCss];

  @property({ attribute: false }) data: WindowsState | null = null;
  @state() private draft: EventDraft | null = null;
  @state() private draftError = '';
  @state() private busy = false;
  @state() private confirm: Confirm | null = null;
  @state() private secret: { name: string; token: string; snippet: string } | null = null;
  @state() private copied = false;

  private tell(text: string): void {
    this.dispatchEvent(new CustomEvent('notice', { detail: text, bubbles: true, composed: true }));
  }

  private changed(): void {
    this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
  }

  private async run(c: Confirm): Promise<void> {
    this.busy = true;
    try {
      await c.run();
      this.confirm = null;
      this.tell(dwt('done'));
      this.changed();
    } catch (err) {
      this.confirm = null;
      this.tell(err instanceof ApiError && err.code === 'automation_actor_unavailable' ? dwe('armRefused') : `${dwt('failed')}: ${describeError(err)}`);
    } finally {
      this.busy = false;
    }
  }

  private ask(c: Omit<Confirm, 'title'>): void {
    this.confirm = { title: dwt('confirmTitle'), ...c };
  }

  private askRule(rule: Rule, action: 'enable' | 'pause' | 'retire'): void {
    const text: Record<typeof action, DwtKey> = { enable: 'confirmEnable', pause: 'confirmPause', retire: 'confirmRetire' };
    this.ask({ text: dwt(text[action]), btn: dwt(action), danger: action === 'retire', run: () => ruleAction(rule.id, action) });
  }

  private askArm(rule: Rule, armed: boolean): void {
    this.ask({ text: dwe(armed ? 'confirmArm' : 'confirmDisarm'), btn: dwe(armed ? 'armBtn' : 'disarmBtn'), danger: armed, run: () => armRule(rule.id, armed) });
  }

  private askToken(rule: Rule): void {
    this.ask({
      text: dwe('confirmToken'), btn: dwe('tokenNew'),
      run: async () => {
        const out = await newToken(rule.id);
        this.secret = { name: rule.name, token: out.token, snippet: out.snippet };
      },
    });
  }

  // ---------------------------------------------------------------- editor

  private openEditor(rule?: Rule): void {
    this.draft = rule ? eventDraftOf(rule) : emptyEventDraft();
    this.draftError = '';
  }

  private patch(fn: (d: EventDraft) => void): void {
    if (!this.draft) return;
    const d: EventDraft = { ...this.draft, doors: new Set(this.draft.doors) };
    fn(d);
    this.draft = d;
    this.draftError = '';
  }

  private problem(): string {
    if (!this.draft || !this.data) return '';
    const p = eventProblem(this.draft, limitsOf(this.data.settings));
    return p ? (p.scope === 'dwe' ? dwe(p.key as DweKey, p.vars) : dwt(p.key as DwtKey, p.vars)) : '';
  }

  private save(enable: boolean): void {
    const problem = this.problem();
    if (problem || !this.draft) {
      this.draftError = problem;
      return;
    }
    const d = this.draft;
    const go = async () => {
      const body = eventBodyOf(d, enable);
      const out: RuleSaved = d.id ? await updateRule(d.id, body) : await createRule(body);
      this.draft = null;
      if (out.token) this.secret = { name: d.name.trim(), token: out.token, snippet: out.snippet ?? '' };
    };
    if (enable) this.ask({ text: dwt('confirmEnable'), btn: dwt('saveEnable'), run: go });
    else void this.run({ title: '', text: '', btn: '', run: go });
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      window.setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.copied = false; // the text stays selectable in the box
    }
  }

  // ---------------------------------------------------------------- render

  private logWhen(row: TriggerLogRow): string {
    const zone = this.data?.doors.find((d) => d.key === row.door)?.zone ?? 'Asia/Jerusalem';
    const day = localDay(row.at, zone);
    return `${day.slice(8, 10)}.${day.slice(5, 7)} ${hm(row.at, zone)}`;
  }

  protected render(): TemplateResult | typeof nothing {
    const d = this.data;
    if (!d) return nothing;
    const rules = eventRules(d.rules);
    if (!rules.length && !d.can.manage && !(d.triggers ?? []).length) return nothing;
    return html`<section data-dw-events>
      <div class="head"><h2>${dwe('evSection')}</h2>
        <div class="acts">
          <span class="chip num" data-dw-storm>${dwe('capStorm', { n: STORM_PER_HOUR })}</span>
          ${d.settings.max_per_day_per_door ? html`<span class="chip num">${dwe('capDay', { n: d.settings.max_per_day_per_door })}</span>` : nothing}
          ${d.settings.quiet_from ? html`<span class="chip num">${dwe('capQuiet', { from: d.settings.quiet_from, to: d.settings.quiet_to })}</span>` : nothing}
          ${d.can.manage ? html`<sw-button size="sm" variant="secondary" icon="plus" data-dw-new-event @click=${() => this.openEditor()}>${dwe('evNew')}</sw-button>` : nothing}
        </div></div>
      ${rules.length ? rules.map((r) => this.renderCard(r)) : html`<div class="muted" data-dw-events-empty>${dwe('evEmpty')}</div>`}
      ${this.renderLog()}
      ${this.renderEditor()}
      ${this.draft ? nothing : this.renderConfirm()}
      ${this.renderSecret()}
    </section>`;
  }

  private renderCard(r: Rule): TemplateResult {
    const t = r.trigger!;
    const arm = armView(t, !!r.manageable, this.data!.automation_actor);
    return html`<div class="card" data-dw-event-rule=${r.id} data-dw-rule-state=${r.state} data-dw-arm=${t.arm_state} data-dw-source=${t.source}>
      <div class="top"><b>${r.name}</b>
        <div class="chips">
          <span class="chip" data-tone=${RULE_TONE[r.state]}>${dwt(`rs_${r.state}` as DwtKey)}</span>
          <span class="chip" data-tone=${arm.tone} data-dw-arm-chip>${dwe(arm.state)}</span>
          ${arm.unavailable ? html`<span class="chip" data-tone="off" data-dw-arm-unavailable>${dwe('arm_unavailable')}</span>` : nothing}
        </div></div>
      <div class="chips"><span class="chip" data-tone="acc">${dwe(`src_${t.source}` as DweKey)}</span>
        ${t.source === 'arx_automation' && t.automation_id ? html`<span class="chip num">${t.automation_id}</span>` : nothing}
        ${t.source === 'ha_event' && t.has_token ? html`<span class="chip">${dwe('tokenHas')}</span>` : nothing}
        ${r.doors.filter((x) => x.visible).map((x) => html`<span class="chip">${x.label}</span>`)}</div>
      <div class="chips">${triggerFacts(t).map((f) => html`<span class="chip num">${dwe(f.key, f.vars)}</span>`)}</div>
      ${r.manageable ? html`<div class="acts">
        <sw-button size="sm" variant="ghost" icon="edit" data-dw-edit @click=${() => this.openEditor(r)}>${dwt('edit')}</sw-button>
        ${r.state === 'enabled'
          ? html`<sw-button size="sm" variant="ghost" icon="pause" data-dw-pause @click=${() => this.askRule(r, 'pause')}>${dwt('pause')}</sw-button>`
          : html`<sw-button size="sm" variant="secondary" icon="play" data-dw-enable @click=${() => this.askRule(r, 'enable')}>${dwt('enable')}</sw-button>`}
        ${arm.action === 'arm' ? html`<sw-button size="sm" variant="secondary" icon="bolt" data-dw-arm @click=${() => this.askArm(r, true)}>${dwe('armBtn')}</sw-button>` : nothing}
        ${arm.action === 'disarm' ? html`<sw-button size="sm" variant="secondary" data-dw-disarm @click=${() => this.askArm(r, false)}>${dwe('disarmBtn')}</sw-button>` : nothing}
        ${t.source === 'ha_event' ? html`<sw-button size="sm" variant="ghost" icon="link" data-dw-token @click=${() => this.askToken(r)}>${dwe('tokenNew')}</sw-button>` : nothing}
        <sw-button size="sm" variant="ghost" icon="trash" data-dw-retire @click=${() => this.askRule(r, 'retire')}>${dwt('retire')}</sw-button>
      </div>` : nothing}
    </div>`;
  }

  private renderLog(): TemplateResult | typeof nothing {
    const log = this.data!.triggers ?? [];
    if (!log.length && !eventRules(this.data!.rules).length) return nothing;
    const door = (k: string) => this.data!.doors.find((x) => x.key === k)?.label ?? k;
    return html`<div class="card" data-dw-trigger-log><b>${dwe('logTitle')}</b>
      ${log.length ? html`<ul class="lines">${log.map((row) => html`<li data-dw-log=${row.decision}>
        <span>${door(row.door)} <span class="muted num">${this.logWhen(row)}</span></span>
        <span class="chips"><span class="chip">${dwe(`src_${row.source}` as DweKey)}</span>
          <span class="chip" data-tone=${DECISION_TONE[row.decision]}>${dwe(`dec_${row.decision}` as DweKey)}</span>
          ${row.reason ? html`<span class="chip" data-tone="off">${dweDynamic(reasonKey(row.reason), 'reason_other')}</span>` : nothing}</span>
      </li>`)}</ul>` : html`<div class="muted">${dwe('logEmpty')}</div>`}
    </div>`;
  }

  private renderEditor(): TemplateResult | typeof nothing {
    const dr = this.draft;
    if (!dr || !this.data) return nothing;
    const lim = limitsOf(this.data.settings);
    const exteriorOk = this.data.settings.exterior_allowed === 'true';
    const doors = this.data.doors.filter((x) => x.manage && (exteriorOk || !x.exterior));
    const stations = [...new Set(doors.map((x) => x.station_name))];
    const text = (id: string, value: string, set: (d: EventDraft, v: string) => void) => html`<input id=${id} type="text" inputmode="numeric"
      data-dw-field=${id} .value=${value} @input=${(e: Event) => this.patch((d) => set(d, (e.target as HTMLInputElement).value))}>`;
    return html`<sw-drawer open modal heading=${dr.id ? dwe('evEditorEdit') : dwe('evEditorNew')} @close=${() => (this.draft = null)}>
      <div class="form" data-dw-event-editor>
        <div class="field"><label for="dwe-name">${dwt('fName')}</label>
          <input id="dwe-name" type="text" maxlength="60" .value=${dr.name} @input=${(e: Event) => this.patch((d) => (d.name = (e.target as HTMLInputElement).value))}></div>
        <div class="field"><span class="lbl">${dwe('src_label')}</span><div class="seg" role="group">
          ${RULE_SOURCES.map((s) => html`<button type="button" aria-pressed=${String(dr.source === s)} data-dw-source-pick=${s}
            @click=${() => this.patch((d) => (d.source = s))}>${dwe(`src_${s}` as DweKey)}</button>`)}</div></div>
        ${dr.source === 'arx_automation' ? html`<div class="field"><label for="dwe-auto">${dwe('fAutomation')}</label>
          <input id="dwe-auto" class="code" type="text" maxlength="90" placeholder=${dwe('fAutomationPh')} .value=${dr.automationId}
            @input=${(e: Event) => this.patch((d) => (d.automationId = (e.target as HTMLInputElement).value))}></div>` : nothing}
        <div class="field"><span class="lbl">${dwt('fDoors')}</span>
          <div class="doors" data-dw-doors>${stations.map((st) => html`${st ? html`<div class="st">${st}</div>` : nothing}
            ${doors.filter((x) => x.station_name === st).map((x) => html`<label><input type="checkbox" data-dw-door=${x.key} .checked=${dr.doors.has(x.key)}
              @change=${(e: Event) => this.patch((d) => ((e.target as HTMLInputElement).checked ? d.doors.add(x.key) : d.doors.delete(x.key)))}>${x.name}</label>`)}`)}</div></div>
        <div class="row2">
          <div class="field"><label for="dwe-dur">${dwe('fDurationMin')}</label>${text('dwe-dur', dr.durationMin, (d, v) => (d.durationMin = v))}</div>
          <div class="field"><label for="dwe-cap">${dwe('fMaxPerDay')}</label>${text('dwe-cap', dr.maxPerDay, (d, v) => (d.maxPerDay = v))}</div>
          <div class="field"><label for="dwe-cool">${dwe('fCooldownMin')}</label>${text('dwe-cool', dr.cooldownMin, (d, v) => (d.cooldownMin = v))}</div>
        </div>
        <div class="field"><label class="chk"><input type="checkbox" data-dw-limit .checked=${dr.limitHours}
            @change=${(e: Event) => this.patch((d) => (d.limitHours = (e.target as HTMLInputElement).checked))}>${dwe('fAllowedLimit')}</label>
          ${dr.limitHours ? html`<div class="row2">
            <label class="muted">${dwe('fAllowedFrom')} <input type="time" step="900" .value=${dr.from} @change=${(e: Event) => this.patch((d) => (d.from = (e.target as HTMLInputElement).value))}></label>
            <label class="muted">${dwe('fAllowedTo')} <input type="time" step="900" .value=${dr.to === '24:00' ? '23:59' : dr.to} @change=${(e: Event) => this.patch((d) => (d.to = (e.target as HTMLInputElement).value))}></label>
          </div>` : html`<span class="muted">${dwe('fAllowedAll')}</span>`}
          <span class="chip num">${dwe('capQuiet', { from: lim.quiet[0], to: lim.quiet[1] })}</span></div>
        ${dr.id && dr.source === 'ha_event' ? html`<label class="chk"><input type="checkbox" data-dw-regenerate .checked=${dr.regenerate}
            @change=${(e: Event) => this.patch((d) => (d.regenerate = (e.target as HTMLInputElement).checked))}>${dwe('fRegenerate')}</label>` : nothing}
        ${this.draftError ? html`<div class="err" role="alert" data-dw-error>${this.draftError}</div>` : nothing}
      </div>
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => (this.draft = null)}>${dwt('cancel')}</sw-button>
        <sw-button variant="secondary" data-dw-save-draft ?disabled=${this.busy} @click=${() => this.save(false)}>${dwt('saveDraft')}</sw-button>
        <sw-button variant="primary" data-dw-save-enable ?disabled=${this.busy} @click=${() => this.save(true)}>${dwt('saveEnable')}</sw-button>
      </div>
      ${this.renderConfirm() /* a modal drawer keeps its confirmation inside itself */}
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

  private renderSecret(): TemplateResult | typeof nothing {
    const s = this.secret;
    if (!s) return nothing;
    return html`<sw-dialog open heading=${dwe('tokenTitle')} subheading=${s.name} @close=${() => (this.secret = null)} data-dw-secret>
      <pre class="snippet" data-dw-snippet>${s.snippet || s.token}</pre>
      <div slot="footer" class="footer">
        <sw-button variant="secondary" icon="copy" data-dw-copy @click=${() => void this.copy(s.snippet || s.token)}>${this.copied ? dwe('tokenCopied') : dwe('tokenCopy')}</sw-button>
        <sw-button variant="primary" @click=${() => (this.secret = null)}>${dwt('close')}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'door-event-rules': DoorEventRules;
  }
}
