import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-toggle';
import './sw-button';
import './sw-dialog';
import { describeError } from '../api/client';
import {
  alarmText, changeLine, getChanges, getPolicy, getProfiles, putPolicy, putProfileRules, revertChange, visibleClasses,
  type ChangeRow, type ControlPolicy, type ProfilesView, type WriteClass,
} from '../api/frigate-control';
import { he } from '../i18n/he';

/**
 * NN5-F2: management of the writes toward ONE Frigate recorder (Settings only): which write classes are on (all off until switched on
 * here), which profile each alarm state suggests (a mapping: nothing is switched by it), and the change log with undo. The operator's
 * camera drawer is `frigate-camera-control`. Tokens only.
 */
@customElement('frigate-control-settings')
export class FrigateControlSettings extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @state() private policy: ControlPolicy | null = null;
  @state() private profiles: ProfilesView | null = null;
  @state() private changes: ChangeRow[] = [];
  @state() private failed = false;
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private undoing: ChangeRow | null = null;

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
    const [p, c] = await Promise.allSettled([getProfiles(this.recorderId), getChanges(this.recorderId)]);
    this.profiles = p.status === 'fulfilled' ? p.value : null;
    this.changes = c.status === 'fulfilled' ? c.value.changes : [];
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

  private async undo(c: ChangeRow, confirm: boolean) {
    this.busy = true;
    try {
      await revertChange(this.recorderId, c.id, confirm);
      this.undoing = null;
      this.flash('ok', he.frigate.control.settings.undone);
      this.changes = (await getChanges(this.recorderId)).changes;
    } catch (err) {
      this.undoing = null;
      this.flash('err', describeError(err));
    } finally {
      this.busy = false;
    }
  }

  private onUndo(c: ChangeRow) {
    if (c.class === 'record' || c.class === 'profile') this.undoing = c;
    else void this.undo(c, false);
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
      font-size: var(--sw-fs-sm);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      margin: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-1);
    }
    .row .name {
      display: grid;
      min-inline-size: 0;
    }
    .row .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      max-inline-size: 50%;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--sw-s-1);
    }
    li.change {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding-block: var(--sw-s-1);
      border-block-start: 1px solid var(--sw-border);
    }
    li.change .what {
      display: grid;
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
    }
    .tag.bad {
      color: var(--sw-danger-text);
    }
    .msg.ok {
      color: var(--sw-success-text);
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
  `;

  private timeText(iso: string): string {
    try {
      return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  private statusTag(c: ChangeRow) {
    const t = he.frigate.control.settings;
    if (c.status === 'reverted') return html`<span class="tag" data-change-status="reverted">${t.reverted}</span>`;
    if (c.status === 'failed') return html`<span class="tag bad" data-change-status="failed">${t.failed}</span>`;
    if (c.status === 'unverified') return html`<span class="tag" data-change-status="unverified">${t.unverified}</span>`;
    return nothing;
  }

  render() {
    const t = he.frigate.control.settings;
    if (this.failed) return html`<div class="note" data-fcs-failed>${t.unavailable}</div>`;
    const pol = this.policy;
    if (!pol) return nothing;
    const prof = this.profiles;
    return html`<div class="box" data-frigate-control-settings>
      <h4>${t.title}</h4>
      <p class="note">${t.intro}</p>
      <div data-fcs-classes>
        ${visibleClasses(pol).map((c) => html`<div class="row" data-fcs-class=${c.class}>
          <span class="name"><span>${t.classes[c.class]}</span>${c.per_action ? html`<span class="sub">${t.perAction}</span>` : nothing}</span>
          <sw-toggle .checked=${c.enabled} ?disabled=${this.busy || !c.available} labelHidden label=${t.classes[c.class]} data-fcs-toggle=${c.class} @change=${(e: Event) => void this.toggle(c.class, e)}></sw-toggle>
        </div>`)}
      </div>
      ${prof && prof.names.length ? html`<div data-fcs-rules>
        <h4>${t.rules}</h4>
        ${prof.alarm_states.filter((s) => ['disarmed', 'armed_home', 'armed_away', 'armed_night'].includes(s)).map((s) => html`<div class="row">
          <span>${alarmText(s)}</span>
          <select aria-label=${alarmText(s)} data-fcs-rule=${s} .value=${prof.rules[s] ?? ''} ?disabled=${this.busy} @change=${(e: Event) => void this.rule(s, e)}>
            <option value="">${t.rulesNone}</option>
            ${prof.names.map((n) => html`<option value=${n} ?selected=${prof.rules[s] === n}>${n}</option>`)}
          </select>
        </div>`)}
      </div>` : nothing}
      <div data-fcs-log>
        <h4>${t.log}</h4>
        ${this.changes.length
          ? html`<ul>${this.changes.map((c) => html`<li class="change" data-change=${c.id}>
              <span class="what"><span>${changeLine(c)} ${this.statusTag(c)}</span><span class="meta">${this.timeText(c.at)}${c.actor ? ` · ${c.actor}` : ''}</span></span>
              ${c.reversible ? html`<sw-button size="sm" variant="ghost" data-change-undo ?disabled=${this.busy} @click=${() => this.onUndo(c)}>${t.undo}</sw-button>` : nothing}
            </li>`)}</ul>`
          : html`<p class="note" data-fcs-log-empty>${t.logEmpty}</p>`}
      </div>
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fcs-msg>${this.msg.text}</div>` : nothing}
      ${this.undoing ? html`<sw-dialog open heading=${`${t.undo}: ${changeLine(this.undoing)}`} data-fcs-confirm @close=${() => (this.undoing = null)}>
        <sw-button slot="footer" @click=${() => (this.undoing = null)}>${he.frigate.control.cancel}</sw-button>
        <sw-button slot="footer" variant="primary" data-fcs-ok ?disabled=${this.busy} @click=${() => void this.undo(this.undoing!, true)}>${he.frigate.control.confirm}</sw-button>
      </sw-dialog>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-control-settings': FrigateControlSettings;
  }
}
