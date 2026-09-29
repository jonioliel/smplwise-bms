import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-icon';
import { describeError } from '../api/client';
import { listRemoteSessions, revokeAllRemoteSessions, revokeRemoteSession, whenLabel, whereLabel, type RemoteSession, type RevokeResult } from '../api/remote';

const CHANNEL_LABEL: Record<RemoteSession['channel'], string> = { cookie: 'דפדפן', bearer: 'אפליקציה (אסימון גישה)' };

/**
 * CR-008 P2: the remote sign-ins (SmplWise Arx sessions) - one row per browser or client: what it is (browser family ·
 * system), where from (country, or the address masked to /24), when it signed in and was last seen, how many live
 * streams it has open. `scope="own"`: the viewer's own, with "התנתק מכל המקומות"; `scope="all"` (system
 * administrators, הגדרות › גישה מרחוק): everyone's, per-row revoke. Ending the sign-in of THIS page fires
 * `remote-signed-out` (the shell then signs out locally).
 */
@customElement('sw-remote-sessions')
export class SwRemoteSessions extends LitElement {
  @property() scope: 'own' | 'all' = 'own';
  /** The profile menu's short form: fewer details per row. */
  @property({ type: Boolean, reflect: true }) compact = false;
  @state() private rows: RemoteSession[] | null = null;
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private armed = false;
  @state() private remote = false;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  async load() {
    try {
      const r = await listRemoteSessions(this.scope);
      this.rows = r.sessions;
      this.remote = r.channel === 'remote';
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.rows = [];
    }
  }

  private announce(result: RevokeResult, what: string) {
    this.message = result.sessions_ended ? what : 'לא נמצאו כניסות פעילות.';
    this.dispatchEvent(new CustomEvent('remote-sessions-changed', { bubbles: true, composed: true, detail: result }));
    if (result.current_ended) this.dispatchEvent(new CustomEvent('remote-signed-out', { bubbles: true, composed: true, detail: result }));
  }

  private async revoke(row: RemoteSession) {
    this.busy = true;
    this.message = '';
    try {
      this.announce(await revokeRemoteSession(row.id), row.current ? 'יצאת מהמכשיר הזה.' : 'הכניסה נותקה.');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
      await this.load();
    }
  }

  private async revokeAll() {
    if (!this.armed) {
      this.armed = true;
      return;
    }
    this.armed = false;
    this.busy = true;
    this.message = '';
    try {
      const r = await revokeAllRemoteSessions();
      this.announce(r, `נותקו ${r.sessions_ended} כניסות.`);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
      await this.load();
    }
  }

  private renderRow(s: RemoteSession) {
    const all = this.scope === 'all';
    return html`<li class=${s.current ? 'cur' : ''} data-remote-session=${s.id} data-channel=${s.channel}>
      <sw-icon name=${s.channel === 'bearer' ? 'link' : 'user'} size=${16}></sw-icon>
      <div class="what">
        <div class="top">
          ${all ? html`<strong>${s.display_name || s.username || s.user_id}</strong>` : nothing}
          <span>${s.agent || CHANNEL_LABEL[s.channel]}</span>
          ${s.current ? html`<sw-badge kind="recorded" label="המכשיר הזה" data-current></sw-badge>` : nothing}
          ${s.live_streams ? html`<sw-badge kind="live" label=${`${s.live_streams} זרמים חיים`}></sw-badge>` : nothing}
        </div>
        <div class="sub">
          <span class="ltr-iso" data-where>${whereLabel(s)}</span>
          ${this.compact ? nothing : html`<span>· ${CHANNEL_LABEL[s.channel]}</span><span>· נכנס ${whenLabel(s.created_at)}</span>`}
          <span>· פעיל ${whenLabel(s.last_seen_at)}</span>
        </div>
      </div>
      <sw-button size="sm" variant="ghost" icon="logout" data-revoke ?disabled=${this.busy} @click=${() => void this.revoke(s)}>${s.current ? 'יציאה' : 'נתק'}</sw-button>
    </li>`;
  }

  render() {
    const rows = this.rows;
    if (rows === null) return html`<div class="muted">טוען כניסות…</div>`;
    const own = this.scope === 'own';
    return html`
      ${rows.length
        ? html`<ul data-remote-sessions-list>${rows.map((s) => this.renderRow(s))}</ul>`
        : this.error
          ? nothing
          : html`<div class="muted" data-remote-sessions-empty>${own ? 'אין כניסות פעילות מרחוק.' : 'אף משתמש אינו מחובר כרגע מרחוק.'}</div>`}
      ${own && rows.length
        ? html`<div class="foot">
            <sw-button size="sm" variant=${this.armed ? 'danger' : 'secondary'} icon="logout" data-signout-everywhere ?disabled=${this.busy} @click=${() => void this.revokeAll()}>
              ${this.armed ? 'לאשר? כל הכניסות ינותקו' : this.remote ? 'התנתק מכל המקומות' : 'נתק את כל הכניסות מרחוק'}
            </sw-button>
            ${this.armed ? html`<sw-button size="sm" variant="ghost" @click=${() => (this.armed = false)}>ביטול</sw-button>` : nothing}
          </div>`
        : nothing}
      ${this.message ? html`<div class="ok" role="status" data-remote-sessions-message>${this.message}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li > sw-icon {
      color: var(--sw-text-3);
      flex-shrink: 0;
    }
    li.cur > sw-icon {
      color: var(--sw-accent);
    }
    .what {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .sub {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ltr-iso {
      unicode-bidi: isolate;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    :host([compact]) li {
      padding: 6px 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-remote-sessions': SwRemoteSessions;
  }
}
