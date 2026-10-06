import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-toggle';
import './sw-button';
import './sw-dialog';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import {
  confirmCopy, frigateRecorderIds, getCameraControl, getProfiles, groupSwitches, featureText, needsConfirm, setProfile, setSwitch,
  type CameraControl, type ProfilesView, type SwitchGroup,
} from '../api/frigate-control';
import { he } from '../i18n/he';

interface Pending {
  group: SwitchGroup | 'profile';
  feature: string;
  to: boolean | string | null;
  /** the switch to put back when the person cancels (the toggle flips itself on click) */
  undo?: () => void;
}

/**
 * NN5-F2: the operator's control of ONE Frigate camera - its analytics switches and (with the right permission and the class switched on)
 * its recording switches, plus the active profile. Drawn only for a camera of a Frigate recorder and only when the caller may change
 * something now: nothing else is shown, no hints, no paragraphs (clean operator screens). Management (which classes are on, the alarm
 * mapping, the change log) is in Settings. Recording switches and the profile ask for a confirmation every time; the server enforces it.
 * Tokens only.
 */
@customElement('frigate-camera-control')
export class FrigateCameraControl extends LitElement {
  @property({ attribute: 'camera-id' }) cameraId = '';
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @state() private data: CameraControl | null = null;
  @state() private profiles: ProfilesView | null = null;
  @state() private pending: Pending | null = null;
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  private seq = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('cameraId') && changed.get('cameraId') !== undefined) void this.load();
  }

  private async load() {
    const my = ++this.seq;
    this.data = null;
    this.profiles = null;
    if (!isApi() || !this.cameraId || !this.recorderId) return;
    if (!(await frigateRecorderIds()).has(this.recorderId) || my !== this.seq) return;
    try {
      const d = await getCameraControl(this.recorderId, this.cameraId);
      if (my !== this.seq) return;
      this.data = d.writable.analytics || d.writable.record ? d : null;
    } catch {
      this.data = null; // a camera the caller cannot read, an old server: nothing is drawn
      return;
    }
    try {
      const p = await getProfiles(this.recorderId);
      if (my === this.seq && p.can_switch && p.names.length) this.profiles = p;
    } catch {
      /* no permission to read the profiles: the row is not drawn */
    }
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 3500);
  }

  private ask(p: Pending) {
    this.pending = p;
  }

  private cancel() {
    this.pending?.undo?.();
    this.pending = null;
  }

  private async apply(p: Pending, confirm: boolean) {
    if (!this.data && !this.profiles) return;
    this.busy = true;
    try {
      if (p.group === 'profile') {
        const r = await setProfile(this.recorderId, (p.to as string | null) || null, confirm);
        if (this.profiles) this.profiles = { ...this.profiles, active: r.active };
      } else {
        const r = await setSwitch(this.recorderId, this.cameraId, p.feature, p.to as boolean, confirm);
        if (this.data) this.data = { ...this.data, features: this.data.features.map((f) => (f.feature === p.feature ? { ...f, value: p.to as boolean } : f)) };
        if (!r.verified) this.flash('ok', he.frigate.control.unverified);
        else this.flash('ok', he.frigate.control.saved);
      }
      if (p.group === 'profile') this.flash('ok', he.frigate.control.saved);
    } catch (err) {
      p.undo?.();
      this.flash('err', `${he.frigate.control.failed}: ${describeError(err)}`);
      void this.load();
    } finally {
      this.busy = false;
      this.pending = null;
    }
  }

  private onSwitch(group: SwitchGroup, feature: string, e: Event) {
    const el = e.currentTarget as HTMLElement & { checked: boolean };
    const to = el.checked;
    const p: Pending = { group, feature, to, undo: () => (el.checked = !to) };
    if (needsConfirm(group)) this.ask(p);
    else void this.apply(p, false);
  }

  static styles = css`
    :host {
      display: block;
    }
    .box {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: var(--sw-s-2) var(--sw-s-4);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      max-inline-size: 100%;
    }
    .msg {
      font-size: var(--sw-fs-xs);
    }
    .msg.ok {
      color: var(--sw-success-text);
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
    .dialog-text {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
  `;

  private group(group: SwitchGroup, title: string, writable: boolean) {
    const d = this.data!;
    const rows = groupSwitches(d, group);
    if (!writable || !rows.length) return nothing;
    return html`<div data-fcc-group=${group}>
      <h4>${title}</h4>
      <div class="grid">
        ${rows.map((f) => html`<div class="row" data-fcc-row=${f.feature}>
          <span>${featureText(f.feature)}</span>
          <sw-toggle .checked=${f.value === true} ?disabled=${this.busy} labelHidden label=${featureText(f.feature)} data-fcc-switch=${f.feature} @change=${(e: Event) => this.onSwitch(group, f.feature, e)}></sw-toggle>
        </div>`)}
      </div>
    </div>`;
  }

  private dialog() {
    const p = this.pending;
    if (!p) return nothing;
    const c = he.frigate.control;
    const copy = p.group === 'profile' ? { title: `${c.profile}: ${p.to || c.noProfile}`, text: c.confirmProfile } : confirmCopy(p.group, p.feature, p.to as boolean);
    return html`<sw-dialog open heading=${copy.title} data-fcc-confirm @close=${() => this.cancel()}>
      ${copy.text ? html`<p class="dialog-text">${copy.text}</p>` : nothing}
      <sw-button slot="footer" data-fcc-cancel @click=${() => this.cancel()}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcc-ok ?disabled=${this.busy} @click=${() => void this.apply(p, true)}>${c.confirm}</sw-button>
    </sw-dialog>`;
  }

  render() {
    const d = this.data;
    if (!d && !this.profiles) return nothing;
    const c = he.frigate.control;
    const pr = this.profiles;
    return html`<div class="box" data-frigate-camera-control>
      ${d ? this.group('analytics', c.analytics, d.writable.analytics) : nothing}
      ${d ? this.group('record', c.record, d.writable.record) : nothing}
      ${pr ? html`<div class="row" data-fcc-profile>
        <h4>${c.profile}</h4>
        <select aria-label=${c.profile} .value=${pr.active ?? ''} ?disabled=${this.busy} @change=${(e: Event) => {
          const el = e.currentTarget as HTMLSelectElement;
          const prev = pr.active ?? '';
          this.ask({ group: 'profile', feature: 'profile', to: el.value || null, undo: () => (el.value = prev) });
        }}>
          <option value="">${c.noProfile}</option>
          ${pr.names.map((n) => html`<option value=${n} ?selected=${n === pr.active}>${n}</option>`)}
        </select>
      </div>` : nothing}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fcc-msg>${this.msg.text}</div>` : nothing}
      ${this.dialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-camera-control': FrigateCameraControl;
  }
}
