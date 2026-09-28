import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import {
  actionOutcome,
  createIntercomPerson,
  deleteIntercomPerson,
  generateIntercomPin,
  getIntercomEditorContext,
  getIntercomPersonForEdit,
  updateIntercomPerson,
  type DisplayZone,
  type IntercomCardDraft,
  type IntercomEditorContext,
  type IntercomEditorPerson,
  type IntercomPersonDraft,
} from '../api/intercom';
import { syncBadge } from './wiskey-people';
import { localInput, resolveLocalInput, t, UTC_ZONE } from './wiskey-format';

/** A card row of the draft: a saved card (by `id`, its number masked by WisKey) or a new one typed here. */
interface CardRow {
  key: string;
  id?: string;
  masked_number?: string;
  card_no: string;
  label: string;
  enabled: boolean;
}

interface Assignment {
  enabled: boolean;
  allowed_locks: number[];
  sync_state: string | null;
}

/** WisKey panel.ts `Draft`, reduced to this slice: identity, phone, active, validity, PIN (undefined = unchanged,
 * null = remove, a string = set), cards and station assignments. */
interface Draft {
  employee_no: string;
  display_name: string;
  phone: string;
  active: boolean;
  pin?: string | null;
  confirm_pin: string;
  cards: CardRow[];
  assignments: Record<string, Assignment>;
}

type Busy = '' | 'save' | 'sync' | 'delete' | 'pin';
type Tone = 'err' | 'warn' | 'info';

/** WisKey panel.ts `edit()`: a new person gets a random nine-digit employee number (100000000 + uint32 % 900000000). */
function randomEmployeeNo(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(100000000 + (n[0] % 900000000));
}

let rowSeq = 0;
const rowKey = () => `row-${++rowSeq}`;

/** WisKey phone.ts `mobileDisplay`: an Israeli mobile number typed as digits is shown as 05X-xxx-xxxx; anything else
 * is kept as typed (WisKey's backend normalises on save). */
export function mobileDisplay(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (/^05\d{8}$/.test(digits) && /^[\d\s()-]*$/.test(value)) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

/**
 * WisKey tab: the person editor (CR-005 phase 2, slice A1, `access.people.manage`). Ported from the owner's WisKey
 * frontend - panel.ts `editorBody()` (the person, validity, PIN, cards and assignments fieldsets), `edit()` (the draft),
 * `save()` (the validation order and the save payload) and `removeUser()` (the delete confirmation naming the stations)
 * - with `hass.callWS` replaced by the SMPLWISE API (which validates the draft again, audits every save under the
 * SMPLWISE user and classifies WisKey's answer) and WisKey's styles by SMPLWISE's components.
 *
 * What this slice deliberately leaves to the next ones, and says so on the form instead of showing disabled stubs:
 * custom profile fields, groups, onboarding templates and photos (A3), weekly / dates schedules and station-native
 * enforcement (A3; a person who has one keeps it - this editor never sends timing keys), reading a card from a station
 * reader and the USB wedge (A2). The live PIN availability check is not offered (owner decision 8): a taken PIN is
 * reported by WisKey at save time and "generate unique PIN" gives a free one. Card numbers are shown exactly as WisKey
 * returns them - masked - and only a number typed here is ever a full one; it leaves the form only inside the save.
 */
@customElement('wiskey-person-editor')
export class WiskeyPersonEditor extends LitElement {
  /** The person to edit; '' for a new person. */
  @property() userId = '';

  @state() private ctx: IntercomEditorContext | null = null;
  @state() private ctxNote = '';
  @state() private original: IntercomEditorPerson | null = null;
  @state() private draft: Draft | null = null;
  @state() private loadError = '';
  @state() private loading = true;
  @state() private timed = false;
  @state() private validityFrom = '';
  @state() private validityUntil = '';
  @state() private busy: Busy = '';
  @state() private error = '';
  @state() private errorCode = '';
  @state() private errorTone: Tone = 'err';
  @state() private outcome: 'refused' | 'unknown' | 'not_sent' | '' = '';
  @state() private pinStatus: '' | 'generated' | 'failed' = '';
  @state() private confirmDelete = false;
  @state() private confirmClose = false;
  private baseline = '';
  private generation = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    this.generation++;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.confirmDelete && !this.confirmClose) this.requestClose();
  };

  private get zone(): DisplayZone {
    return this.ctx?.default_zone ?? UTC_ZONE;
  }

  private get isNew(): boolean {
    return !this.userId;
  }

  // ------------------------------------------------------------------ loading

  /** The editor context (a fresh overview read) and, for an existing person, the record for editing (`users/get`). */
  private async load() {
    const generation = ++this.generation;
    this.loading = true;
    this.loadError = '';
    try {
      const [ctx, person] = await Promise.all([getIntercomEditorContext(), this.isNew ? null : getIntercomPersonForEdit(this.userId)]);
      if (generation !== this.generation) return;
      if (ctx.context) this.ctx = ctx.context;
      else this.ctxNote = ctx.state === 'unsupported' ? 'גרסת WisKey המותקנת אינה מכירה את הפקודות הנדרשות.' : `נתוני התחנות לא נטענו (${ctx.last_error ?? ctx.state}).`;
      if (!this.isNew) {
        if (!person?.person) {
          this.loadError = `הרשומה לא נטענה (${person?.last_error ?? person?.state ?? 'error'}).`;
          return;
        }
        this.edit(person.person);
      } else {
        this.edit(null);
      }
    } catch (err) {
      if (generation !== this.generation) return;
      this.loadError = err instanceof ApiError && err.code === 'intercom_person_not_found' ? 'האדם הזה לא נמצא עוד ב־WisKey (ייתכן שנמחק).' : describeError(err);
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  /** WisKey `edit(user?)`: build the draft and its baseline (unsaved-change detection). */
  private edit(user: IntercomEditorPerson | null) {
    this.original = user;
    this.pinStatus = '';
    this.error = '';
    this.errorCode = '';
    this.outcome = '';
    if (user) {
      this.draft = {
        employee_no: user.employee_no,
        display_name: user.display_name,
        phone: user.phone,
        active: user.active,
        confirm_pin: '',
        cards: user.cards.map((c) => ({ key: c.id, id: c.id, masked_number: c.masked_number, card_no: '', label: c.label, enabled: c.enabled })),
        assignments: Object.fromEntries(user.stations.map((s) => [s.station_id, { enabled: s.enabled, allowed_locks: [...s.doors], sync_state: s.sync_state }])),
      };
      this.timed = !!user.valid_from;
      this.validityFrom = localInput(user.valid_from, this.zone);
      this.validityUntil = localInput(user.valid_until, this.zone);
    } else {
      this.draft = { employee_no: randomEmployeeNo(), display_name: '', phone: '', active: true, confirm_pin: '', cards: [], assignments: {} };
      this.timed = false;
      this.validityFrom = '';
      this.validityUntil = '';
    }
    this.baseline = this.snapshot();
  }

  private snapshot(): string {
    return JSON.stringify([this.draft, this.timed, this.validityFrom, this.validityUntil]);
  }

  private get dirty(): boolean {
    return !!this.draft && this.snapshot() !== this.baseline;
  }

  private patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (!this.draft) return;
    this.draft = { ...this.draft, [key]: value };
  }

  // ------------------------------------------------------------------ PIN

  /** WisKey `pinBlocked()`: a selected station whose keypad PIN cannot be written blocks PIN edits. */
  private pinBlocked(): boolean {
    if (!this.draft || !this.ctx) return false;
    return this.ctx.stations.some((s) => this.draft!.assignments[s.id]?.enabled && s.pin_writable === false);
  }

  private async generatePin() {
    if (!this.draft || this.busy) return;
    this.busy = 'pin';
    this.pinStatus = '';
    this.error = '';
    try {
      const r = await generateIntercomPin(this.userId);
      if (r.pin) {
        this.draft = { ...this.draft, pin: r.pin.pin, confirm_pin: r.pin.pin };
        this.pinStatus = 'generated';
      } else {
        this.pinStatus = 'failed';
        this.setError(r.last_error === 'pin_generation_failed' ? t('pin_generation_failed') : `${t('pin_generation_failed')} (${r.last_error ?? r.state})`, 'err', r.last_error ?? r.state);
      }
    } catch (err) {
      this.pinStatus = 'failed';
      this.setError(describeError(err), 'err', err instanceof ApiError ? err.code : 'error');
    } finally {
      this.busy = '';
    }
  }

  // ------------------------------------------------------------------ validity

  /** WisKey `readValidity()`: the two `datetime-local` inputs in the HA zone as instants; a known instant is kept when
   * its displayed value is unchanged. Throws the i18n key of the clock error. */
  private readValidity(): { from: string; until: string } {
    const from = resolveLocalInput(this.validityFrom, this.zone, this.original?.valid_from ?? undefined);
    const until = resolveLocalInput(this.validityUntil, this.zone, this.original?.valid_until ?? undefined);
    if (!from || !until) throw new Error('invalid_validity');
    return { from, until };
  }

  // ------------------------------------------------------------------ save

  private setError(text: string, tone: Tone, code = '', outcome: '' | 'refused' | 'unknown' | 'not_sent' = '') {
    this.error = text;
    this.errorTone = tone;
    this.errorCode = code;
    this.outcome = outcome;
  }

  /** WisKey `save()`: validation in its order, then the payload as WisKey's own editor builds it (this slice's fields),
   * sent as create or update. */
  private async save(syncNow: boolean) {
    const draft = this.draft;
    if (!draft || this.busy) return;
    this.error = '';
    this.errorCode = '';
    this.outcome = '';
    let validity: { from: string; until: string } | null = null;
    if (this.timed) {
      try {
        validity = this.readValidity();
      } catch (e) {
        this.setError(t((e as Error).message), 'err', (e as Error).message);
        return;
      }
    }
    if (draft.pin && draft.pin !== draft.confirm_pin) {
      this.setError(t('pin_mismatch'), 'err', 'pin_mismatch');
      return;
    }
    if (validity && Date.parse(validity.from) >= Date.parse(validity.until)) {
      this.setError(t('invalid_validity'), 'err', 'invalid_validity');
      return;
    }
    const form = this.renderRoot.querySelector<HTMLFormElement>('form');
    if (form && !form.reportValidity()) {
      this.setError(t('field_required'), 'err', 'field_required');
      return;
    }
    const data: IntercomPersonDraft = {
      employee_no: draft.employee_no,
      phone: draft.phone ?? '',
      display_name: draft.display_name,
      active: draft.active,
      valid_from: validity ? validity.from : null,
      valid_until: validity ? validity.until : null,
      assignments: Object.fromEntries(Object.entries(draft.assignments).map(([id, a]) => [id, { enabled: a.enabled, allowed_locks: a.allowed_locks }])),
      cards: draft.cards.map<IntercomCardDraft>((c) => (c.id ? { id: c.id, label: c.label, enabled: c.enabled } : { card_no: c.card_no, label: c.label, enabled: c.enabled })),
    };
    if (draft.pin !== undefined) data.pin = draft.pin;
    this.busy = syncNow ? 'sync' : 'save';
    try {
      const r = this.isNew ? await createIntercomPerson(data, syncNow) : await updateIntercomPerson(this.userId, this.original?.revision ?? 0, data, syncNow);
      if (!r.person) throw new Error('empty reply');
      // the PIN and any typed card number leave memory with the draft: the saved record carries only WisKey's masked form
      this.draft = null;
      this.dispatchEvent(new CustomEvent('editor-saved', { detail: { person: r.person, notice: syncNow ? 'saved_sync' : 'saved', note: r.note }, bubbles: true, composed: true }));
    } catch (err) {
      this.showFailure(err);
    } finally {
      this.busy = '';
    }
  }

  /** How a failed save reads: WisKey's named refusals by their WisKey text; anything not structurally "not sent" or
   * "refused" is "outcome unknown", in amber, with the reload advice (never a reassurance that nothing happened). */
  private showFailure(err: unknown) {
    const outcome = actionOutcome(err);
    const code = err instanceof ApiError ? err.code : 'error';
    if (outcome === 'unknown') {
      const text = err instanceof ApiError && err.body?.details?.outcome === 'unknown' ? err.message : `לא התקבלה תשובה ברורה מהשרת (${describeError(err)}).`;
      this.setError(`לא ידוע אם השינוי נשמר ב־WisKey: ${text}`, 'warn', code, 'unknown');
      return;
    }
    if (code === 'intercom_pin_conflict') this.setError(t('pin_conflict'), 'err', code, outcome);
    else if (code === 'intercom_revision_conflict') this.setError(t('revision_conflict'), 'err', code, outcome);
    else if (code === 'intercom_card_conflict') this.setError(t('card_conflict'), 'err', code, outcome);
    else if (code === 'intercom_employee_conflict') this.setError(t('employee_conflict'), 'err', code, outcome);
    else this.setError(describeError(err), 'err', code, outcome);
  }

  /** After a revision conflict or an unknown outcome: the fresh record replaces the draft (the edits are not merged
   * over someone else's - the user types them again against the current revision). */
  private async reload() {
    if (this.isNew) return;
    this.loading = true;
    this.draft = null;
    await this.load();
  }

  // ------------------------------------------------------------------ delete

  /** WisKey `editorAction` + `removeUser`: only an unmodified draft, and only after the confirmation that names the
   * number of stations the removal is scheduled on (the assignments; pending revocations WisKey may add are not served). */
  private askDelete() {
    if (this.dirty) {
      this.setError(t('profile_save_first'), 'err', 'profile_save_first');
      return;
    }
    this.confirmDelete = true;
  }

  private async doDelete() {
    const user = this.original;
    if (!user || this.busy) return;
    this.busy = 'delete';
    this.error = '';
    try {
      const r = await deleteIntercomPerson(user.id, user.revision ?? 0);
      this.confirmDelete = false;
      this.draft = null;
      this.dispatchEvent(new CustomEvent('editor-deleted', { detail: { id: user.id, notice: 'deleted', note: r.note }, bubbles: true, composed: true }));
    } catch (err) {
      this.confirmDelete = false;
      this.showFailure(err);
    } finally {
      this.busy = '';
    }
  }

  // ------------------------------------------------------------------ close

  private requestClose() {
    if (this.busy) return;
    if (this.dirty) {
      this.confirmClose = true;
      return;
    }
    this.close();
  }

  private close() {
    this.draft = null; // a typed PIN or card number does not outlive the form
    this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------ assignments

  private setStation(id: string, enabled: boolean) {
    if (!this.draft) return;
    const current = this.draft.assignments[id];
    const locks = current?.allowed_locks.length ? current.allowed_locks : [1];
    this.patch('assignments', { ...this.draft.assignments, [id]: { enabled, allowed_locks: locks, sync_state: current?.sync_state ?? null } });
  }

  private setLock(id: string, lock: number, on: boolean) {
    if (!this.draft) return;
    const a = this.draft.assignments[id];
    if (!a) return;
    const selected = on ? [...a.allowed_locks, lock].sort() : a.allowed_locks.filter((l) => l !== lock);
    if (!selected.length) this.setStation(id, false); // WisKey: unchecking the last lock denies the station
    else this.patch('assignments', { ...this.draft.assignments, [id]: { ...a, allowed_locks: selected } });
  }

  private setAll(enabled: boolean) {
    if (!this.draft || !this.ctx) return;
    const next = { ...this.draft.assignments };
    for (const s of this.ctx.stations) {
      if (!s.lock_enabled) continue;
      const current = next[s.id];
      next[s.id] = { enabled, allowed_locks: current?.allowed_locks.length ? current.allowed_locks : [1], sync_state: current?.sync_state ?? null };
    }
    this.patch('assignments', next);
  }

  // ------------------------------------------------------------------ render

  render() {
    const mode = this.isNew ? 'new' : 'edit';
    return html`<div class="backdrop" data-wiskey-editor data-wiskey-editor-mode=${mode} @click=${(e: Event) => e.target === e.currentTarget && this.requestClose()}>
      <div class="pane" role="dialog" aria-modal="true" aria-label=${t(this.isNew ? 'add_user' : 'edit_user')}>
        <header>
          <div>
            <h3>${t(this.isNew ? 'add_user' : 'edit_user')}</h3>
            <div class="sub" data-wiskey-editor-heading>${this.draft?.display_name || (this.isNew ? t('new_person_heading') : '')} · ${t('editor_intro')}</div>
          </div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${t('cancel')} data-wiskey-editor-cancel @click=${() => this.requestClose()}></sw-button>
        </header>
        <div class="body">${this.renderBody()}</div>
        ${this.draft ? this.renderFooter() : nothing}
      </div>
      ${this.confirmDelete ? this.renderDeleteConfirm() : nothing}
      ${this.confirmClose ? this.renderCloseConfirm() : nothing}
    </div>`;
  }

  private renderBody() {
    if (this.loading && !this.draft) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.loadError || !this.draft) {
      return html`<sw-state-panel data-wiskey-editor-load-error state="error" heading="לא ניתן לפתוח את העורך" hint=${this.loadError || 'הרשומה לא נטענה.'}></sw-state-panel>
        <div class="row"><sw-button size="sm" icon="refresh" data-wiskey-editor-retry ?disabled=${this.loading} @click=${() => void this.load()}>נסו שוב</sw-button></div>`;
    }
    const d = this.draft;
    const ctx = this.ctx;
    const blocked = this.pinBlocked();
    return html`
      ${this.renderContextNotes()}
      ${this.error ? this.renderError() : nothing}
      <form @submit=${(e: Event) => e.preventDefault()}>
        <p class="hint">${t('save_hint')}</p>
        <div class="columns">
          <div class="column">
            <fieldset data-wiskey-editor-section="person">
              <legend><sw-icon name="user" size=${16}></sw-icon>${t('person_details')}</legend>
              <div class="grid2">
                <sw-field label=${t('name')}>
                  <input required autofocus maxlength="32" data-wiskey-editor-name .value=${live(d.display_name)} @input=${(e: Event) => this.patch('display_name', (e.target as HTMLInputElement).value)} />
                </sw-field>
                <sw-field label=${t('employee_id')} hint=${this.original?.identity_locked ? t('employee_locked') : ''}>
                  <input required pattern="[A-Za-z0-9_-]{1,32}" maxlength="32" data-ltr data-wiskey-editor-employee .value=${live(d.employee_no)} ?disabled=${!!this.original?.identity_locked} @input=${(e: Event) => this.patch('employee_no', (e.target as HTMLInputElement).value)} />
                </sw-field>
              </div>
              <sw-field label=${t('phone')}>
                <input type="tel" autocomplete="tel" maxlength="32" data-ltr placeholder="05X-xxx-xxxx" data-wiskey-editor-phone .value=${live(d.phone)} @input=${(e: Event) => this.patch('phone', mobileDisplay((e.target as HTMLInputElement).value))} />
              </sw-field>
              <label class="check"><input type="checkbox" data-wiskey-editor-active .checked=${live(d.active)} @change=${(e: Event) => this.patch('active', (e.target as HTMLInputElement).checked)} />${t('active')}</label>
            </fieldset>
            ${this.isNew ? nothing : this.renderActions()}
            ${this.renderValidity()}
            ${this.renderPin(blocked)}
          </div>
          <div class="column">
            ${this.renderCards()}
            ${ctx ? this.renderAssignments(ctx) : html`<fieldset data-wiskey-editor-section="assignments"><legend>${t('assignments')}</legend><p class="muted">${this.ctxNote || 'רשימת התחנות לא נטענה, ולכן אי אפשר לערוך הרשאות לתחנות כאן.'}</p></fieldset>`}
          </div>
        </div>
      </form>
    `;
  }

  private renderContextNotes() {
    const ctx = this.ctx;
    const notes = [];
    if (ctx && (ctx.writes_listed === false || ctx.users_manage === false)) {
      notes.push(html`<div class="note err" role="alert" data-wiskey-editor-note="no_users_manage">WisKey אינו מציע את פקודות ניהול האנשים למשתמש ה־Home Assistant של SMPLWISE (נדרש אזור users ברמת manage ב־WisKey). שמירה תידחה על ידי WisKey ולא תשנה דבר.</div>`);
    } else if (ctx && ctx.writes_listed === null) {
      notes.push(html`<div class="note info" role="note" data-wiskey-editor-note="writes_unverified">WisKey לא ציין אילו פקודות זמינות למשתמש של SMPLWISE; אם חסרה לו הרשאת ניהול אנשים (users:manage) השמירה תידחה - ותוצג כאן כדחייה.</div>`);
    }
    if (this.ctxNote) notes.push(html`<div class="note warn" role="status" data-wiskey-editor-note="context">${this.ctxNote}</div>`);
    if (this.original?.has_timing) {
      notes.push(html`<div class="note info" role="note" data-wiskey-editor-note="timing">לאדם הזה מוגדר ב־WisKey לוח זמנים שבועי / לפי תאריכים או אכיפת זמנים. העורך הזה עדיין אינו עורך אותם (השלב הבא), ושמירה מכאן משאירה אותם כפי שהם.</div>`);
    }
    if (ctx?.profile_policy && (ctx.profile_policy.fields || ctx.profile_policy.groups)) {
      notes.push(html`<div class="note info" role="note" data-wiskey-editor-note="profile">ל־WisKey מוגדרים שדות פרופיל וקבוצות (${ctx.profile_policy.fields} שדות, ${ctx.profile_policy.groups} קבוצות). עריכתם, תמונות וקריאת כרטיס מקורא בעמדה יגיעו בשלבים הבאים; עד אז הם נערכים ב־WisKey עצמו. הרשאות שמגיעות דרך קבוצה נשמרות כאן כפי שהן מוצגות.</div>`);
    }
    return notes;
  }

  private renderActions() {
    return html`<fieldset data-wiskey-editor-section="actions">
      <legend>${t('user_more_actions')}</legend>
      <div class="row">
        <sw-button variant="danger" size="sm" icon="trash" data-wiskey-editor-delete ?disabled=${!!this.busy} @click=${() => this.askDelete()}>${t('delete')}</sw-button>
      </div>
      <p class="muted">${t('profile_save_first')}</p>
    </fieldset>`;
  }

  private renderValidity() {
    return html`<fieldset data-wiskey-editor-section="validity">
      <legend><sw-icon name="calendar" size=${16}></sw-icon>${t('validity')}</legend>
      <sw-field label=${t('user_timing_mode')}>
        <select data-wiskey-editor-validity-mode .value=${live(this.timed ? 'period' : 'always')} @change=${(e: Event) => (this.timed = (e.target as HTMLSelectElement).value === 'period')}>
          <option value="always">${t('permanent')}</option>
          <option value="period">${t('period')}</option>
        </select>
      </sw-field>
      ${this.timed
        ? html`<div class="grid2">
              <sw-field label=${t('valid_from')}>
                <input required type="datetime-local" data-wiskey-editor-valid-from .value=${live(this.validityFrom)} @input=${(e: Event) => (this.validityFrom = (e.target as HTMLInputElement).value)} />
              </sw-field>
              <sw-field label=${t('valid_until')}>
                <input required type="datetime-local" data-wiskey-editor-valid-until .value=${live(this.validityUntil)} @input=${(e: Event) => (this.validityUntil = (e.target as HTMLInputElement).value)} />
              </sw-field>
            </div>
            <p class="muted">${t('clock_ha_zone')}: <bdi>${this.zone.name}</bdi>. ${t('validity_hint')}</p>`
        : html`<p class="muted">${t('permanent')}</p>`}
      <p class="muted">לוח זמנים שבועי / לפי תאריכים ואכיפה בעמדה יגיעו בשלב הבא; כאן נקבע תוקף קבוע או טווח תאריכים בלבד.</p>
    </fieldset>`;
  }

  private renderPin(blocked: boolean) {
    const d = this.draft!;
    const configured = !!this.original?.pin_configured;
    const removing = d.pin === null;
    return html`<fieldset data-wiskey-editor-section="pin" data-wiskey-editor-pin-configured=${String(configured)}>
      <legend><sw-icon name="lock" size=${16}></sw-icon>${t('pin')} · ${t(configured ? 'configured' : 'not_configured')}</legend>
      <p class="muted">${t('pin_private')}</p>
      ${blocked ? html`<p class="danger" data-wiskey-editor-pin-blocked>${t('pin_mode_blocked')}</p>` : nothing}
      <div class="grid2">
        <sw-field label=${t('new_pin')}>
          <input type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]*" maxlength="128" data-ltr data-wiskey-editor-pin .value=${live(d.pin ?? '')} ?disabled=${blocked || removing} @input=${(e: Event) => this.patch('pin', (e.target as HTMLInputElement).value || undefined)} />
        </sw-field>
        <sw-field label=${t('confirm_pin')}>
          <input type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]*" maxlength="128" data-ltr data-wiskey-editor-pin-confirm .value=${live(d.confirm_pin)} ?disabled=${blocked || removing} @input=${(e: Event) => this.patch('confirm_pin', (e.target as HTMLInputElement).value)} />
        </sw-field>
      </div>
      <div aria-live="polite" data-wiskey-editor-pin-status=${this.pinStatus}>
        ${this.pinStatus === 'generated' ? html`<p class="ok">נוצר קוד פנוי ומולא בשני השדות. הוא אינו שמור עדיין - הוא ייבדק שוב בשמירה.</p>` : nothing}
      </div>
      <div class="row">
        <sw-button size="sm" data-wiskey-editor-pin-generate ?disabled=${blocked || removing || !!this.busy} @click=${() => void this.generatePin()}>${this.busy === 'pin' ? t('wait') : t('generate_unique_pin')}</sw-button>
        ${removing
          ? html`<sw-badge kind="stale" label=${t('remove_pin')}></sw-badge>
              <sw-button size="sm" variant="ghost" data-wiskey-editor-pin-keep @click=${() => { this.draft = { ...d, pin: undefined, confirm_pin: '' }; this.pinStatus = ''; }}>${t('keep_pin')}</sw-button>`
          : html`<sw-button size="sm" variant="danger" data-wiskey-editor-pin-remove ?disabled=${blocked || !configured} @click=${() => { this.draft = { ...d, pin: null, confirm_pin: '' }; this.pinStatus = ''; }}>${t('remove_pin')}</sw-button>`}
      </div>
      <p class="muted">${t('pin_physical')} אין בדיקת זמינות בזמן ההקלדה: קוד תפוס יידחה על ידי WisKey בשמירה.</p>
    </fieldset>`;
  }

  private renderCards() {
    const d = this.draft!;
    return html`<fieldset data-wiskey-editor-section="cards">
      <legend><sw-icon name="grid" size=${16}></sw-icon>${t('cards')}</legend>
      ${repeat(
        d.cards,
        (c) => c.key,
        (c) => html`<div class="card-row" data-wiskey-editor-card=${c.id ? 'saved' : 'new'}>
          <div class="grid2">
            <sw-field label=${t('card_label')}>
              <input maxlength="64" data-wiskey-editor-card-label .value=${live(c.label)} @input=${(e: Event) => this.editCard(c.key, { label: (e.target as HTMLInputElement).value })} />
            </sw-field>
            <sw-field label=${t('card_number')} hint=${c.id ? t('masked') : ''}>
              ${c.id
                ? html`<input readonly data-ltr data-wiskey-editor-card-masked .value=${c.masked_number ?? '••••'} aria-label=${t('masked')} />`
                : html`<input required pattern="[A-Za-z0-9_-]+" maxlength="32" autocomplete="off" data-ltr data-wiskey-editor-card-number .value=${live(c.card_no)} @input=${(e: Event) => this.editCard(c.key, { card_no: (e.target as HTMLInputElement).value })} />`}
            </sw-field>
          </div>
          <div class="row between">
            <label class="check"><input type="checkbox" data-wiskey-editor-card-enabled .checked=${live(c.enabled)} @change=${(e: Event) => this.editCard(c.key, { enabled: (e.target as HTMLInputElement).checked })} />${t('active')} · ${t('normal_card')}</label>
            <sw-button size="sm" variant="ghost" icon="trash" data-wiskey-editor-card-remove @click=${() => this.patch('cards', d.cards.filter((x) => x.key !== c.key))}>${t('remove')}</sw-button>
          </div>
        </div>`,
      )}
      <div class="row">
        <sw-button size="sm" icon="plus" data-wiskey-editor-card-add @click=${() => this.patch('cards', [...d.cards, { key: rowKey(), card_no: '', label: '', enabled: true }])}>${t('add_card')}</sw-button>
      </div>
      <p class="muted">מספר כרטיס שמור מוצג ממוסך, כפי ש־WisKey מחזיר אותו; המספר המלא אינו זמין לאחר השמירה. קריאת כרטיס מקורא בעמדה תגיע בשלב הבא - כאן מקלידים את המספר.</p>
    </fieldset>`;
  }

  private editCard(key: string, change: Partial<CardRow>) {
    if (!this.draft) return;
    this.patch('cards', this.draft.cards.map((c) => (c.key === key ? { ...c, ...change } : c)));
  }

  private renderAssignments(ctx: IntercomEditorContext) {
    const d = this.draft!;
    const count = Object.values(d.assignments).filter((a) => a.enabled).length;
    return html`<fieldset data-wiskey-editor-section="assignments">
      <legend><sw-icon name="door" size=${16}></sw-icon>${t('assignments')}</legend>
      <div class="row">
        <sw-button size="sm" variant="ghost" data-wiskey-editor-stations-all @click=${() => this.setAll(true)}>${t('select_all_stations')}</sw-button>
        <sw-button size="sm" variant="ghost" data-wiskey-editor-stations-clear @click=${() => this.setAll(false)}>${t('clear_stations')}</sw-button>
        <span class="muted" data-wiskey-editor-stations-count=${count}>${t('selected_stations')}: ${count}</span>
      </div>
      ${ctx.stations.length ? nothing : html`<p class="muted">${t('no_stations')}</p>`}
      ${ctx.stations.map((s) => {
        const a = d.assignments[s.id];
        const enabled = !!a?.enabled;
        const badge = enabled && a ? syncBadge(a.sync_state ?? 'pending') : null;
        return html`<div class="station" data-wiskey-editor-station=${s.id} data-wiskey-editor-station-enabled=${String(enabled)}>
          <label class="check">
            <input type="checkbox" data-wiskey-editor-station-toggle .checked=${live(enabled)} ?disabled=${!s.lock_enabled} @change=${(e: Event) => this.setStation(s.id, (e.target as HTMLInputElement).checked)} />
            <b>${s.name}</b>
          </label>
          <sw-badge kind=${s.online ? 'recorded' : 'offline'} label=${t(s.online ? 'online' : 'offline')}></sw-badge>
          <span class="muted">${s.lock_enabled ? `${t('station_access')}${s.locks.length === 1 && s.locks[0].name ? ` · ${s.locks[0].name}` : ''}` : t('camera_only')}</span>
          ${enabled && s.locks.length > 1
            ? html`<div class="locks">
                ${s.locks.map((l) => html`<label class="check"><input type="checkbox" data-wiskey-editor-lock=${l.physical_index} .checked=${live(a!.allowed_locks.includes(l.physical_index))} @change=${(e: Event) => this.setLock(s.id, l.physical_index, (e.target as HTMLInputElement).checked)} />${l.name || `${t('physical_lock')} ${l.physical_index}`}</label>`)}
              </div>`
            : nothing}
          ${badge ? html`<sw-badge kind=${badge.kind} label=${badge.label}></sw-badge>` : nothing}
        </div>`;
      })}
    </fieldset>`;
  }

  private renderError() {
    const unknown = this.outcome === 'unknown';
    const conflict = this.errorCode === 'intercom_revision_conflict';
    return html`<div class="note ${this.errorTone}" role="alert" data-wiskey-editor-error data-wiskey-editor-error-code=${this.errorCode} data-wiskey-editor-outcome=${this.outcome}>
      <sw-icon name=${unknown ? 'warning' : 'info'} size=${16}></sw-icon>
      <span>${this.error}${unknown && !this.isNew ? ' טענו מחדש את הרשומה והשוו את הגרסה לפני ניסיון נוסף.' : ''}${unknown && this.isNew ? ' חפשו את מזהה העובד בספריית האנשים לפני שיוצרים שוב.' : ''}${this.errorCode === 'intercom_pin_conflict' ? ` אפשר ללחוץ על "${t('generate_unique_pin')}".` : ''}</span>
      ${(conflict || unknown) && !this.isNew ? html`<sw-button size="sm" variant="ghost" icon="refresh" data-wiskey-editor-reload @click=${() => void this.reload()}>טען מחדש את הרשומה</sw-button>` : nothing}
    </div>`;
  }

  private renderFooter() {
    const busy = !!this.busy;
    const blockedSave = busy || this.ctx?.writes_listed === false || this.ctx?.users_manage === false;
    return html`<footer>
      <sw-button variant="ghost" data-wiskey-editor-cancel-footer ?disabled=${busy} @click=${() => this.requestClose()}>${t('cancel')}</sw-button>
      <sw-button data-wiskey-editor-save ?disabled=${blockedSave} @click=${() => void this.save(false)}>${this.busy === 'save' ? t('wait') : t('save')}</sw-button>
      <sw-button variant="primary" icon="check" data-wiskey-editor-save-sync ?disabled=${blockedSave} @click=${() => void this.save(true)}>${this.busy === 'sync' ? t('wait') : t('save_sync')}</sw-button>
    </footer>`;
  }

  private renderDeleteConfirm() {
    const user = this.original!;
    const count = Object.keys(this.draft?.assignments ?? {}).length;
    return html`<sw-dialog open heading=${t('delete')} subheading=${user.display_name} data-wiskey-editor-delete-dialog @close=${() => (this.confirmDelete = false)}>
      <p>${t('confirm_delete').replace('{count}', String(count))}</p>
      <p class="muted">האדם ייעלם מרשימת WisKey מיד; ההסרה מכל תחנה מתוזמנת על ידי WisKey ומאושרת תחנה־תחנה (תחנות שממתינות להסרת אמצעי זיהוי קודמים נכללות גם הן). הפעולה נרשמת ביומן הביקורת של SMPLWISE בשמך.</p>
      <div slot="footer">
        <sw-button variant="ghost" @click=${() => (this.confirmDelete = false)}>${t('cancel')}</sw-button>
        <sw-button variant="danger" icon="trash" data-wiskey-editor-delete-confirm ?disabled=${!!this.busy} @click=${() => void this.doDelete()}>${this.busy === 'delete' ? t('wait') : t('delete')}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderCloseConfirm() {
    return html`<sw-dialog open heading="שינויים שלא נשמרו" data-wiskey-editor-close-dialog @close=${() => (this.confirmClose = false)}>
      <p>יש בטופס שינויים שלא נשמרו. לסגור בלי לשמור?</p>
      <div slot="footer">
        <sw-button variant="ghost" @click=${() => (this.confirmClose = false)}>חזרה לעריכה</sw-button>
        <sw-button variant="danger" data-wiskey-editor-close-discard @click=${() => { this.confirmClose = false; this.close(); }}>סגירה בלי לשמור</sw-button>
      </div>
    </sw-dialog>`;
  }

  static styles = css`
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--sw-overlay);
      z-index: var(--sw-z-modal);
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .pane {
      inline-size: min(1040px, 100%);
      max-block-size: calc(100dvh - 32px);
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      min-block-size: 0;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 14px 16px 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    header div {
      flex: 1;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 2px;
    }
    .body {
      padding: 12px 16px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-block-size: 0;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px 14px;
      border-block-start: 1px solid var(--sw-border);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 860px) {
      .columns {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    fieldset {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px 12px 12px;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    legend {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    @media (max-width: 480px) {
      .grid2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
    }
    .row.between {
      justify-content: space-between;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .card-row {
      border: 1px dashed var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .station {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 6px 0;
      border-block-start: 1px solid var(--sw-border);
    }
    .locks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      flex-basis: 100%;
      padding-inline-start: 24px;
    }
    .hint,
    .muted {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      margin: 0;
      color: var(--sw-success);
      font-size: var(--sw-fs-xs);
    }
    .danger {
      margin: 0;
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 240px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-person-editor': WiskeyPersonEditor;
  }
}
