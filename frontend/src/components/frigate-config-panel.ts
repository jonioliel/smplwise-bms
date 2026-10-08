import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-dropdown';
import './frigate-zone-editor';
import { describeError } from '../api/client';
import type { WireCamera } from '../api/frigate';
import {
  deleteZone, frigateStillUrl, getCameraConfig, getConfigSchema, isFirstWriteRefusal, parseSetting, polygonError, putSettings, putZone, sameSetting, zoneNameError,
  type CameraConfigView, type ConfigField, type ConfigSchema, type ConfigZone, type Pt, type SettingValue,
} from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles } from './frigate-admin-shared';

type Mode = 'zones' | 'settings';
interface Draft {
  name: string;
  isNew: boolean;
  points: Pt[];
  objects: string[];
  inertia: string;
  loitering: string;
}
type Pending = { kind: 'zone' } | { kind: 'delete' } | { kind: 'settings'; section: string };

/**
 * FRGS: zones and the curated camera settings of ONE Frigate recorder (Settings > the recorder > "שינויים ב־Frigate" > "אזורים והגדרות";
 * CR-029 section 13). One camera at a time: its still with the zones over it (`frigate-zone-editor`, never mirrored) and a short list, and
 * the settings drawn from the server's schema, one section per save. Every save asks first (the change lands in Frigate's configuration
 * file); the first save of each kind carries the supervision box. What the caller may change comes from the server (`writable`: the
 * `config` class on AND system.configure on the camera); the server stays the authority. Tokens only, no hints beyond one drawing line.
 */
@customElement('frigate-config-panel')
export class FrigateConfigPanel extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: false }) cams: WireCamera[] = [];
  /** the `config` class is on for the recorder */
  @property({ type: Boolean }) enabled = false;
  @state() private schema: ConfigSchema | null = null;
  @state() private cameraId = '';
  @state() private view: CameraConfigView | null = null;
  @state() private failed = false;
  @state() private mode: Mode = 'zones';
  @state() private draft: Draft | null = null;
  @state() private values: Record<string, string | string[]> = {};
  @state() private pending: Pending | null = null;
  @state() private supervised = false;
  @state() private dialogError = '';
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;

  connectedCallback() {
    super.connectedCallback();
    void getConfigSchema(this.recorderId).then((s) => (this.schema = s)).catch(() => (this.failed = true));
  }

  updated(changed: Map<string, unknown>) {
    if ((changed.has('cams') || changed.has('recorderId')) && !this.cameraId) {
      const first = this.cams.find((c) => c.enabled);
      if (first) void this.pickCamera(first.id);
    }
  }

  private async pickCamera(id: string) {
    this.cameraId = id;
    this.draft = null;
    await this.reload();
  }

  private async reload() {
    if (!this.cameraId) return;
    try {
      this.view = await getCameraConfig(this.recorderId, this.cameraId);
      this.values = {};
      this.failed = false;
    } catch {
      this.view = null;
      this.failed = true;
    }
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 4000);
  }

  static styles = [adminStyles, css`
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
    }
    @container admin (max-width: 720px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .side {
      display: grid;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .zl {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .zl li + li {
      border-block-start: 1px solid var(--sw-border);
    }
    .zl button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      inline-size: 100%;
      min-block-size: 44px;
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 0;
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .zl button:hover,
    .zl button[aria-current='true'] {
      background: var(--sw-surface-2);
    }
    .zl button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: -2px;
    }
    .zl .zn {
      direction: ltr;
      unicode-bidi: isolate;
      font-weight: var(--sw-fw-medium);
    }
    .zl .zs {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chips button {
      min-block-size: 32px;
      padding-inline: var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .chips button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
    }
    .chips button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .chips button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .sect {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
    }
    .sections {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--sw-s-3);
    }
    .field {
      display: grid;
      gap: 4px;
    }
    .field .lbl {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .field input {
      direction: ltr;
      text-align: start;
    }
    .link {
      border: 0;
      background: none;
      padding: 0;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .link:disabled {
      color: var(--sw-text-3);
      cursor: default;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      justify-content: flex-end;
    }
  `];

  // ------------------------------------------------------------------------------------------------ zones

  private startNew() {
    this.draft = { name: '', isNew: true, points: [], objects: [], inertia: '', loitering: '' };
  }

  private select(z: ConfigZone) {
    if (!z.points) return;
    this.draft = { name: z.name, isNew: false, points: z.points.map((p) => [p[0], p[1]] as Pt), objects: [...z.objects], inertia: z.inertia == null ? '' : String(z.inertia),
      loitering: z.loitering_time == null ? '' : String(z.loitering_time) };
  }

  private draftErrors(): { name: string | null; poly: string | null; num: string | null } {
    const t = fx().control.settings.config;
    const d = this.draft;
    if (!d || !this.view) return { name: null, poly: null, num: null };
    const nameErr = d.isNew ? zoneNameError(d.name, this.view.camera_key, this.view.zones.map((z) => z.name)) : null;
    const polyErr = polygonError(d.points);
    const fields = this.schema?.zone.fields ?? [];
    const bad = (key: string, raw: string) => {
      const f = fields.find((x) => x.key === key);
      return !!f && 'error' in parseSetting(f, raw);
    };
    return {
      name: nameErr && d.name ? t.nameError[nameErr] : null,
      poly: polyErr && d.points.length ? t.polyError[polyErr] : null,
      num: bad('inertia', d.inertia) || bad('loitering_time', d.loitering) ? t.rangeError : null,
    };
  }

  private canSaveZone(): boolean {
    const d = this.draft;
    if (!d || !this.view?.writable) return false;
    const e = this.draftErrors();
    return !e.name && !e.poly && !e.num && !polygonError(d.points) && (!d.isNew || !zoneNameError(d.name, this.view.camera_key, this.view.zones.map((z) => z.name)));
  }

  private toggleObject(label: string) {
    if (!this.draft) return;
    const has = this.draft.objects.includes(label);
    this.draft = { ...this.draft, objects: has ? this.draft.objects.filter((x) => x !== label) : [...this.draft.objects, label].sort() };
  }

  private async saveZone() {
    const d = this.draft!;
    const num = (v: string) => (v.trim() === '' ? null : Number(v));
    const r = await putZone(this.recorderId, this.cameraId, d.name, { points: d.points, objects: d.objects, inertia: num(d.inertia), loitering_time: num(d.loitering) }, this.supervised);
    return r.verified;
  }

  private async removeZone() {
    const r = await deleteZone(this.recorderId, this.cameraId, this.draft!.name, this.supervised);
    return r.verified;
  }

  // ------------------------------------------------------------------------------------------------ settings

  private sectionFields(section: string): ConfigField[] {
    return (this.schema?.settings ?? []).filter((f) => f.section === section);
  }

  private current(f: ConfigField): SettingValue {
    return this.view?.settings[f.key] ?? null;
  }

  /** The edited value of a field: the typed text / the chosen labels, or what Frigate shows now. */
  private edited(f: ConfigField): string | string[] {
    if (f.key in this.values) return this.values[f.key];
    const cur = this.current(f);
    if (f.type === 'labels') return Array.isArray(cur) ? cur : Array.isArray(f.default) ? f.default : [];
    return cur == null ? '' : String(cur);
  }

  /** The section's changed values (parsed), or 'error' when one is out of range. */
  private sectionDiff(section: string): Record<string, SettingValue> | 'error' {
    const out: Record<string, SettingValue> = {};
    for (const f of this.sectionFields(section)) {
      if (!(f.key in this.values)) continue;
      const raw = this.values[f.key];
      let v: SettingValue;
      if (f.type === 'labels') v = [...(raw as string[])].sort();
      else {
        const p = parseSetting(f, raw as string);
        if ('error' in p) return 'error';
        v = p.value;
      }
      if (!sameSetting(f, this.current(f), v)) out[f.key] = v;
    }
    return out;
  }

  private setValue(key: string, v: string | string[]) {
    this.values = { ...this.values, [key]: v };
  }

  private toggleLabel(f: ConfigField, label: string) {
    const cur = this.edited(f) as string[];
    this.setValue(f.key, cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label].sort());
  }

  // ------------------------------------------------------------------------------------------------ the confirmation

  private ask(p: Pending) {
    this.pending = p;
    this.supervised = false;
    this.dialogError = '';
  }

  private kindOf(p: Pending): 'config_zone' | 'config_settings' {
    return p.kind === 'settings' ? 'config_settings' : 'config_zone';
  }

  private async run() {
    const p = this.pending;
    if (!p) return;
    const t = fx().control.settings.config;
    this.busy = true;
    try {
      let verified: boolean;
      if (p.kind === 'zone') verified = await this.saveZone();
      else if (p.kind === 'delete') verified = await this.removeZone();
      else {
        const diff = this.sectionDiff(p.section);
        if (diff === 'error') throw new Error(t.rangeError);
        verified = (await putSettings(this.recorderId, this.cameraId, p.section, diff, this.supervised)).verified;
      }
      this.pending = null;
      this.draft = null;
      this.flash('ok', p.kind === 'delete' ? t.deleted : verified ? t.saved : t.sent);
      this.dispatchEvent(new CustomEvent('frigate-changed', { bubbles: true, composed: true }));
      await this.reload();
    } catch (err) {
      this.dialogError = isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : err instanceof Error && !('body' in err) ? err.message : describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private dialog() {
    const p = this.pending;
    const v = this.view;
    if (!p || !v) return nothing;
    const t = fx().control.settings.config;
    const s = fx().control.settings;
    const kind = this.kindOf(p);
    const needSup = v.can_supervise && !v.first_write_done[kind];
    const blocked = !v.can_supervise && !v.first_write_done[kind];
    const heading = p.kind === 'delete' ? `${t.removeTitle}: ${this.draft?.name ?? ''}` : t.confirmTitle;
    return html`<sw-dialog open heading=${heading} data-fcp-confirm=${p.kind} @close=${() => (this.pending = null)}>
      <div class="form">
        <p class="dialog-text">${t.confirmText}</p>
        ${needSup ? html`<label class="sup" data-supervised-box=${kind}><input type="checkbox" .checked=${this.supervised} @change=${(e: Event) => (this.supervised = (e.target as HTMLInputElement).checked)} /><span><b>${s.supervised.label}</b> · ${s.supervised.hint}</span></label>` : nothing}
        ${blocked ? html`<div class="err" data-fcp-blocked>${s.supervised.need}</div>` : nothing}
        ${this.dialogError ? html`<div class="err" role="alert" data-fcp-error>${this.dialogError}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.pending = null)}>${t.cancel}</sw-button>
      <sw-button slot="footer" variant=${p.kind === 'delete' ? 'danger' : 'primary'} data-fcp-ok ?disabled=${this.busy || blocked || (needSup && !this.supervised)} @click=${() => void this.run()}>${fx().control.confirm}</sw-button>
    </sw-dialog>`;
  }

  // ------------------------------------------------------------------------------------------------ render

  private labelText(l: string): string {
    return (fx().control.settings.config.labels as Record<string, string>)[l] ?? l;
  }

  private zonesView(v: CameraConfigView) {
    const t = fx().control.settings.config;
    const d = this.draft;
    const aspect = v.frame.width && v.frame.height ? v.frame.width / v.frame.height : 16 / 9;
    const cam = this.cams.find((c) => c.id === this.cameraId);
    const src = cam && cam.enabled ? frigateStillUrl(this.recorderId, this.cameraId) : null;
    const err = this.draftErrors();
    const lock = !v.writable || this.busy;
    const labels = Array.from(new Set([...(this.schema?.labels ?? []), ...(d?.objects ?? [])]));
    const maxZones = this.schema?.zone.max_zones ?? 24;
    return html`<div class="grid" data-fcp-zones>
      <div>
        <frigate-zone-editor .src=${src} .aspect=${aspect} .zones=${v.zones} .selected=${d ? d.name || '' : null} .points=${d?.points ?? []} ?editing=${!!d && v.writable}
          @zone-points=${(e: CustomEvent<{ points: Pt[] }>) => d && (this.draft = { ...d, points: e.detail.points })}
          @zone-pick=${(e: CustomEvent<{ name: string }>) => { const z = v.zones.find((x) => x.name === e.detail.name); if (z) this.select(z); }}></frigate-zone-editor>
      </div>
      <div class="side">
        ${d
          ? html`<div class="form" data-fcp-zone-form>
              ${d.isNew
                ? html`<label>${t.name}<input dir="ltr" data-fcp-zone-name maxlength="40" autocomplete="off" .value=${d.name} ?disabled=${lock} @input=${(e: Event) => (this.draft = { ...d, name: (e.target as HTMLInputElement).value.trim() })} /></label>
                  ${err.name ? html`<div class="err" data-fcp-name-error>${err.name}</div>` : nothing}`
                : html`<div class="head"><h4 dir="ltr">${d.name}</h4></div>`}
              ${v.writable ? html`<p class="note">${t.draw}</p>` : nothing}
              <div class="inline">
                <span class="chip" data-fcp-points>${t.points}: ${d.points.length}</span>
                <sw-button size="sm" variant="ghost" data-fcp-undo-point ?disabled=${lock || !d.points.length} @click=${() => (this.draft = { ...d, points: d.points.slice(0, -1) })}>${t.undoPoint}</sw-button>
                <sw-button size="sm" variant="ghost" data-fcp-clear ?disabled=${lock || !d.points.length} @click=${() => (this.draft = { ...d, points: [] })}>${t.clear}</sw-button>
              </div>
              ${err.poly ? html`<div class="err" data-fcp-poly-error>${err.poly}</div>` : nothing}
              <div class="field"><span class="lbl">${t.objects}${d.objects.length ? nothing : html`<span>${t.allObjects}</span>`}</span>
                <div class="chips" data-fcp-zone-objects>${labels.map((l) => html`<button type="button" aria-pressed=${String(d.objects.includes(l))} ?disabled=${lock} data-label=${l} @click=${() => this.toggleObject(l)}>${this.labelText(l)}</button>`)}</div>
              </div>
              <div class="two">
                <label>${t.inertia}<input type="number" inputmode="numeric" min="1" max="10" placeholder="3" data-fcp-inertia .value=${d.inertia} ?disabled=${lock} @input=${(e: Event) => (this.draft = { ...d, inertia: (e.target as HTMLInputElement).value })} /></label>
                <label>${t.loitering}<input type="number" inputmode="numeric" min="0" max="3600" placeholder="0" data-fcp-loitering .value=${d.loitering} ?disabled=${lock} @input=${(e: Event) => (this.draft = { ...d, loitering: (e.target as HTMLInputElement).value })} /></label>
              </div>
              ${err.num ? html`<div class="err">${err.num}</div>` : nothing}
              <div class="acts">
                ${!d.isNew && v.writable ? html`<sw-button size="sm" variant="ghost" data-fcp-delete ?disabled=${this.busy} @click=${() => this.ask({ kind: 'delete' })}>${t.remove}</sw-button>` : nothing}
                <sw-button size="sm" data-fcp-cancel @click=${() => (this.draft = null)}>${t.cancel}</sw-button>
                ${v.writable ? html`<sw-button size="sm" variant="primary" data-fcp-save ?disabled=${!this.canSaveZone() || this.busy} @click=${() => this.ask({ kind: 'zone' })}>${t.save}</sw-button>` : nothing}
              </div>
            </div>`
          : html`${v.zones.length
              ? html`<ul class="zl" data-fcp-zone-list>${v.zones.map((z) => html`<li><button type="button" data-zone=${z.name} ?disabled=${!z.points} title=${z.points ? '' : t.notEditable} @click=${() => this.select(z)}>
                  <span class="zn">${z.name}</span><span class="zs">${z.objects.length ? z.objects.map((l) => this.labelText(l)).join(', ') : t.allObjects}</span></button></li>`)}</ul>`
              : html`<div class="empty" data-fcp-no-zones>${t.noZones}</div>`}
            ${v.writable ? html`<div class="acts"><sw-button size="sm" icon="plus" data-fcp-new-zone ?disabled=${v.zones.length >= maxZones} @click=${() => this.startNew()}>${t.newZone}</sw-button></div>` : nothing}`}
      </div>
    </div>`;
  }

  private field(f: ConfigField, lock: boolean) {
    const t = fx().control.settings.config;
    const label = (t.fields as Record<string, string>)[f.key] ?? f.key;
    const val = this.edited(f);
    if (f.type === 'labels') {
      const labels = Array.from(new Set([...(this.schema?.labels ?? []), ...(val as string[])]));
      return html`<div class="field" data-fcp-field=${f.key}><span class="lbl">${label}</span>
        <div class="chips">${labels.map((l) => html`<button type="button" aria-pressed=${String((val as string[]).includes(l))} ?disabled=${lock} data-label=${l} @click=${() => this.toggleLabel(f, l)}>${this.labelText(l)}</button>`)}</div>
      </div>`;
    }
    const bad = 'error' in parseSetting(f, val as string);
    return html`<label class="field" data-fcp-field=${f.key}><span class="lbl"><span>${label}</span>
        <button type="button" class="link" data-fcp-default ?disabled=${lock || val === ''} @click=${() => this.setValue(f.key, '')}>${t.useDefault}</button></span>
      <input type="number" inputmode=${f.type === 'int' ? 'numeric' : 'decimal'} min=${f.min ?? ''} max=${f.max ?? ''} step=${f.step ?? (f.type === 'int' ? 1 : 'any')}
        placeholder=${f.default == null ? '' : `${t.defaultValue}: ${f.default}`} .value=${val as string} ?disabled=${lock} aria-invalid=${String(bad)}
        @input=${(e: Event) => this.setValue(f.key, (e.target as HTMLInputElement).value)} />
      ${bad ? html`<span class="err">${t.rangeError}</span>` : nothing}
    </label>`;
  }

  private settingsView(v: CameraConfigView) {
    const t = fx().control.settings.config;
    const lock = !v.writable || this.busy;
    return html`<div class="sections" data-fcp-settings>
      ${(this.schema?.sections ?? []).map((sec) => {
        const diff = this.sectionDiff(sec);
        const dirty = diff !== 'error' && Object.keys(diff).length > 0;
        return html`<div class="sect" data-fcp-section=${sec}>
          <h4>${(t.sections as Record<string, string>)[sec] ?? sec}</h4>
          ${this.sectionFields(sec).map((f) => this.field(f, lock))}
          ${v.writable ? html`<div class="acts"><sw-button size="sm" variant="primary" data-fcp-save-section=${sec} ?disabled=${!dirty || this.busy} @click=${() => this.ask({ kind: 'settings', section: sec })}>${t.save}</sw-button></div>` : nothing}
        </div>`;
      })}
    </div>`;
  }

  render() {
    const t = fx().control.settings.config;
    const s = fx().control.settings;
    const items = this.cams.filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.name }));
    if (!items.length) return html`<div class="panel"><div class="empty" data-fcp-no-cameras>${t.noCameras}</div></div>`;
    const v = this.view;
    return html`<div class="panel" data-frigate-config-panel>
      <div class="head">
        <div class="inline" style="min-inline-size: 200px; flex: 1 1 220px">
          <sw-dropdown block data-fcp-camera .label=${t.camera} .placeholder=${t.camera} .value=${this.cameraId} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => void this.pickCamera(e.detail.id)}></sw-dropdown>
        </div>
        <div class="inline">
          ${!this.enabled ? html`<span class="chip warn" data-fcp-class-off>${t.classOff}</span>` : v && !v.writable ? html`<span class="chip" data-fcp-read-only>${t.readOnly}</span>` : nothing}
          <div class="seg" role="group" aria-label=${s.tabs.config}>
            <button type="button" aria-pressed=${String(this.mode === 'zones')} data-fcp-mode="zones" @click=${() => (this.mode = 'zones')}>${t.zones}</button>
            <button type="button" aria-pressed=${String(this.mode === 'settings')} data-fcp-mode="settings" @click=${() => (this.mode = 'settings')}>${t.settings}</button>
          </div>
        </div>
      </div>
      ${this.failed ? html`<div class="msg err" data-fcp-failed>${t.unavailable}</div>` : nothing}
      ${v && !this.failed ? (this.mode === 'zones' ? this.zonesView(v) : this.settingsView(v)) : nothing}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fcp-msg>${this.msg.text}</div>` : nothing}
      ${this.dialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-config-panel': FrigateConfigPanel;
  }
}
