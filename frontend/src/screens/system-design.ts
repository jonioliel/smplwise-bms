import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-card';
import '../components/sw-button';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { SELECTABLE_SKIN_IDS, SKINS, type SkinId } from '../design/skins';
import { skinTable } from '../design/css';
import { SCHEMES, installationDesign, onDesign, ownSchemeChoice, saveDemoDesign, setInstallationDesign, setOwnScheme, type Scheme, type Theme } from '../design/apply';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { t } from '../i18n/he';
import { BACKGROUND_MODES, BACKGROUND_SLOTS, customBackgroundUrl, installationBackground, onBackground, ownBackgroundChoice, saveDemoBackground, saveOwnBackground, setInstallationBackground, type BackgroundMode, type BackgroundSlot } from '../design/background';
import { deleteBackground, uploadBackground } from '../api/background';

const SCHEME_LABEL: Record<Scheme, string> = { light: 'בהיר', dark: 'כהה', auto: 'אוטומטי' };
const BG_LABEL: Record<BackgroundMode, () => string> = { builtin: () => t('background.builtin'), none: () => t('background.none'), custom: () => t('background.custom') };

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
  /** CRY: the installation's background choice (saved with the button) and this user's own (saved at once). */
  @state() private draftBackground: BackgroundMode = installationBackground().mode;
  @state() private ownBackground: BackgroundMode | null = ownBackgroundChoice();
  @state() private slotBusy: BackgroundSlot | null = null;
  @state() private slotMessage = '';
  @state() private slotError = '';
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
    /* VISDIFF-246: skins in a row that held one fewer left the last alone on a second line (a 25 % card and a hole beside it):
       where the card is wide enough all of them sit in one row. BUBBLE-FREEZE-295: four selectable skins (the bubble skin is frozen).
       SKINFOUND-297: six with the two Arx skins - one row where the card is wide, two equal rows (3 + 3) where it is medium; the counts
       come from the registry (--skins-n / --skins-half on .skins), so a lone card on its own line never appears */
    .skinrow {
      container-type: inline-size;
    }
    @container (min-width: 520px) {
      .skins {
        grid-template-columns: repeat(var(--skins-half, 2), minmax(0, 1fr));
      }
    }
    @container (min-width: 860px) {
      .skins {
        grid-template-columns: repeat(var(--skins-n, 4), minmax(0, 1fr));
      }
    }
    /* R5-SYSTEM-297: a skin card is a key one step below the card (surface-2 well, no outline at rest); the chosen one is a FILLED accent
       field with the accent ring; it gives on press and lifts only under a pointer that hovers */
    .skin {
      all: unset;
      align-self: start;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      cursor: pointer;
      min-block-size: 44px;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .skin:hover:not([disabled]) {
        box-shadow: var(--sw-shadow-2);
      }
    }
    .skin:active:not([disabled]) {
      transform: scale(var(--sw-press-scale));
    }
    .skin[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent), var(--sw-shadow-2);
    }
    @media (prefers-reduced-motion: reduce) {
      .skin {
        transition-duration: 0ms;
      }
    }
    .skin[disabled] {
      cursor: default;
      opacity: 0.7;
    }
    .skin:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* DESIGNTOKENS-297 (break-ui): a skin added as data may carry a long name (up to 24 characters, skins/define.ts) or an unbroken
       English word; the name wraps inside its card instead of pushing the card wider, and the "current" mark never shrinks or wraps */
    .skin .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.005em;
    }
    .skin .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .skin .cur {
      flex: none;
      white-space: nowrap;
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
    /* CRY: the two picture slots of the custom background */
    .slots {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .slot {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .slot .thumb {
      inline-size: 96px;
      block-size: 54px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      object-fit: cover;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
    }
    .slot .acts {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .slot .acts .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .slot .btns {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .upl {
      display: inline-flex;
      position: relative;
    }
    .upl input[type='file'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `, bubbleChrome];

  private stopBackground?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.stop = onDesign(() => this.requestUpdate());
    this.stopBackground = onBackground(() => {
      this.ownBackground = ownBackgroundChoice();
      this.requestUpdate();
    });
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          setInstallationDesign(r.settings['ui.skin'], r.settings['ui.scheme']);
          setInstallationBackground(r.settings['ui.background'], r.settings['ui.background_images']);
          const d = installationDesign();
          this.draftSkin = d.skin;
          this.draftScheme = d.scheme;
          this.draftBackground = installationBackground().mode;
        })
        .catch(() => undefined);
    }
  }

  disconnectedCallback() {
    this.stop?.();
    this.stopBackground?.();
    super.disconnectedCallback();
  }

  private get dirty(): boolean {
    const d = installationDesign();
    return d.skin !== this.draftSkin || d.scheme !== this.draftScheme || installationBackground().mode !== this.draftBackground;
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      if (isApi()) {
        const r = await patchSettings({ 'ui.skin': this.draftSkin, 'ui.scheme': this.draftScheme, 'ui.background': this.draftBackground });
        invalidateSettings();
        setInstallationDesign(r.settings['ui.skin'], r.settings['ui.scheme']);
        setInstallationBackground(r.settings['ui.background'], r.settings['ui.background_images']);
      } else {
        saveDemoDesign(this.draftSkin, this.draftScheme);
        saveDemoBackground(this.draftBackground);
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

  /** CRY: the user's own background (saved at once; null = "כמו המערכת"). */
  private async setOwnBackground(mode: BackgroundMode | null) {
    this.ownBackground = mode;
    this.slotError = '';
    try {
      await saveOwnBackground(mode);
    } catch (err) {
      this.ownBackground = ownBackgroundChoice();
      this.slotError = describeError(err);
    }
  }

  /** CRY: upload a picture into a slot (the server re-encodes it and answers with both stamps). */
  private async uploadSlot(slot: BackgroundSlot, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file || !isApi()) return;
    this.slotBusy = slot;
    this.slotError = '';
    this.slotMessage = '';
    try {
      const r = await uploadBackground(slot, file);
      invalidateSettings();
      setInstallationBackground(undefined, r.images);
      this.slotMessage = t('background.uploaded');
      setTimeout(() => (this.slotMessage = ''), 2500);
    } catch (err) {
      this.slotError = describeError(err);
    } finally {
      this.slotBusy = null;
    }
  }

  private async removeSlot(slot: BackgroundSlot) {
    if (!isApi()) return;
    this.slotBusy = slot;
    this.slotError = '';
    this.slotMessage = '';
    try {
      const r = await deleteBackground(slot);
      invalidateSettings();
      setInstallationBackground(undefined, r.images);
      this.slotMessage = t('background.removed');
      setTimeout(() => (this.slotMessage = ''), 2500);
    } catch (err) {
      this.slotError = describeError(err);
    } finally {
      this.slotBusy = null;
    }
  }

  /** One picture slot: the thumbnail (the uploaded picture or "no picture"), upload / replace and remove. */
  private slotCard(slot: BackgroundSlot) {
    const url = customBackgroundUrl(slot);
    const busy = this.slotBusy !== null || !this.canEdit || !isApi();
    return html`<div class="slot" data-bg-slot=${slot}>
      ${url ? html`<img class="thumb" src=${url} alt="" />` : html`<span class="thumb">${t('background.empty')}</span>`}
      <div class="acts">
        <span class="nm">${slot === 'day' ? t('background.day') : t('background.night')}</span>
        <div class="btns">
          <label class="upl"><input type="file" accept="image/png,image/jpeg,image/webp" data-bg-input=${slot} ?disabled=${busy} @change=${(e: Event) => void this.uploadSlot(slot, e.target as HTMLInputElement)} /><sw-button size="sm" icon="upload" ?disabled=${busy} @click=${(e: Event) => ((e.currentTarget as HTMLElement).closest('label') as HTMLLabelElement | null)?.querySelector('input')?.click()}>${url ? t('background.replace') : t('background.upload')}</sw-button></label>
          ${url ? html`<sw-button size="sm" variant="ghost" icon="trash" data-bg-remove=${slot} ?disabled=${busy} @click=${() => void this.removeSlot(slot)}>${t('background.remove')}</sw-button>` : nothing}
        </div>
      </div>
    </div>`;
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
      <div class="row col skinrow">
        <span class="lbl">סגנון<span class="muted">אותו מבנה בכל הסגנונות; ההבדל הוא בחומרים, בצורות ובצבעים</span></span>
        <div class="skins" role="group" aria-label="סגנון" style=${styleMap({ '--skins-n': String(SELECTABLE_SKIN_IDS.length), '--skins-half': String(Math.ceil(SELECTABLE_SKIN_IDS.length / 2)) })}>
          ${SELECTABLE_SKIN_IDS.map(
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
      <div class="row ${this.draftBackground === 'custom' ? 'col' : ''}"><span class="lbl">${t('background.label')}<span class="muted">${t('background.note')}</span></span>
        <span class="seg" role="group" aria-label=${t('background.label')}>
          ${BACKGROUND_MODES.map((m) => html`<button type="button" data-bg-option=${m} aria-pressed=${this.draftBackground === m ? 'true' : 'false'} ?disabled=${!this.canEdit} @click=${() => (this.draftBackground = m)}>${BG_LABEL[m]()}</button>`)}
        </span>
        ${this.draftBackground === 'custom'
          ? html`<div class="slots" data-bg-slots>${BACKGROUND_SLOTS.map((s) => this.slotCard(s))}</div>
              <span class="muted">${isApi() ? `${t('background.hint')}. ${t('background.fallback')}` : t('background.demoOnly')}</span>
              ${this.slotMessage ? html`<span class="ok" role="status" data-bg-slot-message>${this.slotMessage}</span>` : nothing}
              ${this.slotError ? html`<span class="err" role="alert">${this.slotError}</span>` : nothing}`
          : nothing}
      </div>
      <div class="row"><span class="lbl">${t('background.ownLabel')}<span class="muted">${t('background.ownNote')}</span></span>
        <span class="seg" role="group" aria-label=${t('background.ownLabel')}>
          <button type="button" data-own-bg="system" aria-pressed=${this.ownBackground === null ? 'true' : 'false'} @click=${() => void this.setOwnBackground(null)}>${t('background.likeSystem')}</button>
          ${BACKGROUND_MODES.map((m) => html`<button type="button" data-own-bg=${m} aria-pressed=${this.ownBackground === m ? 'true' : 'false'} @click=${() => void this.setOwnBackground(m)}>${BG_LABEL[m]()}</button>`)}
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
