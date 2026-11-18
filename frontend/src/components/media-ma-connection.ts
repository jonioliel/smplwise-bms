import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import './sw-toggle';
import './sw-badge';
import { onRemote, LOCAL_ONLY_GENERIC } from '../api/session';
import { describeError } from '../api/client';
import { dayText } from '../api/day-format';
import { MA_STATE_LABEL, players, type MaConnection, type MaState, type MaTest } from '../api/media-players';
import { tr } from '../i18n/msg/components';

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
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      inline-size: min(320px, 100%);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (!onRemote()) void this.load();
  }

  private async load() {
    try {
      this.conn = await players().maConnection();
      this.url = this.conn.url ?? '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** FIX-2438-REDS: the host says when a save / test is in flight (`aria-busy`), the settled marker for assistive tech and the tests. */
  protected updated(): void {
    const busy = String(this.busy);
    if (this.getAttribute('aria-busy') !== busy) this.setAttribute('aria-busy', busy);
  }

  private async save(body: Parameters<ReturnType<typeof players>['saveMaConnection']>[0]) {
    this.busy = true;
    this.error = '';
    try {
      this.conn = await players().saveMaConnection(body);
      // FIX-2438-REDS: a save resets only the draft it sent. Before, saving the address also wiped a token typed while that save was
      // in flight (and a token save reset an address being edited): the token then never reached the server (entry check 2771a0b90).
      if ('url' in body) this.url = this.conn.url ?? '';
      if ('token' in body || 'clear_token' in body) {
        this.token = '';
        this.editingToken = false;
      }
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
    if (onRemote()) return html`<div class="row"><span class="lbl">${tr('חיבור ישיר ל־Music Assistant')}<span class="muted" data-mc-local-only>${LOCAL_ONLY_GENERIC}</span></span></div>`;
    if (!c) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    const t = this.test ?? c.last_test;
    const since = c.token_set_at ? dayText(c.token_set_at) : null;
    return html`
      <div class="row"><span class="lbl">${tr('חיבור ישיר ל־Music Assistant')}<span class="muted">${tr('תור מלא (גרירה, מחיקה, נגן הבא) וחיפוש בספרייה. ללא החיבור: התור הקצר והספרייה בלי חיפוש.')}</span></span>
        <span class="acts"><sw-badge kind=${BADGE[c.state]} label=${MA_STATE_LABEL[c.state]} data-mc-state=${c.state}></sw-badge>
          <sw-toggle label=${tr('חיבור ישיר')} labelHidden .checked=${c.enabled} ?disabled=${this.busy || (!c.url && !this.url)} data-mc-enabled
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ enabled: e.detail.checked, ...(this.url && this.url !== c.url ? { url: this.url } : {}) })}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${tr('כתובת השרת')}<span class="muted">${tr('http://שם-מארח:8095 · נשמרת בהגדרות בלבד')}</span></span>
        <span class="acts"><input type="url" inputmode="url" spellcheck="false" placeholder="http://host:8095" .value=${this.url} data-mc-url aria-label=${tr('כתובת השרת')}
            @input=${(e: Event) => (this.url = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" ?disabled=${this.busy || this.url === (c.url ?? '')} data-mc-url-save @click=${() => void this.save({ url: this.url || null })}>${tr('שמור')}</sw-button></span></div>
      <div class="row"><span class="lbl">${tr('אסימון גישה')}<span class="muted" data-mc-token>${c.token_set ? (since ? tr('הוגדר ב־{date}', { date: since }) : tr('הוגדר')) : tr('לא הוגדר')} · ${tr('משתמש ייעודי עם סינון נגנים')}${c.token_expiring ? html` · <span class="warn">${tr('יש לחדש את האסימון')}</span>` : ''}</span></span>
        <span class="acts">${this.editingToken || !c.token_set
          ? html`<input type="password" autocomplete="off" spellcheck="false" .value=${this.token} data-mc-token-input aria-label=${tr('אסימון גישה')} @input=${(e: Event) => (this.token = (e.target as HTMLInputElement).value)} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy || this.token.trim().length < 16} data-mc-token-save @click=${() => void this.save({ token: this.token.trim() })}>${tr('שמור')}</sw-button>
              ${c.token_set ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => { this.editingToken = false; this.token = ''; }}>${tr('ביטול')}</sw-button>` : nothing}`
          : html`<sw-button size="sm" ?disabled=${this.busy} data-mc-token-replace @click=${() => (this.editingToken = true)}>${tr('החלף')}</sw-button>
              <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-mc-token-clear @click=${() => void this.save({ clear_token: true })}>${tr('מחק')}</sw-button>`}</span></div>
      <div class="row"><span class="lbl">${tr('בדיקת חיבור')}<span class="muted" data-mc-test>${t
          ? `${MA_STATE_LABEL[t.state]}${t.server_version ? ` · ${tr('גרסה {v}', { v: t.server_version })}` : ''}${t.schema_version !== null ? ` · ${tr('סכמה {v}', { v: t.schema_version })}` : ''}${t.players !== null ? ` · ${tr('{n} נגנים גלויים לחשבון', { n: t.players })}` : ''}`
          : tr('לא נבדק')}</span></span>
        <sw-button size="sm" ?disabled=${this.busy || !c.url || !c.token_set} data-mc-test-run @click=${() => void this.runTest()}>${tr('בדוק חיבור')}</sw-button></div>
      ${this.error ? html`<div class="err" role="alert" data-mc-error>${this.error}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-ma-connection': MediaMaConnection;
  }
}
