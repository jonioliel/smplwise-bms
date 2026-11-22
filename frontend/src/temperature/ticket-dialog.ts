import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { getTicketDraft, openTicket, type TicketDraft } from '../api/temperature';
import { tempCss } from './styles';
import { tt, ttLang } from '../i18n/temperature';
import { errLineStyles } from '../styles/fragments';
import '../components/sw-field';

/**
 * CR-INFRA-TEMPERATURE phase 3 (idea 11): "קריאת שירות" from a unit's detail - a ticket in the service module, opened AS the person, through
 * the module's own creation path (its rules decide the department and the permission). The dialog loads the server's draft (the title, the
 * description with the unit, the event, the values and the link back, the departments the person may open a ticket in), lets him edit it, and
 * opens the ticket with the 24-hour chart attached as a picture (a setting). A repeat while the ticket is open joins it. Events: `done`
 * {message}, `close`.
 */
@customElement('temp-ticket')
export class TempTicket extends LitElement {
  @property() unitId = '';
  @property() eventId: string | null = null;
  @state() private draft: TicketDraft | null = null;
  @state() private dept = '';
  @state() private subject = '';
  @state() private desc = '';
  @state() private chart = true;
  @state() private err = '';
  @state() private busy = false;

  static styles = [tempCss, css`
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A): the system's one dialog (sw-dialog: the scrim, the opaque centred box, the title
       and the close button on top, the actions on the bottom, focus trap, Escape, focus return, the phone's bottom sheet). */
    :host { display: contents; }
    .form { display: grid; gap: 12px; align-content: start; }
    .field { display: grid; gap: 6px; }
    label.l { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .in { min-block-size: var(--sw-ctl-h-md); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 12px; font: inherit; box-sizing: border-box; inline-size: 100%; }
    textarea.in { padding: 10px 12px; min-block-size: 150px; resize: vertical; line-height: 1.5; }
    .sw { display: inline-flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .bar { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; flex: 1; min-inline-size: 0; }
    ${errLineStyles}
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private async load() {
    try {
      const d = await getTicketDraft(this.unitId, this.eventId, ttLang() === 'en' ? 'en' : 'he');
      this.draft = d;
      this.dept = d.department_id ?? '';
      this.subject = d.title;
      this.desc = d.description;
      this.chart = d.attach_chart;
    } catch (e) {
      this.err = describeError(e);
    }
  }

  private async submit() {
    if (!this.dept) return;
    this.busy = true;
    this.err = '';
    try {
      const r = await openTicket(this.unitId, { department_id: this.dept, title: this.subject.trim(), description: this.desc, event_id: this.eventId, attach_chart: this.chart,
        lang: ttLang() === 'en' ? 'en' : 'he' });
      this.dispatchEvent(new CustomEvent('done', { detail: { message: tt(r.result === 'absorbed' ? 'ticketAbsorbed' : 'ticketOpened', { n: r.number }), ticketId: r.ticket_id } }));
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const d = this.draft;
    return html`<sw-dialog open wide heading=${tt('ticketTitle')} @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      <div class="form" data-temp-ticket>
        ${!d ? (this.err ? html`<p class="err" role="alert">${this.err}</p>` : html`<div class="skl" style="block-size:200px"></div>`)
          : !d.departments.length ? html`<p class="hint" data-ticket-nodept>${tt('ticketNoDept')}</p>`
          : html`<div class="field"><label class="l" for="tk-dept">${tt('ticketDept')}</label>
              <sw-field flow><select id="tk-dept" class="in" data-ticket-dept @change=${(e: Event) => { this.dept = (e.target as HTMLSelectElement).value; }}>
                <option value="" ?selected=${!this.dept}>${tt('ticketChoose')}</option>
                ${d.departments.map((x) => html`<option value=${x.id} ?selected=${this.dept === x.id}>${x.name}</option>`)}</select></sw-field></div>
            <div class="field"><label class="l" for="tk-subj">${tt('ticketSubject')}</label><input id="tk-subj" class="in" maxlength="200" .value=${this.subject}
              @input=${(e: Event) => { this.subject = (e.target as HTMLInputElement).value; }} data-ticket-title /></div>
            <div class="field"><label class="l" for="tk-desc">${tt('ticketDesc')}</label><textarea id="tk-desc" class="in" maxlength="4000" .value=${this.desc}
              @input=${(e: Event) => { this.desc = (e.target as HTMLTextAreaElement).value; }} data-ticket-desc></textarea></div>
            <label class="sw"><input type="checkbox" .checked=${this.chart} @change=${(e: Event) => { this.chart = (e.target as HTMLInputElement).checked; }} data-ticket-chart />${tt('ticketChart')}</label>`}
      </div>
        <div slot="footer" class="bar">${this.err && d ? html`<span class="err" role="alert">${this.err}</span>` : nothing}
          <button type="button" class="btn ghost" @click=${() => this.close()}>${tt('cancel')}</button>
          ${d?.departments.length ? html`<button type="button" class="btn pri" ?disabled=${this.busy || !this.dept || !this.subject.trim()} data-ticket-open @click=${() => this.submit()}>
            <sw-icon name="ticket" size="16"></sw-icon>${tt('ticketOpen')}</button>` : nothing}</div>
      </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-ticket': TempTicket;
  }
}
