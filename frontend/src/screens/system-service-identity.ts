import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-card';
import { ApiError, describeError, get, put } from '../api/client';
import { lit, litLang } from '../i18n/local-identity';

/** USR2 P3: GET /identity/service-identity (local channel only, system.configure) - services/service_identity.status on the server. */
export interface ServiceIdentityStatus {
  configured_user_id: string | null;
  user: { id: string; name: string | null; is_active: boolean; is_admin: boolean } | null;
  bridge: { paired: boolean; version: string | null; required: string; version_ok: boolean; capable: boolean; reported_user_id: string | null; agrees: boolean };
  feature_on: boolean;
  ready: boolean;
  steps: { code: string; he: string; en: string }[];
  allowed: { key: string; he: string; en: string }[];
  refused: { he: string; en: string }[];
}

/** The text of a bilingual server line in the document language. */
export function pick(x: { he: string; en: string }, lang: 'he' | 'en' = litLang()): string {
  return lang === 'en' ? x.en || x.he : x.he;
}

/**
 * USR2 P3: the service-identity card at the top of Settings › משתמשים והרשאות › משתמשי Arx. Shows whether a local user's Home Assistant
 * action would be accepted by both sides, what is still missing (plain Hebrew from the server), what is allowed and what never is, and
 * lets a system administrator set / clear the id. Local channel only: on the remote channel the route answers 404 and the card shows one
 * line instead; a caller without system.configure (403) sees nothing.
 */
@customElement('system-service-identity')
export class SystemServiceIdentity extends LitElement {
  @property({ type: Boolean }) remote = false;
  @state() private data: ServiceIdentityStatus | null = null;
  @state() private notShown = false;
  @state() private error = '';
  @state() private saved = false;
  @state() private busy = false;
  @state() private value = '';

  static styles = css`
    :host {
      display: block;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md, 1rem);
      font-weight: var(--sw-fw-semibold, 600);
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      max-inline-size: 75ch;
      margin: 0;
    }
    .note {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .note.warn {
      background: var(--sw-warning-soft, var(--sw-accent-soft));
    }
    ol,
    ul {
      margin: 0;
      padding-inline-start: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      margin-block-end: 4px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-end;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      flex: 1 1 260px;
      min-inline-size: 0;
    }
    input {
      font: inherit;
      min-block-size: 40px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      inline-size: 100%;
      box-sizing: border-box;
      direction: ltr;
      text-align: start;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    bdi.id {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      word-break: break-all;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.remote) void this.load();
  }

  private async load() {
    try {
      const d = await get<ServiceIdentityStatus>('/identity/service-identity');
      this.data = d;
      this.value = d.configured_user_id ?? '';
      this.error = '';
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) this.notShown = true;
      else this.error = describeError(err);
    }
  }

  private async save(clear = false) {
    this.busy = true;
    this.error = '';
    this.saved = false;
    try {
      const d = await put<ServiceIdentityStatus>('/identity/service-identity', { user_id: clear ? null : this.value.trim() || null });
      this.data = d;
      this.value = d.configured_user_id ?? '';
      this.saved = true;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (this.remote) return html`<div class="note" data-si-remote>${lit('siRemote')}</div>`;
    if (this.notShown) return nothing;
    const d = this.data;
    return html`<sw-card data-service-identity>
      <div class="body">
        <div class="head">
          <h3>${lit('siTitle')}</h3>
          ${d ? html`<sw-badge kind=${d.ready ? 'live' : 'partial'} label=${d.ready ? lit('siReady') : lit('siNotReady')} data-si-state=${d.ready ? 'ready' : 'not-ready'}></sw-badge>` : nothing}
        </div>
        <p class="sub">${lit('siSub')}</p>
        ${this.error ? html`<div class="note err" role="alert" data-si-error>${this.error}</div>` : nothing}
        ${this.saved ? html`<div class="note" role="status">${lit('siSaved')}</div>` : nothing}
        ${d
          ? html`
              ${d.user
                ? html`<div class="facts" data-si-user>
                    <span>${lit('siUser')}: <bdi>${d.user.name ?? ''}</bdi> · <bdi class="id">${d.user.id}</bdi>${d.user.is_admin ? html` · <strong>${lit('siAdmin')}</strong>` : nothing}</span>
                    <span>${lit('siBridge')}: <bdi>${d.bridge.version ?? '?'}</bdi> · ${d.bridge.agrees ? lit('siAgrees') : lit('siDiffers')}</span>
                  </div>`
                : nothing}
              ${d.steps.length
                ? html`<div class="note warn" data-si-steps>
                    <div class="label">${lit('siNeeded')}</div>
                    <ol>${d.steps.map((s) => html`<li data-si-step=${s.code}>${pick(s)}</li>`)}</ol>
                  </div>`
                : nothing}
              <div class="row">
                <label
                  >${lit('siUserId')}
                  <input
                    .value=${this.value}
                    maxlength="64"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${lit('siPlaceholder')}
                    @input=${(e: Event) => (this.value = (e.target as HTMLInputElement).value)}
                    data-si-input
                /></label>
                <sw-button variant="primary" ?disabled=${this.busy} @click=${() => this.save()} data-si-save>${lit('siSave')}</sw-button>
                ${d.configured_user_id ? html`<sw-button variant="ghost" ?disabled=${this.busy} @click=${() => this.save(true)} data-si-clear>${lit('siClear')}</sw-button>` : nothing}
              </div>
              <div class="cols">
                <div>
                  <div class="label">${lit('siAllowed')}</div>
                  <ul data-si-allowed>${d.allowed.map((a) => html`<li>${pick(a)}</li>`)}</ul>
                </div>
                <div>
                  <div class="label">${lit('siRefused')}</div>
                  <ul data-si-refused>${d.refused.map((a) => html`<li>${pick(a)}</li>`)}</ul>
                </div>
              </div>
            `
          : html`<div class="sub">…</div>`}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-service-identity': SystemServiceIdentity;
  }
}
