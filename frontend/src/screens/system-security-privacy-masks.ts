import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError } from '../api/client';
import { can, isApi, onRemote } from '../api/session';
import { getSettings, patchSettings, snapshotUrl } from '../api/media';
import { nvrSettings, type NvrCamera } from '../api/nvr-settings';
import { privacyMaskApi, type ApplyResult, type MaskChange, type MaskView, type PreviewResult, type PreviewRow } from '../api/nvr-privacy-mask';
import { pm, pmError, type PmKey } from '../i18n/privacy-mask';
import {
  DEFAULT_FRAME,
  cloneDraft,
  clampRect,
  defaultRect,
  dragCorner,
  draftOf,
  invalidOf,
  isArrow,
  isChanged,
  itemOf,
  keyEdit,
  newKey,
  percentBox,
  pointsAttr,
  shapesOf,
  spanRect,
  undoableChange,
  type Corner,
  type Draft,
  type Frame,
  type Invalid,
  type Rect,
} from './privacy-mask-logic';
import { dayMonthTimeText } from '../api/day-format';

/** What one camera's mask looks like on screen: the NVR's mask, the frame and limits, and the draft being edited. */
interface Loaded {
  view: MaskView;
  original: Draft;
  frame: Frame;
  /** When the snapshot was asked for: a new value is a new picture. */
  shot: number;
}

type Step = 'edit' | 'review' | 'done';

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

/**
 * MASKUI-295: Settings > Security > Privacy masks. Draw, move and delete rectangles on a snapshot of the camera; "Review changes" asks the
 * server for the before -> after of every edited camera (nothing is written); "Write to NVR" in the confirmation dialog is the ONLY thing
 * that sends a write, and only by a deliberate press: no queue, no retry, no autosave - a failed call shows its line and waits for the person.
 * The undo is the change log's rollback, one press.
 *
 * Disabled with a plain line (never a hint paragraph) when the switch `nvr.privacy_mask_write` is off, the person lacks `nvr.config.privacy`,
 * or the page runs on the remote channel (the server refuses there). The picture and its regions are never mirrored by RTL.
 * Test hooks: data-pm-* attributes.
 */
@customElement('system-security-privacy-masks')
export class SystemSecurityPrivacyMasks extends LitElement {
  @state() private cameras: NvrCamera[] | null = null;
  @state() private failure: { status: number; code: string } | null = null;
  @state() private loading = true;
  @state() private selected = '';
  @state() private loaded = new Map<string, Loaded | 'error' | 'loading'>();
  /** Edited cameras only (an unedited camera has no draft). */
  @state() private drafts = new Map<string, Draft>();
  @state() private regionKey = '';
  @state() private step: Step = 'edit';
  @state() private preview: PreviewResult | null = null;
  @state() private previewing = false;
  @state() private confirmOpen = false;
  @state() private applying = false;
  @state() private applied: ApplyResult | null = null;
  @state() private line = '';
  @state() private ghost: Rect | null = null;
  @state() private history: MaskChange[] | null = null;
  @state() private undoing = '';
  @state() private undone = new Set<string>();
  @state() private brokenShot = new Set<string>();
  /** MASKSWITCH-295: the installation setting `nvr.privacy_mask_write` as last read or saved (null = not read, or the person may not change it). */
  @state() private switchOn: boolean | null = null;
  @state() private switchAsk = false;
  @state() private switchBusy = false;
  @state() private switchErr = false;
  private drag: { kind: 'move' | 'corner' | 'draw'; key: string; px: number; py: number; rect: Rect | null; corner?: Corner } | null = null;

  static styles = css`
    :host {
      display: contents;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
      gap: var(--sw-s-4, 16px);
      align-items: start;
    }
    @media (max-width: 767px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .banner {
      margin: 0 0 var(--sw-s-3, 12px);
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .cams {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    @media (max-width: 767px) {
      .cams {
        flex-direction: row;
        overflow-x: auto;
        padding-block-end: 4px;
        scroll-snap-type: x proximity;
      }
      .cams li {
        flex: 0 0 auto;
        max-inline-size: 85%;
      }
    }
    .cam {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      min-block-size: 44px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      text-align: start;
      white-space: nowrap;
      box-sizing: border-box;
      min-inline-size: 0;
    }
    .cam > span:not([class]) {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cam[aria-current='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .cam .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
      flex: none;
    }
    .cam bdi {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .main {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-s-3, 12px);
      min-inline-size: 0;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .bar .count {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin-inline-start: auto;
    }
    .sw-switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding: 0 4px;
      border: 0;
      background: none;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .sw-switch .track {
      inline-size: 44px;
      block-size: 26px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-border-strong);
      position: relative;
      flex: none;
    }
    .sw-switch .track::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 20px;
      block-size: 20px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      transition: transform 120ms ease;
    }
    .sw-switch[aria-checked='true'] .track {
      background: var(--sw-accent);
    }
    .sw-switch[aria-checked='true'] .track::after {
      transform: translateX(18px);
    }
    :host-context([dir='rtl']) .sw-switch[aria-checked='true'] .track::after {
      transform: translateX(-18px);
    }
    .swrow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      margin: 0 0 var(--sw-s-3, 12px);
    }
    .swrow .ask {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .swrow .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .swrow .ask sw-button {
        min-block-size: 44px;
      }
    }
    .sw-switch:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    button:focus-visible,
    [tabindex]:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    /* the picture: LTR in every language (video and geometry are never mirrored) */
    .frame {
      direction: ltr;
      position: relative;
      box-sizing: border-box;
      inline-size: 100%;
      max-inline-size: 960px;
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      user-select: none;
      touch-action: pan-y;
      cursor: crosshair;
    }
    .frame.ro {
      cursor: default;
    }
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: fill;
      pointer-events: none;
      -webkit-user-drag: none;
    }
    .frame .nopic {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      pointer-events: none;
    }
    .frame svg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      pointer-events: none;
    }
    .frame svg polygon {
      fill: rgba(0, 0, 0, 0.78);
      stroke: var(--sw-on-video);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .frame svg polygon.sel {
      stroke: var(--sw-accent);
      stroke-width: 3;
    }
    .frame svg polygon.off {
      fill: rgba(0, 0, 0, 0.25);
      stroke-dasharray: 6 4;
    }
    .reg {
      position: absolute;
      box-sizing: border-box;
      cursor: move;
      touch-action: none;
      border-radius: 2px;
    }
    .reg.ro {
      cursor: default;
      pointer-events: none;
    }
    .reg:focus-visible {
      outline: 3px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .handle {
      position: absolute;
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      touch-action: none;
      cursor: nwse-resize;
    }
    .handle::after {
      content: '';
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      background: var(--sw-accent);
      border: 2px solid var(--sw-on-video);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    }
    .handle.tl {
      inset-block-start: -22px;
      inset-inline-start: -22px;
    }
    .handle.tr {
      inset-block-start: -22px;
      inset-inline-end: -22px;
      cursor: nesw-resize;
    }
    .handle.bl {
      inset-block-end: -22px;
      inset-inline-start: -22px;
      cursor: nesw-resize;
    }
    .handle.br {
      inset-block-end: -22px;
      inset-inline-end: -22px;
    }
    .ghost {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      background: rgba(59, 130, 246, 0.2);
      pointer-events: none;
    }
    .regions {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 4px;
    }
    .regions li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .regions .pick {
      flex: 1;
      min-block-size: 44px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    .regions .pick[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .vh {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
      margin: 0;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .history ul,
    .results {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .history li,
    .results li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      min-block-size: 44px;
      padding: 4px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font-size: var(--sw-fs-sm);
    }
    .history li .when {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .results .name {
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-medium);
    }
    .results .st {
      color: var(--sw-text-2);
    }
    .results .st.bad {
      color: var(--sw-danger);
    }
    .review {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-s-3, 12px);
    }
    .rv-card {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .rv-card header {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      align-items: baseline;
    }
    .rv-card .name {
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-semibold);
    }
    [data-pm-confirm-cameras] li {
      overflow-wrap: anywhere;
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .pair figcaption {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .pair figure {
      margin: 0;
    }
    .thumb {
      direction: ltr;
      position: relative;
      box-sizing: border-box;
      inline-size: 100%;
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-2xs);
      overflow: hidden;
    }
    .thumb img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: fill;
    }
    .thumb svg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .thumb svg polygon {
      fill: rgba(0, 0, 0, 0.78);
      stroke: var(--sw-on-video);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .st-chip {
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill, 999px);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
    }
    .st-chip.ready {
      background: var(--sw-success-soft);
      color: var(--sw-success);
      border-color: transparent;
    }
    .st-chip.invalid,
    .st-chip.skipped {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
      border-color: transparent;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    sw-dialog ul {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
      max-block-size: min(36dvh, 240px);
      overflow: auto;
    }
    sw-dialog p {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    sw-dialog .count {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.loadCameras();
    void this.loadSwitch();
  }

  /** The switch row is for `system.configure` (installation scope); anyone else never sees it and the page follows the server's own `write_enabled`. */
  private async loadSwitch() {
    if (!isApi() || onRemote() || !can('system.configure')) return;
    try {
      const r = await getSettings();
      this.switchOn = r.can_edit === false ? null : r.settings['nvr.privacy_mask_write'] === 'true';
    } catch {
      this.switchOn = null;
    }
  }

  private async saveSwitch(on: boolean) {
    if (this.switchBusy) return;
    this.switchBusy = true;
    this.switchErr = false;
    try {
      const r = await patchSettings({ 'nvr.privacy_mask_write': on ? 'true' : 'false' });
      this.switchOn = (r.settings?.['nvr.privacy_mask_write'] ?? (on ? 'true' : 'false')) === 'true';
      this.switchAsk = false;
    } catch {
      this.switchErr = true;
    } finally {
      this.switchBusy = false;
    }
  }

  private onSwitch() {
    if (this.switchBusy || this.switchOn === null) return;
    if (this.switchOn) void this.saveSwitch(false);
    else {
      this.switchErr = false;
      this.switchAsk = !this.switchAsk;
    }
  }

  private renderSwitch() {
    if (this.switchOn === null || this.step !== 'edit') return nothing;
    return html`<div class="swrow" data-pm-switch-row>
      <button type="button" class="sw-switch" role="switch" aria-checked=${this.switchOn ? 'true' : 'false'} data-pm-switch ?disabled=${this.switchBusy || this.applying} @click=${this.onSwitch}><span class="track" aria-hidden="true"></span>${pm('sw_label')}</button>
      ${this.switchAsk && !this.switchOn
        ? html`<div class="ask" data-pm-switch-ask role="group"><span>${pm('sw_confirm')}</span>
            <sw-button size="lg" variant="ghost" data-pm-switch-cancel ?disabled=${this.switchBusy} @click=${() => (this.switchAsk = false)}>${pm('cancel')}</sw-button>
            <sw-button size="lg" variant="primary" data-pm-switch-confirm ?disabled=${this.switchBusy} @click=${() => void this.saveSwitch(true)}>${this.switchBusy ? pm('sw_saving') : pm('sw_turn_on')}</sw-button></div>`
        : nothing}
      ${this.switchErr ? html`<span class="err" data-pm-switch-err role="alert">${pm('sw_err')}</span>` : nothing}
    </div>`;
  }

  // ------------------------------------------------------------------------------------------------ loading

  private async loadCameras() {
    this.loading = true;
    try {
      if (!isApi()) {
        this.cameras = [];
        this.failure = null;
        return;
      }
      const list = await nvrSettings().cameras();
      this.cameras = list.cameras.filter((c) => !!c.camera_id);
      this.failure = null;
      if (this.cameras.length && !this.selected) void this.select(this.cameras[0].camera_id as string);
    } catch (err) {
      this.cameras = null;
      this.failure = { status: err instanceof ApiError ? err.status : 0, code: err instanceof ApiError ? err.code : 'network' };
    } finally {
      this.loading = false;
    }
  }

  private async loadMask(id: string, force = false) {
    if (!force && this.loaded.get(id) && this.loaded.get(id) !== 'error') return;
    const next = new Map(this.loaded);
    next.set(id, 'loading');
    this.loaded = next;
    try {
      const view = await privacyMaskApi.readMask(id);
      const frame: Frame = view.normalized?.width && view.normalized?.height ? { width: view.normalized.width, height: view.normalized.height } : DEFAULT_FRAME;
      const m = new Map(this.loaded);
      m.set(id, { view, original: draftOf(view.enabled, view.regions), frame, shot: Date.now() });
      this.loaded = m;
    } catch {
      const m = new Map(this.loaded);
      m.set(id, 'error');
      this.loaded = m;
    }
  }

  private async loadHistory(id: string) {
    this.history = null;
    try {
      const r = await privacyMaskApi.changes(id, 20);
      if (this.selected === id) this.history = r.changes.filter((c) => c.kind === 'privacy_mask');
    } catch {
      if (this.selected === id) this.history = [];
    }
  }

  private async select(id: string) {
    this.selected = id;
    this.regionKey = '';
    this.line = '';
    this.history = null;
    await this.loadMask(id);
    void this.loadHistory(id);
  }

  // ------------------------------------------------------------------------------------------------ state helpers

  private get cur(): Loaded | null {
    const l = this.loaded.get(this.selected);
    return l && l !== 'error' && l !== 'loading' ? l : null;
  }

  private draftFor(id: string): Draft | null {
    const l = this.loaded.get(id);
    if (!l || l === 'error' || l === 'loading') return null;
    return this.drafts.get(id) ?? l.original;
  }

  /** The reason the screen is view-only, or '' when it may edit. */
  private get lock(): PmKey | '' {
    const l = this.cur;
    if (!l) return '';
    if (onRemote()) return 'off_remote';
    if (!l.view.can_write) return 'off_perm';
    if (!(this.switchOn ?? l.view.write_enabled)) return 'off_switch';
    return '';
  }

  private edit(fn: (d: Draft, f: Frame) => void) {
    const l = this.cur;
    if (!l || this.lock) return;
    const d = cloneDraft(this.drafts.get(this.selected) ?? l.original);
    fn(d, l.frame);
    const next = new Map(this.drafts);
    if (isChanged(l.original, d)) next.set(this.selected, d);
    else next.delete(this.selected);
    this.drafts = next;
  }

  private invalidFor(id: string): Invalid {
    const l = this.loaded.get(id);
    const d = this.drafts.get(id);
    if (!l || l === 'error' || l === 'loading' || !d) return null;
    return invalidOf(d, l.view.max_regions, l.frame);
  }

  private nameOf(id: string): string {
    return this.cameras?.find((c) => c.camera_id === id)?.name ?? id;
  }

  // ------------------------------------------------------------------------------------------------ editing

  private addRegion = () => {
    this.edit((d, f) => {
      const l = this.cur;
      if (!l || d.regions.length >= l.view.max_regions) return;
      const key = newKey();
      d.regions.push({ key, rect: defaultRect(f, d.regions.length), points: [] });
      if (!d.enabled) d.enabled = true;
      this.regionKey = key;
    });
    void this.updateComplete.then(() => this.shadowRoot?.querySelector<HTMLElement>(`[data-pm-region="${this.regionKey}"]`)?.focus());
  };

  private deleteRegion(key: string) {
    const d = this.draftFor(this.selected);
    const idx = d ? d.regions.findIndex((r) => r.key === key) : -1;
    this.edit((x) => {
      x.regions = x.regions.filter((r) => r.key !== key);
    });
    const after = this.draftFor(this.selected);
    this.regionKey = after && after.regions.length ? after.regions[Math.min(idx, after.regions.length - 1)].key : '';
    void this.updateComplete.then(() => {
      const target = this.regionKey ? this.shadowRoot?.querySelector<HTMLElement>(`[data-pm-region="${this.regionKey}"]`) : this.shadowRoot?.querySelector('[data-pm-add]')?.shadowRoot?.querySelector('button'); // sw-button does not delegate focus: its inner button takes it
      target?.focus();
    });
  }

  private setRect(key: string, rect: Rect) {
    this.edit((d) => {
      const r = d.regions.find((x) => x.key === key);
      if (r) r.rect = rect;
    });
  }

  private discard = () => {
    const next = new Map(this.drafts);
    next.delete(this.selected);
    this.drafts = next;
    this.regionKey = '';
  };

  private toggleMask = () => {
    this.edit((d) => {
      d.enabled = !d.enabled;
    });
  };

  private framePoint(e: PointerEvent): { x: number; y: number } | null {
    const l = this.cur;
    const el = this.shadowRoot?.querySelector<HTMLElement>('[data-pm-frame]');
    if (!l || !el) return null;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    return { x: ((e.clientX - b.left) / b.width) * l.frame.width, y: ((e.clientY - b.top) / b.height) * l.frame.height };
  }

  private onFrameDown(e: PointerEvent) {
    const l = this.cur;
    if (!l || this.lock || e.button !== 0 || e.pointerType === 'touch') return; // a finger adds with the button, so the page can still scroll
    if ((e.target as HTMLElement).closest('[data-pm-region],[data-pm-handle]')) return;
    const d = this.draftFor(this.selected);
    if (!d || d.regions.length >= l.view.max_regions) return;
    const p = this.framePoint(e);
    if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { kind: 'draw', key: '', px: p.x, py: p.y, rect: null };
    this.regionKey = '';
  }

  private onRegionDown(e: PointerEvent, key: string, rect: Rect) {
    if (this.lock || e.button !== 0) return;
    const p = this.framePoint(e);
    if (!p) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.regionKey = key;
    this.drag = { kind: 'move', key, px: p.x, py: p.y, rect };
  }

  private onHandleDown(e: PointerEvent, key: string, rect: Rect, corner: Corner) {
    if (this.lock || e.button !== 0) return;
    const p = this.framePoint(e);
    if (!p) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { kind: 'corner', key, px: p.x, py: p.y, rect, corner };
  }

  private onPointerMove(e: PointerEvent) {
    const g = this.drag;
    const l = this.cur;
    if (!g || !l) return;
    const p = this.framePoint(e);
    if (!p) return;
    if (g.kind === 'draw') {
      this.ghost = spanRect(g.px, g.py, p.x, p.y, l.frame);
    } else if (g.kind === 'move' && g.rect) {
      this.setRect(g.key, clampRect({ ...g.rect, x: g.rect.x + (p.x - g.px), y: g.rect.y + (p.y - g.py) }, l.frame));
    } else if (g.kind === 'corner' && g.rect && g.corner) {
      this.setRect(g.key, dragCorner(g.rect, g.corner, p.x, p.y, l.frame));
    }
  }

  private onPointerUp(e: PointerEvent) {
    const g = this.drag;
    const l = this.cur;
    this.drag = null;
    if (!g || !l) return;
    if (g.kind === 'draw') {
      const p = this.framePoint(e);
      const r = p ? spanRect(g.px, g.py, p.x, p.y, l.frame) : null;
      this.ghost = null;
      if (r) {
        const key = newKey();
        this.edit((d) => {
          if (d.regions.length >= l.view.max_regions) return;
          d.regions.push({ key, rect: r, points: [] });
          d.enabled = true;
        });
        this.regionKey = key;
      }
    }
  }

  private onRegionKey(e: KeyboardEvent, key: string) {
    const l = this.cur;
    if (!l || this.lock) return;
    const d = this.draftFor(this.selected);
    const reg = d?.regions.find((r) => r.key === key);
    if (!reg) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteRegion(key);
    } else if (isArrow(e.key) && reg.rect) {
      e.preventDefault();
      this.setRect(key, keyEdit(reg.rect, e.key, e.shiftKey, l.frame, e.ctrlKey || e.metaKey));
    }
  }

  // ------------------------------------------------------------------------------------------------ preview, confirm, write, undo

  private get invalidCameras(): string[] {
    return [...this.drafts.keys()].filter((id) => this.invalidFor(id));
  }

  private get canReview(): boolean {
    return !this.lock && !!this.cur && this.drafts.size > 0 && this.invalidCameras.length === 0 && !this.previewing;
  }

  /** READ-ONLY on the device: the server reads every edited camera and answers before -> after. Nothing is written. */
  private review = async () => {
    if (!this.canReview) return;
    this.previewing = true;
    this.line = '';
    try {
      const items = [...this.drafts.entries()].map(([id, d]) => itemOf(id, d));
      this.preview = await privacyMaskApi.previewMasks(items);
      this.step = 'review';
    } catch (err) {
      this.line = pmError(err instanceof ApiError ? err.code : 'generic');
    } finally {
      this.previewing = false;
    }
  };

  private get readyRows(): PreviewRow[] {
    return (this.preview?.items ?? []).filter((r) => r.status === 'ready');
  }

  private backToEdit = () => {
    this.preview = null;
    this.confirmOpen = false;
    this.step = 'edit';
  };

  /** THE write: sent only from the confirmation dialog's button. Once per press; a failure is shown and never repeated by the screen. */
  private write = async () => {
    if (this.applying || !this.preview) return;
    const rows = this.readyRows;
    if (!rows.length) return;
    this.applying = true;
    this.line = '';
    try {
      const items = rows.map((r) => {
        const d = this.drafts.get(r.camera_id);
        return itemOf(r.camera_id, d as Draft, r.etag);
      });
      this.applied = await privacyMaskApi.applyMasks(items);
      this.confirmOpen = false;
      this.step = 'done';
      // the cameras that are now as the person drew them (or were already) leave the draft set; the rest keep their drafts
      const next = new Map(this.drafts);
      for (const r of this.applied.results) if (r.status === 'applied' || r.status === 'unchanged') next.delete(r.camera_id);
      this.drafts = next;
      for (const r of this.applied.results) if (r.status === 'applied') void this.loadMask(r.camera_id, true);
      void this.loadHistory(this.selected);
    } catch (err) {
      this.confirmOpen = false;
      this.line = pmError(err instanceof ApiError ? err.code : 'generic');
      this.step = 'edit';
      this.preview = null;
    } finally {
      this.applying = false;
    }
  };

  /** The change log's undo: one deliberate press, one request, never repeated by the screen. */
  private undo = async (changeId: string, cameraId: string) => {
    if (this.undoing) return;
    this.undoing = changeId;
    this.line = '';
    try {
      await privacyMaskApi.undoChange(changeId);
      const u = new Set(this.undone);
      u.add(changeId);
      this.undone = u;
      const next = new Map(this.drafts);
      next.delete(cameraId);
      this.drafts = next;
      await this.loadMask(cameraId, true);
      if (this.selected === cameraId) void this.loadHistory(cameraId);
    } catch (err) {
      this.line = pmError(err instanceof ApiError ? err.code : 'generic');
    } finally {
      this.undoing = '';
    }
  };

  private finish = () => {
    this.applied = null;
    this.preview = null;
    this.step = 'edit';
    void this.loadHistory(this.selected);
  };

  // ------------------------------------------------------------------------------------------------ render

  private regionLabel(i: number, rect: Rect | null) {
    return pm(rect ? 'region_n' : 'region_poly', { n: i + 1 });
  }

  private invalidText(code: Invalid, max: number): string {
    return code === 'need_region' ? pm('inv_need_region') : code === 'too_many' ? pm('inv_too_many', { max }) : code === 'too_small' ? pm('inv_too_small') : '';
  }

  private renderPicture(id: string, shot: number) {
    return this.brokenShot.has(id)
      ? html`<div class="nopic">${pm('no_picture')}</div>`
      : html`<img alt="" src=${snapshotUrl(id, shot)} @error=${() => (this.brokenShot = new Set(this.brokenShot).add(id))} />`;
  }

  private thumb(id: string, frame: Frame, shapes: number[][][], shot: number) {
    return html`<div class="thumb" style=${`aspect-ratio:${frame.width} / ${frame.height}`}>
      ${this.renderPicture(id, shot)}
      <svg viewBox=${`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="none" aria-hidden="true">${shapes.map((p) => svg`<polygon points=${pointsAttr(p)}></polygon>`)}</svg>
    </div>`;
  }

  private renderCameras() {
    return html`<ul class="cams" data-pm-cameras aria-label=${pm('cameras')}>
      ${this.cameras!.map((c) => {
        const id = c.camera_id as string;
        return html`<li>
          <button type="button" class="cam" data-pm-camera=${id} aria-current=${id === this.selected ? 'true' : 'false'} ?disabled=${this.step !== 'edit'} @click=${() => void this.select(id)}>
            ${this.drafts.has(id) ? html`<span class="dot" data-pm-edited aria-hidden="true"></span><span class="vh">${pm('camera_edited')}</span>` : nothing}
            <span>${c.name}</span><bdi>${c.channel}</bdi>
          </button>
        </li>`;
      })}
    </ul>`;
  }

  private renderEditor() {
    const l = this.cur;
    const entry = this.loaded.get(this.selected);
    if (entry === 'error') return html`<sw-state-panel state="error" heading=${pm('err_mask')} actionLabel=${pm('retry')} data-pm-mask-error @action=${() => void this.loadMask(this.selected, true)}></sw-state-panel>`;
    if (!l) return html`<sw-state-panel state="loading" heading=${pm('loading')} data-pm-mask-loading></sw-state-panel>`;
    const d = this.draftFor(this.selected) as Draft;
    const lock = this.lock;
    const inv = this.invalidFor(this.selected);
    const sel = d.regions.find((r) => r.key === this.regionKey) ?? null;
    return html`
      <div class="bar">
        <button type="button" class="sw-switch" role="switch" aria-checked=${d.enabled ? 'true' : 'false'} data-pm-enabled ?disabled=${!!lock} @click=${this.toggleMask}><span class="track" aria-hidden="true"></span>${pm('mask_on')}</button>
        <sw-button size="lg" data-pm-add ?disabled=${!!lock || d.regions.length >= l.view.max_regions} @click=${this.addRegion}>${pm('add_region')}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-delete ?disabled=${!!lock || !sel} @click=${() => sel && this.deleteRegion(sel.key)}>${pm('delete_region')}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-discard ?disabled=${!this.drafts.has(this.selected)} @click=${this.discard}>${pm('discard')}</sw-button>
        <span class="count" data-pm-count>${pm('regions_count', { n: d.regions.length, max: l.view.max_regions })}</span>
      </div>
      <div class="frame ${lock ? 'ro' : ''}" data-pm-frame style=${`aspect-ratio:${l.frame.width} / ${l.frame.height}`}
        @pointerdown=${(e: PointerEvent) => this.onFrameDown(e)} @pointermove=${(e: PointerEvent) => this.onPointerMove(e)} @pointerup=${(e: PointerEvent) => this.onPointerUp(e)} @pointercancel=${() => ((this.drag = null), (this.ghost = null))}>
        ${this.renderPicture(this.selected, l.shot)}
        <svg viewBox=${`0 0 ${l.frame.width} ${l.frame.height}`} preserveAspectRatio="none" aria-hidden="true">
          ${d.regions.map((r) => svg`<polygon class=${[r.key === this.regionKey ? 'sel' : '', d.enabled ? '' : 'off'].join(' ')} points=${pointsAttr(r.rect ? [[r.rect.x, r.rect.y], [r.rect.x + r.rect.w, r.rect.y], [r.rect.x + r.rect.w, r.rect.y + r.rect.h], [r.rect.x, r.rect.y + r.rect.h]] : r.points)}></polygon>`)}
        </svg>
        ${repeat(d.regions, (r) => r.key, (r, i) => this.renderRegion(r.key, i, r.rect, r.points, l.frame, !!lock))}
        ${this.ghost ? html`<div class="ghost" style=${this.styleOf(percentBox(this.ghost, l.frame))}></div>` : nothing}
      </div>
      <span id="pm-keys" class="vh">${pm('region_keys')}</span>
      ${inv || this.invalidCameras.length ? html`<p class="err" data-pm-invalid role="alert">${this.invalidCameras.map((id) => `${this.nameOf(id)}: ${this.invalidText(this.invalidFor(id), (this.loaded.get(id) as Loaded).view.max_regions)}`).join(' · ')}</p>` : nothing}
      <ul class="regions" data-pm-regions>
        ${d.regions.map(
          (r, i) => html`<li>
            <button type="button" class="pick" data-pm-pick=${r.key} aria-pressed=${r.key === this.regionKey ? 'true' : 'false'} @click=${() => (this.regionKey = r.key)}>${this.regionLabel(i, r.rect)}</button>
            <sw-button size="lg" variant="ghost" iconOnly icon="close" label=${`${pm('delete_region')}: ${this.regionLabel(i, r.rect)}`} data-pm-remove=${r.key} ?disabled=${!!lock} @click=${() => this.deleteRegion(r.key)}></sw-button>
          </li>`,
        )}
      </ul>
      ${this.renderHistory()}
      ${this.line ? html`<p class="err" data-pm-line role="alert">${this.line}</p>` : nothing}
      <div class="foot">
        <sw-button size="lg" variant="primary" data-pm-review ?disabled=${!this.canReview} @click=${() => void this.review()}>${this.previewing ? pm('reviewing') : pm('review', { n: this.drafts.size })}</sw-button>
      </div>`;
  }

  private styleOf(b: { left: string; top: string; width: string; height: string }) {
    return `left:${b.left};top:${b.top};width:${b.width};height:${b.height}`;
  }

  private renderRegion(key: string, i: number, rect: Rect | null, points: number[][], f: Frame, ro: boolean) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const box: Rect = rect ?? { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const selected = key === this.regionKey;
    const label = this.regionLabel(i, rect);
    return html`<div class="reg ${ro ? 'ro' : ''}" data-pm-region=${key} data-pm-index=${i + 1} data-pm-rect=${rect ? `${rect.x},${rect.y},${rect.w},${rect.h}` : 'free'} style=${this.styleOf(percentBox(box, f))}
      role="group" tabindex=${ro ? -1 : 0} aria-label=${label} aria-describedby="pm-keys" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Delete"
      @focus=${() => (this.regionKey = key)}
      @pointerdown=${(e: PointerEvent) => rect && this.onRegionDown(e, key, rect)} @pointermove=${(e: PointerEvent) => this.onPointerMove(e)} @pointerup=${(e: PointerEvent) => this.onPointerUp(e)}
      @keydown=${(e: KeyboardEvent) => this.onRegionKey(e, key)}>
      ${selected && rect && !ro ? CORNERS.map((c) => html`<div class="handle ${c}" data-pm-handle=${c} aria-hidden="true" @pointerdown=${(e: PointerEvent) => this.onHandleDown(e, key, rect, c)} @pointermove=${(e: PointerEvent) => this.onPointerMove(e)} @pointerup=${(e: PointerEvent) => this.onPointerUp(e)}></div>`) : nothing}
    </div>`;
  }

  private changeStatus(c: MaskChange): string {
    if (c.rollback_of) return pm('log_applied');
    const s = c.status;
    return s === 'applied' ? pm('log_applied') : s === 'rolled_back' ? pm('log_rolled_back') : s === 'failed' ? pm('log_failed') : s === 'diverged' ? pm('log_diverged') : pm('log_other');
  }

  private renderHistory() {
    if (this.history === null) return nothing;
    const can = undoableChange(this.history);
    const lock = this.lock;
    return html`<section class="history" data-pm-history aria-label=${pm('log_title')}>
      <h3>${pm('log_title')}</h3>
      ${this.history.length
        ? html`<ul>
            ${this.history.slice(0, 5).map(
              (c) => html`<li data-pm-change=${c.id} data-status=${c.status}>
                <span class="when">${this.when(c.created_at)}</span><span>${this.changeStatus(c)}</span>
                ${can && can.id === c.id && !this.undone.has(c.id)
                  ? html`<sw-button size="lg" variant="ghost" data-pm-undo=${c.id} ?disabled=${!!this.undoing || !!lock} @click=${() => void this.undo(c.id, this.selected)}>${this.undoing === c.id ? pm('undoing') : pm('undo')}</sw-button>`
                  : nothing}
              </li>`,
            )}
          </ul>`
        : html`<p class="muted" data-pm-history-empty>${pm('log_empty')}</p>`}
    </section>`;
  }

  private when(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : dayMonthTimeText(d);
  }

  private statusText(s: string): string {
    return s === 'ready' ? pm('st_ready') : s === 'unchanged' ? pm('st_unchanged') : s === 'invalid' ? pm('st_invalid') : pm('st_skipped');
  }

  private renderReview() {
    const p = this.preview;
    if (!p) return nothing;
    const ready = this.readyRows.length;
    return html`<div class="review" data-pm-review-step>
      <h3>${pm('preview_title')}</h3>
      ${p.items.map((r) => {
        const loaded = this.loaded.get(r.camera_id);
        const frame: Frame = r.before?.normalized?.width ? { width: r.before.normalized.width, height: r.before.normalized.height ?? DEFAULT_FRAME.height } : loaded && loaded !== 'error' && loaded !== 'loading' ? loaded.frame : DEFAULT_FRAME;
        const shot = loaded && loaded !== 'error' && loaded !== 'loading' ? loaded.shot : 0;
        return html`<article class="rv-card" data-pm-preview=${r.camera_id} data-status=${r.status}>
          <header><span class="name">${r.name || this.nameOf(r.camera_id)}</span><span class="st-chip ${r.status}" data-pm-status>${this.statusText(r.status)}</span>${r.status === 'invalid' || r.status === 'skipped' ? html`<span class="err">${pmError(r.reason ?? 'generic')}</span>` : nothing}</header>
          ${r.before && r.after
            ? html`<div class="pair">
                <figure><figcaption>${pm('before')}</figcaption>${this.thumb(r.camera_id, frame, shapesOf(r.before.enabled ? r.before : { ...r.before, regions: [] }), shot)}</figure>
                <figure><figcaption>${pm('after')}</figcaption>${this.thumb(r.camera_id, frame, shapesOf(r.after.enabled ? r.after : { ...r.after, regions: [] }), shot)}</figure>
              </div>`
            : nothing}
        </article>`;
      })}
      <div class="foot">
        <sw-button size="lg" variant="ghost" data-pm-back @click=${this.backToEdit}>${pm('back')}</sw-button>
        <sw-button size="lg" variant="primary" data-pm-next ?disabled=${!ready} @click=${() => (this.confirmOpen = true)}>${pm('next')}</sw-button>
      </div>
    </div>`;
  }

  private renderConfirm() {
    const rows = this.readyRows;
    return html`<sw-dialog ?open=${this.confirmOpen} heading=${pm('confirm_title')} data-pm-confirm-dialog @close=${(e: Event) => { e.stopPropagation(); if (!this.applying) this.confirmOpen = false; }}>
      ${this.confirmOpen
        ? html`<p>${pm('confirm_lead')}</p>
            <p class="count" data-pm-confirm-count>${rows.length === 1 ? pm('confirm_count_one') : pm('confirm_count', { n: rows.length })}</p>
            <ul data-pm-confirm-cameras>${rows.map((r) => html`<li data-pm-confirm-camera=${r.camera_id}>${r.name || this.nameOf(r.camera_id)}</li>`)}</ul>
            <sw-button size="lg" slot="footer" variant="ghost" data-pm-cancel ?disabled=${this.applying} @click=${() => (this.confirmOpen = false)}>${pm('cancel')}</sw-button>
            <sw-button size="lg" slot="footer" variant="primary" data-pm-confirm ?disabled=${this.applying || !rows.length} @click=${() => void this.write()}>${this.applying ? pm('applying') : pm('write')}</sw-button>`
        : nothing}
    </sw-dialog>`;
  }

  private resultText(r: { status: string; reason?: string; restored?: boolean | null }): { text: string; bad: boolean } {
    switch (r.status) {
      case 'applied':
        return { text: pm('res_applied'), bad: false };
      case 'unchanged':
        return { text: pm('res_unchanged'), bad: false };
      case 'skipped':
        return { text: `${pm('res_skipped')}: ${pmError(r.reason ?? 'generic')}`, bad: true };
      case 'not_attempted':
        return { text: pm('res_not_attempted'), bad: false };
      default:
        return { text: `${pm('res_failed')}: ${pmError(r.reason ?? 'generic')}${r.restored === true ? `. ${pm('restored')}` : r.restored === false ? `. ${pm('not_restored')}` : ''}`, bad: true };
    }
  }

  private renderDone() {
    const a = this.applied;
    if (!a) return nothing;
    return html`<div class="review" data-pm-done-step>
      <h3>${pm('result_title')}</h3>
      <ul class="results" data-pm-results>
        ${a.results.map((r) => {
          const t = this.resultText(r);
          const done = !!r.change_id && this.undone.has(r.change_id);
          return html`<li data-pm-result=${r.camera_id} data-status=${r.status}>
            <span class="name">${this.nameOf(r.camera_id)}</span><span class="st ${t.bad ? 'bad' : ''}">${done ? pm('undone') : t.text}</span>
            ${r.status === 'applied' && r.change_id && !done
              ? html`<sw-button size="lg" variant="ghost" data-pm-undo=${r.change_id} ?disabled=${!!this.undoing} @click=${() => void this.undo(r.change_id as string, r.camera_id)}>${this.undoing === r.change_id ? pm('undoing') : pm('undo')}</sw-button>`
              : nothing}
          </li>`;
        })}
      </ul>
      ${this.line ? html`<p class="err" data-pm-line role="alert">${this.line}</p>` : nothing}
      <div class="foot"><sw-button size="lg" variant="primary" data-pm-finish @click=${this.finish}>${pm('done')}</sw-button></div>
    </div>`;
  }

  render() {
    let content;
    if (this.loading && !this.cameras) content = html`<sw-state-panel state="loading" heading=${pm('loading')} data-pm-loading></sw-state-panel>`;
    else if (this.failure?.status === 403) content = html`<sw-state-panel state="forbidden" heading=${pm('forbidden')} quiet data-pm-forbidden></sw-state-panel>`;
    else if (this.failure) content = html`<sw-state-panel state="error" heading=${pm('err_cameras')} actionLabel=${pm('retry')} data-pm-error @action=${() => void this.loadCameras()}></sw-state-panel>`;
    else if (!this.cameras?.length) content = html`<sw-state-panel icon="camera" state="empty" heading=${pm('empty_cameras')} quiet data-pm-empty></sw-state-panel>`;
    else {
      const lock = this.step === 'edit' ? this.lock : '';
      content = html`${this.renderSwitch()}${lock ? html`<p class="banner" data-pm-lock=${lock} role="status">${pm(lock)}</p>` : nothing}
        <div class="layout">
          ${this.renderCameras()}
          <div class="main" data-pm-step=${this.step}>${this.step === 'edit' ? this.renderEditor() : this.step === 'review' ? this.renderReview() : this.renderDone()}</div>
        </div>`;
    }
    return html`<sw-page crumbs=${pm('crumbs')} heading=${pm('heading')}><div data-pm-screen data-state=${this.loading && !this.cameras ? 'loading' : this.failure ? 'error' : 'ready'} style="display:contents">${content}</div></sw-page>${this.renderConfirm()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security-privacy-masks': SystemSecurityPrivacyMasks;
  }
}
