import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { DEVICE_PALETTES, LAYOUT_ROLE_IDS } from '../styles/devices-palettes';
import type { DevicesScheme } from './devices-style';

export interface DevicesPick {
  key: 'devices.theme' | 'devices.scheme';
  value: string;
}

/**
 * CR-007 slice 6b: הגדרות › חשמל והתקנים - the colour theme (palette) swatches and the colour scheme of the device
 * area. Each swatch paints the palette's own light and dark previews and its card-colour roles (devices-palettes.ts);
 * choosing one only fires `devices-pick` - the settings screen keeps the draft and saves it with the section's "שמור".
 */
@customElement('devices-theme-picker')
export class DevicesThemePicker extends LitElement {
  @property() theme = 'default';
  @property() scheme: DevicesScheme = 'light';
  @property({ type: Boolean }) disabled = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .themes {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    button.theme {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      inline-size: 164px;
    }
    button.theme[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent-soft);
    }
    button.theme:disabled {
      cursor: default;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      block-size: 64px;
    }
    .prev {
      border-radius: 8px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: hidden;
    }
    .prev i {
      display: block;
      border-radius: 5px;
      block-size: 14px;
    }
    .prev b {
      display: block;
      inline-size: 60%;
      block-size: 6px;
      border-radius: 3px;
    }
    .roles {
      display: flex;
      gap: 3px;
      padding-inline: 2px;
    }
    .roles span {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    .cap {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding-inline: 2px;
      font-weight: var(--sw-fw-medium);
    }
    .cap .muted {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .scheme {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    select {
      min-block-size: 32px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      padding-inline: 8px;
    }
  `;

  private pick(key: DevicesPick['key'], value: string) {
    this.dispatchEvent(new CustomEvent<DevicesPick>('devices-pick', { detail: { key, value }, bubbles: true, composed: true }));
  }

  render() {
    return html`<div class="lbl">ערכת צבעים<span class="muted">הצבעים של אזור החשמל וההתקנים בסגנון זכוכית, בהיר וכהה, וצבעי הכרטיסים שנבחרים בעורך הפריסה (לפי תפקיד: הדגשה, חם, קריר ...) - בשני הסגנונות.</span></div>
      <div class="themes" role="group" aria-label="ערכת צבעים" data-devices-themes>
        ${DEVICE_PALETTES.map((p) => {
          const box = (s: typeof p.light) => html`<span class="prev" style=${styleMap({ background: s.preview.backdrop })}>
            <i style=${styleMap({ background: s.preview.surface })}></i>
            <i style=${styleMap({ background: `linear-gradient(135deg, color-mix(in srgb, ${s.preview.on} 55%, transparent), ${s.preview.surface})` })}></i>
            <b style=${styleMap({ background: s.preview.accent })}></b>
          </span>`;
          return html`<button type="button" class="theme" data-devices-theme-swatch=${p.id} aria-pressed=${String(this.theme === p.id)} ?disabled=${this.disabled} @click=${() => this.pick('devices.theme', p.id)}>
            <span class="pair" aria-hidden="true">${box(p.light)}${box(p.dark)}</span>
            <span class="roles" aria-hidden="true">${LAYOUT_ROLE_IDS.map((r) => html`<span style=${styleMap({ background: `rgb(${p.light.roles[r].rgb})` })}></span>`)}</span>
            <span class="cap">${p.name}<span class="muted">${p.hint}</span></span>
          </button>`;
        })}
      </div>
      <div class="scheme">
        <span class="lbl">בהיר או כהה<span class="muted">ברירת המחדל בהיר, כמו שאר המערכת. "לפי המכשיר" עובר לכהה רק במכשיר שמוגדר כהה. חל על סגנון הזכוכית.</span></span>
        <select data-set-devices-scheme ?disabled=${this.disabled} @change=${(e: Event) => this.pick('devices.scheme', (e.target as HTMLSelectElement).value)}>
          <option value="light" ?selected=${this.scheme === 'light'}>בהיר</option>
          <option value="dark" ?selected=${this.scheme === 'dark'}>כהה</option>
          <option value="auto" ?selected=${this.scheme === 'auto'}>לפי המכשיר</option>
        </select>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-theme-picker': DevicesThemePicker;
  }
}
