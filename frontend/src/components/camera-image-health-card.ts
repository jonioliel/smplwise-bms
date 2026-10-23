import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-chip';
import { describeError } from '../api/client';
import { IMAGE_KINDS, checkCameraImages, type ImageHealth, type ImageKind } from '../api/camera-image-health';
import { cit } from '../i18n/camera-image-health';
import { SkinController } from '../design/skin';

const DOT: Record<ImageKind, string> = { dark: 'var(--sw-stale)', blurred: 'var(--sw-stale)', frozen: 'var(--sw-danger)', shifted: 'var(--sw-danger)' };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * CAMHEALTH091: one compact row on בריאות מצלמות - is the picture of the cameras usable (dark / blurred / frozen / shifted). The host
 * owns the data (it also feeds the table's picture column); the chips filter the table (`cih-filter`, detail = a kind or null), and
 * "check now" sends the fresh answer back (`cih-updated`). One line: never a scrolling block on a control screen.
 */
@customElement('camera-image-health-card')
export class CameraImageHealthCard extends LitElement {
  readonly skin = new SkinController(this);
  @property({ attribute: false }) data: ImageHealth | null = null;
  @property() selected: ImageKind | null = null;
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    :host {
      display: block;
    }
    .strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 6px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-glass-sheen), var(--sw-surface);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      min-inline-size: 0;
    }
    .strip[data-warn] {
      border-color: color-mix(in srgb, var(--sw-stale) 55%, var(--sw-border));
    }
    .h {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .grow {
      flex: 1;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    a {
      color: var(--sw-accent);
      font-size: var(--sw-fs-xs);
    }
    :host([data-skin='bubble']) .strip {
      border-color: transparent;
      background: var(--sw-surface-2, var(--sw-surface));
    }
  `;

  private async check() {
    this.busy = true;
    this.error = '';
    try {
      const r = await checkCameraImages();
      this.dispatchEvent(new CustomEvent('cih-updated', { detail: r, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private pick(kind: ImageKind | null) {
    this.dispatchEvent(new CustomEvent('cih-filter', { detail: kind === this.selected ? null : kind, bubbles: true, composed: true }));
  }

  render() {
    const d = this.data;
    if (!d) return nothing;
    const c = d.counts;
    if (!d.enabled) {
      if (!d.can_manage) return nothing;
      return html`<div class="strip" data-cih-card data-state="off"><span class="h">${cit('title')}</span><span class="meta">${cit('off')}</span><span class="grow"></span>
        <a href="#/system/diagnostics?tab=health" data-cih-settings>${cit('openSettings')}</a></div>`;
    }
    const warn = IMAGE_KINDS.some((k) => (c[k] ?? 0) > 0);
    return html`<div class="strip" data-cih-card data-state="on" ?data-warn=${warn}>
      <span class="h">${cit('title')}</span>
      <sw-chip dot="var(--sw-live)" count=${c.ok ?? 0} data-cih-count="ok">${cit('ok')}</sw-chip>
      ${IMAGE_KINDS.filter((k) => (c[k] ?? 0) > 0).map((k) => html`<sw-chip dot=${DOT[k]} count=${c[k]} ?selected=${this.selected === k} data-cih-count=${k} @click=${() => this.pick(k)}>${cit(k)}</sw-chip>`)}
      ${(c.unknown ?? 0) > 0 ? html`<sw-chip dot="var(--sw-unknown)" count=${c.unknown} data-cih-count="unknown">${cit('unknown')}</sw-chip>` : nothing}
      <span class="grow"></span>
      <span class="meta" data-cih-checked>${d.checked_at ? cit('lastCheck', { t: fmt(d.checked_at) }) : cit('never')} · ${cit('every', { n: Math.round(d.interval_s / 60) })}</span>
      ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      ${d.can_manage ? html`<sw-button size="sm" icon="refresh" data-cih-check ?disabled=${this.busy} @click=${() => this.check()}>${this.busy ? cit('checking') : cit('checkNow')}</sw-button>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'camera-image-health-card': CameraImageHealthCard;
  }
}
