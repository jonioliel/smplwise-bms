import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { can, isApi } from '../api/session';
import { BRAND_ACCENT, BRAND_DEFAULT, BRAND_PRESETS, SYSTEM_BLUE, brandColors, brandHex, contrastOnWhite, normalizeBrand, setBrandColors } from '../design/brand';
import { t, type I18nKey } from '../i18n/he';
import { settingsStyles } from '../styles/settings';

type Which = 'accent' | 'toggle';
const CHOICES = [BRAND_DEFAULT, ...Object.keys(BRAND_PRESETS)];

/**
 * הגדרות › כללי › צבעי המותג (owner 2026-10-10, release 2.4.4): the installation's accent colour and switch-on colour (`ui.accent`,
 * `ui.toggle_on`; design/brand.ts applies them on the DU1 token layer). A preset swatch (the system blue = default, the earlier glass
 * mockup's iOS green, ...) or any colour from the native picker. system.configure saves; the preview applies only after the save.
 * A colour too light for white text on a button is saved but flagged (warn only).
 */
@customElement('system-brand-colors')
export class SystemBrandColors extends LitElement {
  @state() private draft = brandColors();
  @state() private saved = brandColors();
  @state() private canEdit = !isApi();
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';

  static styles = [settingsStyles, css`
    .row {
      display: grid;
      gap: 8px;
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .sw {
      all: unset;
      box-sizing: border-box;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-pill);
      border: 2px solid var(--sw-border-strong);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .sw[aria-pressed='true'] {
      border-color: var(--sw-text);
      box-shadow: 0 0 0 2px var(--sw-surface), 0 0 0 4px var(--sw-text);
    }
    .sw:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 3px;
    }
    .sw[disabled] {
      cursor: default;
      opacity: 0.7;
    }
    /* "same as the accent": a swatch painted with the live accent, marked by a link glyph */
    .sw.follow {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .custom {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .custom input {
      inline-size: 44px;
      block-size: 44px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      cursor: pointer;
    }
    .custom input[aria-pressed='true'] {
      outline: 2px solid var(--sw-text);
      outline-offset: 2px;
    }
    .warn {
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    this.canEdit = can('system.configure');
    void getSettings()
      .then((r) => {
        this.canEdit = r.can_edit;
        const v = { accent: normalizeBrand(r.settings['ui.accent']), toggle: normalizeBrand(r.settings['ui.toggle_on'], 'toggle') };
        this.saved = v;
        this.draft = { ...v };
      })
      .catch(() => undefined);
  }

  private get dirty(): boolean {
    return this.draft.accent !== this.saved.accent || this.draft.toggle !== this.saved.toggle;
  }

  private pick(which: Which, value: string) {
    this.draft = { ...this.draft, [which]: normalizeBrand(value, which) };
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      if (isApi()) {
        const r = await patchSettings({ 'ui.accent': this.draft.accent, 'ui.toggle_on': this.draft.toggle });
        invalidateSettings();
        this.saved = { accent: normalizeBrand(r.settings['ui.accent']), toggle: normalizeBrand(r.settings['ui.toggle_on'], 'toggle') };
      } else {
        this.saved = { ...this.draft };
      }
      setBrandColors(this.saved.accent, this.saved.toggle); // the whole UI follows at once
      this.draft = { ...this.saved };
      this.message = t('brandColors.saved');
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderRow(which: Which) {
    const value = this.draft[which];
    const hex = brandHex(value) ?? SYSTEM_BLUE;
    const isCustom = value.startsWith('#');
    const follow = which === 'toggle' && value === BRAND_ACCENT;
    const label: I18nKey = which === 'accent' ? 'brandColors.accentLabel' : 'brandColors.toggleLabel';
    const hint: I18nKey = which === 'accent' ? 'brandColors.accentHint' : 'brandColors.toggleHint';
    const low = which === 'accent' && contrastOnWhite(hex) < 3;
    return html`<div class="row" data-brand-row=${which}>
      <span class="lbl">${t(label)}<span class="muted">${t(hint)}</span></span>
      <div class="swatches" role="group" aria-label=${t(label)}>
        ${which === 'toggle' ? html`<button type="button" class="sw follow" data-brand-option=${BRAND_ACCENT} title=${t('brandColors.preset_accent')} aria-label=${t('brandColors.preset_accent')} aria-pressed=${follow ? 'true' : 'false'}
            ?disabled=${!this.canEdit} @click=${() => this.pick(which, BRAND_ACCENT)}><sw-icon name="link" size=${18}></sw-icon></button>` : nothing}
        ${CHOICES.map((id) => {
          const name = t(`brandColors.preset_${id}` as I18nKey);
          return html`<button type="button" class="sw" data-brand-option=${id} title=${name} aria-label=${name} aria-pressed=${value === id ? 'true' : 'false'}
            ?disabled=${!this.canEdit} style=${styleMap({ background: brandHex(id) ?? SYSTEM_BLUE })} @click=${() => this.pick(which, id)}></button>`;
        })}
        <label class="custom">
          <input type="color" data-brand-custom=${which} aria-label=${`${t(label)} - ${t('brandColors.custom')}`} aria-pressed=${isCustom ? 'true' : 'false'}
            .value=${hex} ?disabled=${!this.canEdit} @input=${(e: Event) => this.pick(which, (e.target as HTMLInputElement).value)} />
          ${t('brandColors.custom')}
        </label>
      </div>
      ${follow ? html`<span class="hint" data-brand-follow>${t('brandColors.accentFollowHint')}</span>` : nothing}
      ${low ? html`<span class="warn" role="status" data-brand-low-contrast>${t('brandColors.lowContrast')}</span>` : nothing}
    </div>`;
  }

  render() {
    return html`<sw-card heading=${t('brandColors.heading')} subheading=${t('brandColors.subheading')} data-brand-card>
      ${this.renderRow('accent')}
      ${this.renderRow('toggle')}
      <div class="foot">
        <sw-button variant="primary" size="sm" icon="check" data-brand-save ?disabled=${!this.canEdit || !this.dirty || this.busy} @click=${() => void this.save()}>${t('brandColors.save')}</sw-button>
        ${this.message ? html`<span class="msg ok" role="status" data-brand-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-brand-colors': SystemBrandColors;
  }
}
