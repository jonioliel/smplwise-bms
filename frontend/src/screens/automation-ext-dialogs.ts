import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PRESS_WORD, type AnyDraft, type AutomationDraft, type DryRunResult, type ExtFlags, type ModelContext } from '../api/automations';
import {
  applyMerge, detectPress, deviceTestPlan, mergeCounts, mergeParts, restorePlan, scheduleDeviceTestPlan,
  type MergePart, type MergeSide, type TestPlan,
} from '../api/automations-ext';
import { ACTION_ERROR_LABEL, ACTION_STATUS_LABEL, awaitAction, runAction, type HaActionRecord } from '../api/ha';
import { describeError } from '../api/client';
import { physicalOutcome } from '../api/physical-outcome';
import { confirmDialog } from '../components/confirm-dialog';
import { continueAfter, needsConfirm, recordOutcome, worstOutcome, type DeviceOutcome } from './automation-device-test-logic';
import '../components/sw-tabs';
import { icon } from './automation-builder-icons';
import { tr } from '../i18n/msg/automation';

/**
 * KAV079-295 (mockup r079 states 3 and 5): the two dialog bodies the automation builder opens inside its existing `<sw-dialog>`s. Light DOM (the editor's
 * shadow styles apply).
 *
 *   <kav-device-test>  "בדיקה": the existing "בלי להפעיל כלום" view and the new "על ההתקן". On the device every step runs ONLY after the person presses
 *                      its button, through the ordinary device-control route (the same permission, grant and confirmation rules as a manual action -
 *                      "פעולה רגישה דורשת הרשאת הפעלה ידנית, כמו היום"); a button trigger can be heard first (a real press). At the end the setting
 *                      decides (owner 359: ask by default): put the devices back from the snapshot, leave them, or ask.
 *                      PHYSICAL-CONFIRM-2540 (review SCR-18): each device's action record is followed to its end - a refused / failed
 *                      device is an error with its reason, no state report is "unknown" (amber), never "done"; a sensitive step (lock,
 *                      alarm panel, siren) and a restore that holds one run only from their own confirmation (focus on cancel), which
 *                      is what the confirmation grant now stands for.
 *   <kav-merge>        "השוואה ומיזוג": per changed part, mine or the other person's; a part changed on BOTH sides is pre-marked with the other version
 *                      and waits for a click (owner 366) before "שמירת המיזוג" is enabled. Emits `merge-save` with the merged draft.
 */

type StepState = 'idle' | 'busy' | 'done' | 'unknown' | 'error';

/** The reason of one device's record that did not end confirmed, in the screen's words. */
function recordText(r: HaActionRecord): string {
  if (r.status === 'failed' || r.status === 'denied') return (r.error && ACTION_ERROR_LABEL[r.error]) || r.error || ACTION_STATUS_LABEL[r.status];
  return ACTION_STATUS_LABEL.unknown;
}

@customElement('kav-device-test')
export class KavDeviceTest extends LitElement {
  @property({ attribute: false }) itemId: string | null = null;
  @property({ attribute: false }) draft: AnyDraft | null = null;
  @property({ attribute: false }) dry: DryRunResult | null = null;
  @property({ attribute: false }) flags: ExtFlags | null = null;
  @property() mode: 'dry' | 'dev' = 'dev';
  /** 'schedule' (KAVDEVTEST-295): the plan is a schedule's, there is no dry view here, and nothing runs until the person confirms the list once. */
  @property() source: 'automation' | 'schedule' = 'automation';
  @state() private armed = false;
  @state() private plan: TestPlan | null = null;
  @state() private error = '';
  @state() private steps: Record<string, { st: StepState; note: string }> = {};
  @state() private heard: { st: StepState; text: string } = { st: 'idle', text: '' };
  @state() private ran = false;
  @state() private restored = false;
  @state() private asking = false;
  @state() private busy = false;
  /** PHYSICAL-CONFIRM-2540: the last restore's outcome when it did not end confirmed for every device (shown above the footer). */
  @state() private restoreNote: { tone: 'unknown' | 'error'; text: string } | null = null;

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    if (this.mode === 'dev') void this.load();
  }

  private async load() {
    if (!this.itemId || this.plan) return;
    try { this.plan = this.source === 'schedule' ? await scheduleDeviceTestPlan(this.itemId, this.draft) : await deviceTestPlan(this.itemId, this.draft); } catch (e) { this.error = describeError(e); }
  }

  private setMode(m: 'dry' | 'dev') {
    this.mode = m;
    if (m === 'dev') void this.load();
    else this.dispatchEvent(new CustomEvent('need-dry', { bubbles: true, composed: true }));
  }

  private async listen() {
    const t = this.plan?.triggers[0];
    if (!t) return;
    this.heard = { st: 'busy', text: tr('מאזינים… לחצו על הכפתור') };
    try {
      const r = await detectPress(t.device_id);
      if (!r.detected) { this.heard = { st: 'error', text: tr('לא זוהתה לחיצה') }; return; }
      const match = r.button === t.button && r.press === t.press;
      this.heard = { st: match ? 'done' : 'error', text: `${tr('נקלטה {press} על כפתור {button}', { press: r.press ? PRESS_WORD[r.press] : tr('לחיצה'), button: r.button ?? '?' })}${match ? ` – ${tr('תואם לטריגר')}` : ` – ${tr('לא תואם לטריגר')}`}` };
    } catch (e) { this.heard = { st: 'error', text: describeError(e) }; }
  }

  /** PHYSICAL-CONFIRM-2540 (SCR-18): one device action, followed to where it ended. A thrown error is a refusal only when the server
   * said no before anything happened; otherwise the device may have acted - unknown. */
  private async sendOne(entityId: string, action: string, data: Record<string, unknown>, confirmed: boolean): Promise<{ o: DeviceOutcome; text: string; sent: boolean }> {
    let rec: HaActionRecord;
    try {
      rec = await runAction(entityId, action, data, confirmed);
    } catch (e) {
      return physicalOutcome(e) === 'refused' ? { o: 'error', text: describeError(e), sent: false } : { o: 'unknown', text: tr('לא ידוע אם הפעולה בוצעה · בדקו במקום לפני הפעלה חוזרת'), sent: true };
    }
    if (rec.status === 'pending' && rec.id) {
      try { rec = await awaitAction(rec.id, () => undefined, undefined, entityId); } catch { return { o: 'unknown', text: ACTION_STATUS_LABEL.unknown, sent: true }; }
    }
    const o = recordOutcome(rec);
    const sent = rec.status !== 'denied'; // a denied action never reached the device
    if (o === 'done') return { o, text: rec.confirmation === 'none' ? tr('נשלח · ההתקן אינו מדווח מצב') : tr('הופעל'), sent };
    return { o, text: recordText(rec), sent };
  }

  private async runStep(path: string) {
    const s = this.plan?.steps.find((x) => x.path === path);
    if (!s || (this.source === 'schedule' && !this.armed)) return;
    if (Object.values(this.steps).some((x) => x.st === 'busy')) return;  // one run at a time
    // PHYSICAL-CONFIRM-2540 (SCR-18): a sensitive step (unlock, disarm, a siren) is never one tap away - its own confirmation, every press
    if (needsConfirm(s)) {
      const prev = this.steps[path];
      this.steps = { ...this.steps, [path]: { st: 'busy', note: '' } }; // nothing else starts while the question is open
      const ok = await confirmDialog({
        heading: tr('פעולה רגישה'),
        body: `${s.sentence}\n${tr('הצעד יופעל עכשיו באמת ({n} התקנים), בזהות שלך, ויירשם באודיט.', { n: s.entity_ids.length })}`,
        confirmLabel: tr('הפעלת הצעד'),
        danger: true,
        focusCancel: true,
      });
      if (!ok) {
        const { [path]: _drop, ...rest } = this.steps;
        this.steps = prev ? { ...rest, [path]: prev } : rest; // cancelled: nothing was sent, the step is as it was
        return;
      }
    }
    this.steps = { ...this.steps, [path]: { st: 'busy', note: '' } };
    const outcomes: DeviceOutcome[] = [];
    let last = '';
    let anySent = false;
    for (const e of s.entity_ids) {
      const r = await this.sendOne(e, s.action, s.data, s.sensitive);
      outcomes.push(r.o);
      anySent = anySent || r.sent;
      if (r.o !== 'done' || !last) last = r.text;
      if (!continueAfter(r.o)) break; // a refused device stops the step: nothing more is sent blind
    }
    const st = worstOutcome(outcomes);
    this.steps = { ...this.steps, [path]: { st, note: last } };
    if (anySent) { this.ran = true; this.restored = false; } // something may have changed: the end-of-test restore is offered
  }

  /** Puts the devices back from the snapshot. 'ok' only when every device confirmed; 'unknown' / 'failed' keep the restore offered;
   * 'cancel' = a sensitive restore was not confirmed (nothing sent). */
  private async restore(): Promise<'ok' | 'unknown' | 'failed' | 'cancel'> {
    if (!this.plan) return 'ok';
    this.busy = true;
    this.restoreNote = null;
    try {
      const { actions } = await restorePlan(this.plan.snapshot);
      const sensitive = actions.filter((a) => a.sensitive).length;
      if (sensitive) {
        const ok = await confirmDialog({
          heading: tr('החזרה למצב הקודם'),
          body: tr('ההחזרה כוללת {n} פעולות רגישות (מנעול, אזעקה או צופר). הן יופעלו עכשיו באמת, בזהות שלך, ויירשמו באודיט.', { n: sensitive }),
          confirmLabel: tr('החזרה למצב הקודם'),
          danger: true,
          focusCancel: true,
        });
        if (!ok) return 'cancel';
      }
      const outcomes: DeviceOutcome[] = [];
      let text = '';
      for (const a of actions) {
        const r = await this.sendOne(a.entity_id, a.action, a.arguments, a.sensitive);
        outcomes.push(r.o);
        if (r.o !== 'done' && !text) text = r.text;
      }
      const o = worstOutcome(outcomes);
      if (o === 'done') { this.restored = true; this.asking = false; return 'ok'; }
      this.restoreNote = { tone: o === 'error' ? 'error' : 'unknown', text: o === 'error' ? tr('לא כל ההתקנים הוחזרו: {why}', { why: text }) : tr('לא ידוע אם כל ההתקנים חזרו למצב הקודם · בדקו במקום') };
      return o === 'error' ? 'failed' : 'unknown';
    } catch (e) {
      this.restoreNote = { tone: physicalOutcome(e) === 'refused' ? 'error' : 'unknown', text: describeError(e) };
      return physicalOutcome(e) === 'refused' ? 'failed' : 'unknown';
    } finally { this.busy = false; }
  }

  private async close() {
    const end = this.flags?.device_test_end ?? 'ask';
    if (this.ran && !this.restored) {
      if (end === 'ask' && !this.asking) { this.asking = true; return; }
      // a restore whose outcome is already unknown is not sent again by closing; the restore button stays for a deliberate retry
      if (end === 'restore' && this.restoreNote?.tone !== 'unknown' && (await this.restore()) !== 'ok') return;
    }
    this.dispatchEvent(new CustomEvent('test-close', { bubbles: true, composed: true }));
  }

  private renderDry() {
    const d = this.dry;
    if (!d) return html`<div class="kvrow"><span>${tr('טוען…')}</span></div>`;
    return html`${d.conditions.length ? html`<h5>${tr('תנאים עכשיו')}</h5>${d.conditions.map((c) => html`<div class="kvrow"><span>${c.sentence}</span>${c.passed === null ? html`<span>${tr('לא ניתן לבדוק')}</span>` : c.passed ? html`<span class="ok">${tr('מתקיים')}</span>` : html`<span class="bad">${tr('לא מתקיים')}</span>`}</div>`)}` : nothing}
      <h5>${tr('מה יקרה')}</h5>
      ${d.effects.entities.length ? d.effects.entities.map((e) => html`<div class="kvrow"><span>${e.name}</span><span>${e.from ? `${e.from} → ` : ''}${e.to ?? ''}</span></div>`) : html`<div class="kvrow"><span>${tr('לא ידוע אילו מכשירים ישתנו')}</span></div>`}`;
  }

  private renderDev() {
    const p = this.plan;
    if (this.error) return html`<div class="banner bad" role="alert" data-kav-test-error>${icon('info')}<div class="t"><b>${this.error}</b></div></div>`;
    if (!p) return html`<div class="kvrow"><span>${tr('טוען…')}</span></div>`;
    let n = 0;
    const t = p.triggers[0];
    return html`<div class="banner info" data-kav-test-banner>${icon('info')}<div class="t"><b>${tr('הבדיקה מפעילה את ההתקנים באמת')}</b><small>${tr('כל צעד מופעל רק אחרי לחיצה שלך. פעולה רגישה דורשת הרשאת הפעלה ידנית, כמו היום.')}</small></div></div>
      ${t ? html`<div class="kav-step ${this.heard.st}" data-kav-listen><span class="sn">${this.heard.st === 'done' ? icon('check') : String(++n)}</span>
        <div><b>${this.heard.st === 'done' ? tr('מאזינים לכפתור · זוהה') : tr('מאזינים לכפתור')}</b><span class="s">${this.heard.text || t.sentence}</span></div>
        <button class="btn sm" type="button" ?disabled=${this.heard.st === 'busy'} @click=${() => void this.listen()}>${icon(this.heard.st === 'idle' ? 'button' : 'refresh')}${this.heard.st === 'idle' ? tr('האזנה') : tr('שוב')}</button></div>` : nothing}
      ${this.source === 'schedule' && !this.armed ? html`<div class="banner bad" role="alert" data-kav-arm>${icon('info')}<div class="t"><b>${tr('לפני שמתחילים: הבדיקה תפעיל את ההתקנים האלה באמת')}</b>
        <ul>${p.steps.filter((s) => s.entity_ids.length).map((s) => html`<li>${s.sentence}</li>`)}</ul>
        ${p.steps.some((s) => !s.entity_ids.length) ? html`<small>${tr('צעדים שלא ניתן לבדוק כאן מוצגים אך לא יופעלו.')}</small>` : nothing}
        <div class="acts"><button class="btn sm primary" type="button" data-kav-arm-yes ?disabled=${!p.steps.some((s) => s.entity_ids.length)} @click=${() => { this.armed = true; }}>${tr('הבנתי, אפשר להתחיל')}</button></div></div></div>` : nothing}
      ${p.steps.length ? p.steps.map((s) => {
        const st = this.steps[s.path] ?? { st: 'idle' as StepState, note: '' };
        const now = s.now.map((x) => x.state ?? '?').join(', ');
        return html`<div class="kav-step ${st.st}" data-kav-step=${s.path} data-kav-step-state=${st.st}><span class="sn">${st.st === 'done' ? icon('check') : String(++n)}</span>
          <div><b>${s.sentence}</b><span class="s">${st.note || (now ? tr('עכשיו: {now}', { now }) : '')}</span></div>
          <button class="btn sm primary" type="button" ?disabled=${Object.values(this.steps).some((x) => x.st === 'busy') || !s.entity_ids.length || (this.source === 'schedule' && !this.armed)} @click=${() => void this.runStep(s.path)}>${icon('play')}${st.st === 'idle' || st.st === 'busy' ? tr('הפעלה') : tr('שוב')}</button></div>`;
      }) : html`<div class="kvrow"><span>${tr('אין צעדים שמפעילים התקנים')}</span></div>`}
      ${this.restoreNote ? html`<div class="banner ${this.restoreNote.tone === 'error' ? 'bad' : 'warn'}" role="alert" data-kav-restore-note=${this.restoreNote.tone}>${icon('info')}<div class="t"><b>${this.restoreNote.text}</b></div></div>` : nothing}
      ${this.asking ? html`<div class="banner" role="alert" data-kav-test-ask>${icon('info')}<div class="t"><b>${tr('להחזיר את ההתקנים למצב הקודם?')}</b>
        <div class="acts"><button class="btn sm primary" type="button" ?disabled=${this.busy} data-kav-restore-yes @click=${async () => { if ((await this.restore()) === 'ok') void this.close(); }}>${tr('החזרה למצב הקודם')}</button>
        <button class="btn sm" type="button" data-kav-restore-no @click=${() => { this.restored = true; void this.close(); }}>${tr('להשאיר')}</button></div></div></div>` : nothing}`;
  }

  render() {
    const end = this.flags?.device_test_end ?? 'ask';
    const endText = end === 'ask' ? tr('לשאול') : end === 'restore' ? tr('החזרה למצב הקודם') : tr('להשאיר כמו שהוא');
    return html`<div class="dlg-body" data-kav-device-test>
        ${this.source === 'schedule' ? nothing : html`<sw-tabs controlled variant="pill" group-label=${tr('סוג הבדיקה')} data-kav-test-mode .active=${this.mode}
          .items=${[{ id: 'dry', label: tr('בלי להפעיל כלום'), attrs: { 'data-m': 'dry' } }, { id: 'dev', label: tr('על ההתקן'), attrs: { 'data-m': 'dev' } }]}
          @change=${(e: CustomEvent<{ id: string }>) => { e.stopPropagation(); this.setMode(e.detail.id as 'dry' | 'dev'); }}></sw-tabs>`}
        ${this.mode === 'dry' ? this.renderDry() : this.renderDev()}
      </div>
      <div class="kav-foot">
        ${this.mode === 'dev' ? html`<span class="kav-note">${tr('בסיום')}: <b>${endText}</b> · <a href="#/system/automations">${tr('הגדרות')}</a></span>` : nothing}
        <span class="sp"></span>
        ${this.mode === 'dev' && this.ran && !this.restored ? html`<button class="btn" type="button" ?disabled=${this.busy} data-kav-restore @click=${() => void this.restore()}>${tr('החזרה למצב הקודם')}</button>` : nothing}
        <button class="btn primary" type="button" data-kav-test-close @click=${() => void this.close()}>${tr('סגירה')}</button></div>`;
  }
}

@customElement('kav-merge')
export class KavMerge extends LitElement {
  @property({ attribute: false }) base: AutomationDraft | null = null;
  @property({ attribute: false }) mine: AutomationDraft | null = null;
  @property({ attribute: false }) theirs: AutomationDraft | null = null;
  @property({ attribute: false }) ctx: ModelContext = {};
  /** "של דנה · 21:12" - who saved the other version and when (empty = "החדש"). */
  @property() theirsLabel = tr('החדש');
  @state() private parts: MergePart[] = [];
  @state() private approved = new Set<string>();

  createRenderRoot() { return this; }

  protected willUpdate(ch: Map<string, unknown>) {
    if ((ch.has('base') || ch.has('mine') || ch.has('theirs')) && this.base && this.mine && this.theirs) {
      this.parts = mergeParts({ base: this.base, mine: this.mine, theirs: this.theirs, ctx: this.ctx });
      this.approved = new Set();
    }
  }

  private pick(key: string, side: MergeSide) {
    this.parts = this.parts.map((p) => (p.key === key ? { ...p, pick: side } : p));
    this.approved = new Set([...this.approved, key]);
  }

  private save() {
    if (!this.mine || !this.theirs) return;
    const draft = applyMerge({ mine: this.mine, theirs: this.theirs }, this.parts);
    this.dispatchEvent(new CustomEvent('merge-save', { detail: { draft }, bubbles: true, composed: true }));
  }

  render() {
    const rows = this.parts.filter((p) => p.changed !== 'none');
    const c = mergeCounts(this.parts);
    const pending = rows.filter((p) => p.changed === 'both' && !this.approved.has(p.key)).length;
    const opt = (p: MergePart, side: MergeSide, text: string) => html`<label class=${`kav-opt${p.pick === side ? ' pick' : ''}`}><input type="radio" name=${`m-${p.key}`} .checked=${p.pick === side}
      data-kav-merge-pick=${`${p.key}:${side}`} @change=${() => this.pick(p.key, side)} />${text}</label>`;
    return html`<div class="dlg-body" data-kav-merge>
        ${rows.length ? html`<div class="kav-mt">
          <div class="h">${tr('חלק')}</div><div class="h">${tr('שלי (לא נשמר)')}</div><div class="h">${this.theirsLabel}</div>
          ${rows.map((p) => {
            const cf = p.changed === 'both' ? ' cf' : '';
            const mineCell = p.changed === 'theirs' ? html`<div class=${`same${cf}`}>${p.sub || p.mine} (${tr('כמו קודם')})</div>` : html`<div class=${cf}>${opt(p, 'mine', p.mine)}</div>`;
            const theirsCell = p.changed === 'mine' ? html`<div class=${`same${cf}`}>${p.sub || p.theirs} (${tr('כמו קודם')})</div>` : html`<div class=${cf}>${opt(p, 'theirs', p.theirs)}</div>`;
            return html`<div class=${`f${cf}`} data-kav-merge-row=${p.key}>${p.label}${p.changed === 'both' ? html`<small>${tr('שונה בשני הצדדים')}</small>` : nothing}</div>${mineCell}${theirsCell}`;
          })}</div>` : html`<div class="kvrow"><span>${tr('אין הבדלים בתוכן.')}</span></div>`}
      </div>
      <div class="kav-foot"><span class="kav-note" data-kav-merge-counts>${tr('{n} חלקים משלי', { n: c.mine })} · ${c.theirs} ${this.theirsLabel === tr('החדש') ? tr('מהחדש') : this.theirsLabel.split(' · ')[0]}</span><span class="sp"></span>
        <button class="btn quiet" type="button" @click=${() => this.dispatchEvent(new CustomEvent('merge-cancel', { bubbles: true, composed: true }))}>${tr('ביטול')}</button>
        <button class="btn primary" type="button" data-kav-merge-save ?disabled=${pending > 0 || !rows.length} title=${pending ? tr('בחרו בכל חלק שהשתנה בשני הצדדים') : ''} @click=${() => this.save()}>${icon('branch')}${tr('שמירת המיזוג')}</button></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kav-device-test': KavDeviceTest;
    'kav-merge': KavMerge;
  }
}

/** The styles of the two dialog bodies (added to the editor's shadow root). */
export const extDialogStyles = css`
  .kav-foot { display: flex; align-items: center; gap: 8px; padding-block-start: 12px; flex-wrap: wrap; }
  .kav-foot .sp { flex: 1; }
  .kav-step { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: center; padding: 10px; border-radius: var(--sw-r-lg); border: 1px solid var(--dv-border); }
  .kav-step .sn { inline-size: 26px; block-size: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--dv-surface-3); font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); }
  .kav-step.done .sn { background: var(--dv-success-soft); color: var(--sw-success-text); }
  .kav-step.error { border-color: color-mix(in srgb, var(--dv-danger) 50%, transparent); }
  .kav-step.unknown { border-color: color-mix(in srgb, var(--dv-warning) 50%, transparent); }
  .kav-step.unknown .s { color: var(--sw-warning-text); }
  .kav-step > div { display: flex; flex-direction: column; min-inline-size: 0; }
  .kav-step .s { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
  .kav-mt { display: grid; grid-template-columns: minmax(90px, 0.8fr) 1fr 1fr; gap: 0; border: 1px solid var(--dv-border); border-radius: var(--sw-r-lg); overflow: hidden; font-size: var(--sw-fs-sm); }
  .kav-mt > div { padding: 8px 10px; border-block-end: 1px solid var(--dv-border); }
  .kav-mt .h { font-weight: var(--sw-fw-bold); color: var(--dv-text-2); background: var(--dv-surface-3); }
  .kav-mt .f { font-weight: var(--sw-fw-semibold); display: flex; flex-direction: column; }
  .kav-mt .f small { font-weight: var(--sw-fw-regular); color: var(--sw-warning-text); }
  .kav-mt .cf { background: color-mix(in srgb, var(--dv-warning) 10%, transparent); }
  .kav-mt .same { color: var(--dv-text-2); }
  .kav-opt { display: flex; gap: 6px; align-items: center; cursor: pointer; }
  .kav-opt.pick { font-weight: var(--sw-fw-bold); color: var(--dv-accent); }
`;
