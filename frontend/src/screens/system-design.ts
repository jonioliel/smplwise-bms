import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-card';
import '../components/sw-button';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { SKIN_IDS, SKINS, type SkinId } from '../design/skins';
import { skinTable } from '../design/css';
import { SCHEMES, installationDesign, onDesign, ownSchemeChoice, saveDemoDesign, setInstallationDesign, setOwnScheme, type Scheme, type Theme } from '../design/apply';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const SCHEME_LABEL: Record<Scheme, string> = { light: 'בהיר', dark: 'כהה', auto: 'אוטומטי' };

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
const themeOf = (s: Scheme): Theme => (s === 'auto' ? (systemDark() ? 'dark' : 'light') : s);

/**
 * הגדרות › כללי › מראה המערכת (design foundation, 2026-10-01): the skin of the whole product (one structure, several looks:
 * design/skins) and its light / dark choice. Two owners: the installation's defaults (`ui.skin`, `ui.scheme`; a holder of
 * system.configure; saved with the button) and this browser's own scheme (applies at once, "כמו המערכת" clears it). The
 * swatches are drawn from each skin's own token table in the scheme being chosen, so the preview is the skin, not a picture.
 * In the static demo (no backend) "the installation" is this browser.
 */
@customElement('system-design')
export class SystemDesign extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private draftSkin: SkinId = installationDesign().skin;
  @state() private draftScheme: Scheme = installationDesign().scheme;
  @state() private own: Scheme | null = ownSchemeChoice();
  @state() private canEdit = !isApi();
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  private stop?: () => void;

  static styles = [css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row.col {
      align-items: stretch;
      flex-direction: column;
      flex-wrap: nowrap;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
    }
    .skins {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      align-items: start;
    }
    .skin {
      all: unset;
      align-self: start;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
      min-block-size: 44px;
    }
    .skin[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent);
    }
    .skin[disabled] {
      cursor: default;
      opacity: 0.7;
    }
    .skin:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .skin .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .skin .note {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      line-height: 1.35;
    }
    .cur {
      font-size: var(--sw-fs-2xs);
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* the swatch: a miniature of the shell drawn in the skin's own tokens (inline custom properties on .sw) */
    .sw {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 16px;
      gap: 6px;
      padding: 6px;
      block-size: 78px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      direction: rtl;
    }
    .sw .rail {
      border-radius: var(--m-r-lg);
      background: var(--m-surface);
      border: 1px solid var(--m-border);
      display: grid;
      align-content: start;
      justify-items: center;
      gap: 4px;
      padding-block: 5px;
    }
    .sw .rail i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 3px;
      background: var(--m-text3);
      opacity: 0.55;
    }
    .sw .rail i:first-child {
      background: var(--m-accent);
      opacity: 1;
    }
    .sw .body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto 1fr;
      gap: 5px;
    }
    .sw .title {
      grid-column: 1 / -1;
      inline-size: 55%;
      block-size: 7px;
      border-radius: 3px;
      background: var(--m-text);
    }
    .sw .card {
      border-radius: var(--m-r-md);
      background: var(--m-surface);
      border: 1px solid var(--m-border);
      padding: 4px;
      display: grid;
      align-content: space-between;
    }
    .sw .card b {
      display: block;
      inline-size: 60%;
      block-size: 4px;
      border-radius: 2px;
      background: var(--m-text2);
    }
    .sw .card em {
      display: block;
      inline-size: 40%;
      block-size: 6px;
      border-radius: var(--m-r-sm);
      background: var(--m-accent);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      flex-wrap: wrap;
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      min-block-size: 36px;
      padding: 0 14px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-block-start: 12px;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onDesign(() => this.requestUpdate());
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          setInstallationDesign(r.settings['ui.skin'], r.settings['ui.scheme']);
          const d = installationDesign();
          this.draftSkin = d.skin;
          this.draftScheme = d.scheme;
        })
        .catch(() => undefined);
    }
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private get dirty(): boolean {
    const d = installationDesign();
    return d.skin !== this.draftSkin || d.scheme !== this.draftScheme;
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      if (isApi()) {
        const r = await patchSettings({ 'ui.skin': this.draftSkin, 'ui.scheme': this.draftScheme });
        invalidateSettings();
        setInstallationDesign(r.settings['ui.skin'], r.settings['ui.scheme']);
      } else {
        saveDemoDesign(this.draftSkin, this.draftScheme);
      }
      this.message = 'המראה נשמר';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setOwn(s: Scheme | null) {
    this.own = s;
    setOwnScheme(s);
  }

  /** The miniature of a skin in a scheme: every colour and radius comes from the skin's merged token table. */
  private swatch(id: SkinId, theme: Theme) {
    const t = skinTable(id);
    const v = (n: string) => t[n]?.[theme] ?? '';
    const canvas = v('--sw-canvas');
    const px = (n: string) => `${Math.min(parseFloat(v(n)) || 0, 14)}px`;
    const style = {
      background: canvas.includes('var(') ? v('--sw-bg') : canvas,
      '--m-surface': v('--sw-surface-solid'),
      '--m-border': v('--sw-border-strong'),
      '--m-text': v('--sw-heading'),
      '--m-text2': v('--sw-text-2'),
      '--m-text3': v('--sw-text-3'),
      '--m-accent': v('--sw-accent'),
      '--m-r-sm': px('--sw-r-sm'),
      '--m-r-md': px('--sw-r-md'),
      '--m-r-lg': px('--sw-r-lg'),
    };
    return html`<span class="sw" style=${styleMap(style)} aria-hidden="true"
      ><span class="body"><span class="title"></span><span class="card"><b></b><em></em></span><span class="card"><b></b><em></em></span></span
      ><span class="rail"><i></i><i></i><i></i></span></span
    >`;
  }

  render() {
    const preview = themeOf(this.draftScheme);
    const cur = installationDesign();
    return html`<sw-card heading="מראה המערכת" subheading="סגנון וצבעוניות - בהיר, כהה או לפי המכשיר" data-design-card>
      <div class="row col">
        <span class="lbl">סגנון<span class="muted">אותו מבנה בכל הסגנונות; ההבדל הוא בחומרים, בצורות ובצבעים</span></span>
        <div class="skins" role="group" aria-label="סגנון">
          ${SKIN_IDS.map(
            (id) => html`<button type="button" class="skin" data-skin-option=${id} aria-pressed=${this.draftSkin === id ? 'true' : 'false'} ?disabled=${!this.canEdit} @click=${() => (this.draftSkin = id)}>
              ${this.swatch(id, preview)}
              <span class="nm">${SKINS[id].nameHe}${cur.skin === id ? html`<span class="cur" data-skin-current>נוכחי</span>` : nothing}</span>
              <span class="note">${SKINS[id].noteHe}</span>
            </button>`,
          )}
        </div>
      </div>
      <div class="row"><span class="lbl">צבעוניות של המערכת<span class="muted">ברירת המחדל לכל המשתמשים; אוטומטי עוקב אחרי המכשיר</span></span>
        <span class="seg" role="group" aria-label="צבעוניות של המערכת">
          ${SCHEMES.map((s) => html`<button type="button" data-scheme-option=${s} aria-pressed=${this.draftScheme === s ? 'true' : 'false'} ?disabled=${!this.canEdit} @click=${() => (this.draftScheme = s)}>${SCHEME_LABEL[s]}</button>`)}
        </span></div>
      <div class="row"><span class="lbl">הצבעוניות אצלי<span class="muted">רק בדפדפן הזה; "כמו המערכת" מבטל</span></span>
        <span class="seg" role="group" aria-label="הצבעוניות אצלי">
          <button type="button" data-own-scheme="system" aria-pressed=${this.own === null ? 'true' : 'false'} @click=${() => this.setOwn(null)}>כמו המערכת</button>
          ${SCHEMES.map((s) => html`<button type="button" data-own-scheme=${s} aria-pressed=${this.own === s ? 'true' : 'false'} @click=${() => this.setOwn(s)}>${SCHEME_LABEL[s]}</button>`)}
        </span></div>
      <div class="foot">
        <sw-button variant="primary" size="sm" icon="check" data-design-save ?disabled=${!this.canEdit || !this.dirty || this.busy} @click=${() => void this.save()}>שמור</sw-button>
        ${this.message ? html`<span class="ok" role="status" data-design-message>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-design': SystemDesign;
  }
}
