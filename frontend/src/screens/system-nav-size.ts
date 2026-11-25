import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-avatar';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import {
  NAV_PRESETS, NAV_PRESET_LABEL, installationNavSize, navCssVars, navDims, navSize, onNavSize, ownNavSize,
  sameNavSize, saveOwnNavSize, setInstallationNavSize, type NavSize,
} from '../shell/nav-size';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsPlainRowStyles, settingsStackLabelStyles, settingsMutedHintStyles, settingsWrapFootStyles } from '../styles/settings';
import { tr } from '../i18n/msg/system-b';

/** The preview's tabs (the same icons and labels as the rail; shell/nav.ts NAV_A). */
const PREVIEW_TABS = [
  { icon: 'home', label: tr('ראשי') },
  { icon: 'shield', label: tr('אבטחה') },
  { icon: 'map', label: tr('מפה') },
  { icon: 'door', label: 'WisKey' },
];

/**
 * הגדרות › כללי › גודל הניווט (UI round 1b, owner 2026-09-30): how big the side rail (desktop) and the bottom bar (phone)
 * are. Two owners of the value - the installation's default (a system administrator) and the user's own (personal, wins;
 * "ברירת מחדל של המערכת" clears it) - and two ways to choose it:
 *   יחסי  - one of four presets (קטן / בינוני / גדול / גדול מאוד); rail width, icon, label, item height and the avatar scale
 *           together, the size in use is marked "נוכחי";
 *   חופשי - icon, label (or no labels) and item height each on their own, without a proportion lock, inside the ranges the
 *           backend enforces (shell/nav-size.ts NAV_RANGE); the rail follows the widest label, so nothing is clipped.
 * The mini rail and bottom bar below the controls follow every choice at once; saving applies to the running shell at once
 * (no reload). Own component, so the rest of the settings screen is untouched.
 */
@customElement('system-nav-size')
export class SystemNavSize extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private target: 'own' | 'installation' = 'own';
  @state() private draft: NavSize = navSize();
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  /** What is applied right now (for the "נוכחי" mark), kept current by the shell's own change signal. */
  @state() private applied: NavSize = navSize();
  private stop?: () => void;

  static styles = [css`
    ${settingsPlainRowStyles}
    .row:last-of-type {
      border-block-end: 0;
    }
    ${settingsStackLabelStyles}
    ${settingsMutedHintStyles}
    /* CR-SEG-MODULE-LOOK-2470 (owner, 20.11): the keys are sw-segmented in its default, the module look, like every settings page
       (the page's own 36 px key with the medium label went) */
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .stage {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      flex-wrap: wrap;
      padding: 14px;
      margin-block-start: 10px;
      background: var(--sw-bg);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .stage h4 {
      margin: 0 0 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
    }
    /* the mini rail: the shell's own proportions (sw-app.ts), driven by the same variables */
    .mini-rail {
      display: inline-flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      padding: 10px 7px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .mini-rail .it {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      box-sizing: border-box;
      min-inline-size: var(--nav-item-w);
      min-block-size: var(--nav-item-h);
      padding: 6px 4px;
      border-radius: var(--sw-r-md);
      color: var(--sw-text-3);
      font-size: var(--nav-label);
      line-height: 1.3;
      white-space: nowrap;
    }
    .mini-rail .it.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .mini-bar {
      display: flex;
      inline-size: 300px;
      max-inline-size: 100%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
    }
    .mini-bar .it {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      box-sizing: border-box;
      min-block-size: var(--nav-bar-h);
      padding: 3px 2px 4px;
      color: var(--sw-text-3);
      font-size: var(--nav-p-label);
      white-space: nowrap;
    }
    .mini-bar .ic {
      display: grid;
      place-items: center;
      inline-size: var(--nav-pill-w);
      block-size: var(--nav-pill-h);
      border-radius: 999px;
    }
    .mini-bar .it.on {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .mini-bar .it.on .ic {
      background: var(--sw-accent-soft);
    }
    .nolabels .lbl {
      display: none;
    }
    ${settingsWrapFootStyles}
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onNavSize((s) => (this.applied = s));
    this.draft = this.storedOf(this.target);
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          setInstallationNavSize(r.settings['ui.nav_size']);
          this.draft = this.storedOf(this.target);
        })
        .catch(() => undefined);
    }
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  /** The stored value of one target: mine (or, while I have none, the system's - what I see now) / the installation's. */
  private storedOf(t: 'own' | 'installation'): NavSize {
    return t === 'installation' ? installationNavSize() : ownNavSize() ?? installationNavSize();
  }

  private setTarget(t: 'own' | 'installation') {
    this.target = t;
    this.draft = this.storedOf(t);
    this.message = '';
    this.error = '';
  }

  private get dirty(): boolean {
    return !sameNavSize(this.draft, this.storedOf(this.target)) || (this.target === 'own' && ownNavSize() === null);
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      if (this.target === 'own') {
        await saveOwnNavSize(this.draft);
      } else {
        const r = await patchSettings({ 'ui.nav_size': this.draft });
        invalidateSettings();
        setInstallationNavSize(r.settings['ui.nav_size']);
      }
      this.draft = this.storedOf(this.target);
      this.message = tr('גודל הניווט נשמר');
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** "ברירת מחדל של המערכת": forget my own value; the installation's applies again. */
  private async useSystemDefault() {
    this.busy = true;
    this.error = '';
    try {
      await saveOwnNavSize(null);
      this.draft = this.storedOf('own');
      this.message = tr('הניווט חזר לברירת המחדל של המערכת');
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderRel() {
    const cur = this.applied.mode === 'rel' ? this.applied.preset : null;
    const sel = this.draft.mode === 'rel' ? this.draft.preset : null;
    return html`<div class="row" data-nav-rel><span class="lbl">${tr('גודל')}<span class="muted">${tr('כל חלקי הניווט מוגדלים ומוקטנים יחד')}</span></span>
      <sw-segmented label=${tr('גודל הניווט')} value=${sel ?? ''} @change=${(e: CustomEvent<SegmentedChange>) => { this.draft = { mode: 'rel', preset: e.detail.value as (typeof NAV_PRESETS)[number] }; this.message = ''; }}
        .options=${NAV_PRESETS.map((p) => ({ value: p, label: NAV_PRESET_LABEL[p], badge: cur === p ? tr('נוכחי') : undefined, badgeAttrs: { 'data-nav-current': '' }, attrs: { 'data-nav-preset': p } }))}></sw-segmented></div>`;
  }

  private renderPreview() {
    const d = navDims(this.draft);
    const vars = Object.entries(navCssVars(d)).map(([k, v]) => `${k}:${v}`).join(';');
    return html`<div class="stage ${classMap({ nolabels: !d.labels })}" style=${vars} data-nav-preview data-icon=${d.icon} data-label=${d.labels ? d.label : 0} data-item=${d.item}>
      <div><h4>${tr('סרגל צד')}</h4>
        <div class="mini-rail" data-preview-rail>
          ${PREVIEW_TABS.map((t, i) => html`<span class="it ${i === 0 ? 'on' : ''}" data-preview-item><sw-icon name=${t.icon} size=${d.icon}></sw-icon><span class="lbl">${t.label}</span></span>`)}
          <span class="it" data-preview-item><sw-avatar name=${tr('יוני')} size=${d.avatar}></sw-avatar><span class="lbl">${tr('יוני')}</span></span>
        </div></div>
      <div><h4>${tr('סרגל תחתון בטלפון')}</h4>
        <div class="mini-bar" data-preview-bar>
          ${PREVIEW_TABS.map((t, i) => html`<span class="it ${i === 0 ? 'on' : ''}"><span class="ic"><sw-icon name=${t.icon} size=${d.pIcon}></sw-icon></span><span class="lbl">${t.label}</span></span>`)}
          <span class="it"><span class="ic"><sw-avatar name=${tr('יוני')} size=${d.pAvatar}></sw-avatar></span><span class="lbl">${tr('יוני')}</span></span>
        </div></div>
    </div>`;
  }

  render() {
    const both = this.canEdit && isApi();
    return html`<sw-card heading=${tr('גודל הניווט')} subheading=${tr('סרגל הצד במחשב והסרגל התחתון בטלפון')} data-nav-size>
      ${both
        ? html`<div class="row"><span class="lbl">${tr('מה לערוך')}<span class="muted">${tr('הגדרה אישית גוברת על ברירת המחדל של המערכת')}</span></span>
            <sw-segmented label=${tr('מה לערוך')} value=${this.target} @change=${(e: CustomEvent<SegmentedChange>) => this.setTarget(e.detail.value as 'own' | 'installation')}
              .options=${[{ value: 'own', label: tr('שלי'), attrs: { 'data-nav-target': 'own' } }, { value: 'installation', label: tr('ברירת מחדל של המערכת'), attrs: { 'data-nav-target': 'installation' } }]}></sw-segmented></div>`
        : nothing}
      ${this.renderRel()}
      ${this.renderPreview()}
      <div class="foot">
        <sw-button variant="primary" size="sm" icon="check" data-nav-save ?disabled=${!this.dirty || this.busy} @click=${() => void this.save()}>${tr('שמור')}</sw-button>
        ${this.target === 'own' ? html`<sw-button size="sm" data-nav-reset ?disabled=${ownNavSize() === null || this.busy} @click=${() => void this.useSystemDefault()}>${tr('ברירת מחדל של המערכת')}</sw-button>` : nothing}
        ${this.message ? html`<span class="ok" role="status" data-nav-message>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-nav-size': SystemNavSize;
  }
}
