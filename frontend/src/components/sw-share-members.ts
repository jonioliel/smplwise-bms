import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import { describeError } from '../api/client';
import { addShareMember, listShareMembers, removeShareMember, type ShareMember, type ShareMembers } from '../api/zones';
import { bidi } from '../i18n/bidi';

const KIND: Record<ShareMember['kind'], string> = { camera: 'מצלמה', door: 'עמדת דלת', device: 'התקן', station: 'עמדת WisKey' };

/** One small glyph per kind (16px, currentColor): the same line style as the map's symbols. */
const ICON: Record<ShareMember['kind'], ReturnType<typeof svg>> = {
  camera: svg`<path d="M3 8h11v8H3zM14 11l5-3v8l-5-3"/>`,
  door: svg`<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>`,
  device: svg`<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>`,
  station: svg`<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="9" r="2.2"/><path d="M9 15h6M9 18h6"/>`,
};

/**
 * "חברים בחלל המשותף" (CR-009, owner 2026-09-30): the cameras, door stations and devices a shared space shows on every
 * floor of it - each with the floor it is anchored on. The server lists only what the reader's own permissions allow per
 * member; with the share rights (both floors) the list offers "הסר" per row and "הוסף" from the anchors of the room's
 * floors, otherwise it is read-only. Fires `members-changed` after a change (the map reloads its bundle).
 */
@customElement('sw-share-members')
export class SwShareMembers extends LitElement {
  /** The shared space's home zone id. */
  @property() zoneId = '';
  @state() private data: ShareMembers | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private pick = '';
  @state() private q = '';
  private loadedFor = '';

  static styles = css`
    :host {
      display: block;
      font-family: var(--sw-font);
      color: var(--sw-text-1, inherit);
    }
    h4 {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 600;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-top: 1px solid var(--sw-border, rgba(0, 0, 0, 0.08));
      font-size: 13px;
    }
    .row .main {
      flex: 1;
      min-width: 0;
    }
    .row .main span {
      display: block;
      color: var(--sw-text-3, #6b7280);
      font-size: 12px;
    }
    .ic {
      width: 16px;
      height: 16px;
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
      color: var(--sw-text-2, #374151);
    }
    .search {
      flex: 1 1 100%;
      font: inherit;
      font-size: 13px;
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid var(--sw-border, rgba(0, 0, 0, 0.15));
      background: var(--sw-surface, #fff);
      color: inherit;
    }
    .kind {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 8px;
      background: var(--sw-surface-2, rgba(0, 0, 0, 0.05));
      color: var(--sw-text-2, #374151);
      white-space: nowrap;
    }
    .add {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    select {
      flex: 1;
      min-width: 140px;
      font: inherit;
      font-size: 13px;
      padding: 4px 6px;
      border-radius: 8px;
      border: 1px solid var(--sw-border, rgba(0, 0, 0, 0.15));
      background: var(--sw-surface, #fff);
      color: inherit;
    }
    .note,
    .err {
      font-size: 12px;
      color: var(--sw-text-3, #6b7280);
      margin-top: 6px;
    }
    .err {
      color: var(--sw-error, #b91c1c);
    }
  `;

  protected updated(): void {
    if (this.zoneId && this.zoneId !== this.loadedFor) void this.load();
  }

  async load(): Promise<void> {
    const id = this.zoneId;
    this.loadedFor = id;
    this.error = '';
    try {
      const d = await listShareMembers(id);
      if (this.zoneId === id) {
        this.data = d;
        this.pick = '';
        this.q = '';
      }
    } catch (err) {
      if (this.zoneId === id) {
        this.data = null;
        this.error = describeError(err);
      }
    }
  }

  private async change(m: Pick<ShareMember, 'resource_type' | 'resource_id'>, add: boolean): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      if (add) await addShareMember(this.zoneId, m.resource_type, m.resource_id);
      else await removeShareMember(this.zoneId, m.resource_type, m.resource_id);
      await this.load();
      this.dispatchEvent(new CustomEvent('members-changed', { bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private where(m: ShareMember): string {
    if (m.kind === 'station') return 'מוצג בכל קומות החלל'; // a WisKey station is not placed on a map
    return m.floors.length ? m.floors.map((f) => bidi(f.name)).join(', ') : 'לא מוצב';
  }

  render() {
    const d = this.data;
    if (!d) return html`${this.error ? html`<div class="err" data-members-error>${this.error}</div>` : html`<div class="note">טוען חברים…</div>`}`;
    const all = d.candidates ?? [];
    const needle = this.q.trim().toLowerCase();
    const cands = needle ? all.filter((c) => `${KIND[c.kind]} ${c.name} ${c.resource_id}`.toLowerCase().includes(needle)) : all;
    const chosen = cands.find((c) => `${c.resource_type}|${c.resource_id}` === this.pick);
    return html`<h4>חברים בחלל המשותף</h4>
      <div data-members-list>
        ${d.members.length
          ? d.members.map((m) => html`<div class="row" data-member=${`${m.resource_type}:${m.resource_id}`}>
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" data-member-icon=${m.kind}>${ICON[m.kind]}</svg>
              <span class="kind">${KIND[m.kind]}</span>
              <div class="main">${m.name}<span>${this.where(m)}</span></div>
              ${d.can_manage ? html`<sw-button size="sm" variant="ghost" data-member-remove ?disabled=${this.busy} @click=${() => this.change(m, false)}>הסר</sw-button>` : nothing}
            </div>`)
          : html`<div class="note">אין חברים שמוצגים לך.</div>`}
      </div>
      ${d.can_manage
        ? html`<div class="add">
            <input class="search" type="search" data-member-search aria-label="חיפוש מצלמה, עמדה או התקן להוספה" placeholder="חיפוש מצלמה, עמדה או התקן" .value=${this.q} @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; this.pick = ''; }} />
            <select data-member-pick aria-label="בחר מצלמה, עמדה או התקן להוספה" .value=${this.pick} @change=${(e: Event) => (this.pick = (e.target as HTMLSelectElement).value)}>
              <option value="">בחר מצלמה, התקן או עמדת WisKey…</option>
              ${cands.map((c) => html`<option value=${`${c.resource_type}|${c.resource_id}`}>${KIND[c.kind]} · ${c.name} · ${this.where(c)}</option>`)}
            </select>
            <sw-button size="sm" icon="plus" data-member-add ?disabled=${this.busy || !chosen} @click=${() => chosen && this.change(chosen, true)}>הוסף</sw-button>
          </div>
          <div class="note">חבר מוצג בכל הקומות של החלל, לכל מי שמורשה לראות אותו. הוספה והסרה דורשות הרשאת עריכה והצבה בשתי הקומות.</div>`
        : html`<div class="note" data-members-readonly>לקריאה בלבד: הוספה והסרה דורשות הרשאת עריכה והצבה בכל הקומות של החלל.</div>`}
      ${this.error ? html`<div class="err" data-members-error>${this.error}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-share-members': SwShareMembers;
  }
}
