/**
 * CAMERA-STREAM-SOURCES-2410: the "video source" dialog of one camera, and the "add camera without a recorder" dialog (`mode="add"`).
 *
 * Edit: a two-way choice "מהמקליט" / "כתובת ידנית" (a camera without a recorder has no choice: its source is always manual), the main
 * and sub RTSP addresses (one filled address serves both), "בדיקת זרם" (one frame through the server: a small preview, the resolution
 * and the codec, or a fixed Hebrew error), Save / Cancel. Add: the name and the area first, then the same addresses and test.
 *
 * Nothing secret is ever shown: the server returns the addresses with the password masked (`***`); sending such an address back keeps
 * the stored password. Saving does not require a passing test (owner answer 4) - the dialog only says it is recommended. Everything
 * fits without scrolling inside the dialog: the preview sits beside its result line, not under the form.
 */
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-button';
import './sw-field';
import {
  addStandaloneCamera,
  getCameraSource,
  saveCameraSource,
  testStream,
  type CameraSource,
  type StreamTest,
} from '../api/camera-sources';
import { getDevicesTree } from '../api/devices';
import { cst } from '../i18n/camera-sources';
import { draftReady, isMasked, sourceErrorText, testLine, urlProblem } from '../screens/camera-source-logic';
import { sourceControls } from '../api/camera-visibility';
import { webrtcServer } from '../api/session';

interface AreaOption {
  id: string;
  name: string;
}

@customElement('camera-source-dialog')
export class CameraSourceDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** `edit` (one camera's source) or `add` (a new camera without a recorder). */
  @property() mode: 'edit' | 'add' = 'edit';
  @property({ attribute: 'camera-id' }) cameraId = '';
  @property({ attribute: 'camera-name' }) cameraName = '';

  @state() private src: CameraSource | null = null;
  @state() private choice: 'nvr' | 'manual' = 'nvr';
  @state() private main = '';
  @state() private sub = '';
  @state() private name = '';
  @state() private area = '';
  @state() private areas: AreaOption[] = [];
  @state() private loading = false;
  @state() private busy = false;
  @state() private testing = false;
  @state() private test: StreamTest | null = null;
  @state() private error = '';

  static styles = css`
    :host {
      display: contents;
    }
    .body {
      display: grid;
      gap: 12px;
      min-inline-size: min(560px, 86vw);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      justify-self: start;
    }
    .seg button {
      border: 0;
      background: transparent;
      border-radius: 999px;
      padding: 6px 16px;
      min-block-size: 32px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background-color 160ms ease, color 160ms ease, transform 120ms ease-out;
    }
    .seg button:active {
      transform: scale(0.97);
    }
    .seg button[aria-checked='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent, var(--sw-text)));
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
    }
    .lead,
    .note {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    input[dir='ltr'] {
      text-align: left;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-sm);
    }
    .bad {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
      margin: 0;
    }
    .test {
      display: flex;
      gap: 12px;
      align-items: center;
      min-block-size: 40px;
    }
    .result {
      display: flex;
      gap: 10px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .result img {
      inline-size: 128px;
      block-size: 72px;
      object-fit: cover;
      border-radius: 8px;
      background: var(--sw-surface-2);
      animation: in 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .result .ok {
      color: var(--sw-success-text, var(--sw-success));
    }
    .result .fail {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    @keyframes in {
      from {
        opacity: 0;
        transform: scale(0.97);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .result img {
        animation: none;
      }
      .seg button {
        transition: none;
      }
    }
    @media (max-width: 640px) {
      .row {
        grid-template-columns: 1fr;
      }
      .result img {
        inline-size: 96px;
        block-size: 54px;
      }
    }
  `;

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) void this.reset();
  }

  private async reset() {
    this.error = '';
    this.test = null;
    this.busy = false;
    this.testing = false;
    this.src = null;
    if (this.mode === 'add') {
      this.choice = 'manual';
      this.main = this.sub = this.name = this.area = '';
      void this.loadAreas();
      return;
    }
    this.loading = true;
    try {
      const s = await getCameraSource(this.cameraId);
      this.src = s;
      this.choice = s.standalone ? 'manual' : s.mode;
      this.main = s.main?.url ?? '';
      this.sub = s.sub?.url ?? '';
    } catch (err) {
      this.error = sourceErrorText(err);
    } finally {
      this.loading = false;
    }
  }

  private async loadAreas() {
    try {
      const tree = await getDevicesTree();
      this.areas = tree.floors.flatMap((f) => f.areas.map((a) => ({ id: a.area_id, name: f.floor_id === 'none' ? a.name : `${a.name} · ${f.name}` })));
    } catch {
      this.areas = []; // the area is optional: the select keeps "ללא אזור" only
    }
  }

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private get standalone(): boolean {
    return this.mode === 'add' || !!this.src?.standalone;
  }

  private async runTest() {
    const url = (this.main.trim() || this.sub.trim());
    const profile: 'main' | 'sub' = this.main.trim() ? 'main' : 'sub';
    if (!url || urlProblem(url)) return;
    this.testing = true;
    this.test = null;
    this.error = '';
    try {
      this.test = await testStream({ url, camera_id: this.mode === 'edit' ? this.cameraId : null, profile });
    } catch (err) {
      this.test = { ok: false, code: 'refused', message: sourceErrorText(err) };
    } finally {
      this.testing = false;
    }
  }

  private async save() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (this.mode === 'add') {
        if (!this.name.trim()) {
          this.error = cst('errName');
          return;
        }
        const cam = await addStandaloneCamera({ name: this.name.trim(), area_id: this.area || null, main_url: this.main.trim() || null, sub_url: this.sub.trim() || null });
        this.dispatchEvent(new CustomEvent('saved', { detail: { camera: cam }, bubbles: true, composed: true }));
      } else {
        const body = this.choice === 'nvr'
          ? { mode: 'nvr' as const, if_revision: this.src?.revision }
          : { mode: 'manual' as const, main_url: this.main.trim() || null, sub_url: this.sub.trim() || null, area_id: this.src?.area_id ?? null, if_revision: this.src?.revision };
        const s = await saveCameraSource(this.cameraId, body);
        this.dispatchEvent(new CustomEvent('saved', { detail: { source: s }, bubbles: true, composed: true }));
      }
      this.close();
    } catch (err) {
      this.error = sourceErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  private urlField(label: string, value: string, set: (v: string) => void, key: string) {
    const problem = urlProblem(value);
    return html`<sw-field label=${label}>
        <input dir="ltr" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2048" placeholder="rtsp://user:password@camera:554/stream"
          data-source-url=${key} .value=${value} aria-invalid=${problem ? 'true' : 'false'}
          @input=${(e: Event) => { set((e.target as HTMLInputElement).value); this.test = null; }} />
      </sw-field>
      ${problem ? html`<p class="bad" data-source-url-problem=${key}>${problem}</p>` : nothing}`;
  }

  private renderManual() {
    const masked = isMasked(this.main) || isMasked(this.sub);
    const ready = draftReady(this.main, this.sub);
    const t = this.test;
    const ctl = sourceControls(webrtcServer(), { ready: ready.ok, testing: this.testing }); // NVRLESS-CAMERAS-2411: the test needs the video server
    return html`
      ${this.urlField(cst('mainUrl'), this.main, (v) => (this.main = v), 'main')}
      ${this.urlField(cst('subUrl'), this.sub, (v) => (this.sub = v), 'sub')}
      <p class="note">${cst('urlHint')}${masked ? html` ${cst('passwordKept')}` : nothing}</p>
      <div class="test">
        <sw-button size="sm" variant="ghost" icon="live" ?disabled=${!ctl.canTest} data-source-test @click=${() => void this.runTest()}>${this.testing ? cst('testing') : cst('test')}</sw-button>
        ${t
          ? html`<div class="result" role="status" data-source-test-result=${t.ok ? 'ok' : 'fail'}>
              ${t.ok ? html`<img src=${t.preview} alt="" />` : nothing}
              <span class=${t.ok ? 'ok' : 'fail'}>${testLine(t)}</span>
            </div>`
          : html`<span class="note" ?data-webrtc-required=${!!ctl.note}>${ctl.note || cst('testEncourage')}</span>`}
      </div>`;
  }

  render() {
    if (!this.open) return nothing;
    const add = this.mode === 'add';
    const ready = this.choice === 'nvr' ? { ok: true, reason: '' } : draftReady(this.main, this.sub);
    const canSave = !this.loading && !this.busy && ready.ok && (!add || (!!this.name.trim() && sourceControls(webrtcServer(), { ready: true, testing: false }).canAdd));
    return html`<sw-dialog open heading=${add ? cst('addTitle') : cst('dialogTitle')} subheading=${add ? cst('addLead') : cst('dialogSub', { name: this.cameraName })}
        data-camera-source-dialog=${this.mode} @close=${() => this.close()}>
      <div class="body">
        ${add
          ? html`<div class="row">
              <sw-field label=${cst('name')}><input data-source-name maxlength="120" .value=${this.name} @input=${(e: Event) => (this.name = (e.target as HTMLInputElement).value)} /></sw-field>
              <sw-field label=${cst('area')}><select data-source-area @change=${(e: Event) => (this.area = (e.target as HTMLSelectElement).value)}>
                <option value="" ?selected=${!this.area}>${cst('noArea')}</option>
                ${this.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === this.area}>${a.name}</option>`)}
              </select></sw-field>
            </div>`
          : this.standalone
            ? html`<p class="lead" data-source-standalone>${cst('standaloneNote')}</p>`
            : html`<div class="seg" role="radiogroup" aria-label=${cst('section')} data-source-choice=${this.choice}>
                ${(['nvr', 'manual'] as const).map((m) => html`<button type="button" role="radio" aria-checked=${String(this.choice === m)} ?disabled=${this.loading || this.busy}
                  data-source-mode=${m} @click=${() => { this.choice = m; this.test = null; }}>${m === 'nvr' ? cst('fromNvr') : cst('manual')}</button>`)}
              </div>
              <p class="lead">${this.choice === 'nvr' ? cst('fromNvrLead') : cst('manualLead')}</p>`}
        ${this.choice === 'manual' && !this.loading ? this.renderManual() : nothing}
        ${this.error ? html`<p class="bad" role="alert" data-source-error>${this.error}</p>` : nothing}
      </div>
      <div slot="footer">
        <sw-button variant="primary" icon="check" ?disabled=${!canSave} data-source-save @click=${() => void this.save()}>${this.busy ? cst('saving') : add ? cst('add') : cst('save')}</sw-button>
        <sw-button variant="ghost" @click=${() => this.close()}>${cst('cancel')}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'camera-source-dialog': CameraSourceDialog;
  }
}
