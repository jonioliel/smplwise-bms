import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import { ApiError, describeError } from '../api/client';
import { isApi, onRemote } from '../api/session';
import {
  APP_SIGNIN_OFF, EXCHANGE_ACCESS_MAX, appSignInBody, appSignInEnds, appSignInOf, appSignInProblem, getAppSignIn, onLocked, putAppSignIn, setAppSwitch,
  type AppSignIn, type AppSwitch,
} from '../api/app-signin';
import { ast } from '../i18n/app-signin';
import { settingsStyles } from '../styles/settings';

/**
 * הגדרות › גישה מרחוק › כניסה מהאפליקציה לנייד: the two sign-in switches of the phone app (`security.app_refresh`,
 * `security.app_session_exchange`; api/app-signin.ts has the rules). A system administrator's card: the GET answers 403 to anyone else
 * and the card then draws nothing. The route's channel rule is the card's: on the remote channel the "פעיל" key of a switch that is off
 * is closed with the local-network note; "כבוי" works anywhere. A save that ends sign-ins asks first and names them. The settings kit:
 * `.row` wells, pill-thumb `.seg` keys, a `.foot.sticky` save row on a phone.
 */
@customElement('system-app-signin')
export class SystemAppSignIn extends LitElement {
  @state() private saved: AppSignIn = APP_SIGNIN_OFF;
  @state() private draft: AppSignIn = APP_SIGNIN_OFF;
  @state() private phase: 'loading' | 'ready' | 'hidden' | 'error' | 'demo' = isApi() ? 'loading' : 'demo';
  @state() private busy = false;
  @state() private asking = false;
  @state() private message = '';
  @state() private error = '';

  static styles = [settingsStyles, css`
    :host { display: block; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
    .note { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load(): Promise<void> {
    try {
      const r = await getAppSignIn();
      this.adopt(appSignInOf(r.settings));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) this.phase = 'hidden';
      else {
        this.phase = 'error';
        this.error = `${ast('loadError')}: ${describeError(e)}`;
      }
    }
  }

  private adopt(s: AppSignIn): void {
    this.saved = s;
    this.draft = { ...s };
    this.phase = 'ready';
  }

  private set(sw: AppSwitch, on: boolean): void {
    this.draft = setAppSwitch(this.draft, sw, on);
    this.message = '';
    this.error = '';
  }

  private ask(): void {
    if (appSignInEnds(this.saved, this.draft).length) this.asking = true;
    else void this.save();
  }

  private async save(): Promise<void> {
    this.asking = false;
    const body = appSignInBody(this.saved, this.draft);
    if (!Object.keys(body).length || appSignInProblem(this.saved, this.draft, onRemote())) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await putAppSignIn(body);
      this.adopt(appSignInOf(r.settings));
      this.message = r.families_ended ? ast('savedEnded', { n: r.families_ended }) : ast('saved');
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private problemText(remote: boolean): string {
    const p = appSignInProblem(this.saved, this.draft, remote);
    if (p === 'remote_on') return ast('localOnly');
    if (p === 'exchange_needs_refresh') return ast('needsRefresh');
    if (p === 'access_too_long') return ast('accessTooLong', { max: EXCHANGE_ACCESS_MAX, n: this.draft.accessMinutes });
    return '';
  }

  private row(sw: AppSwitch, remote: boolean, ro: boolean) {
    const on = this.draft[sw];
    const lockOn = ro || onLocked(this.saved, sw, remote) || (sw === 'exchange' && !this.draft.refresh);
    const label = ast(sw);
    const note = onLocked(this.saved, sw, remote) ? ast('localOnly') : sw === 'exchange' && !this.draft.refresh ? ast('needsRefresh') : '';
    return html`<div class="row" data-app-signin-row=${sw}><span class="lbl">${label}<span class="muted">${ast(sw === 'refresh' ? 'refreshHint' : 'exchangeHint')}</span>
        ${note ? html`<span class="muted note" data-app-signin-note=${sw}>${note}</span>` : nothing}</span>
      <div class="seg" role="group" aria-label=${label} data-app-signin=${sw}>
        <button type="button" data-v="off" aria-pressed=${String(!on)} ?disabled=${ro} @click=${() => this.set(sw, false)}>${ast('off')}</button>
        <button type="button" data-v="on" aria-pressed=${String(on)} ?disabled=${lockOn} @click=${() => this.set(sw, true)}>${ast('on')}</button></div></div>`;
  }

  render() {
    if (this.phase === 'hidden' || this.phase === 'loading') return nothing;
    const remote = onRemote();
    const ro = this.phase !== 'ready' || this.busy;
    const dirty = Object.keys(appSignInBody(this.saved, this.draft)).length > 0;
    const problem = dirty ? this.problemText(remote) : '';
    const ends = appSignInEnds(this.saved, this.draft);
    return html`<sw-card heading=${ast('title')} subheading=${ast('sub')} data-card="remote.app-signin" data-app-signin-card>
      <div class="set-col">${this.row('refresh', remote, ro)}${this.row('exchange', remote, ro)}</div>
      ${this.phase === 'ready'
        ? html`<div class="foot sticky" data-app-signin-foot>
            <sw-button variant="primary" size="sm" icon="check" data-app-signin-save ?disabled=${!dirty || !!problem || this.busy} @click=${() => this.ask()}>${ast('save')}</sw-button>
            ${problem ? html`<span class="err" role="alert" data-app-signin-problem>${problem}</span>` : nothing}
            ${this.message ? html`<span class="ok" role="status" data-app-signin-message>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="err" role="alert" data-app-signin-error>${this.error}</span>` : nothing}
          </div>`
        : html`<div class="muted" data-app-signin-readonly>${this.phase === 'error' ? this.error : ast('demo')}</div>`}
      <sw-dialog ?open=${this.asking} heading=${ast('confirmTitle')} @close=${() => (this.asking = false)} data-app-signin-confirm>
        ${ends.includes('refresh') ? html`<p data-app-signin-ends="refresh">${ast('confirmRefresh')}</p>` : nothing}
        ${ends.includes('exchange') ? html`<p data-app-signin-ends="exchange">${ast('confirmExchange')}</p>` : nothing}
        <sw-button slot="footer" @click=${() => (this.asking = false)}>${ast('cancel')}</sw-button>
        <sw-button slot="footer" variant="primary" data-app-signin-confirm-go @click=${() => void this.save()}>${ast('confirmGo')}</sw-button>
      </sw-dialog>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-app-signin': SystemAppSignIn;
  }
}
