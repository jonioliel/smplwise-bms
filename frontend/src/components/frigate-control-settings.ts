import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-toggle';
import './sw-button';
import './sw-dialog';
import './sw-tabs';
import './frigate-auto-profile';
import './frigate-exports-panel';
import './frigate-cases-panel';
import './frigate-manual-events';
import './frigate-supervision';
import { describeError } from '../api/client';
import { can, canAnywhere } from '../api/session';
import { frigateCameras, type WireCamera } from '../api/frigate';
import {
  alarmText, changeLine, getChanges, getFirstWrites, getPolicy, getProfiles, isFirstWriteRefusal, putPolicy, putProfileRules, revertChange, visibleClasses,
  type ChangeRow, type ControlPolicy, type FirstWrites, type ProfilesView, type SupervisedKind, type WriteClass,
} from '../api/frigate-control';
import { fx, frigateLocale } from '../i18n/frigate-text';
import { adminStyles } from './frigate-admin-shared';

type Tab = 'classes' | 'profiles' | 'exports' | 'cases' | 'events' | 'log' | 'supervision';
const TABS: Tab[] = ['classes', 'profiles', 'exports', 'cases', 'events', 'log', 'supervision'];

/** The inverse kind an undo of a change performs (its first supervised write): absent = the undo is not gated. */
const UNDO_KIND: Record<string, SupervisedKind> = { export_create: 'export_delete', export_rename: 'export_rename', case_create: 'case_delete', case_rename: 'case_rename', event_create: 'event_end' };

/**
 * NN5-F2 / FRGD: management of the writes toward ONE Frigate recorder (Settings only), as one card with tabs: the write classes (all off until
 * switched on here), the profiles (the alarm-state mapping and the automatic profile), exports, cases, manual events, the change log with
 * undo, and the supervision view (first supervised writes, the supervised clip read). Each tab is gated by the permission the API enforces:
 * system.configure switches classes and the automatic profile; analytics.exports / analytics.cases / analytics.events open their tabs;
 * analytics.profile applies a suggestion; video.playback reads a clip. The operator's camera drawer is `frigate-camera-control`. Tokens only.
 */
@customElement('frigate-control-settings')
export class FrigateControlSettings extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @state() private tab: Tab = 'classes';
  @state() private policy: ControlPolicy | null = null;
  @state() private profiles: ProfilesView | null = null;
  @state() private changes: ChangeRow[] = [];
  @state() private first: FirstWrites | null = null;
  @state() private cams: WireCamera[] = [];
  @state() private failed = false;
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private undoing: { row: ChangeRow; supervised: boolean; error: string } | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.policy = await getPolicy(this.recorderId);
      this.failed = false;
    } catch {
      this.failed = true;
      return;
    }
    const [p, c, f, cams] = await Promise.allSettled([getProfiles(this.recorderId), getChanges(this.recorderId), getFirstWrites(this.recorderId), frigateCameras(this.recorderId)]);
    this.profiles = p.status === 'fulfilled' ? p.value : null;
    this.changes = c.status === 'fulfilled' ? c.value.changes : [];
    this.first = f.status === 'fulfilled' ? f.value : null;
    this.cams = cams.status === 'fulfilled' ? cams.value : [];
  }

  /** A child wrote something: the log and the first-write flags are re-read (the children re-read their own lists). */
  private async afterWrite() {
    const [c, f, p] = await Promise.allSettled([getChanges(this.recorderId), getFirstWrites(this.recorderId), getPolicy(this.recorderId)]);
    if (c.status === 'fulfilled') this.changes = c.value.changes;
    if (f.status === 'fulfilled') this.first = f.value;
    if (p.status === 'fulfilled') this.policy = p.value;
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 4000);
  }

  private async toggle(cls: WriteClass, e: Event) {
    const el = e.currentTarget as HTMLElement & { checked: boolean };
    const on = el.checked;
    this.busy = true;
    try {
      await putPolicy(this.recorderId, { [cls]: on });
      this.policy = await getPolicy(this.recorderId);
      this.dispatchEvent(new CustomEvent('frigate-control-policy', { detail: { anyOn: this.policy.classes.some((c) => c.enabled) }, bubbles: true, composed: true }));
    } catch (err) {
      el.checked = !on;
      this.flash('err', describeError(err));
    } finally {
      this.busy = false;
    }
  }

  private async rule(state: string, e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    this.busy = true;
    try {
      const r = await putProfileRules(this.recorderId, { [state]: v || null });
      if (this.profiles) this.profiles = { ...this.profiles, rules: r.rules };
    } catch (err) {
      this.flash('err', describeError(err));
      void this.load();
    } finally {
      this.busy = false;
    }
  }

  private async undo(row: ChangeRow, confirm: boolean, supervised = false) {
    this.busy = true;
    try {
      await revertChange(this.recorderId, row.id, confirm, supervised);
      this.undoing = null;
      this.flash('ok', fx().control.settings.undone);
      void this.afterWrite();
    } catch (err) {
      if (this.undoing) this.undoing = { ...this.undoing, error: isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : describeError(err) };
      else this.flash('err', isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : describeError(err));
    } finally {
      this.busy = false;
    }
  }

  /** Recording, profile and the destroying undos (an export / case create) ask first; so does any undo whose inverse kind is still unsupervised. */
  private onUndo(c: ChangeRow) {
    const kind = UNDO_KIND[c.kind];
    const gated = !!kind && !!this.first && !this.first.done[kind];
    if (c.class === 'record' || c.class === 'profile' || c.kind === 'export_create' || c.kind === 'case_create' || gated) this.undoing = { row: c, supervised: false, error: '' };
    else void this.undo(c, false);
  }

  static styles = [adminStyles, css`
    .box {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .box > .head h4 {
      font-size: var(--sw-fs-md);
    }
    sw-tabs {
      max-inline-size: 100%;
    }
    .classes {
      display: grid;
      gap: 2px;
    }
    .classes .row {
      padding: var(--sw-s-1) 0;
      border-block-start: 1px solid var(--sw-border);
    }
    .classes .row:first-child {
      border-block-start: 0;
    }
    .classes .sub {
      display: flex;
      flex-wrap: wrap;
      gap: 4px var(--sw-s-2);
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      min-block-size: 32px;
      max-inline-size: 50%;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    li.change {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-block-size: 44px;
    }
    li.change:first-child {
      border-block-start: 0;
    }
    li.change .what {
      display: grid;
      gap: 2px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    li.change .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .tag {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-inline-start: 4px;
    }
    .tag.bad {
      color: var(--sw-danger-text);
    }
  `];

  private timeText(iso: string): string {
    try {
      return new Date(iso).toLocaleString(frigateLocale(), { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  private statusTag(c: ChangeRow) {
    const t = fx().control.settings;
    if (c.status === 'reverted') return html`<span class="tag" data-change-status="reverted">${t.reverted}</span>`;
    if (c.status === 'failed') return html`<span class="tag bad" data-change-status="failed">${t.failed}</span>`;
    if (c.status === 'unverified') return html`<span class="tag" data-change-status="unverified">${t.unverified}</span>`;
    return nothing;
  }

  private classesTab(pol: ControlPolicy) {
    const t = fx().control.settings;
    const lock = this.busy || !can('system.configure');
    return html`<div class="classes" data-fcs-classes>
      ${visibleClasses(pol).map((c) => html`<div class="row" data-fcs-class=${c.class}>
        <span class="name"><span>${t.classes[c.class]}</span>
          <span class="sub">${c.per_action ? html`<span>${t.perAction}</span>` : nothing}${c.confirm_actions?.includes('delete') ? html`<span>${t.confirmDelete}</span>` : nothing}<span dir="ltr">${c.permission}</span></span></span>
        <sw-toggle .checked=${c.enabled} ?disabled=${lock || !c.available} labelHidden label=${t.classes[c.class]} data-fcs-toggle=${c.class} @change=${(e: Event) => void this.toggle(c.class, e)}></sw-toggle>
      </div>`)}
    </div>`;
  }

  private profilesTab() {
    const t = fx().control.settings;
    const prof = this.profiles;
    const lock = this.busy || !can('system.configure');
    return html`${prof && prof.names.length ? html`<div data-fcs-rules>
        <h4>${t.rules}</h4>
        ${prof.alarm_states.filter((s) => ['disarmed', 'armed_home', 'armed_away', 'armed_night'].includes(s)).map((s) => html`<div class="row">
          <span>${alarmText(s)}</span>
          <select aria-label=${alarmText(s)} data-fcs-rule=${s} .value=${prof.rules[s] ?? ''} ?disabled=${lock} @change=${(e: Event) => void this.rule(s, e)}>
            <option value="">${t.rulesNone}</option>
            ${prof.names.map((n) => html`<option value=${n} ?selected=${prof.rules[s] === n}>${n}</option>`)}
          </select>
        </div>`)}
      </div>` : nothing}
      <frigate-auto-profile recorder-id=${this.recorderId} .first=${this.first} .canConfigure=${can('system.configure')} .canProfile=${canAnywhere('analytics.profile')} @frigate-changed=${() => void this.afterWrite()}></frigate-auto-profile>`;
  }

  private logTab() {
    const t = fx().control.settings;
    return html`<div data-fcs-log>
      ${this.changes.length
        ? html`<ul>${this.changes.map((c) => html`<li class="change" data-change=${c.id}>
            <span class="what"><span>${changeLine(c)}${this.statusTag(c)}</span><span class="meta">${this.timeText(c.at)}${c.actor ? ` · ${c.actor}` : ''}${c.camera_key && c.camera_key !== '*' ? ` · ${this.cams.find((x) => x.id === c.camera_id)?.name ?? c.camera_key}` : ''}</span></span>
            ${c.reversible ? html`<sw-button size="sm" variant="ghost" data-change-undo ?disabled=${this.busy} @click=${() => this.onUndo(c)}>${t.undo}</sw-button>` : nothing}
          </li>`)}</ul>`
        : html`<p class="note" data-fcs-log-empty>${t.logEmpty}</p>`}
    </div>`;
  }

  private undoDialog() {
    const u = this.undoing;
    if (!u) return nothing;
    const t = fx().control.settings;
    const c = fx().control;
    const kind = UNDO_KIND[u.row.kind];
    const needSup = !!kind && !!this.first && this.first.can_supervise && !this.first.done[kind];
    const blocked = !!kind && !!this.first && !this.first.done[kind] && !this.first.can_supervise;
    return html`<sw-dialog open heading=${`${t.undo}: ${changeLine(u.row)}`} data-fcs-confirm @close=${() => (this.undoing = null)}>
      <div class="form">
        ${needSup ? html`<label class="sup" data-supervised-box=${kind}><input type="checkbox" .checked=${u.supervised} @change=${(e: Event) => (this.undoing = { ...u, supervised: (e.target as HTMLInputElement).checked })} /><span><b>${t.supervised.label}</b> · ${t.supervised.hint}</span></label>` : nothing}
        ${blocked ? html`<div class="err" data-fcs-undo-blocked>${t.supervised.need}</div>` : nothing}
        ${u.error ? html`<div class="err" role="alert" data-fcs-undo-error>${u.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.undoing = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcs-ok ?disabled=${this.busy || blocked || (needSup && !u.supervised)} @click=${() => void this.undo(u.row, true, u.supervised)}>${c.confirm}</sw-button>
    </sw-dialog>`;
  }

  /** The tabs the caller may see: a class tab needs its permission (the API refuses the list otherwise). */
  private tabs(): Tab[] {
    const admin = can('system.configure');
    return TABS.filter((t) => {
      if (t === 'exports') return admin || canAnywhere('analytics.exports');
      if (t === 'cases') return admin || canAnywhere('analytics.cases');
      if (t === 'events') return admin || canAnywhere('analytics.events');
      return true;
    });
  }

  render() {
    const t = fx().control.settings;
    if (this.failed) return html`<div class="note" data-fcs-failed>${t.unavailable}</div>`;
    const pol = this.policy;
    if (!pol) return nothing;
    const tabs = this.tabs();
    const tab = tabs.includes(this.tab) ? this.tab : tabs[0];
    const enabled = (cls: WriteClass) => pol.classes.some((c) => c.class === cls && c.enabled);
    const admin = can('system.configure');
    const tz = '';
    return html`<div class="box" data-frigate-control-settings>
      <div class="head"><h4>${t.title}</h4>${pol.classes.some((c) => c.enabled) ? html`<span class="chip accent" data-fcs-any-on>${pol.classes.filter((c) => c.enabled).length} ${t.classesOn}</span>` : html`<span class="chip" data-fcs-all-off>${fx().summary.readOnly}</span>`}</div>
      <sw-tabs variant="underline-compact" data-fcs-tabs .items=${tabs.map((id) => ({ id, label: t.tabs[id] }))} .active=${tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id as Tab)}></sw-tabs>
      ${tab === 'classes' ? this.classesTab(pol) : nothing}
      ${tab === 'profiles' ? this.profilesTab() : nothing}
      ${tab === 'exports' ? html`<frigate-exports-panel recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .allowed=${admin || canAnywhere('analytics.exports')} tz=${tz} @frigate-changed=${() => void this.afterWrite()}></frigate-exports-panel>` : nothing}
      ${tab === 'cases' ? html`<frigate-cases-panel recorder-id=${this.recorderId} .first=${this.first} .allowed=${admin || canAnywhere('analytics.cases')} tz=${tz} @frigate-changed=${() => void this.afterWrite()}></frigate-cases-panel>` : nothing}
      ${tab === 'events' ? html`<frigate-manual-events recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .changes=${this.changes} .enabled=${enabled('events')} .allowed=${admin || canAnywhere('analytics.events')} tz=${tz} @frigate-changed=${() => void this.afterWrite()}></frigate-manual-events>` : nothing}
      ${tab === 'log' ? this.logTab() : nothing}
      ${tab === 'supervision' ? html`<frigate-supervision recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .canPlayback=${canAnywhere('video.playback')}></frigate-supervision>` : nothing}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fcs-msg>${this.msg.text}</div>` : nothing}
      ${this.undoDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-control-settings': FrigateControlSettings;
  }
}
