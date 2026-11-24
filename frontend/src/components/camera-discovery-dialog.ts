/**
 * ONVIF-UI-2500: "חיפוש מצלמות ברשת" - the three-step wizard of camera discovery (design docs/design/onvif-discovery-2412, owner
 * decisions Q54-Q61 of 2026-11-22), opened from the "מצלמות ללא מקליט" card next to adding a camera by hand.
 *
 *   1 חיפוש     the range (the server's suggestion: the site's own network; up to 1,024 addresses - Q56), "התחלת חיפוש", live progress
 *               with "עצירה", the devices found so far; nothing found -> the three likely reasons, another range, add by hand.
 *   2 זיהוי     the results (camera / recorder / unknown). Behind the recorder or already added: marked, never selectable (Q58); a
 *               device that looks like a recorder offers "הוספה כמקליט" - the recorder wizard with its address (Q59). Tick, type ONE
 *               user / password ("אותו משתמש וסיסמה" for several - Q57), one attempt per camera; a refused pair is never sent to that
 *               camera again (the row's own password must change first); the lockout guard's stop is shown.
 *   3 בחירה     a preview per camera (the preview form of POST /cameras/source/test: the address is assembled on the server), name,
 *               area, the suggested main / sub streams (changeable), "הוספת N מצלמות", then the result per camera.
 *
 * Nothing is written anywhere before "הוספה" (the scan and the identification only read). The typed password lives in this
 * component's memory and in the scan job on the server; closing the wizard after the scan forgets both (DELETE of the scan). No list
 * scrolls: every list is paged to what the dialog shows (owner rule: control screens never scroll). `system.configure` only - the
 * card that opens it is shown to that permission alone, and the server checks every call itself.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-button';
import './sw-field';
import './sw-icon';
import './sw-pager';
import './sw-steps';
import { toggled } from './sw-toggle'; // the "same user for all" switch (HAND-SWITCH-2480 pattern, DESIGN-LITERALS-2510)
import {
  addDiscovered,
  cancelScan,
  getScan,
  identifyDevices,
  listScans,
  previewDiscovered,
  startScan,
  type AddResult,
  type DiscoveryCapabilities,
  type FoundDevice,
  type ScanJob,
} from '../api/camera-discovery';
import { getDevicesTree } from '../api/devices';
import { sourceControls } from '../api/camera-visibility';
import { webrtcServer } from '../api/session';
import { cdt } from '../i18n/camera-discovery';
import { ltrIsolate } from '../i18n/bidi';
import {
  KIND_TEXT,
  addFailureText,
  addSummary,
  authState,
  clockNote,
  defaultName,
  discoveryErrorText,
  errorCode,
  identifyBlock,
  identifySummary,
  identifyTargets,
  mergeDevices,
  needsH265Note,
  offersRecorder,
  pageSize,
  pageSlice,
  pairKey,
  profileLabel,
  progressPct,
  rangeCheck,
  readyToAdd,
  retryAllowed,
  rowClass,
  rowMark,
  runningScan,
  selectable,
  suggestedPair,
  usableProfiles,
  type Step,
  type Tone,
} from '../screens/camera-discovery-logic';

type Phase = 'setup' | 'running' | 'none' | 'failed';
interface Draft {
  name: string;
  area: string;
  main: string | null;
  sub: string | null;
}
interface Preview {
  state: 'loading' | 'ok' | 'fail';
  src?: string;
  text?: string;
}
interface AreaOption {
  id: string;
  name: string;
}

const POLL_MS = 1000;
const ICON = { camera: 'camera', recorder: 'storage', unknown: 'help' } as const;

@customElement('camera-discovery-dialog')
export class CameraDiscoveryDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** GET /cameras/discovery/capabilities, read by the card (the suggested range and the address cap). */
  @property({ attribute: false }) caps: DiscoveryCapabilities | null = null;

  @state() private step: Step = 'scan';
  @state() private phase: Phase = 'setup';
  @state() private range = '';
  @state() private job: ScanJob | null = null;
  @state() private devices: FoundDevice[] = [];
  @state() private selected = new Set<string>();
  @state() private user = '';
  @state() private password = '';
  @state() private sameForAll = true;
  @state() private rowPw: Record<string, string> = {};
  @state() private pressing = new Set<string>();
  @state() private page = 1;
  @state() private drafts: Record<string, Draft> = {};
  @state() private previews: Record<string, Preview> = {};
  @state() private areas: AreaOption[] = [];
  @state() private busy = false;
  @state() private result: AddResult | null = null;
  @state() private msg: { tone: Tone; text: string } | null = null;
  @state() private recorderFor: FoundDevice | null = null;
  @state() private recorderReady = false;

  /** The pair last sent to each device (Q57: never the same refused pair again). Memory only; cleared with the wizard. */
  private tried = new Map<string, string>();
  private timer = 0;
  private generation = 0;
  private readonly mq = window.matchMedia('(max-width: 767px)');
  private readonly onResize = () => this.requestUpdate();

  static styles = css`
    :host {
      display: contents;
    }
    .body {
      display: grid;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    sw-steps {
      justify-content: center;
    }
    .lead,
    .note,
    .help {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .help {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ip {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
      color: var(--sw-text-2);
    }
    input[dir='ltr'] {
      text-align: left;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sw-s-3) var(--sw-s-4);
      align-items: start;
    }
    .panel {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-3) var(--sw-s-3h);
      display: grid;
      gap: var(--sw-s-2);
      background: var(--sw-surface);
    }
    .panel h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .facts .row {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
      min-block-size: 32px;
      font-size: var(--sw-fs-sm);
    }
    .facts .row small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      padding: 2px var(--sw-s-2);
      border-radius: 999px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .chip[data-tone='ok'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .chip[data-tone='warn'] {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip[data-tone='bad'] {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chip[data-tone='accent'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .tone-bad {
      color: var(--sw-danger-text);
    }
    .tone-ok {
      color: var(--sw-success-text);
    }
    .tone-warn {
      color: var(--sw-warning-text);
    }
    .prog {
      block-size: 8px;
      border-radius: 8px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .prog i {
      display: block;
      block-size: 100%;
      border-radius: 8px;
      background: var(--sw-accent);
    }
    @media (prefers-reduced-motion: no-preference) {
      .prog i {
        transition: inline-size 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      }
    }
    .stats {
      display: flex;
      gap: var(--sw-s-4h);
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .list {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .list-head {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-block-end: 1px solid var(--sw-border);
    }
    .list-head h4 {
      margin: 0;
      flex: 1;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .dev {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1.2fr) minmax(0, 1.3fr) auto;
      gap: 10px;
      align-items: center;
      padding: 9px var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-block-size: 44px;
    }
    .dev:first-child {
      border-block-start: 0;
    }
    .dev.dim .t {
      color: var(--sw-text-2); /* not a fade: the address under it keeps its contrast */
      font-weight: var(--sw-fw-medium, 500);
    }
    .dev input[type='checkbox'] {
      inline-size: var(--sw-check-size);
      block-size: var(--sw-check-size);
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .dev sw-icon {
      --sw-icon-size: 18px;
      color: var(--sw-text-3);
    }
    .who {
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .d {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1h);
      align-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .st {
      display: grid;
      gap: 3px;
      justify-items: start;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    .end {
      display: flex;
      gap: var(--sw-s-1h);
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }
    .pw {
      display: flex;
      gap: var(--sw-s-1h);
      align-items: center;
    }
    .pw input {
      inline-size: 160px;
      min-block-size: var(--sw-ctl-h-md);
      box-sizing: border-box;
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: var(--sw-r-sm);
      padding: 0 var(--sw-s-2);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    .spin {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--sw-accent-soft);
      border-block-start-color: var(--sw-accent);
      display: inline-block;
    }
    @media (prefers-reduced-motion: no-preference) {
      .spin {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    }
    .cred {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 10px;
      align-items: end;
    }
    .cred .check {
      grid-column: 1 / -1;
    }
    .check {
      display: flex;
      gap: var(--sw-s-2);
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-block-size: 32px;
      cursor: pointer;
    }
    .foot-line {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: space-between;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .empty {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 10px;
      padding: var(--sw-s-4) var(--sw-s-2);
    }
    .empty h4 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading);
    }
    .empty ul {
      margin: 0;
      padding-inline-start: var(--sw-s-4h);
      text-align: start;
      display: grid;
      gap: var(--sw-s-1h);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      max-inline-size: 520px;
    }
    .btns {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      justify-content: center;
    }
    .addrow {
      display: grid;
      grid-template-columns: 132px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.6fr);
      gap: var(--sw-s-3);
      align-items: start;
      padding: 10px var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
    }
    .addrow:first-child {
      border-block-start: 0;
    }
    .streams {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sw-s-2);
    }
    .thumb {
      inline-size: 132px;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      overflow: hidden;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb sw-button {
      --sw-icon-size: 16px;
    }
    .result {
      display: flex;
      gap: var(--sw-s-3);
      align-items: center;
      padding: var(--sw-s-3) var(--sw-s-3h);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
    }
    .result sw-icon {
      --sw-icon-size: 22px;
    }
    .result .t {
      white-space: normal;
      font-size: var(--sw-fs-md);
    }
    .resrow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--sw-s-1) 10px;
      align-items: center;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
    }
    .resrow:first-child {
      border-block-start: 0;
    }
    .resrow .why {
      grid-column: 1 / -1;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .msg {
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .foot {
      flex: 1;
      display: flex;
      gap: var(--sw-s-2);
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .foot .foot-line {
      flex: 1 1 14em;
    }
    @media (max-width: 767px) {
      .hide-phone {
        display: none;
      }
      .cols,
      .cred {
        grid-template-columns: 1fr 1fr;
      }
      .cred .check {
        grid-column: auto;
        order: 3;
      }
      .cred sw-button {
        order: 4;
      }
      .cols {
        grid-template-columns: 1fr;
      }
      .dev {
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: var(--sw-s-1) 10px;
        padding: var(--sw-s-2) 10px;
      }
      .dev > sw-icon {
        display: none;
      }
      .dev > .st {
        justify-items: end;
      }
      .dev > .st > span:not(.chip) {
        display: none; /* the phone keeps one line per device: the chip says it, the longer note is the desktop's */
      }
      .dev > .end {
        grid-column: 2 / -1;
        justify-self: start;
      }
      .dev > .end {
        inline-size: 100%;
        justify-content: flex-start;
      }
      .pw {
        flex: 1;
      }
      .pw input {
        flex: 1;
        inline-size: auto;
        min-inline-size: 0;
      }
      .addrow {
        grid-template-columns: 112px minmax(0, 1fr);
        gap: var(--sw-s-2) 10px;
        padding: var(--sw-s-2) 10px;
      }
      .addrow .thumb {
        inline-size: 112px;
      }
      .addrow .wide {
        grid-column: 1 / -1;
      }
      .streams {
        grid-template-columns: 1fr; /* a full-width select keeps the whole "2688×1520 · H.265" label */
      }
      .list-head {
        padding: var(--sw-s-1h) 10px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.mq.addEventListener('change', this.onResize);
    window.addEventListener('resize', this.onResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onResize);
    window.removeEventListener('resize', this.onResize);
    this.stopPolling();
    // removed while open (a route change, a reload of the card): the typed pair must not outlive the dialog, here or in the scan job
    if (this.open) {
      this.user = this.password = '';
      this.rowPw = {};
      this.tried.clear();
      const job = this.job;
      if (job && job.state !== 'running') void cancelScan(job.id).catch(() => undefined);
    }
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open && !changed.get('open')) void this.reset();
  }

  // ------------------------------------------------------------------ lifecycle

  private async reset() {
    this.generation += 1;
    this.stopPolling();
    this.step = 'scan';
    this.phase = 'setup';
    this.range = this.caps?.suggested_range ?? '';
    this.job = null;
    this.devices = [];
    this.selected = new Set();
    this.user = '';
    this.password = '';
    this.sameForAll = true;
    this.rowPw = {};
    this.pressing = new Set();
    this.page = 1;
    this.drafts = {};
    this.previews = {};
    this.result = null;
    this.msg = null;
    this.busy = false;
    this.recorderFor = null;
    this.tried.clear();
    // a scan this person started earlier and that still runs (a reload, a second tab): show it instead of refusing a new one
    const gen = this.generation;
    try {
      const running = runningScan((await listScans()).scans);
      if (running && gen === this.generation && this.open) {
        this.msg = { tone: 'muted', text: cdt('resumed') };
        await this.follow(running.id);
      }
    } catch {
      /* the list is a convenience: the setup step works without it */
    }
  }

  private async close() {
    const job = this.job;
    this.generation += 1;
    this.stopPolling();
    this.open = false;
    this.user = this.password = '';
    this.rowPw = {};
    this.tried.clear();
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    // past the sweep, the scan job holds the typed password: closing forgets it (a running sweep is left to finish - reopening finds it)
    if (job && job.state !== 'running') {
      try {
        await cancelScan(job.id);
      } catch {
        /* expired or gone already */
      }
    }
  }

  private stopPolling() {
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  private async follow(id: string) {
    const gen = this.generation;
    try {
      const job = await getScan(id);
      if (gen !== this.generation) return;
      this.apply(job);
      if (job.state === 'running') this.timer = window.setTimeout(() => void this.follow(id), POLL_MS);
    } catch (err) {
      if (gen !== this.generation) return;
      this.job = null;
      this.phase = errorCode(err) === 'scan_not_found' ? 'setup' : 'failed';
      this.msg = { tone: 'bad', text: discoveryErrorText(err, this.max) };
    }
  }

  private apply(job: ScanJob) {
    this.job = job;
    this.devices = job.devices; // the sweep's own list: identification starts only after it is done
    if (job.state === 'running') {
      this.phase = 'running';
      return;
    }
    if (job.state === 'done') {
      if (!job.devices.length) {
        this.phase = 'none';
        return;
      }
      this.selected = new Set(job.devices.filter(selectable).map((d) => d.id));
      this.page = 1;
      this.step = 'identify';
      this.msg = null;
      return;
    }
    if (job.state === 'cancelled') {
      this.phase = 'setup';
      this.job = null;
      this.msg = { tone: 'muted', text: cdt('stopped') };
      return;
    }
    this.phase = 'failed';
    this.msg = { tone: 'bad', text: cdt('failed') };
  }

  private get max(): number {
    return this.caps?.max_addresses ?? 1024;
  }

  private get phone(): boolean {
    return this.mq.matches;
  }

  private get size(): number {
    return pageSize(this.step, this.phone, window.innerHeight);
  }

  // ------------------------------------------------------------------ step 1

  private async start() {
    if (this.busy || !rangeCheck(this.range, this.max).ok) return;
    this.busy = true;
    this.msg = null;
    try {
      const job = await startScan(this.range);
      this.apply(job);
      if (job.state === 'running') this.timer = window.setTimeout(() => void this.follow(job.id), POLL_MS);
    } catch (err) {
      if (errorCode(err) === 'scan_running') {
        // someone (this person in another tab) already scans: follow theirs when it is visible to us, else say so
        try {
          const running = runningScan((await listScans()).scans);
          if (running) {
            this.msg = { tone: 'muted', text: cdt('resumed') };
            await this.follow(running.id);
            return;
          }
        } catch {
          /* fall through to the refusal */
        }
      }
      this.msg = { tone: 'bad', text: discoveryErrorText(err, this.max) };
    } finally {
      this.busy = false;
    }
  }

  private async stop() {
    const job = this.job;
    if (!job || this.busy) return;
    this.busy = true;
    this.generation += 1;
    this.stopPolling();
    try {
      await cancelScan(job.id);
    } catch {
      /* gone already: the result is the same */
    } finally {
      this.busy = false;
      this.job = null;
      this.devices = [];
      this.phase = 'setup';
      this.msg = { tone: 'muted', text: cdt('stopped') };
    }
  }

  private async again() {
    const job = this.job;
    this.generation += 1;
    this.stopPolling();
    this.step = 'scan';
    this.phase = 'setup';
    this.job = null;
    this.devices = [];
    this.selected = new Set();
    this.result = null;
    this.drafts = {};
    this.previews = {};
    this.tried.clear();
    this.rowPw = {};
    this.msg = null;
    if (job) {
      try {
        await cancelScan(job.id); // the old scan's credentials are forgotten
      } catch {
        /* gone already */
      }
    }
  }

  private manual(address = '') {
    this.dispatchEvent(new CustomEvent('manual-add', { detail: { url: address ? `rtsp://${address}:554/` : '' }, bubbles: true, composed: true }));
    void this.close();
  }

  // ------------------------------------------------------------------ step 2

  private toggle(id: string, on: boolean) {
    const next = new Set(this.selected);
    if (on) next.add(id);
    else next.delete(id);
    this.selected = next;
  }

  private selectAll(on: boolean) {
    this.selected = new Set(on ? this.devices.filter(selectable).map((d) => d.id) : []);
  }

  private get pair(): string {
    return pairKey(this.user.trim(), this.password);
  }

  private async press(ids: string[], password: string, sameForAll: boolean) {
    const job = this.job;
    if (!job || !ids.length) return;
    const user = this.user.trim();
    for (const id of ids) this.tried.set(id, pairKey(user, password)); // the attempt is on its way: never this pair again
    this.pressing = new Set([...this.pressing, ...ids]);
    this.msg = null;
    try {
      const r = await identifyDevices(job.id, { device_ids: ids, username: user, password, same_for_all: sameForAll });
      this.devices = mergeDevices(this.devices, r.devices);
    } catch (err) {
      this.msg = { tone: 'bad', text: discoveryErrorText(err, this.max) };
      if (errorCode(err) === 'scan_not_found' || errorCode(err) === 'scan_not_active') this.job = null;
    } finally {
      const left = new Set(this.pressing);
      for (const id of ids) left.delete(id);
      this.pressing = left;
    }
  }

  private identifyAll() {
    const targets = identifyTargets(this.devices, this.selected, this.tried, this.pair);
    if (identifyBlock(targets, this.user, this.password, this.sameForAll)) return;
    void this.press(targets, this.password, this.sameForAll);
  }

  private retry(d: FoundDevice) {
    const pw = this.rowPw[d.id] ?? '';
    if (!retryAllowed(d, this.user, pw, this.tried)) return;
    void this.press([d.id], pw, false);
  }

  private openRecorder(d: FoundDevice) {
    this.recorderReady = !!customElements.get('nvr-connection-form');
    this.recorderFor = d;
    if (!this.recorderReady) void import('./nvr-connection-form').then(() => (this.recorderReady = true));
  }

  private toAdd() {
    const ready = this.devices.filter((d) => this.selected.has(d.id) && readyToAdd(d));
    if (!ready.length) return;
    const drafts: Record<string, Draft> = {};
    for (const d of ready) {
      const s = suggestedPair(d);
      drafts[d.id] = this.drafts[d.id] ?? { name: defaultName(d), area: '', main: s.main, sub: s.sub };
    }
    this.drafts = drafts;
    this.result = null;
    this.step = 'add';
    this.page = 1;
    this.msg = null;
    void this.loadAreas();
  }

  // ------------------------------------------------------------------ step 3

  private async loadAreas() {
    try {
      const tree = await getDevicesTree();
      this.areas = tree.floors.flatMap((f) => f.areas.map((a) => ({ id: a.area_id, name: f.floor_id === 'none' ? a.name : `${a.name} · ${f.name}` })));
    } catch {
      this.areas = []; // the area is optional
    }
  }

  private get addList(): FoundDevice[] {
    return this.devices.filter((d) => !!this.drafts[d.id]);
  }

  private setDraft(id: string, patch: Partial<Draft>) {
    this.drafts = { ...this.drafts, [id]: { ...this.drafts[id], ...patch } };
    if ('main' in patch || 'sub' in patch) {
      const { [id]: _gone, ...rest } = this.previews;
      this.previews = rest;
    }
  }

  private async preview(d: FoundDevice) {
    const job = this.job;
    const dr = this.drafts[d.id];
    if (!job || !dr || this.previews[d.id]?.state === 'loading') return;
    this.previews = { ...this.previews, [d.id]: { state: 'loading' } };
    const token = dr.sub ?? dr.main ?? undefined;
    try {
      const r = await previewDiscovered({ scan_id: job.id, device_id: d.id, profile: dr.sub ? 'sub' : 'main', ...(token ? { profile_token: token } : {}) });
      this.previews = { ...this.previews, [d.id]: r.ok ? { state: 'ok', src: r.preview } : { state: 'fail', text: r.message } };
    } catch (err) {
      this.previews = { ...this.previews, [d.id]: { state: 'fail', text: discoveryErrorText(err, this.max) } };
    }
  }

  private async add() {
    const job = this.job;
    const list = this.addList;
    if (!job || !list.length || this.busy) return;
    if (list.some((d) => !this.drafts[d.id].name.trim())) {
      this.msg = { tone: 'bad', text: cdt('nameRequired') };
      return;
    }
    this.busy = true;
    this.msg = null;
    try {
      const r = await addDiscovered(job.id, list.map((d) => {
        const dr = this.drafts[d.id];
        return { device_id: d.id, name: dr.name.trim(), area_id: dr.area || null, ...(dr.main ? { main_profile: dr.main } : {}), ...(dr.sub ? { sub_profile: dr.sub } : {}) };
      }));
      this.result = r;
      this.page = 1;
      if (r.added.length) this.dispatchEvent(new CustomEvent('added', { detail: { added: r.added }, bubbles: true, composed: true }));
    } catch (err) {
      this.msg = { tone: 'bad', text: discoveryErrorText(err, this.max) };
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------ render

  private chip(text: string, tone: Tone = 'muted', attr = '') {
    return html`<span class="chip" data-tone=${tone} data-chip=${attr || nothing}>${text}</span>`;
  }

  private renderSetup() {
    const check = rangeCheck(this.range, this.max);
    const max = this.max.toLocaleString('en-US');
    return html`<div class="cols">
      <section class="panel" data-discovery-setup>
        <sw-field label=${cdt('rangeLabel')}>
          <input dir="ltr" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="43" data-discovery-range
            placeholder=${this.caps?.suggested_range ?? ''} .value=${this.range} aria-invalid=${check.ok ? 'false' : 'true'}
            @input=${(e: Event) => (this.range = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.start(); }} />
        </sw-field>
        <p class="help">${cdt('rangeHelp')}</p>
        <p class="help" data-discovery-cap>${cdt('rangeCap', { max })}</p>
        ${check.text ? html`<p class=${`msg tone-${check.tone}`} data-discovery-range-check=${check.ok ? 'ok' : 'bad'}>${check.text}</p>` : nothing}
      </section>
      <section class="panel facts" aria-labelledby="cd-facts">
        <h4 id="cd-facts">${cdt('doesTitle')}</h4>
        <div class="row"><span>${cdt('doesRead')}</span>${this.chip(cdt('yes'), 'ok')}</div>
        <div class="row"><span>${cdt('doesChange')}</span>${this.chip(cdt('never'))}</div>
        <div class="row"><span>${cdt('doesGuess')}<small>${cdt('doesGuessNote')}</small></span>${this.chip(cdt('never'))}</div>
        <div class="row"><span>${cdt('doesStore')}<small>${cdt('doesStoreNote')}</small></span>${this.chip(cdt('onlyOnAdd'), 'accent')}</div>
      </section>
    </div>`;
  }

  private renderRunning() {
    const job = this.job;
    if (!job) return nothing;
    const pct = progressPct(job);
    const shown = this.phone ? 3 : 5;
    const recent = job.devices.slice(-shown);
    const more = job.devices.length - recent.length;
    return html`<section class="panel" data-discovery-running>
        <h4>${cdt('searching', { range: ltrIsolate(job.range) })}</h4>
        <div class="prog" role="progressbar" aria-label=${cdt('progressLabel')} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct} data-discovery-progress=${pct}>
          <i style=${`inline-size:${pct}%`}></i>
        </div>
        <div class="stats">
          <span data-discovery-checked>${cdt('checked', { checked: job.progress.checked.toLocaleString('en-US'), total: job.progress.total.toLocaleString('en-US') })}</span>
          <span data-discovery-found>${cdt('foundCount', { n: job.devices.length })}</span>
        </div>
      </section>
      <section class="list" aria-live="polite" aria-labelledby="cd-sofar">
        <div class="list-head"><h4 id="cd-sofar">${cdt('foundSoFar')}</h4>${more > 0 ? html`<span class="note">${cdt('moreFound', { n: more })}</span>` : nothing}</div>
        ${recent.length
          ? recent.map((d) => html`<div class="dev" data-discovery-live=${d.id}><span></span><sw-icon name=${ICON[rowClass(d)]}></sw-icon>
              <div class="who"><div class="t">${cdt(KIND_TEXT[rowClass(d)])}</div><div class="d"><span class="ip">${d.address}</span></div></div><span></span><span></span></div>`)
          : html`<div class="dev"><span></span><span></span><div class="note">${cdt('noneYet')}</div><span></span><span></span></div>`}
      </section>`;
  }

  private renderNone() {
    const range = this.job?.range ?? this.range;
    return html`<section class="panel empty" data-discovery-none>
      <sw-icon name="search"></sw-icon>
      <h4>${cdt('noneTitle', { range: ltrIsolate(range) })}</h4>
      <ul>
        <li>${cdt('noneOther')}</li>
        <li>${cdt('nonePoe')}</li>
        <li>${cdt('noneOnvif')}</li>
      </ul>
      <div class="btns">
        <sw-button variant="primary" icon="search" data-discovery-other @click=${() => void this.again()}>${cdt('otherRange')}</sw-button>
        <sw-button icon="plus" data-discovery-manual @click=${() => this.manual()}>${cdt('addManual')}</sw-button>
      </div>
    </section>`;
  }

  private renderDevice(d: FoundDevice) {
    const cls = rowClass(d);
    const can = selectable(d);
    const mark = rowMark(d);
    const st = authState(d);
    const pressing = this.pressing.has(d.id);
    const title = [d.manufacturer, d.model].filter(Boolean).join(' ') || d.name || cdt(KIND_TEXT[cls]);
    const clock = clockNote(d.clock_offset_s);
    const rowPw = this.rowPw[d.id] ?? '';
    let status: TemplateResult;
    if (mark) {
      status = html`${this.chip(cdt(mark.key), mark.tone, 'mark')}${mark.note ? html`<span>${cdt(mark.note)}</span>` : nothing}`;
    } else if (pressing) {
      status = html`<span data-discovery-identifying><span class="spin" aria-hidden="true"></span> ${cdt('identifying')}</span>`;
    } else {
      status = html`${this.chip(st.text, st.tone, 'auth')}${st.note ? html`<span>${st.note}</span>` : nothing}`;
    }
    const retryRow = !mark && !pressing && d.auth === 'wrong_password' && can
      ? html`<span class="pw"><input type="password" autocomplete="new-password" maxlength="128" data-discovery-row-pw=${d.id}
            aria-label=${cdt('rowPassword', { addr: d.address })} placeholder=${cdt('rowPasswordPh')} .value=${rowPw}
            @input=${(e: Event) => (this.rowPw = { ...this.rowPw, [d.id]: (e.target as HTMLInputElement).value })}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.retry(d); }} />
          <sw-button size="sm" ?disabled=${!retryAllowed(d, this.user, rowPw, this.tried)} data-discovery-row-try=${d.id} @click=${() => this.retry(d)}>${cdt('rowTry')}</sw-button></span>`
      : nothing;
    const noStream = can && (d.auth === 'not_onvif' || d.auth === 'digest_required' || (d.auth === 'ok' && !usableProfiles(d).length));
    return html`<div class=${`dev${can ? '' : ' dim'}`} data-discovery-device=${d.id} data-kind=${cls} data-known=${d.known} data-auth=${d.auth}>
      <input type="checkbox" .checked=${can && this.selected.has(d.id)} ?disabled=${!can} data-discovery-select=${d.id}
        aria-label=${can ? cdt('selectRow', { addr: d.address }) : cdt('cannotSelect', { addr: d.address })}
        @change=${(e: Event) => this.toggle(d.id, (e.target as HTMLInputElement).checked)} />
      <sw-icon name=${ICON[cls]} aria-hidden="true"></sw-icon>
      <div class="who">
        <div class="t">${title}</div>
        <div class="d"><span class="ip">${d.address}</span>${d.firmware ? html`<span>· ${ltrIsolate(d.firmware)}</span>` : nothing}${clock ? this.chip(clock, 'warn') : nothing}</div>
      </div>
      <div class="st" data-discovery-status>${status}</div>
      ${retryRow !== nothing || offersRecorder(d) || noStream
        ? html`<div class="end">
            ${retryRow}
            ${offersRecorder(d) ? html`<sw-button size="sm" icon="storage" data-discovery-as-recorder=${d.id} @click=${() => this.openRecorder(d)}>${cdt('addAsRecorder')}</sw-button>` : nothing}
            ${noStream ? html`<sw-button size="sm" variant="ghost" icon="plus" data-discovery-row-manual=${d.id} @click=${() => this.manual(d.address)}>${cdt('addManual')}</sw-button>` : nothing}
          </div>`
        : nothing}
    </div>`;
  }

  private renderIdentify() {
    const job = this.job;
    const devs = this.devices;
    const targets = identifyTargets(devs, this.selected, this.tried, this.pair);
    const block = identifyBlock(targets, this.user, this.password, this.sameForAll);
    const busy = this.pressing.size > 0;
    const slice = pageSlice(devs, this.page, this.size);
    const anySelectable = devs.some(selectable);
    const allOn = anySelectable && devs.filter(selectable).every((d) => this.selected.has(d.id));
    const blockText = block === 'same' ? cdt('needSame') : '';
    return html`${job ? html`<p class="lead hide-phone" data-discovery-found-line>${cdt('foundLine', { n: devs.length, range: ltrIsolate(job.range) })}</p>` : nothing}
      <section class="panel" aria-labelledby="cd-cred" data-discovery-cred>
        <h4 id="cd-cred">${cdt('credTitle')}</h4>
        <p class="help">${cdt('credLead')}</p>
        <div class="cred">
          <sw-field label=${cdt('user')}><input dir="ltr" autocomplete="off" spellcheck="false" maxlength="64" data-discovery-user .value=${this.user}
            @input=${(e: Event) => (this.user = (e.target as HTMLInputElement).value)} /></sw-field>
          <sw-field label=${cdt('password')}><input type="password" autocomplete="new-password" maxlength="128" data-discovery-password .value=${this.password}
            @input=${(e: Event) => (this.password = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.identifyAll(); }} /></sw-field>
          <sw-button variant="primary" icon="lock" ?disabled=${!!block || busy} data-discovery-identify @click=${() => this.identifyAll()}>
            ${busy ? cdt('identifying') : targets.length > 1 ? cdt('identify', { n: targets.length }) : targets.length ? cdt('identifyOne') : cdt('stepIdentify')}</sw-button>
          <label class="check"><sw-toggle size="sm" labelHidden in-label label=${cdt('sameForAll')} .checked=${this.sameForAll} data-discovery-same
            @change=${(e: Event) => (this.sameForAll = toggled(e))}></sw-toggle>${cdt('sameForAll')}</label>
        </div>
        <p class="help hide-phone">${cdt('sameForAllNote')}</p>
        ${blockText ? html`<p class="msg tone-warn" data-discovery-block=${block}>${blockText}</p>` : nothing}
      </section>
      <section class="list" aria-labelledby="cd-devs">
        <div class="list-head">
          <h4 id="cd-devs"><span class="hide-phone">${cdt('devicesTitle')}</span></h4>
          ${anySelectable ? html`<sw-button size="sm" variant="ghost" data-discovery-select-all @click=${() => this.selectAll(!allOn)}>${allOn ? cdt('selectNone') : cdt('selectAll')}</sw-button>` : nothing}
          <sw-pager .page=${slice.page} .pages=${slice.pages} data-discovery-pager @page-change=${(e: CustomEvent<{ page: number }>) => (this.page = e.detail.page)}></sw-pager>
        </div>
        <div aria-live="polite">${slice.items.map((d) => this.renderDevice(d))}</div>
      </section>`;
  }

  private renderAddRow(d: FoundDevice) {
    const dr = this.drafts[d.id];
    const pv = this.previews[d.id];
    const usable = usableProfiles(d);
    const media = sourceControls(webrtcServer(), { ready: true, testing: pv?.state === 'loading' });
    const thumb = pv?.state === 'ok'
      ? html`<img src=${pv.src ?? ''} alt=${cdt('previewAlt', { name: dr.name })} />`
      : pv?.state === 'loading'
        ? html`<span role="status"><span class="spin" aria-hidden="true"></span> ${cdt('previewing')}</span>`
        : html`<span>${pv?.state === 'fail' ? html`<span class="tone-bad" data-discovery-preview-fail>${pv.text || cdt('previewFailed')}</span><br />` : nothing}
            <sw-button size="sm" variant="ghost" icon="eye" ?disabled=${!media.canTest} data-discovery-preview=${d.id} @click=${() => void this.preview(d)}>${cdt('preview')}</sw-button></span>`;
    return html`<div class="addrow" data-discovery-add-row=${d.id}>
      <div class="thumb" data-discovery-thumb=${pv?.state ?? 'none'}>${thumb}</div>
      <sw-field label=${cdt('name')}><input maxlength="120" data-discovery-name=${d.id} .value=${dr.name}
        aria-invalid=${dr.name.trim() ? 'false' : 'true'} @input=${(e: Event) => this.setDraft(d.id, { name: (e.target as HTMLInputElement).value })} /></sw-field>
      <sw-field label=${cdt('area')}><select data-discovery-area=${d.id} @change=${(e: Event) => this.setDraft(d.id, { area: (e.target as HTMLSelectElement).value })}>
        <option value="" ?selected=${!dr.area}>${cdt('noArea')}</option>
        ${this.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === dr.area}>${a.name}</option>`)}
      </select></sw-field>
      <div class="wide">
        <div class="streams">
          <sw-field label=${cdt('mainStream')}><select data-discovery-main=${d.id} @change=${(e: Event) => {
            const main = (e.target as HTMLSelectElement).value;
            this.setDraft(d.id, { main, sub: dr.sub === main ? null : dr.sub });
          }}>${usable.map((p) => html`<option value=${p.token} ?selected=${p.token === dr.main}>${profileLabel(p)}</option>`)}</select></sw-field>
          <sw-field label=${cdt('subStream')}><select data-discovery-sub=${d.id} @change=${(e: Event) => this.setDraft(d.id, { sub: (e.target as HTMLSelectElement).value || null })}>
            <option value="" ?selected=${!dr.sub}>${cdt('sameAsMain')}</option>
            ${usable.filter((p) => p.token !== dr.main).map((p) => html`<option value=${p.token} ?selected=${p.token === dr.sub}>${profileLabel(p)}</option>`)}
          </select></sw-field>
        </div>
        ${needsH265Note(d, dr.main) ? html`<p class="help" data-discovery-h265>${cdt('h265Note')}</p>` : nothing}
      </div>
    </div>`;
  }

  private renderAdd() {
    const r = this.result;
    if (r) {
      const s = addSummary(r);
      const names = new Map(this.addList.map((d) => [d.id, this.drafts[d.id]?.name ?? d.address]));
      // the cameras that were not added first: they are the ones that need a decision
      const rows = [...r.failed.map((f) => ({ id: f.device_id, ok: false, why: addFailureText(f) })), ...r.added.map((a) => ({ id: a.device_id, ok: true, why: '' }))];
      const slice = pageSlice(rows, this.page, this.phone ? 5 : 8);
      return html`<div class="result" role="status" data-discovery-result=${s.tone}>
          <sw-icon class=${`tone-${s.tone}`} name=${s.tone === 'ok' ? 'check' : 'warning'}></sw-icon>
          <div><div class="t">${s.title}</div>${r.added.length ? html`<div class="note">${cdt('doneNote')}</div>` : nothing}</div>
        </div>
        <section class="list">
          ${slice.pages > 1 ? html`<div class="list-head"><span style="flex:1"></span><sw-pager .page=${slice.page} .pages=${slice.pages} @page-change=${(e: CustomEvent<{ page: number }>) => (this.page = e.detail.page)}></sw-pager></div>` : nothing}
          ${slice.items.map((x) => html`<div class="resrow" data-discovery-result-row=${x.id} data-ok=${x.ok ? 'true' : 'false'}>
            <span class="t">${names.get(x.id) ?? x.id}</span>${this.chip(x.ok ? cdt('rowAdded') : cdt('rowFailed'), x.ok ? 'ok' : 'bad')}
            ${x.why ? html`<span class="why">${x.why}</span>` : nothing}</div>`)}
        </section>`;
    }
    const list = this.addList;
    const slice = pageSlice(list, this.page, this.size);
    const media = sourceControls(webrtcServer(), { ready: true, testing: false });
    return html`<p class="lead">${cdt('addLead')}</p>
      ${media.note ? html`<p class="msg tone-warn" data-webrtc-required>${media.note}</p>` : nothing}
      <section class="list" aria-label=${cdt('stepAdd')}>
        ${slice.pages > 1 ? html`<div class="list-head"><span style="flex:1"></span><sw-pager .page=${slice.page} .pages=${slice.pages} data-discovery-pager @page-change=${(e: CustomEvent<{ page: number }>) => (this.page = e.detail.page)}></sw-pager></div>` : nothing}
        ${slice.items.map((d) => this.renderAddRow(d))}
      </section>
      <p class="note" data-discovery-add-foot>${cdt('addFoot', { n: list.length })}</p>`;
  }

  private footer() {
    if (this.step === 'scan') {
      if (this.phase === 'running') {
        return html`<sw-button variant="danger" icon="close" ?disabled=${this.busy} data-discovery-stop @click=${() => void this.stop()}>${this.busy ? cdt('stopping') : cdt('stop')}</sw-button>
          <sw-button variant="ghost" @click=${() => void this.close()}>${cdt('close')}</sw-button>`;
      }
      if (this.phase === 'setup' || this.phase === 'failed') {
        return html`<sw-button variant="primary" icon="search" ?disabled=${this.busy || !rangeCheck(this.range, this.max).ok} data-discovery-start @click=${() => void this.start()}>${cdt('start')}</sw-button>
          <sw-button variant="ghost" @click=${() => void this.close()}>${cdt('close')}</sw-button>`;
      }
      return html`<sw-button variant="ghost" @click=${() => void this.close()}>${cdt('close')}</sw-button>`;
    }
    if (this.step === 'identify') {
      const sum = identifySummary(this.devices, this.selected);
      return html`<span class="foot-line hide-phone" data-discovery-summary>${sum.ok || sum.bad ? cdt('summaryIdentify', sum) : cdt('pickHint')}</span>
        <sw-button variant="primary" icon="check" ?disabled=${!sum.ok || this.pressing.size > 0} data-discovery-next @click=${() => this.toAdd()}>${sum.ok ? cdt('next', { n: sum.ok }) : cdt('nextNone')}</sw-button>
        <sw-button variant="ghost" icon="refresh" data-discovery-again @click=${() => void this.again()}>${cdt('otherRange')}</sw-button>`;
    }
    if (this.result) {
      return html`<sw-button variant="primary" icon="check" data-discovery-finish @click=${() => void this.close()}>${cdt('finish')}</sw-button>`;
    }
    const n = this.addList.length;
    const canAdd = sourceControls(webrtcServer(), { ready: true, testing: false }).canAdd;
    return html`<sw-button variant="primary" icon="plus" ?disabled=${this.busy || !n || !canAdd} data-discovery-add @click=${() => void this.add()}>${this.busy ? cdt('adding') : cdt('addN', { n })}</sw-button>
      <sw-button variant="ghost" data-discovery-back @click=${() => { this.step = 'identify'; this.page = 1; this.msg = null; }}>${cdt('back')}</sw-button>`;
  }

  render() {
    if (!this.open) return nothing;
    const stepIndex = this.step === 'scan' ? 0 : this.step === 'identify' ? 1 : 2;
    const content = this.step === 'scan'
      ? this.phase === 'running'
        ? this.renderRunning()
        : this.phase === 'none'
          ? this.renderNone()
          : this.renderSetup()
      : this.step === 'identify'
        ? this.renderIdentify()
        : this.renderAdd();
    const rec = this.recorderFor;
    return html`<sw-dialog open xl heading=${cdt('title')} subheading=${this.step === 'scan' || !this.phone ? cdt('sub') : ''} data-camera-discovery=${this.step} data-phase=${this.phase}
        @close=${(e: Event) => { e.stopPropagation(); void this.close(); }}>
        <div class="body">
          <sw-steps .steps=${[cdt('stepScan'), cdt('stepIdentify'), cdt('stepAdd')]} .current=${stepIndex}></sw-steps>
          ${content}
          ${this.msg ? html`<p class=${`msg tone-${this.msg.tone}`} role=${this.msg.tone === 'bad' ? 'alert' : 'status'} data-discovery-msg>${this.msg.text}</p>` : nothing}
        </div>
        <div slot="footer" class="foot">${this.footer()}</div>
      </sw-dialog>
      ${rec?.recorder_prefill
        ? html`<sw-dialog open wide heading=${cdt('addRecorderTitle')} data-discovery-recorder-dialog
            @close=${(e: Event) => { e.stopPropagation(); this.recorderFor = null; }}>
            ${this.recorderReady
              ? html`<nvr-connection-form context="add" .prefill=${rec.recorder_prefill}
                  @nvr-recorder-added=${() => { this.recorderFor = null; this.msg = { tone: 'ok', text: cdt('recorderAdded') }; }}></nvr-connection-form>`
              : html`<span class="spin" aria-hidden="true"></span>`}
          </sw-dialog>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'camera-discovery-dialog': CameraDiscoveryDialog;
  }
}
