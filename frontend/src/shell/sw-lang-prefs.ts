import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { tr } from '../i18n/msg/shell';
import { UI_LANGS, currentUiLang, setUiLang, type UiLang } from '../i18n/ui-lang';

/** Each language is named in itself, whatever the interface language is. */
export const UI_LANG_NAMES: Record<UiLang, string> = { he: 'עברית', en: 'English' };

/**
 * החשבון שלי › שפה (I18N-EN-SWITCH-2438, owner round 32 Q-SYS-7 b): the user's interface language, Hebrew (default) or English,
 * stored on the server per user (`ui.lang`, GET/PUT /me/prefs) so it follows the user to every device. Choosing a language saves it
 * and reloads the page in it (right-to-left for Hebrew, left-to-right for English). Same row as the video choice beside it (a native
 * select: the phone's own picker).
 */
@customElement('sw-lang-prefs')
export class SwLangPrefs extends LitElement {
  @state() private busy = false;
  @state() private failed = false;

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

  private async pick(select: HTMLSelectElement) {
    const lang = select.value as UiLang;
    if (!UI_LANGS.includes(lang) || lang === currentUiLang()) return;
    this.busy = true;
    this.failed = false;
    try {
      await setUiLang(lang); // saves, then reloads the page in the new language
    } catch {
      this.failed = true;
      select.value = currentUiLang(); // a refused choice springs back
    } finally {
      this.busy = false;
    }
  }

  render() {
    const now = currentUiLang();
    return html`
      <div class="row">
        <label for="ui-lang">${tr('שפת הממשק')}</label>
        <select id="ui-lang" data-my-ui-lang ?disabled=${this.busy} @change=${(e: Event) => void this.pick(e.target as HTMLSelectElement)}>
          ${UI_LANGS.map((l) => html`<option value=${l} lang=${l} ?selected=${now === l}>${UI_LANG_NAMES[l]}</option>`)}
        </select>
      </div>
      <p class="note" data-my-ui-lang-note>${tr('חל על כל המסכים ועל כל מכשיר שבו נכנסים בחשבון הזה.')} ${tr('הדף ייטען מחדש בשפה שנבחרה.')}</p>
      ${this.failed ? html`<p class="err" role="alert" data-my-ui-lang-error>${tr('השמירה נכשלה')}</p>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-lang-prefs': SwLangPrefs;
  }
}
