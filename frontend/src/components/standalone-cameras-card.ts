/**
 * CAMERA-STREAM-SOURCES-2410: הגדרות › אבטחה › NVR - "מצלמות ללא מקליט": the cameras that are not connected to a recorder (live video
 * and snapshots straight from their own RTSP address), with "add", "source" (the same dialog as the camera screen) and "remove".
 * ONVIF-UI-2500: "חיפוש מצלמות ברשת" next to adding by hand - the discovery wizard (camera-discovery-dialog, its own chunk), shown
 * while the server offers discovery (GET /cameras/discovery/capabilities); a note when the setting is off.
 * Shown to holders of system.configure only; the server checks every call itself.
 */
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-card';
import './sw-button';
import './sw-dialog';
import './sw-badge';
import './camera-source-dialog';
import { listCameras } from '../api/maps';
import { can, cap, isApi, loadSession, webrtcServer } from '../api/session';
import { sourceControls } from '../api/camera-visibility';
import { removeStandaloneCamera } from '../api/camera-sources';
import { discoveryCapabilities, type DiscoveryCapabilities } from '../api/camera-discovery';
import { cdt } from '../i18n/camera-discovery';
import type { Camera } from '../api/types';
import { cst } from '../i18n/camera-sources';
import { sourceErrorText } from '../screens/camera-source-logic';

@customElement('standalone-cameras-card')
export class StandaloneCamerasCard extends LitElement {
  @state() private cams: Camera[] = [];
  @state() private loaded = false;
  @state() private adding = false;
  @state() private editing: Camera | null = null;
  @state() private removing: Camera | null = null;
  @state() private busy = false;
  @state() private msg = '';
  /** ONVIF-UI-2500: "חיפוש מצלמות ברשת" - what the server offers (null: not read, an older server or no permission: no button). */
  @state() private caps: DiscoveryCapabilities | null = null;
  @state() private finding = false;
  @state() private findReady = false;
  /** The address a found camera without a usable stream hands the manual dialog (`rtsp://<address>:554/`). */
  @state() private manualUrl = '';

  static styles = css`
    :host {
      display: block;
      margin-block-start: 16px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    li {
      display: flex;
      flex-wrap: wrap; /* EVIDENCE-CAMERAS-2412: at 390 px the three actions ran 46 px past the screen edge; they wrap under the name */
      align-items: center;
      gap: 4px 10px;
      min-block-size: 40px;
    }
    li .acts {
      display: flex;
      gap: 4px;
      margin-inline-start: auto;
    }
    li .name {
      flex: 1 1 8em;
      min-inline-size: 7em; /* EVIDENCE-CAMERAS-2412: the actions wrap before the name shrinks to one letter */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .note {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 12px;
      align-items: center;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    void this.loadCaps();
  }

  private async loadCaps() {
    if (!isApi() || !can('system.configure')) return;
    try {
      this.caps = await discoveryCapabilities();
    } catch {
      this.caps = null; // a server without discovery (or a refusal): the card stays as it was
    }
  }

  /** The wizard is its own chunk: fetched on the first press only. */
  private async openFinder() {
    this.msg = '';
    if (!this.findReady) {
      await import('./camera-discovery-dialog');
      this.findReady = true;
    }
    void this.loadCaps(); // the suggested range and the running flag as they are now
    this.finding = true;
  }

  private async load() {
    try {
      const list = await listCameras();
      this.cams = list.cameras.filter((c) => c.standalone);
    } catch {
      this.cams = [];
    } finally {
      this.loaded = true;
    }
  }

  /** NVRLESS-CAMERAS-2411: without an NVR the camera screens follow "is there a camera without a recorder" (`cameras_available` on
   * /me), so the first one added or the last one removed re-reads the session and the navigation follows at once. */
  private async changed() {
    await this.load();
    if (isApi() && !cap('nvr')) void loadSession();
  }

  private async runRemove() {
    const cam = this.removing;
    if (!cam || this.busy) return;
    this.busy = true;
    try {
      await removeStandaloneCamera(cam.id);
      this.msg = cst('removed');
      this.removing = null;
      await this.changed();
    } catch (err) {
      this.msg = sourceErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`<sw-card heading=${cst('listTitle')} data-standalone-cameras>
      <p class="note">${cst('addLead')}</p>
      ${!this.loaded
        ? nothing
        : this.cams.length
          ? html`<ul>${this.cams.map((c) => html`<li data-standalone-camera=${c.id}>
              <sw-badge kind=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'}></sw-badge>
              <span class="name">${c.name}</span>
              <span class="acts"><sw-button size="sm" variant="ghost" icon="live" @click=${() => (window.location.hash = `#/live/cameras/${c.id}`)}>${cst('view')}</sw-button>
              <sw-button size="sm" variant="ghost" icon="edit" data-standalone-edit @click=${() => (this.editing = c)}>${cst('edit')}</sw-button>
              <sw-button size="sm" variant="ghost" icon="close" data-standalone-remove @click=${() => { this.msg = ''; this.removing = c; }}>${cst('remove')}</sw-button></span>
            </li>`)}</ul>`
          : html`<p class="note" data-standalone-empty>${cst('listEmpty')}</p>`}
      <div class="actions">
        ${this.caps?.enabled
          ? html`<sw-button size="sm" variant="primary" icon="search" data-discovery-open @click=${() => void this.openFinder()}>${cdt('findButton')}</sw-button>`
          : nothing}
        <sw-button size="sm" variant=${this.caps?.enabled ? 'secondary' : 'primary'} icon="plus" ?disabled=${!sourceControls(webrtcServer(), { ready: true, testing: false }).canAdd} data-standalone-add @click=${() => { this.msg = ''; this.manualUrl = ''; this.adding = true; }}>${cst('addButton')}</sw-button>
        ${this.caps && !this.caps.enabled ? html`<span class="note" data-discovery-off>${cdt('findOff')}</span>` : nothing}
        ${this.msg ? html`<span role="status" class="note" data-standalone-msg>${this.msg}</span>` : nothing}
        ${sourceControls(webrtcServer(), { ready: true, testing: false }).note ? html`<span class="note" data-webrtc-required>${sourceControls(webrtcServer(), { ready: true, testing: false }).note}</span>` : nothing}
      </div>
    </sw-card>
    ${this.findReady
      ? html`<camera-discovery-dialog .open=${this.finding} .caps=${this.caps} @close=${() => (this.finding = false)}
          @added=${() => void this.changed()}
          @manual-add=${(e: CustomEvent<{ url: string }>) => { this.finding = false; this.manualUrl = e.detail.url; this.adding = true; }}></camera-discovery-dialog>`
      : nothing}
    <camera-source-dialog mode="add" prefill-url=${this.manualUrl} .open=${this.adding} @close=${() => (this.adding = false)}
      @saved=${() => { this.msg = cst('added'); void this.changed(); }}></camera-source-dialog>
    <camera-source-dialog mode="edit" .open=${!!this.editing} camera-id=${this.editing?.id ?? ''} camera-name=${this.editing?.name ?? ''}
      @close=${() => (this.editing = null)} @saved=${() => { this.msg = cst('saved'); void this.load(); }}></camera-source-dialog>
    ${this.removing
      ? html`<sw-dialog open heading=${cst('remove')} data-standalone-remove-dialog @close=${() => (this.removing = null)}>
          <p>${cst('removeConfirm', { name: this.removing.name })}</p>
          <div slot="footer"><sw-button variant="danger" ?disabled=${this.busy} data-standalone-remove-run @click=${() => void this.runRemove()}>${cst('remove')}</sw-button>
            <sw-button variant="ghost" @click=${() => (this.removing = null)}>${cst('cancel')}</sw-button></div>
        </sw-dialog>`
      : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'standalone-cameras-card': StandaloneCamerasCard;
  }
}
