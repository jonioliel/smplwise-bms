import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import { describeError } from '../api/client';
import { restartArx } from '../api/system-update-runs';
import {
  REASON_TEXT,
  SOURCE_LABEL,
  canUse,
  candidateKind,
  candidateLine,
  clearVideoService,
  confirmText,
  listVideoServices,
  selectVideoService,
  sortCandidates,
  type VideoServiceCandidate,
  type VideoServicesView,
} from '../api/video-services';
import { videoService } from '../api/video-service';

/**
 * HEALTH-GO2RTC-FOLLOWUP-2431: "שירות וידאו" - the video services found on this installation, their state, and "use this".
 * Settings › וידאו ומדיה (full) and the administrator's notice of a tile that says the video service is down (`compact`: at most
 * COMPACT_MAX rows, no source line, no "back to the add-on option"). Administrators only - the caller decides; a refused or failed
 * list renders nothing in `compact` and a plain line otherwise. RTL; addresses and versions stay LTR.
 */
const COMPACT_MAX = 2;

@customElement('sw-video-service-picker')
export class SwVideoServicePicker extends LitElement {
  @property({ type: Boolean, reflect: true }) compact = false;
  @state() private view: VideoServicesView | null = null;
  @state() private loading = false;
  @state() private error = '';
  @state() private confirming: string | null = null;
  @state() private busy = false;
  @state() private done = '';

  static styles = css`
    :host { display: block; direction: rtl; font: inherit; color: inherit; }
    .list { display: grid; gap: 6px; }
    .cand { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--sw-r-md, 10px); background: var(--sw-surface-2, rgba(127, 127, 127, 0.08)); min-width: 0; }
    .cand[data-current] { outline: 1px solid var(--sw-accent, #3b82f6); }
    .main { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .line, .muted { color: var(--sw-text-2, #6b7280); font-size: var(--sw-fs-xs, 12px); }
    .addr { direction: ltr; unicode-bidi: isolate; font-family: var(--sw-mono, ui-monospace, monospace); font-size: 11px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-block-end: 8px; flex-wrap: wrap; }
    .confirm { display: grid; gap: 6px; padding: 8px 10px; border-radius: var(--sw-r-md, 10px); background: var(--sw-warning-soft, rgba(234, 179, 8, 0.12)); font-size: 13px; }
    .confirm .end, .end { display: flex; gap: 6px; flex-wrap: wrap; }
    .ok { color: var(--sw-success, #16a34a); font-size: 13px; }
    .err { color: var(--sw-danger, #dc2626); font-size: 13px; }
    :host([compact]) .cand { padding: 4px 8px; gap: 6px; background: rgba(0, 0, 0, 0.25); }
    :host([compact]) .name { font-size: var(--sw-fs-xs, 12px); }
    :host([compact]) .line { font-size: 11px; color: inherit; opacity: 0.8; }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!this.view && !this.loading) void this.load(false);
  }

  /** Re-read the list; `fresh` asks the server to look again (it answers from its cache within a few seconds). */
  async load(fresh: boolean) {
    this.loading = true;
    this.error = '';
    try {
      this.view = await listVideoServices(fresh);
    } catch (e) {
      this.error = describeError(e);
      if (this.compact) this.view = null;
    } finally {
      this.loading = false;
    }
  }

  private async use(c: VideoServiceCandidate) {
    this.busy = true;
    this.error = '';
    this.done = '';
    try {
      this.view = await selectVideoService(c.slug);
      this.confirming = null;
      this.done = `נבחר "${c.name}". הווידאו עובר דרכו מעכשיו.`;
      void videoService.check(); // every waiting tile hears the recovery through the shared watch
      this.dispatchEvent(new CustomEvent('video-service-changed', { detail: { slug: c.slug }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async backToOption() {
    this.busy = true;
    this.error = '';
    this.done = '';
    try {
      this.view = await clearVideoService();
      this.done = 'חזרה לכתובת שבתצורת התוסף.';
      void videoService.check();
      this.dispatchEvent(new CustomEvent('video-service-changed', { detail: { slug: null }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async restart() {
    this.busy = true;
    try {
      await restartArx();
      this.done = 'המערכת מופעלת מחדש…';
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private row(c: VideoServiceCandidate) {
    const confirming = this.confirming === c.slug;
    return html`<div class="cand" data-video-candidate=${c.slug} ?data-current=${c.current}>
        <sw-badge kind=${candidateKind(c)} label=${c.current ? 'בשימוש' : ''}></sw-badge>
        <div class="main">
          <span class="name" data-candidate-name>${c.name}</span>
          <span class="line" data-candidate-line>${candidateLine(c)}${!this.compact && c.address ? html` · <span class="addr">${c.address}</span>` : nothing}</span>
        </div>
        ${canUse(c) && !confirming
          ? html`<sw-button size="sm" variant=${c.state === 'started' ? 'primary' : 'secondary'} ?disabled=${this.busy} data-use-service=${c.slug} @click=${() => (this.confirming = c.slug)}>השתמש בזה</sw-button>`
          : nothing}
      </div>
      ${confirming
        ? html`<div class="confirm" data-use-confirm=${c.slug}><span>${confirmText(c)}</span>
            <span class="end"><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-use-confirm-yes @click=${() => this.use(c)}>אישור</sw-button><sw-button size="sm" ?disabled=${this.busy} @click=${() => (this.confirming = null)}>ביטול</sw-button></span></div>`
        : nothing}`;
  }

  render() {
    const v = this.view;
    if (this.compact) {
      if (!v || !v.supported || !v.candidates.length) return nothing;
      const list = sortCandidates(v.candidates).slice(0, COMPACT_MAX);
      return html`<div class="list" data-video-services-compact>${list.map((c) => this.row(c))}${this.error ? html`<span class="err">${this.error}</span>` : nothing}${this.done ? html`<span class="ok" data-use-done>${this.done}</span>` : nothing}</div>`;
    }
    return html`<div data-video-services>
      <div class="head">
        <span class="muted" data-video-current>${v
          ? html`בשימוש: ${v.current.address ? html`<span class="addr">${v.current.address}</span>` : 'אין'} · ${SOURCE_LABEL[v.current.source]}`
          : this.loading ? 'טוען…' : ''}</span>
        <span class="end"><sw-button size="sm" icon="refresh" ?disabled=${this.loading || this.busy} data-video-refresh @click=${() => this.load(true)}>חיפוש מחדש</sw-button>
          ${v?.selection ? html`<sw-button size="sm" ?disabled=${this.busy} data-video-back-to-option @click=${() => this.backToOption()}>חזרה לכתובת מתצורת התוסף</sw-button>` : nothing}</span>
      </div>
      ${v && !v.supported && v.reason ? html`<div class="muted" data-video-unsupported>${REASON_TEXT[v.reason]}</div>` : nothing}
      ${v && v.supported && !v.candidates.length ? html`<div class="muted" data-video-none>לא נמצאו שירותי וידאו מותקנים.</div>` : nothing}
      ${v && v.candidates.length ? html`<div class="list">${sortCandidates(v.candidates).map((c) => this.row(c))}</div>` : nothing}
      ${this.done ? html`<div class="ok" data-use-done>${this.done}</div>` : nothing}
      ${v?.restart_recommended
        ? html`<div class="muted" data-video-restart>החיפוש התקופתי של המצלמות וסנכרון הזרמים יעברו לשירות שנבחר אחרי הפעלה מחדש של המערכת.
            <sw-button size="sm" ?disabled=${this.busy} data-video-restart-now @click=${() => this.restart()}>הפעלה מחדש עכשיו</sw-button></div>`
        : nothing}
      ${this.error ? html`<div class="err" data-video-error>${this.error}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-video-service-picker': SwVideoServicePicker;
  }
}
