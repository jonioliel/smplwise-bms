import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-button';
import './sw-field';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { addCaseItem, createCase, listCases, type Case, type NewCaseItem } from '../api/cases';

/**
 * "הוסף לתיק" (T049): pick an open case, or create one, and add an event, a recording clip or a note to it.
 * Set `.item` to open; the dialog clears it when closed and emits `added` with the case id.
 */
@customElement('sw-case-picker')
export class SwCasePicker extends LitElement {
  @property({ attribute: false }) item: NewCaseItem | null = null;
  @property() subheading = '';
  @state() private cases: Case[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private picked = '';
  @state() private newTitle = '';
  @state() private note = '';
  @state() private busy = false;
  @state() private done: { id: string; title: string } | null = null;
  @state() private canManage = true;

  static styles = css`
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success, #15803d);
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    select,
    input {
      inline-size: 100%;
      font: inherit;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
  `;

  updated(changed: Map<string, unknown>) {
    if (changed.has('item') && this.item) void this.load();
  }

  private async load() {
    this.loading = true;
    this.error = '';
    this.done = null;
    this.note = '';
    try {
      const r = await listCases({ status: 'open' });
      this.cases = r.cases;
      this.canManage = r.can_manage;
      this.picked = r.cases[0]?.id ?? 'new';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private close() {
    this.item = null;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private async confirm() {
    const it = this.item;
    if (!it) return;
    this.busy = true;
    this.error = '';
    try {
      let caseId = this.picked;
      let title = this.cases.find((c) => c.id === caseId)?.title ?? '';
      if (caseId === 'new') {
        if (!this.newTitle.trim()) {
          this.error = 'תן שם לתיק החדש.';
          return;
        }
        const c = await createCase({ title: this.newTitle.trim() });
        caseId = c.id;
        title = c.title;
      }
      const added = await addCaseItem(caseId, { ...it, note: this.note.trim() || it.note });
      this.done = { id: caseId, title };
      this.dispatchEvent(new CustomEvent('added', { detail: { caseId, item: added }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const it = this.item;
    if (!it) return nothing;
    const what = it.kind === 'event' ? 'האירוע' : it.kind === 'clip' ? 'הקטע' : 'ההערה';
    return html`<sw-dialog open heading="הוסף לתיק" subheading=${this.subheading} data-case-picker @close=${() => this.close()}>
      ${this.error ? html`<div class="err" data-case-error>${this.error}</div>` : nothing}
      ${this.done
        ? html`<div class="ok" data-case-added>${what} נוסף לתיק "${this.done.title}".</div>`
        : this.loading
          ? html`<div class="note">טוען תיקים…</div>`
          : html`${!this.canManage ? html`<div class="note">אין לך הרשאה לנהל תיקים.</div>` : nothing}
              <sw-field label="תיק">
                <select aria-label="תיק" data-case-select @change=${(e: Event) => (this.picked = (e.target as HTMLSelectElement).value)}>
                  ${this.cases.map((c) => html`<option value=${c.id} ?selected=${c.id === this.picked}>${c.title} · ${c.counts.items} פריטים</option>`)}
                  <option value="new" ?selected=${this.picked === 'new'}>+ תיק חדש</option>
                </select>
              </sw-field>
              ${this.picked === 'new'
                ? html`<sw-field label="שם התיק החדש"><input data-case-new-title .value=${this.newTitle} placeholder="למשל: כניסה לא מורשית" @input=${(e: Event) => (this.newTitle = (e.target as HTMLInputElement).value)} /></sw-field>`
                : nothing}
              ${it.kind !== 'note' ? html`<sw-field label="הערה לפריט (לא חובה)"><input data-case-note .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLInputElement).value)} /></sw-field>` : nothing}
              <div class="note">
                ${it.kind === 'clip'
                  ? 'הקטע נשמר כסימנייה שמצביעה ל־NVR; שימור עותק מאומת נעשה מתוך התיק.'
                  : it.kind === 'event'
                    ? 'האירוע נוסף עם חלון של 5 שניות לפני ו־30 שניות אחרי; שימור עותק מאומת נעשה מתוך התיק.'
                    : ''}
              </div>`}
      ${this.done
        ? html`<sw-button slot="footer" variant="ghost" @click=${() => this.close()}>סגור</sw-button>
            <sw-button slot="footer" variant="primary" icon="case" data-case-open @click=${() => { const id = this.done?.id ?? ''; this.close(); navigate(`/investigate/cases/${id}`); }}>פתח את התיק</sw-button>`
        : html`<sw-button slot="footer" variant="ghost" @click=${() => this.close()}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" icon="plus" data-case-confirm ?disabled=${this.busy || this.loading || !this.canManage} @click=${() => this.confirm()}>הוסף</sw-button>`}
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-case-picker': SwCasePicker;
  }
}
