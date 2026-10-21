import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { openFor, type DoorRow } from '../api/door-windows';
import { dwt } from '../i18n/door-windows';
import { dwe, dweDynamic } from '../i18n/door-windows-events';
import { hm } from './logic';
import { hourChoices, plannedEnd, reasonKey, refusalReason } from './events-logic';
import { dwCss } from './styles';
import { dweCss } from './events-styles';

/**
 * DOORWIN3-295 / CR-039 9.1: "open for N hours" - the `arx_button` source. A person picks a door they manage and a whole number of hours,
 * then confirms; the server (`POST /doors/windows/doors/{station}/{relay}/open-for`) judges it like any event window (closed day, quiet hours,
 * midnight, caps, SR-5, emergency) and the engine holds and relocks - nothing opens from this dialog. Gated on `door_windows_manager`: only
 * the doors the state marks `manage` are offered, and the server re-checks. Two steps: choose, then confirm (the second names the end time).
 */
@customElement('door-open-for')
export class DoorOpenFor extends LitElement {
  static styles = [dwCss, dweCss];

  @property({ type: Boolean }) open = false;
  /** the doors the person may start a hold on (see `openableDoors`) */
  @property({ attribute: false }) doors: DoorRow[] = [];
  /** the door the dialog was opened from, or '' to choose */
  @property() preset = '';
  @property({ type: Number }) maxHours = 4;
  @property() nowIso = '';
  @state() private door = '';
  @state() private hours = 1;
  @state() private step: 'choose' | 'confirm' = 'choose';
  @state() private busy = false;
  @state() private error = '';

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      this.door = this.doors.find((d) => d.key === this.preset)?.key ?? this.doors[0]?.key ?? '';
      this.hours = 1;
      this.step = 'choose';
      this.error = '';
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private current(): DoorRow | undefined {
    return this.doors.find((d) => d.key === this.door);
  }

  private async start(): Promise<void> {
    const door = this.current();
    if (!door) return;
    this.busy = true;
    this.error = '';
    try {
      const out = await openFor(door.station_id, door.relay, this.hours * 3600);
      const end = out.decision.end_at ? hm(out.decision.end_at, door.zone) : hm(plannedEnd(this.nowIso || new Date().toISOString(), this.hours), door.zone);
      this.dispatchEvent(new CustomEvent('notice', { detail: dwe(out.decision.decision === 'extended' ? 'ofExtended' : 'ofStarted', { end }), bubbles: true, composed: true }));
      this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
      this.close();
    } catch (err) {
      const reason = refusalReason(err);
      this.error = reason ? dweDynamic(reasonKey(reason), 'reason_other') : describeError(err);
      this.step = 'choose';
    } finally {
      this.busy = false;
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    const door = this.current();
    const end = door ? hm(plannedEnd(this.nowIso || new Date().toISOString(), this.hours), door.zone) : '';
    return html`<sw-dialog open heading=${dwe('ofTitle')} @close=${() => this.close()} data-dw-openfor>
      ${!this.doors.length ? html`<div class="muted" data-dw-openfor-none>${dwe('ofNoDoors')}</div>` : this.step === 'choose' ? html`<div class="form">
        <div class="field"><label for="dwo-door">${dwe('ofDoor')}</label>
          <select id="dwo-door" data-dw-openfor-door @change=${(e: Event) => (this.door = (e.target as HTMLSelectElement).value)}>
            ${this.doors.map((d) => html`<option value=${d.key} ?selected=${d.key === this.door}>${d.label}</option>`)}</select></div>
        <div class="field"><span class="lbl">${dwe('ofHours')}</span><div class="seg" role="group" data-dw-openfor-hours>
          ${hourChoices(this.maxHours).map((n) => html`<button type="button" class="num" aria-pressed=${String(this.hours === n)} data-dw-hours=${n}
            @click=${() => (this.hours = n)}>${dwe('ofHoursN', { n })}</button>`)}</div></div>
        ${this.error ? html`<div class="err" role="alert" data-dw-error>${this.error}</div>` : nothing}
      </div>` : html`<p data-dw-openfor-confirm>${dwe('ofConfirmText', { door: door?.label ?? '', end })}</p>`}
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => (this.step === 'confirm' ? (this.step = 'choose') : this.close())}>${dwt('cancel')}</sw-button>
        ${this.doors.length ? (this.step === 'choose'
          ? html`<sw-button variant="primary" icon="clock" data-dw-openfor-next ?disabled=${!door} @click=${() => (this.step = 'confirm')}>${dwe('ofConfirm', { n: this.hours })}</sw-button>`
          : html`<sw-button variant="primary" data-dw-openfor-go ?disabled=${this.busy} @click=${() => void this.start()}>${dwt('confirmBtn')}</sw-button>`) : nothing}
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'door-open-for': DoorOpenFor;
  }
}
