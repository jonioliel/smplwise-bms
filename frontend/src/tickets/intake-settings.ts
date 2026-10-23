import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import { settingsStyles } from '../styles/settings';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type IntakeSettings, type Meta, type SettingsDoc } from '../api/tickets';
import { intakeApi, type KnownNumber } from '../api/tickets-intake';
import { itx } from '../i18n/intake';
import { ticketSettingsCss } from './settings-styles';
import { INTAKE_LIMITS, intakeOf, limitedInt, numberPatch, plausiblePhone, subControlsEnabled, type IntakeLimitKey } from './intake-model';

const NUMBER_ROWS: Array<{ key: IntakeLimitKey; label: Parameters<typeof itx>[0] }> = [
  { key: 'coalesce_min', label: 'coalesce' }, { key: 'sender_per_day', label: 'perDay' }, { key: 'sender_per_week', label: 'perWeek' },
  { key: 'installation_per_hour', label: 'perHour' }, { key: 'installation_per_day', label: 'perDayAll' }, { key: 'open_max', label: 'openMax' },
  { key: 'draft_ttl_days', label: 'ttl' }, { key: 'rejected_keep_days', label: 'keep' }, { key: 'block_days', label: 'blockDays' },
  { key: 'unlisted_reply_per_day', label: 'unlistedPerDay' },
];
const KNOWN_PAGE = 5;

/**
 * CR-INTAKE99 / TENANTINTAKE098-295 (owner answers 143-156): Settings > the module > message channel > "קליטת פניות בטקסט חופשי".
 * Two cards: the switches and limits (system.configure; every rule, limit and default department is editable here, everything is OFF by
 * default) and the managed list of numbers that may open a request by WhatsApp (owner 146: only listed numbers; no self-registration).
 * The list shows names and the LAST FOUR digits only. An older server without the `intake` block shows nothing. Events: `notice`.
 */
@customElement('tickets-intake-settings')
export class TicketsIntakeSettings extends LitElement {
  @state() private doc: SettingsDoc | null = null;
  @state() private meta: Meta | null = null;
  @state() private busy = false;
  @state() private drafts: Record<string, string> = {};
  @state() private known: KnownNumber[] = [];
  @state() private knownAllowed = false;
  @state() private page = 0;
  @state() private fName = '';
  @state() private fPhone = '';
  @state() private fOrg = '';

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host { display: flex; flex-direction: column; gap: var(--sw-s-3); min-inline-size: 0; }
    input.in.short { inline-size: 6em; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--sw-s-4); }
    @media (max-width: 720px) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
    .addrow { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); align-items: end; padding-block: var(--sw-s-2); }
    .addrow input, select.in { padding: 6px 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; }
    .nm { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private get s(): IntakeSettings | null {
    return intakeOf(this.doc?.intake);
  }

  async load(): Promise<void> {
    try {
      this.doc = await ticketsApi().settings();
      const s = this.s;
      if (s) {
        this.drafts = Object.fromEntries(NUMBER_ROWS.map((r) => [r.key, String(s[r.key])]));
        try { this.meta = await ticketsApi().meta(); } catch { /* the picker stays empty */ }
        await this.loadKnown();
      }
    } catch (e) {
      if (!(e instanceof ApiError && (e.status === 403 || e.status === 404))) this.notice({ error: describeError(e) });
    }
  }

  private async loadKnown(): Promise<void> {
    try {
      this.known = (await intakeApi.known()).known;
      this.knownAllowed = true;
      if (this.page * KNOWN_PAGE >= this.known.length) this.page = Math.max(0, Math.ceil(this.known.length / KNOWN_PAGE) - 1);
    } catch {
      this.known = [];
      this.knownAllowed = false; // not a list manager (403): that card is absent
    }
  }

  private async save(patch: Partial<IntakeSettings>): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    try {
      this.doc = await ticketsApi().saveInstallation(this.doc.revision, { intake: patch });
      this.notice({ ok: itx('saved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private toggle(label: Parameters<typeof itx>[0], key: 'enabled' | 'whatsapp' | 'approval_reply' | 'unlisted_reply', checked: boolean, off = false) {
    return html`<div class="row"><span class="lbl">${itx(label)}</span>
      <sw-toggle label=${itx(label)} labelHidden .checked=${checked} ?disabled=${this.busy || off} data-intake=${key}
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [key]: e.detail.checked })}></sw-toggle></div>`;
  }

  private numberRow(key: IntakeLimitKey, label: Parameters<typeof itx>[0], s: IntakeSettings, off: boolean) {
    const draft = this.drafts[key] ?? String(s[key]);
    const ok = limitedInt(draft, key) !== null;
    const [lo, hi] = INTAKE_LIMITS[key];
    return html`<div class="row"><span class="lbl">${itx(label)}</span>
      <span class="end"><input class="in num short" type="number" min=${lo} max=${hi} .value=${draft} ?disabled=${this.busy || off} data-intake-num=${key}
        aria-invalid=${String(!ok)} aria-label=${itx(label)} @input=${(e: Event) => (this.drafts = { ...this.drafts, [key]: (e.target as HTMLInputElement).value })} />
        <sw-button size="sm" ?disabled=${this.busy || off || numberPatch(s, key, draft) === null} data-intake-save=${key}
          @click=${() => { const p = numberPatch(s, key, draft); if (p) void this.save(p); }}>${itx('saveSetting')}</sw-button></span></div>`;
  }

  private async addKnown(): Promise<void> {
    if (this.busy || !this.fName.trim() || !plausiblePhone(this.fPhone)) return;
    this.busy = true;
    try {
      await intakeApi.addKnown({ display_name: this.fName.trim(), phone: this.fPhone.trim(), org: this.fOrg.trim() });
      this.fName = this.fPhone = this.fOrg = '';
      await this.loadKnown();
      this.notice({ ok: itx('added') });
    } catch (e) {
      this.notice({ error: e instanceof ApiError && e.status === 409 ? itx('alreadyListed') : describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  private async removeKnown(k: KnownNumber): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await intakeApi.removeKnown(k);
      await this.loadKnown();
      this.notice({ ok: itx('removed') });
    } catch (e) {
      this.notice({ error: describeError(e) });
      await this.loadKnown();
    } finally {
      this.busy = false;
    }
  }

  private knownCard() {
    if (!this.knownAllowed) return nothing;
    const from = this.page * KNOWN_PAGE;
    const shown = this.known.slice(from, from + KNOWN_PAGE);
    return html`<sw-card heading=${itx('knownTitle')} data-card="intake-known">
      <div class="addrow">
        <input data-known="name" maxlength="80" dir="auto" placeholder=${itx('name')} aria-label=${itx('name')} .value=${this.fName} @input=${(e: Event) => (this.fName = (e.target as HTMLInputElement).value)} />
        <input data-known="phone" type="tel" inputmode="tel" maxlength="24" dir="ltr" placeholder=${itx('phone')} aria-label=${itx('phone')} .value=${this.fPhone} @input=${(e: Event) => (this.fPhone = (e.target as HTMLInputElement).value)} />
        <input data-known="org" maxlength="80" dir="auto" placeholder=${itx('org')} aria-label=${itx('org')} .value=${this.fOrg} @input=${(e: Event) => (this.fOrg = (e.target as HTMLInputElement).value)} />
        <sw-button size="sm" variant="primary" data-known-add ?disabled=${this.busy || !this.fName.trim() || !plausiblePhone(this.fPhone)} @click=${() => void this.addKnown()}>${itx('add')}</sw-button>
      </div>
      ${shown.length ? shown.map((k) => html`<div class="row" data-known-row=${k.id}><span class="nm" dir="auto">${k.display_name}${k.org ? ` · ${k.org}` : ''}</span>
        <bdi dir="ltr" class="muted">${k.phone_masked}</bdi>
        <sw-button size="sm" ?disabled=${this.busy} data-known-remove @click=${() => void this.removeKnown(k)}>${itx('remove')}</sw-button></div>`)
        : html`<div class="muted" data-known-empty>${itx('knownEmpty')}</div>`}
      ${this.known.length > KNOWN_PAGE ? html`<div class="row"><sw-button size="sm" ?disabled=${this.page === 0} @click=${() => (this.page -= 1)}>${itx('prev')}</sw-button>
        <span class="muted">${from + 1}-${from + shown.length} ${itx('of')} ${this.known.length}</span>
        <sw-button size="sm" ?disabled=${from + KNOWN_PAGE >= this.known.length} @click=${() => (this.page += 1)}>${itx('next')}</sw-button></div>` : nothing}
    </sw-card>`;
  }

  render() {
    const s = this.s;
    if (!s) return nothing;
    const off = !subControlsEnabled(s);
    const depts = this.meta?.departments ?? [];
    return html`<sw-card heading=${itx('setTitle')} data-card="intake-settings">
      ${this.toggle('enabled', 'enabled', s.enabled)}
      ${this.toggle('whatsapp', 'whatsapp', s.whatsapp, off)}
      <div class="row"><span class="lbl">${itx('defaultDept')}</span>
        <select class="in" data-intake="default_department" aria-label=${itx('defaultDept')} ?disabled=${this.busy || off}
          @change=${(e: Event) => void this.save({ default_department: (e.target as HTMLSelectElement).value })}>
          <option value="">${itx('pickDept')}</option>${depts.map((d) => html`<option value=${d.id} ?selected=${d.id === s.default_department}>${d.name}</option>`)}</select></div>
      ${this.toggle('approvalReply', 'approval_reply', s.approval_reply, off)}
      ${this.toggle('unlistedReply', 'unlisted_reply', s.unlisted_reply, off)}
      <div class="row"><span class="lbl">${itx('classifier')}</span>
        <sw-toggle label=${itx('classifier')} labelHidden .checked=${s.classifier === 'rules'} ?disabled=${this.busy || off} data-intake="classifier"
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ classifier: e.detail.checked ? 'rules' : 'off' })}></sw-toggle></div>
      <div class="grid2">${NUMBER_ROWS.map((r) => this.numberRow(r.key, r.label, s, off))}</div>
    </sw-card>${this.knownCard()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-intake-settings': TicketsIntakeSettings;
  }
}
