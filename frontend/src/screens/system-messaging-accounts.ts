import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import './messaging-pacing-card';
import './messaging-policy-card';
import { ApiError, describeError } from '../api/client';
import { dayTimeText } from '../api/day-format';
import { messagingAccountsApi, type PacingKey, type QueuedMove, type WaAccount, type WaUse, type WaWarning, type WhatsappView } from '../api/messaging-accounts';
import { settingsStyles } from '../styles/settings';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { wt, type WaTextKey } from '../i18n/messaging-accounts';
import {
  DEPT_SEP, LABEL_MAX, PACING_KEYS, accountOf, accountWarnings, chipTone, displayLabel, draftFrom, isDirty, manualProblem, newManualKey, pacingProblem,
  stateWord, toPutBody, useOptions, useWarnings, usesOf, usesText, warningText, type Draft, type DraftAccount,
} from '../messaging/accounts-model';

/**
 * CR-038 slice 5a: Settings › ערוץ ההודעות (`#/system/messaging-accounts`, section 9.9.3; the approved mock-up's "ערוץ ההודעות" settings tab,
 * tickets-v2). Installation-level - not inside the tickets module: other modules register their own uses later.
 *   חשבונות וואטסאפ  every linked account (read from the system platform's entity mirror, plus manual ones) with its state chip, the last
 *                    four digits, the uses it carries, its 24-hour sends against the daily cap and a "shared" chip; "רענון" re-reads the
 *                    mirror and the label digits; the use rows (installation default, codes = "כמו ...", one row per department) and
 *                    "הזנה ידנית".
 *   ערוצים           WhatsApp / e-mail / in-app state lines and SMS shown disabled as "בקרוב" (D13: future work).
 *   החשבון הנבחר      label, "used outside the system" mark, pacing (shared by every use of the account), the manual value and status
 *                    entity, removal, and the test send (OFF until the outbox of slice 5b and the owner's approval of live sends).
 * Read with system.configure (read-only, manual values masked) or messaging.accounts.manage (edit, sensitive). A save that moves a use
 * with queued messages first shows the count and asks to confirm (409 queued_messages). Warnings live here only, never on operator
 * screens. No text here names the tickets module: the use labels arrive rendered with its configured name (D33).
 */
@customElement('system-messaging-accounts')
export class SystemMessagingAccounts extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private view: WhatsappView | null = null;
  @state() private draft: Draft | null = null;
  @state() private selected = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private ok = '';
  @state() private loadState: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private manualOpen = false;
  @state() private manual = { label: '', value: '', entity: '' };
  @state() private confirm: QueuedMove[] | null = null;
  @state() private openDepts: Record<string, boolean> = {};
  @state() private pacingOpen = false;
  @state() private testTarget = '';
  /** owner 2026-10-14: the test send is open to messaging.accounts.manage holders - one confirm before a real message leaves */
  @state() private testConfirm = false;
  @state() private fieldErrors: Record<string, string> = {};
  private okTimer = 0;

  static styles = [settingsStyles, css`
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
      max-inline-size: 1180px;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: var(--sw-s-2);
    }
    .head .grow {
      flex: 1;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .tag.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .tag.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .tag.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .acc {
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      padding: 10px 6px;
      border: 0;
      border-block-end: 1px solid var(--sw-border);
      border-radius: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      min-inline-size: 0;
    }
    .acc[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-radius: var(--sw-r-sm);
    }
    .acc:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .acc .nm {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .acc .nm b {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .acc .nm small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .in {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-solid);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      inline-size: 100%;
      min-inline-size: 0;
    }
    .in.num {
      inline-size: 96px;
    }
    /* a stacked row: the label is a line, not a 220 px flex basis (which is a HEIGHT in a column) */
    .row.stack .lbl {
      flex: none;
    }
    .warnline {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 4px;
      min-inline-size: 0;
    }
    /* a warning is a sentence: it wraps inside its row on a narrow phone instead of leaving the card */
    .warnline .tag {
      white-space: normal;
      max-inline-size: 100%;
      box-sizing: border-box;
      /* GATE-FIX-2270: a wrapped warning is a short block, not a pill - a 999 px radius put the last word of a two-line warning
         into the rounded corner (domus 1024 px); one line still reads as a rounded tag */
      border-radius: var(--sw-r-md);
    }
    .usegroup {
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: var(--sw-s-2);
      padding-block-start: var(--sw-s-2);
    }
    .usegroup h4 {
      margin: 0 0 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .linkbtn {
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      padding: 4px 0;
    }
    .pace {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
      inline-size: 100%;
    }
    .pace label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .form label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .disabled {
      opacity: 0.6;
    }
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 480px) {
      .pace {
        grid-template-columns: minmax(0, 1fr);
      }
      .in.num {
        inline-size: 100%;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.okTimer);
  }

  private say(text: string): void {
    this.ok = text;
    this.error = '';
    window.clearTimeout(this.okTimer);
    this.okTimer = window.setTimeout(() => (this.ok = ''), 3000);
  }

  private take(v: WhatsappView): void {
    this.view = v;
    this.draft = draftFrom(v);
    this.fieldErrors = {};
    if (!this.selected || !v.accounts.some((a) => a.key === this.selected)) this.selected = v.accounts[0]?.key ?? '';
    this.loadState = 'ready';
  }

  private async load(): Promise<void> {
    try {
      this.take(await messagingAccountsApi().view());
    } catch (e) {
      this.loadState = e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error';
      this.error = this.loadState === 'error' ? describeError(e) : '';
    }
  }

  private get editable(): boolean {
    return !!this.view?.can_manage;
  }

  private setAccount(key: string, patch: Partial<DraftAccount>): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, accounts: this.draft.accounts.map((a) => (a.key === key ? { ...a, ...patch } : a)) };
  }

  private setUse(useKey: string, value: string): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, uses: { ...this.draft.uses, [useKey]: value || null } };
  }

  private ensureDraftAccount(key: string): void {
    if (!this.draft || !this.view || this.draft.accounts.some((a) => a.key === key)) return;
    const v = accountOf(this.view, key);
    if (v) this.draft = { ...this.draft, accounts: [...this.draft.accounts, { key, kind: v.kind, label: '', shared_outside: false, pacing: { ...v.pacing } }] };
  }

  // ---------------------------------------------------------------- actions

  private async save(confirmQueued = false): Promise<void> {
    if (!this.view || !this.draft || this.busy) return;
    for (const a of this.draft.accounts) {
      const p = pacingProblem(this.view, a.pacing);
      if (p) {
        this.selected = a.key;
        this.pacingOpen = true;
        this.fieldErrors = { [`pacing.${p.field}`]: wt(`err_${p.code}` as WaTextKey) };
        return;
      }
    }
    this.busy = true;
    try {
      this.take(await messagingAccountsApi().save(toPutBody(this.view, this.draft, confirmQueued)));
      this.confirm = null;
      this.say(wt('saved'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'queued_messages') {
        this.confirm = ((e.body.details?.moves as QueuedMove[] | undefined) ?? []);
      } else if (e instanceof ApiError && e.code === 'validation') {
        const fields = (e.body.details?.fields as { code: string; field: string }[] | undefined) ?? [];
        this.fieldErrors = Object.fromEntries(fields.map((f) => [f.field, wt(`err_${f.code}` as WaTextKey)]));
        this.error = describeError(e);
      } else {
        this.error = describeError(e);
        if (e instanceof ApiError && e.status === 409) void this.load();
      }
    } finally {
      this.busy = false;
    }
  }

  private async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const keepDraft = this.view && this.draft && isDirty(this.view, this.draft);
      const v = await messagingAccountsApi().refresh();
      if (keepDraft) this.view = v; // the edits stay; the states and digits are fresh
      else this.take(v);
      this.say(wt('refreshed'));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private addManual(): void {
    if (!this.view || !this.draft) return;
    const problem = manualProblem(this.manual.value, this.view);
    if (problem) {
      this.fieldErrors = { manual: wt(`err_${problem}` as WaTextKey) };
      return;
    }
    const key = newManualKey(this.draft);
    const entity = this.manual.entity.trim();
    this.draft = {
      ...this.draft,
      accounts: [...this.draft.accounts, { key, kind: 'manual', label: this.manual.label.trim().slice(0, LABEL_MAX), shared_outside: false, pacing: { ...this.view.pacing_default }, account: this.manual.value.trim(), status_entity_id: entity || null }],
    };
    this.selected = key;
    this.manualOpen = false;
    this.manual = { label: '', value: '', entity: '' };
    this.fieldErrors = {};
  }

  /** Select an account; on a one-column layout (phone, tablet) the selected card lies below the lists - bring it into view. */
  private select(key: string): void {
    this.selected = key;
    this.pacingOpen = false;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      void this.updateComplete.then(() => this.renderRoot.querySelector('[data-card="selected"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  }

  private removeAccount(key: string): void {
    if (!this.draft || usesOf(this.draft, key).length) return;
    this.draft = { ...this.draft, accounts: this.draft.accounts.filter((a) => a.key !== key) };
    this.selected = this.draft.accounts[0]?.key ?? '';
  }

  private async test(): Promise<void> {
    if (!this.selected || this.busy) return;
    this.busy = true;
    try {
      await messagingAccountsApi().test(this.selected, this.testTarget);
      this.testTarget = '';
      this.say(wt('testQueued'));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- pieces

  private chip(state: WaAccount['state']): TemplateResult {
    return html`<span class=${`tag ${chipTone(state)}`} data-state=${state}>${stateWord(state)}</span>`;
  }

  private warnChips(ws: WaWarning[]): TemplateResult | typeof nothing {
    if (!this.view || !ws.length) return nothing;
    const modules = this.view.modules;
    return html`<div class="warnline">${ws.map((w) => html`<span class=${`tag ${w.severity === 'red' ? 'bad' : w.severity === 'amber' ? 'warn' : 'mute'}`} data-warning=${w.code}><sw-icon name="warning" size="14"></sw-icon>${warningText(w, modules)}</span>`)}</div>`;
  }

  private accountRow(key: string): TemplateResult {
    const view = this.view!;
    const draft = this.draft!;
    const v = accountOf(view, key);
    const state = v?.state ?? 'unknown';
    const uses = usesOf(draft, key);
    const cap = draft.accounts.find((a) => a.key === key)?.pacing.per_day ?? v?.pacing.per_day ?? 0;
    const shared = accountWarnings(view, key).some((w) => w.code !== 'maybe_same_number') || draft.accounts.find((a) => a.key === key)?.shared_outside;
    const line = [uses.length ? wt('usedBy', { uses: usesText(view, uses) }) : wt('unused'), wt('sends', { n: v?.sends_24h ?? 0, cap })].join(' · ');
    return html`<button type="button" class="acc" aria-pressed=${String(this.selected === key)} data-account=${key} @click=${() => this.select(key)}>
      <sw-icon name="signal" size="18"></sw-icon>
      <span class="nm"><b>${bidi(displayLabel(view, draft, key))}${v?.last4 ? html` <span class="ltr muted">····${v.last4}</span>` : nothing}${v?.kind === 'manual' || !v ? html` <span class="tag mute">${wt('manualTag')}</span>` : nothing}</b>
        <small>${line}</small></span>
      <span class="chips">${shared ? html`<span class="tag warn" data-shared><sw-icon name="warning" size="14"></sw-icon>${wt('sharedChip')}</span>` : nothing}${this.chip(state)}</span>
    </button>`;
  }

  private useRow(use: WaUse): TemplateResult {
    const view = this.view!;
    const draft = this.draft!;
    const value = draft.uses[use.key] ?? '';
    const sub = use.inherits ? wt('inheritDefault') : wt('installDefault');
    const depts = use.departments ?? [];
    const open = this.openDepts[use.key] ?? depts.some((d) => !!draft.uses[`${use.key}${DEPT_SEP}${d.id}`]);
    return html`<div class="usegroup" data-use=${use.key}>
      <div class="row"><span class="lbl">${use.label}<span class="muted">${sub}${use.queued ? ` · ${wt('queued', { n: use.queued })}` : ''}</span>${this.warnChips(useWarnings(view, use.key, null))}</span>
        <span class="ctl"><select class="in" data-use-pick=${use.key} aria-label=${use.label} ?disabled=${!this.editable || this.busy} @change=${(e: Event) => this.setUse(use.key, (e.target as HTMLSelectElement).value)}>
          ${useOptions(view, draft, use).map((o) => html`<option value=${o.value} ?selected=${o.value === value}>${o.label}</option>`)}
        </select></span></div>
      ${use.per_department && depts.length ? html`
        <button type="button" class="linkbtn" aria-expanded=${String(open)} data-depts-toggle=${use.key} @click=${() => (this.openDepts = { ...this.openDepts, [use.key]: !open })}>${wt('deptsToggle', { n: depts.length })}</button>
        ${open ? depts.map((d) => {
          const k = `${use.key}${DEPT_SEP}${d.id}`;
          const dv = draft.uses[k] ?? '';
          return html`<div class="row" data-dept-row=${d.id}><span class="lbl">${bidi(d.name)}<span class="muted">${dv ? wt('deptOwn') : wt('deptDefault')}</span>${this.warnChips(useWarnings(view, use.key, d.id))}</span>
            <span class="ctl"><select class="in" data-dept-pick=${k} aria-label=${d.name} ?disabled=${!this.editable || this.busy} @change=${(e: Event) => this.setUse(k, (e.target as HTMLSelectElement).value)}>
              ${useOptions(view, draft, use, true).map((o) => html`<option value=${o.value} ?selected=${o.value === dv}>${o.label}</option>`)}
            </select></span></div>`;
        }) : nothing}` : nothing}
    </div>`;
  }

  private accountsCard(): TemplateResult {
    const view = this.view!;
    const draft = this.draft!;
    const keys = [...draft.accounts.map((a) => a.key), ...view.accounts.filter((a) => !a.removed && !draft.accounts.some((d) => d.key === a.key)).map((a) => a.key)];
    const red = view.warnings.filter((w) => w.code === 'required_unmapped');
    return html`<sw-card data-card="accounts">
      <div class="head"><h3 class="sr">${wt('accounts')}</h3><strong>${wt('accounts')}</strong><span class="tag">${wt('source')}</span><span class="grow"></span>
        ${this.editable ? html`<sw-button size="sm" icon="refresh" data-refresh ?disabled=${this.busy} @click=${() => void this.refresh()}>${wt('refresh')}</sw-button>` : nothing}</div>
      ${!view.ws_connected ? html`<div class="msg warn" data-ws-down><sw-icon name="offline" size="16"></sw-icon>${wt('wsDown')}</div>` : nothing}
      ${red.length ? html`<div class="msg err" data-required-unmapped><sw-icon name="warning" size="16"></sw-icon>${warningText(red[0], view.modules)}</div>` : nothing}
      <div data-accounts>${keys.length ? repeat(keys, (k) => k, (k) => this.accountRow(k)) : html`<p class="muted" data-no-accounts>${wt('noAccounts')}</p>`}</div>
      ${view.uses.length ? repeat(view.uses, (u) => u.key, (u) => this.useRow(u)) : html`<div class="usegroup"><span class="muted" data-no-uses>${wt('noUses')}</span></div>`}
      <div class="usegroup"><div class="row"><span class="lbl">${wt('manualRow')}<span class="muted">${wt('manualSub')}</span></span>
        <sw-button size="sm" icon="plus" data-manual-add ?disabled=${!this.editable || this.busy} @click=${() => { this.manualOpen = true; this.fieldErrors = {}; }}>${wt('manualAdd')}</sw-button></div></div>
    </sw-card>`;
  }

  private channelsCard(): TemplateResult {
    const view = this.view!;
    const tone = (s: string) => (s === 'active' ? 'ok' : s === 'down' ? 'bad' : 'mute');
    return html`<sw-card heading=${wt('channels')} data-card="channels">
      ${view.channels.map((c) => html`<div class=${`row ${c.state === 'soon' ? 'disabled' : ''}`} data-channel=${c.key} aria-disabled=${c.state === 'soon' ? 'true' : 'false'}>
        <span class="lbl">${wt(`ch_${c.key}` as WaTextKey)}<span class="muted">${wt(`ch_${c.key}_sub` as WaTextKey)}</span></span>
        <span class=${`tag ${tone(c.state)}`} data-channel-state=${c.state}>${wt(`cs_${c.state}` as WaTextKey)}</span></div>`)}
    </sw-card>`;
  }

  private selectedCard(): TemplateResult {
    const view = this.view!;
    const draft = this.draft!;
    const key = this.selected;
    const v = accountOf(view, key);
    const d = draft.accounts.find((a) => a.key === key);
    if (!key || (!v && !d)) return html`<sw-card heading=${wt('selected')} data-card="selected"><p class="muted">${wt('selectHint')}</p></sw-card>`;
    const kind = d?.kind ?? v?.kind ?? 'discovered';
    const pacing = d?.pacing ?? v?.pacing ?? view.pacing_default;
    const inUse = usesOf(draft, key).length > 0;
    const removable = this.editable && (kind === 'manual' || (v ? !v.in_mirror : true));
    const ed = this.editable && !this.busy;
    const fe = this.fieldErrors;
    return html`<sw-card heading=${wt('selected')} data-card="selected" data-selected=${key}>
      <div class="row"><span class="lbl">${bidi(displayLabel(view, draft, key))}<span class="muted">${v?.last_send_at ? wt('lastSend', { time: dayTimeText(v.last_send_at) }) : wt('neverSent')}</span></span>${this.chip(v?.state ?? 'unknown')}</div>
      ${this.warnChips(accountWarnings(view, key))}
      <div class="row stack"><label class="lbl" for="lbl">${wt('labelField')}</label>
        <input id="lbl" class="in" maxlength=${LABEL_MAX} data-label .value=${d?.label ?? ''} placeholder=${v?.label ?? ''} ?disabled=${!ed}
          @input=${(e: Event) => { this.ensureDraftAccount(key); this.setAccount(key, { label: (e.target as HTMLInputElement).value }); }} /></div>
      ${kind === 'manual' ? html`
        <div class="row stack"><label class="lbl" for="mv">${wt('manualValue')}<span class="muted">${wt('manualValueSub')}</span></label>
          <input id="mv" class="in ltr" dir="ltr" maxlength="64" data-manual-value .value=${view.can_manage ? d?.account ?? '' : v?.last4 ? `····${v.last4}` : ''} ?disabled=${!ed}
            aria-invalid=${String(!!fe[`accounts.account`])} @input=${(e: Event) => this.setAccount(key, { account: (e.target as HTMLInputElement).value })} /></div>
        <div class="row stack"><label class="lbl" for="se">${wt('manualStatus')}</label>
          <input id="se" class="in ltr" dir="ltr" maxlength="120" data-manual-status .value=${d?.status_entity_id ?? ''} ?disabled=${!ed}
            @input=${(e: Event) => this.setAccount(key, { status_entity_id: (e.target as HTMLInputElement).value || null })} /></div>` : nothing}
      <div class="row"><span class="lbl">${wt('sharedOutside')}<span class="muted">${wt('sharedOutsideSub')}</span></span>
        <sw-toggle label=${wt('sharedOutside')} labelHidden data-shared-outside .checked=${d?.shared_outside ?? v?.shared_outside ?? false} ?disabled=${!ed}
          @change=${(e: CustomEvent<{ checked: boolean }>) => { this.ensureDraftAccount(key); this.setAccount(key, { shared_outside: e.detail.checked }); }}></sw-toggle></div>
      <div class="row stack"><span class="lbl">${wt('pacing')}<span class="muted">${wt('pacingSub')}</span></span>
        <button type="button" class="linkbtn" aria-expanded=${String(this.pacingOpen)} data-pacing-toggle @click=${() => (this.pacingOpen = !this.pacingOpen)}>${wt('pacingSummary', { hour: pacing.per_hour, day: pacing.per_day, gap: pacing.min_gap_s })}</button>
        ${this.pacingOpen ? html`<div class="pace" data-pacing>${PACING_KEYS.map((k: PacingKey) => html`<label>${wt(`p_${k}` as WaTextKey)}
          <input class="in num" type="number" inputmode="numeric" min=${view.pacing_ranges[k][0]} max=${view.pacing_ranges[k][1]} data-pace=${k} .value=${String(pacing[k])} ?disabled=${!ed}
            aria-invalid=${String(!!fe[`pacing.${k}`])} @input=${(e: Event) => { this.ensureDraftAccount(key); this.setAccount(key, { pacing: { ...pacing, [k]: Number((e.target as HTMLInputElement).value) } }); }} />
          ${fe[`pacing.${k}`] ? html`<span class="field-error">${fe[`pacing.${k}`]}</span>` : nothing}</label>`)}</div>` : nothing}</div>
      <div class="row stack"><span class="lbl">${wt('testTitle')}${view.test_send.enabled ? nothing : html`<span class="muted" data-test-off>${wt('testOff')}</span>`}</span>
        <div class="actions"><input class="in ltr" dir="ltr" inputmode="tel" maxlength="20" data-test-target aria-label=${wt('testTarget')} placeholder=${wt('testTarget')} .value=${this.testTarget}
          ?disabled=${!view.test_send.enabled || !ed} @input=${(e: Event) => (this.testTarget = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" data-test-send ?disabled=${!view.test_send.enabled || !ed || !this.testTarget.trim()} @click=${() => (this.testConfirm = true)}>${wt('testSend')}</sw-button></div></div>
      ${removable ? html`<div class="row"><span class="lbl">${inUse ? html`<span class="muted">${wt('removeInUse')}</span>` : nothing}</span>
        <sw-button size="sm" variant="danger" data-remove ?disabled=${inUse || this.busy} @click=${() => this.removeAccount(key)}>${wt('remove')}</sw-button></div>` : nothing}
    </sw-card>`;
  }

  private manualDialog(): TemplateResult {
    const err = this.fieldErrors.manual ?? '';
    return html`<sw-dialog heading=${wt('manualTitle')} .open=${this.manualOpen} data-manual-dialog @close=${() => (this.manualOpen = false)}>
      <div class="form">
        <label>${wt('labelField')}<input class="in" maxlength=${LABEL_MAX} data-manual-label .value=${this.manual.label} @input=${(e: Event) => (this.manual = { ...this.manual, label: (e.target as HTMLInputElement).value })} /></label>
        <label>${wt('manualValue')}<span class="muted">${wt('manualValueSub')}</span><input class="in ltr" dir="ltr" maxlength="64" data-manual-new-value aria-invalid=${String(!!err)} .value=${this.manual.value} @input=${(e: Event) => { this.manual = { ...this.manual, value: (e.target as HTMLInputElement).value }; this.fieldErrors = {}; }} />
          ${err ? html`<span class="field-error" data-manual-error>${err}</span>` : nothing}</label>
        <label>${wt('manualStatus')}<input class="in ltr" dir="ltr" maxlength="120" data-manual-new-status .value=${this.manual.entity} @input=${(e: Event) => (this.manual = { ...this.manual, entity: (e.target as HTMLInputElement).value })} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.manualOpen = false)}>${wt('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-manual-ok ?disabled=${!this.manual.value.trim()} @click=${() => this.addManual()}>${wt('add')}</sw-button>
    </sw-dialog>`;
  }

  private testDialog(): TemplateResult {
    return html`<sw-dialog heading=${wt('testTitle')} .open=${this.testConfirm} data-test-dialog @close=${() => (this.testConfirm = false)}>
      <p>${wt('testConfirmLine', { target: this.testTarget.trim() })}</p>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.testConfirm = false)}>${wt('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-test-confirm ?disabled=${this.busy} @click=${() => { this.testConfirm = false; void this.test(); }}>${wt('testSend')}</sw-button>
    </sw-dialog>`;
  }

  private confirmDialog(): TemplateResult {
    const n = (this.confirm ?? []).reduce((s, m) => s + m.count, 0);
    return html`<sw-dialog heading=${wt('confirmTitle')} .open=${!!this.confirm} data-confirm-dialog @close=${() => (this.confirm = null)}>
      <p data-confirm-count=${n}>${wt('confirmLine', { n })}</p>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.confirm = null)}>${wt('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-save ?disabled=${this.busy} @click=${() => void this.save(true)}>${wt('confirmSave')}</sw-button>
    </sw-dialog>`;
  }

  render() {
    const heading = wt('title');
    if (this.loadState === 'loading') return html`<sw-page crumbs="הגדרות" heading=${heading}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.loadState !== 'ready' || !this.view || !this.draft) {
      return html`<sw-page crumbs="הגדרות" heading=${heading} data-messaging-accounts data-state=${this.loadState}>
        <sw-state-panel icon="mail" state=${this.loadState === 'forbidden' ? 'forbidden' : 'error'} heading=${this.loadState === 'forbidden' ? wt('forbidden') : this.error} actionLabel=${wt('retry')} @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    }
    const dirty = isDirty(this.view, this.draft);
    return html`<sw-page crumbs="הגדרות" heading=${heading} subheading=${wt('sub')} data-messaging-accounts data-state="ready">
      ${this.error ? html`<div class="msg err" role="alert" data-error>${this.error}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-ok>${this.ok}</div>` : nothing}
      <div class="cols">
        <div class="col">${this.accountsCard()}${this.channelsCard()}</div>
        <div class="col">${this.selectedCard()}<messaging-pacing-card .labels=${Object.fromEntries(this.view.accounts.map((a) => [a.key, a.label]))}></messaging-pacing-card><messaging-policy-card></messaging-policy-card></div>
      </div>
      ${this.editable ? html`<div class="savebar" data-savebar>
        <span class=${dirty ? 'dirty' : 'muted'}>${dirty ? wt('dirty') : ''}</span><span class="grow"></span>
        <sw-button size="sm" variant="ghost" data-discard ?disabled=${!dirty || this.busy} @click=${() => this.view && this.take(this.view)}>${wt('discard')}</sw-button>
        <sw-button size="sm" variant="primary" data-save ?disabled=${!dirty || this.busy} @click=${() => void this.save()}>${wt('save')}</sw-button>
      </div>` : html`<p class="muted" data-read-only>${wt('readOnly')}</p>`}
      ${this.manualDialog()}${this.confirmDialog()}${this.testDialog()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-messaging-accounts': SystemMessagingAccounts;
  }
}
