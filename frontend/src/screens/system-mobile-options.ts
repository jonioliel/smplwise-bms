import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import {
  DEFAULT_MOBILE_OPTIONS, MOBILE_OPTION_LABEL, mobileOptions, normalizeMobileOptions, onMobileOptions, setInstallationMobileOptions,
  type MobileKind, type MobileOptions,
} from '../shell/phone';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/** The options in the order the settings card lists them (the structure guard first: it is on by default). */
const KINDS: readonly MobileKind[] = ['structure', 'control_images', 'layout_editor', 'wall_arrange', 'settings_writes', 'permissions'];

/**
 * הגדרות › כללי › אפשרויות נייד (owner 2026-09-30): which kinds of management the phone UI (a screen narrower than
 * 768 px) hides. One toggle per kind, installation-wide; only who may change settings sees the toggles enabled. A UX guard:
 * the server's permissions do not change, and a wide window reaches every screen. The value is the `ui.mobile` setting
 * (backend services/mobile_options.py, frontend shell/phone.ts).
 */
@customElement('system-mobile-options')
export class SystemMobileOptions extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private draft: MobileOptions = { ...mobileOptions() };
  @state() private canEdit = false;
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
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl {
      font-weight: var(--sw-fw-medium);
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 12px;
    }
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
    this.stop = onMobileOptions(() => {
      if (!this.dirty) this.draft = { ...mobileOptions() };
    });
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          setInstallationMobileOptions(r.settings['ui.mobile']);
          this.draft = { ...mobileOptions() };
        })
        .catch(() => undefined);
    }
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private get dirty(): boolean {
    const now = mobileOptions();
    return (Object.keys(DEFAULT_MOBILE_OPTIONS) as (keyof MobileOptions)[]).some((k) => this.draft[k] !== now[k]);
  }

  private set(kind: MobileKind, on: boolean) {
    this.draft = { ...this.draft, [`hide_${kind}`]: on };
    this.message = '';
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.mobile': this.draft });
      invalidateSettings();
      setInstallationMobileOptions(r.settings['ui.mobile']); // every open screen follows at once
      this.draft = normalizeMobileOptions(r.settings['ui.mobile']);
      this.message = 'האפשרויות נשמרו';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const editable = this.canEdit && isApi();
    return html`<sw-card heading="אפשרויות נייד" subheading="חלות רק במסך צר (עד 768 פיקסלים); ההרשאות אינן משתנות" data-mobile-options>
      ${KINDS.map(
        (k) => html`<div class="row" data-mobile-option=${k}><span class="lbl">${MOBILE_OPTION_LABEL[k]}</span>
          <sw-toggle ?checked=${this.draft[`hide_${k}`]} ?disabled=${!editable || this.busy} label=${MOBILE_OPTION_LABEL[k]} labelHidden data-mobile-toggle=${k} @change=${(e: CustomEvent<{ checked: boolean }>) => this.set(k, e.detail.checked)}></sw-toggle></div>`,
      )}
      ${editable
        ? html`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-mobile-save ?disabled=${!this.dirty || this.busy} @click=${() => void this.save()}>שמור</sw-button>
            ${this.message ? html`<span class="ok" role="status" data-mobile-message>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
          </div>`
        : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-mobile-options': SystemMobileOptions;
  }
}
