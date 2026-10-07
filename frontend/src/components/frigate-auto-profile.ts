import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-toggle';
import { describeError } from '../api/client';
import {
  AUTO_MODES, alarmText, applyAutoSuggestion, dismissAutoSuggestion, getProfileAuto, isFirstWriteRefusal, putProfileAuto,
  type AutoItem, type AutoMode, type AutoView, type FirstWrites,
} from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles, dateText, supervisedBox } from './frigate-admin-shared';

/**
 * FRGD: the automatic profile of ONE Frigate recorder (Settings only; CR-029 section 11.1): the mode (off / suggest only / apply), the
 * explicit consent to automatic switching, one status line that says what an alarm change does right now (and what blocks "apply"), the
 * open suggestions (apply with a confirmation, dismiss) and the recent alarm changes. `apply` needs the consent (the server refuses
 * otherwise), the profile class on, and one supervised first write of the automatic kind - given by applying a suggestion with
 * `supervised: true`. Fires `frigate-changed` after a write.
 */
@customElement('frigate-auto-profile')
export class FrigateAutoProfile extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: false }) first: FirstWrites | null = null;
  /** the caller holds system.configure: the mode and the consent may be changed */
  @property({ type: Boolean }) canConfigure = false;
  /** the caller holds analytics.profile somewhere: a suggestion may be applied or dismissed */
  @property({ type: Boolean }) canProfile = false;
  @property() tz = '';
  @state() private data: AutoView | null = null;
  @state() private failed = '';
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private applying: { item: AutoItem; supervised: boolean; error: string } | null = null;

  static styles = adminStyles;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('recorderId') && changed.get('recorderId') !== undefined) void this.load();
  }

  async load() {
    if (!this.recorderId) return;
    try {
      this.data = await getProfileAuto(this.recorderId);
      this.failed = '';
    } catch (err) {
      this.failed = describeError(err);
    }
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 4000);
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('frigate-changed', { bubbles: true, composed: true }));
  }

  private async setting(body: { mode?: AutoMode; auto_apply_consent?: boolean }) {
    if (!this.data) return;
    this.busy = true;
    try {
      const r = await putProfileAuto(this.recorderId, body);
      this.data = { ...this.data, setting: r.setting };
      this.flash('ok', fx().control.saved);
      this.changed();
      void this.load();
    } catch (err) {
      this.flash('err', describeError(err));
      void this.load();
    } finally {
      this.busy = false;
    }
  }

  private async apply() {
    const a = this.applying;
    if (!a || this.busy) return;
    this.busy = true;
    try {
      const r = await applyAutoSuggestion(this.recorderId, a.item.id, a.supervised);
      this.applying = null;
      this.flash('ok', r.status === 'applied' ? fx().control.settings.auto.applied : r.status === 'skipped' ? fx().control.settings.auto.status.skipped : fx().control.unverified);
      this.changed();
      void this.load();
    } catch (err) {
      this.applying = { ...a, error: isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : describeError(err) };
    } finally {
      this.busy = false;
    }
  }

  private async dismiss(item: AutoItem) {
    this.busy = true;
    try {
      await dismissAutoSuggestion(this.recorderId, item.id);
      this.flash('ok', fx().control.settings.auto.dismissed);
      void this.load();
    } catch (err) {
      this.flash('err', describeError(err));
    } finally {
      this.busy = false;
    }
  }

  /** One line: what an alarm change does now, or why "apply" is not applying. */
  private statusLine() {
    const a = fx().control.settings.auto;
    const s = this.data!.setting;
    if (s.mode === 'off') return html`<span class="chip" data-auto-status="off">${a.offText}</span>`;
    if (s.mode === 'suggest') return html`<span class="chip accent" data-auto-status="suggest">${a.suggestOnly}</span>`;
    if (s.will_apply) return html`<span class="chip ok" data-auto-status="apply">${a.willApply}</span>`;
    const why = [!s.profile_class_on ? a.blockedClass : null, !s.auto_apply_consent ? a.blockedConsent : null, !s.first_write_done ? a.blockedFirst : null].filter(Boolean);
    return html`<span class="chip warn" data-auto-status="blocked">${a.suggestOnly} · ${why.join(' · ')}</span>`;
  }

  private itemLine(it: AutoItem) {
    const a = fx().control.settings.auto;
    return html`<b>${alarmText(it.alarm_state)}</b> <span class="muted">${a.arrow}</span><b>${it.profile === 'none' ? a.profileNone : it.profile}</b>`;
  }

  private applyDialog() {
    const x = this.applying;
    if (!x) return nothing;
    const a = fx().control.settings.auto;
    const c = fx().control;
    const needSup = !!this.first && this.first.can_supervise && !this.first.done.profile_auto;
    return html`<sw-dialog open heading=${a.confirmApply} data-auto-confirm @close=${() => (this.applying = null)}>
      <div class="form">
        <p class="dialog-text">${this.itemLine(x.item)} · ${c.confirmProfile}</p>
        ${supervisedBox(this.first, 'profile_auto', x.supervised, (v) => (this.applying = { ...x, supervised: v }), 'profile_auto')}
        ${x.error ? html`<div class="err" role="alert" data-auto-error>${x.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.applying = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-auto-apply-ok ?disabled=${this.busy || (needSup && !x.supervised)} @click=${() => void this.apply()}>${c.confirm}</sw-button>
    </sw-dialog>`;
  }

  render() {
    const a = fx().control.settings.auto;
    const s = fx().control.settings;
    if (this.failed) return html`<div class="panel" data-frigate-auto><div class="msg err" data-auto-failed>${this.failed}</div></div>`;
    const d = this.data;
    if (!d) return nothing;
    const st = d.setting;
    const open = d.items.filter((i) => i.status === 'suggested' || i.status === 'pending');
    const recent = d.items.filter((i) => i.status !== 'suggested' && i.status !== 'pending').slice(0, 8);
    const lock = this.busy || !this.canConfigure;
    return html`<div class="panel" data-frigate-auto>
      <div class="head"><h4>${a.title}</h4>${this.statusLine()}</div>
      <div class="row">
        <span class="name"><span>${a.mode}</span></span>
        <div class="seg" role="group" aria-label=${a.mode} data-auto-modes>
          ${AUTO_MODES.map((m) => html`<button type="button" aria-pressed=${String(st.mode === m)} data-auto-mode=${m} ?disabled=${lock || (m === 'apply' && !st.auto_apply_consent)} title=${m === 'apply' && !st.auto_apply_consent ? a.blockedConsent : ''} @click=${() => st.mode !== m && void this.setting({ mode: m })}>${a.modes[m]}</button>`)}
        </div>
      </div>
      <div class="row">
        <span class="name"><span>${a.consent}</span>${st.auto_apply_consent && st.consent_at ? html`<span class="sub" data-auto-consent-by>${a.consentBy} · ${dateText(st.consent_at, this.tz || undefined)}</span>` : nothing}</span>
        <sw-toggle .checked=${st.auto_apply_consent} ?disabled=${lock} labelHidden label=${a.consent} data-auto-consent @change=${(e: Event) => void this.setting({ auto_apply_consent: (e.currentTarget as HTMLElement & { checked: boolean }).checked })}></sw-toggle>
      </div>
      <h5>${a.suggestions}</h5>
      ${open.length
        ? html`<div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) 110px 150px">
            ${open.map((it) => html`<div class="r" role="row" data-auto-item=${it.id}>
              <div class="c main" role="cell">${this.itemLine(it)}</div>
              <div class="c sub ltr muted" role="cell">${dateText(it.at, this.tz || undefined)}</div>
              <div class="c acts" role="cell">
                ${this.canProfile ? html`<sw-button size="sm" variant="primary" data-auto-apply ?disabled=${this.busy} @click=${() => (this.applying = { item: it, supervised: false, error: '' })}>${a.apply}</sw-button>
                  <sw-button size="sm" variant="ghost" data-auto-dismiss ?disabled=${this.busy} @click=${() => void this.dismiss(it)}>${a.dismiss}</sw-button>` : nothing}
              </div>
            </div>`)}
          </div>`
        : html`<div class="tbl"><div class="empty" data-auto-empty>${a.noSuggestions}</div></div>`}
      ${recent.length
        ? html`<h5>${a.recent}</h5>
          <div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) minmax(120px, 1fr) 110px" data-auto-recent>
            ${recent.map((it) => html`<div class="r" role="row" data-auto-recent-item=${it.id}>
              <div class="c main" role="cell">${this.itemLine(it)}</div>
              <div class="c sub" role="cell"><span class=${`chip ${it.status === 'applied' ? 'ok' : it.status === 'failed' ? 'bad' : ''}`}>${a.status[it.status] ?? it.status}</span>${it.reason && (a.reason as Record<string, string>)[it.reason] ? html` <span class="muted">${(a.reason as Record<string, string>)[it.reason]}</span>` : nothing}</div>
              <div class="c ltr muted" role="cell">${dateText(it.at, this.tz || undefined)}</div>
            </div>`)}
          </div>`
        : nothing}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-auto-msg>${this.msg.text}</div>` : nothing}
      ${this.first && !this.first.done.profile_auto && st.mode !== 'off' ? html`<p class="note" data-auto-first-note>${s.kinds.profile_auto}: ${s.firstPending}</p>` : nothing}
      ${this.applyDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-auto-profile': FrigateAutoProfile;
  }
}
