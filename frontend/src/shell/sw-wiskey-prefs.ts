import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WISKEY_AUTO, WISKEY_DENSITIES, WISKEY_WALLS } from '../wiskey/embed-view';
import { installWiskeyChoices, ownWiskeyChoices, refreshWiskeyView, saveWiskeyChoice, type WiskeyChoiceKey } from '../wiskey/wiskey-prefs';

/**
 * החשבון שלי › WisKey (WisKey rc.37): the user's own start choices for the embedded panel - how many cards the overview
 * shows and how many streams the camera wall opens with. Stored on the server per user (`wiskey.density` / `wiskey.wall`,
 * GET/PUT /me/prefs), so they follow the user to every device; "ברירת מחדל" hands the choice back to the installation
 * (הגדרות › מדיה). WisKey does not report a count changed inside the panel, so this is where the choice is kept; a change
 * here reloads an open WisKey frame once (wiskey-embed.ts). Mounted only while its section of the user menu is open.
 */
@customElement('sw-wiskey-prefs')
export class SwWiskeyPrefs extends LitElement {
  @state() private failed = false;
  @state() private busy = false;

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-block-size: 44px;
    }
    label {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    select {
      min-block-size: 32px;
      max-inline-size: 60%;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .note {
      margin: 2px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void refreshWiskeyView().then(() => this.requestUpdate()); // the stored values (once per opening of the section)
  }

  private async pick(key: WiskeyChoiceKey, select: HTMLSelectElement) {
    this.busy = true;
    this.failed = false;
    try {
      await saveWiskeyChoice(key, select.value === '' ? null : select.value);
    } catch {
      this.failed = true;
    } finally {
      this.busy = false;
      select.value = ownWiskeyChoices()[key] ?? ''; // what the server holds (a refused choice springs back)
      this.requestUpdate();
    }
  }

  private defaultLabel(value: string): string {
    return value === WISKEY_AUTO ? 'ברירת מחדל' : `ברירת מחדל (${value})`;
  }

  render() {
    const own = ownWiskeyChoices();
    const base = installWiskeyChoices();
    const density = own.density ?? '';
    const wall = own.wall ?? '';
    return html`
      <div class="row">
        <label for="wk-density">כרטיסים בסקירה</label>
        <select id="wk-density" data-my-wiskey-density ?disabled=${this.busy} @change=${(e: Event) => void this.pick('density', e.target as HTMLSelectElement)}>
          <option value="" ?selected=${density === ''}>${base.density === WISKEY_AUTO ? 'ברירת מחדל (אוטומטי)' : this.defaultLabel(base.density)}</option>
          <option value=${WISKEY_AUTO} ?selected=${density === WISKEY_AUTO}>אוטומטי</option>
          ${WISKEY_DENSITIES.map((n) => html`<option value=${n} ?selected=${density === n}>${n}</option>`)}
        </select>
      </div>
      <div class="row">
        <label for="wk-wall">מצלמות בקיר</label>
        <select id="wk-wall" data-my-wiskey-wall ?disabled=${this.busy} @change=${(e: Event) => void this.pick('wall', e.target as HTMLSelectElement)}>
          <option value="" ?selected=${wall === ''}>${this.defaultLabel(base.wall)}</option>
          ${WISKEY_WALLS.map((n) => html`<option value=${n} ?selected=${wall === n}>${n}</option>`)}
        </select>
      </div>
      <p class="note" data-my-wiskey-note>נקודת פתיחה בכל טעינה. שינוי בתוך WisKey אינו נשמר.</p>
      ${this.failed ? html`<p class="err" role="alert" data-my-wiskey-error>השמירה נכשלה</p>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-wiskey-prefs': SwWiskeyPrefs;
  }
}
