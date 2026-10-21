import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import { settingsStyles } from '../styles/settings';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type SettingsDoc } from '../api/tickets';
import { vrt } from '../i18n/vendor-reports';
import { ticketSettingsCss } from './settings-styles';
import { REPORT_LIMITS, documentFieldsEnabled, limitedInt, numberPatch, reportsOf, subControlsEnabled, type ReportsPatch, type ReportsSettings } from './reports-settings-model';

/**
 * VENDORQ2-295: Settings > the module > message channel > "Reports to vendors" (system.configure - the administrators; the server checks
 * again). The three switches of CR-VENDORQ-294 (reports through the message queue, e-mail as the second channel, documents by a temporary
 * link - all OFF by default) and the link's two limits. No explanatory paragraphs. The card offers no ticket action, so the
 * tickets-module-off rule has nothing to hide; it is mounted only inside the module's settings, which exist only while the module is on.
 * An older server without the `reports` block shows nothing. Events: `notice` {ok | error}.
 */
@customElement('tickets-reports-settings')
export class TicketsReportsSettings extends LitElement {
  @state() private doc: SettingsDoc | null = null;
  @state() private busy = false;
  @state() private hoursDraft = '';
  @state() private opensDraft = '';

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host { display: block; min-inline-size: 0; }
    input.in.short { inline-size: 6em; }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private get current(): ReportsSettings | null {
    return reportsOf(this.doc?.reports);
  }

  async load(): Promise<void> {
    try {
      this.doc = await ticketsApi().settings();
      this.sync();
    } catch (e) {
      if (!(e instanceof ApiError && (e.status === 403 || e.status === 404))) this.notice({ error: describeError(e) });
    }
  }

  private sync(): void {
    const s = this.current;
    if (!s) return;
    this.hoursDraft = String(s.document_hours);
    this.opensDraft = String(s.document_max_opens);
  }

  private async save(patch: ReportsPatch): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    try {
      this.doc = await ticketsApi().saveInstallation(this.doc.revision, { reports: patch });
      this.sync();
      this.notice({ ok: vrt('saved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private toggle(label: 'toContacts' | 'email' | 'documents', key: 'to_contacts' | 'email' | 'documents', checked: boolean, off: boolean, attr: string) {
    return html`<div class="row"><span class="lbl">${vrt(label)}</span>
      <sw-toggle label=${vrt(label)} labelHidden .checked=${checked} ?disabled=${this.busy || off} data-reports=${attr}
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [key]: e.detail.checked })}></sw-toggle></div>`;
  }

  private numberRow(label: 'hours' | 'opens', unit: 'hoursUnit' | 'opensUnit', key: 'document_hours' | 'document_max_opens', draft: string,
    s: ReportsSettings, off: boolean) {
    const ok = limitedInt(draft, key) !== null;
    const [lo, hi] = REPORT_LIMITS[key];
    const set = (v: string) => (key === 'document_hours' ? (this.hoursDraft = v) : (this.opensDraft = v));
    return html`<div class="row"><span class="lbl">${vrt(label)}</span>
      <span class="end"><input class="in num short" type="number" min=${lo} max=${hi} .value=${draft} ?disabled=${this.busy || off} data-reports=${key}
        aria-invalid=${String(!ok)} aria-label=${vrt(label)} @input=${(e: Event) => set((e.target as HTMLInputElement).value)} />
        <span class="muted">${vrt(unit)}</span>
        <sw-button size="sm" ?disabled=${this.busy || off || numberPatch(s, key, draft) === null} data-reports-save=${key}
          @click=${() => { const p = numberPatch(s, key, draft); if (p) void this.save(p); }}>${vrt('save')}</sw-button></span></div>`;
  }

  render() {
    const s = this.current;
    if (!s) return nothing;
    const subOff = !subControlsEnabled(s);
    const docOff = !documentFieldsEnabled(s);
    return html`<sw-card heading=${vrt('title')} data-card="reports-settings">
      ${this.toggle('toContacts', 'to_contacts', s.to_contacts, false, 'to_contacts')}
      ${this.toggle('email', 'email', s.email, subOff, 'email')}
      ${this.toggle('documents', 'documents', s.documents, subOff, 'documents')}
      ${this.numberRow('hours', 'hoursUnit', 'document_hours', this.hoursDraft, s, docOff)}
      ${this.numberRow('opens', 'opensUnit', 'document_max_opens', this.opensDraft, s, docOff)}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-reports-settings': TicketsReportsSettings;
  }
}
