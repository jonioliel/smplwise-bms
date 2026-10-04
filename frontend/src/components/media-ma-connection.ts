import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import './sw-toggle';
import './sw-badge';
import { describeError } from '../api/client';
import { MA_STATE_LABEL, players, type MaConnection, type MaState, type MaTest } from '../api/media-players';

const BADGE: Record<MaState, string> = { off: 'neutral', ready: 'live', unreachable: 'error', unauthorized: 'error', schema_too_old: 'error', error: 'error', unreadable: 'error', host_refused: 'error' };

/**
 * CR-016 phase 2b (docs/changes/CR-016-MEDIA-PLAYERS.md section 17.3 / 17.8): הגדרות › מולטימדיה › חיבור - the direct Music Assistant connection, for the
 * installer (`system.configure`). A switch, the server address, the token (WRITE-ONLY: the server says only whether one is set and since when - "החלף" /
 * "מחק"), "בדוק חיבור" with the state line (server version, schema, how many players the account sees). This is a settings screen: the technical names
 * stay (docs/design/UI_COPY_RULES.md); operator screens never name it. Every change is saved at once (audited server-side, never with a value).
 */
@customElement('media-ma-connection')
export class MediaMaConnection extends LitElement {
  @state() private conn: MaConnection | null = null;
  @state() private url = '';
  @state() private token = '';
  @state() private editingToken = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private test: MaTest | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .warn {
      color: var(--sw-warning-text, var(--sw-text-2));
    }
    .acts {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    input {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      inline-size: min(320px, 100%);
    }
    .err {
      color: var(--sw-danger-text, #b3261e);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.conn = await players().maConnection();
      this.url = this.conn.url ?? '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async save(body: Parameters<ReturnType<typeof players>['saveMaConnection']>[0]) {
    this.busy = true;
    this.error = '';
    try {
      this.conn = await players().saveMaConnection(body);
      this.url = this.conn.url ?? '';
      this.token = '';
      this.editingToken = false;
      this.test = null;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async runTest() {
    this.busy = true;
    this.error = '';
    try {
      this.test = await players().testMaConnection();
      this.conn = await players().maConnection();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  protected render(): TemplateResult | typeof nothing {
    const c = this.conn;
    if (!c) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    const t = this.test ?? c.last_test;
    const since = c.token_set_at ? new Date(c.token_set_at).toLocaleDateString('he-IL') : null;
    return html`
      <div class="row"><span class="lbl">חיבור ישיר ל־Music Assistant<span class="muted">תור מלא (גרירה, מחיקה, נגן הבא) וחיפוש בספרייה. ללא החיבור: התור הקצר והספרייה בלי חיפוש.</span></span>
        <span class="acts"><sw-badge kind=${BADGE[c.state]} label=${MA_STATE_LABEL[c.state]} data-mc-state=${c.state}></sw-badge>
          <sw-toggle label="חיבור ישיר" labelHidden .checked=${c.enabled} ?disabled=${this.busy || (!c.url && !this.url)} data-mc-enabled
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ enabled: e.detail.checked, ...(this.url && this.url !== c.url ? { url: this.url } : {}) })}></sw-toggle></span></div>
      <div class="row"><span class="lbl">כתובת השרת<span class="muted">http://שם-מארח:8095 · נשמרת בהגדרות בלבד</span></span>
        <span class="acts"><input type="url" inputmode="url" spellcheck="false" placeholder="http://host:8095" .value=${this.url} data-mc-url aria-label="כתובת השרת"
            @input=${(e: Event) => (this.url = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" ?disabled=${this.busy || this.url === (c.url ?? '')} data-mc-url-save @click=${() => void this.save({ url: this.url || null })}>שמור</sw-button></span></div>
      <div class="row"><span class="lbl">אסימון גישה<span class="muted" data-mc-token>${c.token_set ? `הוגדר${since ? ` ב־${since}` : ''}` : 'לא הוגדר'} · משתמש ייעודי עם סינון נגנים${c.token_expiring ? html` · <span class="warn">יש לחדש את האסימון</span>` : ''}</span></span>
        <span class="acts">${this.editingToken || !c.token_set
          ? html`<input type="password" autocomplete="off" spellcheck="false" .value=${this.token} data-mc-token-input aria-label="אסימון גישה" @input=${(e: Event) => (this.token = (e.target as HTMLInputElement).value)} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy || this.token.trim().length < 16} data-mc-token-save @click=${() => void this.save({ token: this.token.trim() })}>שמור</sw-button>
              ${c.token_set ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => { this.editingToken = false; this.token = ''; }}>ביטול</sw-button>` : nothing}`
          : html`<sw-button size="sm" ?disabled=${this.busy} data-mc-token-replace @click=${() => (this.editingToken = true)}>החלף</sw-button>
              <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-mc-token-clear @click=${() => void this.save({ clear_token: true })}>מחק</sw-button>`}</span></div>
      <div class="row"><span class="lbl">בדיקת חיבור<span class="muted" data-mc-test>${t
          ? `${MA_STATE_LABEL[t.state]}${t.server_version ? ` · גרסה ${t.server_version}` : ''}${t.schema_version !== null ? ` · סכמה ${t.schema_version}` : ''}${t.players !== null ? ` · ${t.players} נגנים גלויים לחשבון` : ''}`
          : 'לא נבדק'}</span></span>
        <sw-button size="sm" ?disabled=${this.busy || !c.url || !c.token_set} data-mc-test-run @click=${() => void this.runTest()}>בדוק חיבור</sw-button></div>
      ${this.error ? html`<div class="err" role="alert" data-mc-error>${this.error}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-ma-connection': MediaMaConnection;
  }
}
