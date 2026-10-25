import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PRESS_WORD, type AnyDraft, type AutomationDraft, type DryRunResult, type ExtFlags, type ModelContext } from '../api/automations';
import {
  applyMerge, detectPress, deviceTestPlan, mergeCounts, mergeParts, restorePlan, scheduleDeviceTestPlan,
  type MergePart, type MergeSide, type TestPlan,
} from '../api/automations-ext';
import { runAction } from '../api/ha';
import { describeError } from '../api/client';
import { icon } from './automation-builder-icons';

/**
 * KAV079-295 (mockup r079 states 3 and 5): the two dialog bodies the automation builder opens inside its existing `<sw-dialog>`s. Light DOM (the editor's
 * shadow styles apply).
 *
 *   <kav-device-test>  "בדיקה": the existing "בלי להפעיל כלום" view and the new "על ההתקן". On the device every step runs ONLY after the person presses
 *                      its button, through the ordinary device-control route (the same permission, grant and confirmation rules as a manual action -
 *                      "פעולה רגישה דורשת הרשאת הפעלה ידנית, כמו היום"); a button trigger can be heard first (a real press). At the end the setting
 *                      decides (owner 359: ask by default): put the devices back from the snapshot, leave them, or ask.
 *   <kav-merge>        "השוואה ומיזוג": per changed part, mine or the other person's; a part changed on BOTH sides is pre-marked with the other version
 *                      and waits for a click (owner 366) before "שמירת המיזוג" is enabled. Emits `merge-save` with the merged draft.
 */

type StepState = 'idle' | 'busy' | 'done' | 'error';

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
    this.heard = { st: 'busy', text: 'מאזינים… לחצו על הכפתור' };
    try {
      const r = await detectPress(t.device_id);
      if (!r.detected) { this.heard = { st: 'error', text: 'לא זוהתה לחיצה' }; return; }
      const match = r.button === t.button && r.press === t.press;
      this.heard = { st: match ? 'done' : 'error', text: `נקלטה ${r.press ? PRESS_WORD[r.press] : 'לחיצה'} על כפתור ${r.button ?? '?'}${match ? ' – תואם לטריגר' : ' – לא תואם לטריגר'}` };
    } catch (e) { this.heard = { st: 'error', text: describeError(e) }; }
  }

  private async runStep(path: string) {
    const s = this.plan?.steps.find((x) => x.path === path);
    if (!s || (this.source === 'schedule' && !this.armed)) return;
    if (Object.values(this.steps).some((x) => x.st === 'busy')) return;  // one run at a time
    this.steps = { ...this.steps, [path]: { st: 'busy', note: '' } };
    try {
      for (const e of s.entity_ids) await runAction(e, s.action, s.data, s.sensitive);
      this.steps = { ...this.steps, [path]: { st: 'done', note: 'הופעל' } };
      this.ran = true; this.restored = false;
    } catch (e) { this.steps = { ...this.steps, [path]: { st: 'error', note: describeError(e) } }; }
  }

  private async restore(): Promise<boolean> {
    if (!this.plan) return true;
    this.busy = true;
    try {
      const { actions } = await restorePlan(this.plan.snapshot);
      for (const a of actions) await runAction(a.entity_id, a.action, a.arguments, a.sensitive);
      this.restored = true; this.asking = false;
      return true;
    } catch (e) { this.error = describeError(e); return false; } finally { this.busy = false; }
  }

  private async close() {
    const end = this.flags?.device_test_end ?? 'ask';
    if (this.ran && !this.restored) {
      if (end === 'ask' && !this.asking) { this.asking = true; return; }
      if (end === 'restore' && !(await this.restore())) return;
    }
    this.dispatchEvent(new CustomEvent('test-close', { bubbles: true, composed: true }));
  }

  private renderDry() {
    const d = this.dry;
    if (!d) return html`<div class="kvrow"><span>טוען…</span></div>`;
    return html`${d.conditions.length ? html`<h5>תנאים עכשיו</h5>${d.conditions.map((c) => html`<div class="kvrow"><span>${c.sentence}</span>${c.passed === null ? html`<span>לא ניתן לבדוק</span>` : c.passed ? html`<span class="ok">מתקיים</span>` : html`<span class="bad">לא מתקיים</span>`}</div>`)}` : nothing}
      <h5>מה יקרה</h5>
      ${d.effects.entities.length ? d.effects.entities.map((e) => html`<div class="kvrow"><span>${e.name}</span><span>${e.from ? `${e.from} → ` : ''}${e.to ?? ''}</span></div>`) : html`<div class="kvrow"><span>לא ידוע אילו מכשירים ישתנו</span></div>`}`;
  }

  private renderDev() {
    const p = this.plan;
    if (this.error) return html`<div class="banner bad" role="alert" data-kav-test-error>${icon('info')}<div class="t"><b>${this.error}</b></div></div>`;
    if (!p) return html`<div class="kvrow"><span>טוען…</span></div>`;
    let n = 0;
    const t = p.triggers[0];
    return html`<div class="banner info" data-kav-test-banner>${icon('info')}<div class="t"><b>הבדיקה מפעילה את ההתקנים באמת</b><small>כל צעד מופעל רק אחרי לחיצה שלך. פעולה רגישה דורשת הרשאת הפעלה ידנית, כמו היום.</small></div></div>
      ${t ? html`<div class="kav-step ${this.heard.st}" data-kav-listen><span class="sn">${this.heard.st === 'done' ? icon('check') : String(++n)}</span>
        <div><b>${this.heard.st === 'done' ? 'מאזינים לכפתור · זוהה' : 'מאזינים לכפתור'}</b><span class="s">${this.heard.text || t.sentence}</span></div>
        <button class="btn sm" type="button" ?disabled=${this.heard.st === 'busy'} @click=${() => void this.listen()}>${icon(this.heard.st === 'idle' ? 'button' : 'refresh')}${this.heard.st === 'idle' ? 'האזנה' : 'שוב'}</button></div>` : nothing}
      ${this.source === 'schedule' && !this.armed ? html`<div class="banner bad" role="alert" data-kav-arm>${icon('info')}<div class="t"><b>לפני שמתחילים: הבדיקה תפעיל את ההתקנים האלה באמת</b>
        <ul>${p.steps.filter((s) => s.entity_ids.length).map((s) => html`<li>${s.sentence}</li>`)}</ul>
        ${p.steps.some((s) => !s.entity_ids.length) ? html`<small>צעדים שלא ניתן לבדוק כאן מוצגים אך לא יופעלו.</small>` : nothing}
        <div class="acts"><button class="btn sm primary" type="button" data-kav-arm-yes ?disabled=${!p.steps.some((s) => s.entity_ids.length)} @click=${() => { this.armed = true; }}>הבנתי, אפשר להתחיל</button></div></div></div>` : nothing}
      ${p.steps.length ? p.steps.map((s) => {
        const st = this.steps[s.path] ?? { st: 'idle' as StepState, note: '' };
        const now = s.now.map((x) => x.state ?? '?').join(', ');
        return html`<div class="kav-step ${st.st}" data-kav-step=${s.path}><span class="sn">${st.st === 'done' ? icon('check') : String(++n)}</span>
          <div><b>${s.sentence}</b><span class="s">${st.note || (now ? `עכשיו: ${now}` : '')}</span></div>
          <button class="btn sm primary" type="button" ?disabled=${Object.values(this.steps).some((x) => x.st === 'busy') || !s.entity_ids.length || (this.source === 'schedule' && !this.armed)} @click=${() => void this.runStep(s.path)}>${icon('play')}${st.st === 'done' ? 'שוב' : 'הפעלה'}</button></div>`;
      }) : html`<div class="kvrow"><span>אין צעדים שמפעילים התקנים</span></div>`}
      ${this.asking ? html`<div class="banner" role="alert" data-kav-test-ask>${icon('info')}<div class="t"><b>להחזיר את ההתקנים למצב הקודם?</b>
        <div class="acts"><button class="btn sm primary" type="button" ?disabled=${this.busy} data-kav-restore-yes @click=${async () => { if (await this.restore()) void this.close(); }}>החזרה למצב הקודם</button>
        <button class="btn sm" type="button" data-kav-restore-no @click=${() => { this.restored = true; void this.close(); }}>להשאיר</button></div></div></div>` : nothing}`;
  }

  render() {
    const end = this.flags?.device_test_end ?? 'ask';
    const endText = end === 'ask' ? 'לשאול' : end === 'restore' ? 'החזרה למצב הקודם' : 'להשאיר כמו שהוא';
    return html`<div class="dlg-body" data-kav-device-test>
        ${this.source === 'schedule' ? nothing : html`<div class="seg" role="tablist" aria-label="סוג הבדיקה" data-kav-test-mode>
          <button type="button" role="tab" aria-selected=${String(this.mode === 'dry')} data-m="dry" @click=${() => this.setMode('dry')}>בלי להפעיל כלום</button>
          <button type="button" role="tab" aria-selected=${String(this.mode === 'dev')} data-m="dev" @click=${() => this.setMode('dev')}>על ההתקן</button></div>`}
        ${this.mode === 'dry' ? this.renderDry() : this.renderDev()}
      </div>
      <div class="kav-foot">
        ${this.mode === 'dev' ? html`<span class="kav-note">בסיום: <b>${endText}</b> · <a href="#/system/automations">הגדרות</a></span>` : nothing}
        <span class="sp"></span>
        ${this.mode === 'dev' && this.ran && !this.restored ? html`<button class="btn" type="button" ?disabled=${this.busy} data-kav-restore @click=${() => void this.restore()}>החזרה למצב הקודם</button>` : nothing}
        <button class="btn primary" type="button" data-kav-test-close @click=${() => void this.close()}>סגירה</button></div>`;
  }
}

@customElement('kav-merge')
export class KavMerge extends LitElement {
  @property({ attribute: false }) base: AutomationDraft | null = null;
  @property({ attribute: false }) mine: AutomationDraft | null = null;
  @property({ attribute: false }) theirs: AutomationDraft | null = null;
  @property({ attribute: false }) ctx: ModelContext = {};
  /** "של דנה · 21:12" - who saved the other version and when (empty = "החדש"). */
  @property() theirsLabel = 'החדש';
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
          <div class="h">חלק</div><div class="h">שלי (לא נשמר)</div><div class="h">${this.theirsLabel}</div>
          ${rows.map((p) => {
            const cf = p.changed === 'both' ? ' cf' : '';
            const mineCell = p.changed === 'theirs' ? html`<div class=${`same${cf}`}>${p.sub || p.mine} (כמו קודם)</div>` : html`<div class=${cf}>${opt(p, 'mine', p.mine)}</div>`;
            const theirsCell = p.changed === 'mine' ? html`<div class=${`same${cf}`}>${p.sub || p.theirs} (כמו קודם)</div>` : html`<div class=${cf}>${opt(p, 'theirs', p.theirs)}</div>`;
            return html`<div class=${`f${cf}`} data-kav-merge-row=${p.key}>${p.label}${p.changed === 'both' ? html`<small>שונה בשני הצדדים</small>` : nothing}</div>${mineCell}${theirsCell}`;
          })}</div>` : html`<div class="kvrow"><span>אין הבדלים בתוכן.</span></div>`}
      </div>
      <div class="kav-foot"><span class="kav-note" data-kav-merge-counts>${c.mine} חלקים משלי · ${c.theirs} ${this.theirsLabel === 'החדש' ? 'מהחדש' : this.theirsLabel.split(' · ')[0]}</span><span class="sp"></span>
        <button class="btn quiet" type="button" @click=${() => this.dispatchEvent(new CustomEvent('merge-cancel', { bubbles: true, composed: true }))}>ביטול</button>
        <button class="btn primary" type="button" data-kav-merge-save ?disabled=${pending > 0 || !rows.length} title=${pending ? 'בחרו בכל חלק שהשתנה בשני הצדדים' : ''} @click=${() => this.save()}>${icon('branch')}שמירת המיזוג</button></div>`;
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
  .kav-step .sn { inline-size: 26px; block-size: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--dv-surface-3); font-weight: 700; font-size: var(--sw-fs-sm); }
  .kav-step.done .sn { background: var(--dv-success-soft); color: var(--sw-success-text); }
  .kav-step.error { border-color: color-mix(in srgb, var(--dv-danger) 50%, transparent); }
  .kav-step > div { display: flex; flex-direction: column; min-inline-size: 0; }
  .kav-step .s { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
  .kav-mt { display: grid; grid-template-columns: minmax(90px, 0.8fr) 1fr 1fr; gap: 0; border: 1px solid var(--dv-border); border-radius: var(--sw-r-lg); overflow: hidden; font-size: var(--sw-fs-sm); }
  .kav-mt > div { padding: 8px 10px; border-block-end: 1px solid var(--dv-border); }
  .kav-mt .h { font-weight: 700; color: var(--dv-text-2); background: var(--dv-surface-3); }
  .kav-mt .f { font-weight: 600; display: flex; flex-direction: column; }
  .kav-mt .f small { font-weight: 400; color: var(--sw-warning-text); }
  .kav-mt .cf { background: color-mix(in srgb, var(--dv-warning) 10%, transparent); }
  .kav-mt .same { color: var(--dv-text-2); }
  .kav-opt { display: flex; gap: 6px; align-items: center; cursor: pointer; }
  .kav-opt.pick { font-weight: 700; color: var(--dv-accent); }
`;
