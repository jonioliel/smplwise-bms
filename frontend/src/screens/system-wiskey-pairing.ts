import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { isApi, can, onRemote, LOCAL_ONLY_GENERIC } from '../api/session';
import {
  featureCounts,
  getPairingStatus,
  groupFeatures,
  KIND_TEXT,
  probeIsStale,
  probePairing,
  repairPairing,
  VERDICT_TEXT,
  type FeatureRow,
  type FeatureState,
  type PairingLine,
  type PairingLineState,
  type PairingStatus,
  type RepairResult,
} from '../api/wiskey-pairing';
import type { StateKind } from '../components/sw-badge';
import { formatTime, UTC_ZONE } from './wiskey-format';

const LINE_KIND: Record<PairingLineState, StateKind> = { ok: 'live', warn: 'stale', blocked: 'error', unknown: 'unknown' };
const LINE_TEXT: Record<PairingLineState, string> = { ok: 'תקין', warn: 'לתשומת לב', blocked: 'חסום', unknown: 'לא ידוע' };
const FEATURE_KIND: Record<FeatureState, StateKind> = { on: 'live', off: 'offline', blocked: 'error', unknown: 'unknown' };
const FEATURE_TEXT: Record<FeatureState, string> = { on: 'פעיל', off: 'כבוי', blocked: 'חסום', unknown: 'לא ידוע' };

/**
 * הגדרות › מתגי מסכי כניסה › "חיבור Arx ל-WisKey" (WISKEY-PAIRING-2382). One place that says whether Arx and WisKey are paired - the
 * bridge, the WisKey component, the pairing key, WisKey's acceptance (a signed read, "בדוק חיבור חתום"), the discovery contract, the media
 * path and the last error - each red line with a plain "how to fix" line; the guided re-pair when Arx can fix it itself; the exact owner
 * steps when the fix is on the other side; and "מצב WisKey": every built WisKey feature that is off right now, with its reasons.
 * Read only, except the two system-administrator actions (both confirmed / audited server-side). Never shows key material.
 */
@customElement('system-wiskey-pairing')
export class SystemWiskeyPairing extends LitElement {
  @state() private data: PairingStatus | null = null;
  @state() private busy: '' | 'load' | 'probe' | 'repair' = '';
  @state() private error = '';
  @state() private confirming = false;
  @state() private pauseRotation = true;
  @state() private result: RepairResult | null = null;
  @state() private copied = false;
  @state() private showFeatures = true;

  static styles = css`
    :host {
      display: block;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding-block-end: 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .top .sp {
      flex: 1 1 auto;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .lines {
      display: flex;
      flex-direction: column;
    }
    .line {
      display: grid;
      grid-template-columns: minmax(150px, 220px) auto 1fr;
      align-items: start;
      gap: 4px 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .line .lbl {
      font-weight: var(--sw-fw-medium);
    }
    .line .body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .fix {
      padding: 4px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      line-height: 1.45;
    }
    .fix.blocked {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .chip.on {
      background: var(--sw-accent-soft);
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-block: 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    .section:last-child {
      border-block-end: 0;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    ol {
      margin: 0;
      padding-inline-start: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .code {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .code code {
      padding: 4px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-family: var(--sw-font-mono, monospace);
      direction: ltr;
      unicode-bidi: isolate;
      overflow-wrap: anywhere;
    }
    .err {
      align-self: flex-start;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .group {
      display: flex;
      flex-direction: column;
    }
    .group h5 {
      margin: 8px 0 2px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .feat {
      display: grid;
      grid-template-columns: minmax(170px, 260px) auto 1fr;
      gap: 4px 12px;
      align-items: start;
      padding: 7px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .reasons {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .reason .kind {
      display: inline-block;
      margin-inline-end: 6px;
      padding: 0 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .reason .how {
      color: var(--sw-text-2);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .dfoot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-block-start: 12px;
    }
    label.chk {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    bdi {
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .line,
      .feat {
        grid-template-columns: 1fr auto;
      }
      .line .body,
      .feat .reasons {
        grid-column: 1 / -1;
      }
      .top sw-button {
        flex: 1 1 100%;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (isApi() && can('system.configure') && !onRemote()) void this.load();
  }

  private async load() {
    this.busy = 'load';
    this.error = '';
    try {
      this.data = await getPairingStatus();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  private async probe() {
    this.busy = 'probe';
    this.error = '';
    try {
      this.data = await probePairing();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  private async repair() {
    this.busy = 'repair';
    this.error = '';
    try {
      this.result = await repairPairing(this.pauseRotation);
      this.data = this.result.status;
      this.confirming = false;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  private async copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.copied = false;
    }
  }

  private renderFacts(l: PairingLine): TemplateResult | typeof nothing {
    const f = l.facts;
    if (l.key === 'discovery' && f.listed && typeof f.listed === 'object' && Object.keys(f.listed as object).length) {
      const listed = f.listed as Record<string, boolean>;
      return html`<div class="chips" data-wkp-listed>${Object.entries(listed).map(([c, on]) => html`<span class="chip ${on ? 'on' : ''}"><bdi>${c}</bdi> ${on ? '✓' : '✗'}</span>`)}</div>`;
    }
    if (l.key === 'provider') {
      return html`<div class="chips" data-wkp-provider><span class="chip">בחירה: <bdi>${String(f.choice ?? '')}</bdi></span>
        <span class="chip">רשימת ערוץ השירות: <bdi>${f.feed_reason ? String(f.feed_reason) : 'מפרסמת וידאו'}</bdi></span></div>`;
    }
    return nothing;
  }

  private renderLine(l: PairingLine) {
    return html`<div class="line" data-wkp-line=${l.key} data-state=${l.state}>
      <span class="lbl">${l.label}</span>
      <sw-badge kind=${LINE_KIND[l.state]} label=${LINE_TEXT[l.state]}></sw-badge>
      <div class="body"><span>${l.text}</span>${this.renderFacts(l)}${l.fix ? html`<span class="fix ${l.state === 'blocked' ? 'blocked' : ''}" data-wkp-fix>איך מתקנים: ${l.fix}</span>` : nothing}</div>
    </div>`;
  }

  private renderRepair(d: PairingStatus) {
    if (!d.repair.available && !this.result) return nothing;
    const r = this.result;
    return html`<div class="section" data-wkp-repair>
      <h4>צימוד מחדש</h4>
      ${r
        ? html`<div class="muted" data-wkp-repair-done>${r.announced ? 'נוצר קוד צימוד חדש והוא נשלח לגשר.' : 'נוצר קוד צימוד חדש. יש להזין אותו בגשר בתשתית המערכת.'}${r.rotation_paused ? ' החלפת מפתח הגשר כובתה.' : ''}</div>
            ${r.pairing_code
              ? html`<div class="code"><span>קוד הצימוד:</span><code data-wkp-code>${r.pairing_code}</code>
                  <sw-button size="sm" icon="copy" @click=${() => this.copy(r.pairing_code ?? '')}>${this.copied ? 'הועתק' : 'העתקה'}</sw-button></div>`
              : nothing}
            <ol data-wkp-repair-steps>${r.steps.map((s) => html`<li>${s}</li>`)}</ol>`
        : html`<div class="muted">Arx יכול לתקן את זה בעצמו: ליצור קוד צימוד חדש ${d.repair.announce ? 'ולשלוח אותו לגשר' : '(את הקוד מזינים בגשר בתשתית המערכת)'}. פעולה של מנהל מערכת, נרשמת ביומן.</div>
            <div><sw-button variant="danger" size="sm" icon="link" data-wkp-repair-open ?disabled=${!!this.busy} @click=${() => (this.confirming = true)}>צימוד מחדש</sw-button></div>`}
    </div>`;
  }

  private renderConfirm(d: PairingStatus) {
    if (!this.confirming) return nothing;
    return html`<sw-dialog open heading="צימוד מחדש של Arx ו־WisKey" data-wkp-confirm @close=${() => (this.confirming = false)}>
      <div class="dlg">
        <div>Arx ייצור קוד צימוד חדש. עד שהגשר יקבל אותו, פעולות דרך הגשר (פתיחת דלת, פעולות בהתקנים, רשימת המשתמשים) ו־WisKey לא יעבדו, וכל אישור קליטת כרטיס פתוח יבוטל.</div>
        <div>${d.repair.announce ? 'הקוד יישלח לגשר אוטומטית; ייתכן שתופיע בקשת אישור בתשתית המערכת.' : 'בהתקנה הזו הקוד לא נשלח אוטומטית: יוצגו כאן הקוד והשלבים להזנתו בגשר.'}</div>
        <label class="chk"><input type="checkbox" data-wkp-pause .checked=${this.pauseRotation} @change=${(e: Event) => (this.pauseRotation = (e.target as HTMLInputElement).checked)} />
          <span>לכבות גם את החלפת מפתח הגשר (מומלץ: החלפה מנתקת את WisKey)</span></label>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </div>
      <div class="dfoot"><sw-button variant="ghost" @click=${() => (this.confirming = false)}>ביטול</sw-button>
        <sw-button variant="danger" data-wkp-confirm-ok ?disabled=${this.busy === 'repair'} @click=${() => this.repair()}>${this.busy === 'repair' ? 'מצמד…' : 'צימוד מחדש'}</sw-button></div>
    </sw-dialog>`;
  }

  private renderFeature(f: FeatureRow) {
    return html`<div class="feat" data-wkp-feature=${f.key} data-state=${f.state}>
      <span>${f.label}</span>
      <sw-badge kind=${FEATURE_KIND[f.state]} label=${FEATURE_TEXT[f.state]}></sw-badge>
      <div class="reasons">
        ${f.reasons.map((r) => html`<div class="reason" data-wkp-reason=${r.code}><span class="kind">${KIND_TEXT[r.kind]}</span>${r.text}${r.fix ? html` <span class="how">· איך מפעילים: ${r.fix}</span>` : nothing}</div>`)}
        ${f.link ? html`<a href=${f.link.href} data-wkp-link>${f.link.label}</a>` : nothing}
      </div>
    </div>`;
  }

  private renderFeatures(d: PairingStatus) {
    if (!d.features.length) return nothing;
    const c = featureCounts(d.features);
    return html`<div class="section" data-wkp-features>
      <div class="top" style="border:0;padding:0">
        <h4>מצב WisKey: תכונות בנויות</h4>
        <span class="muted">${c.on} פעילות · ${c.off} כבויות · ${c.blocked} חסומות${c.unknown ? ` · ${c.unknown} לא ידוע` : ''}</span>
        <span class="sp"></span>
        <sw-button size="sm" variant="ghost" data-wkp-features-toggle @click=${() => (this.showFeatures = !this.showFeatures)}>${this.showFeatures ? 'הסתרה' : 'הצגה'}</sw-button>
      </div>
      ${this.showFeatures ? groupFeatures(d.features).map(([g, rows]) => html`<div class="group"><h5>${g}</h5>${rows.map((f) => this.renderFeature(f))}</div>`) : nothing}
    </div>`;
  }

  render() {
    if (!isApi() || !can('system.configure')) return nothing;
    const d = this.data;
    const remote = onRemote();
    return html`<sw-card heading="חיבור Arx ל-WisKey" subheading="האם Arx ו־WisKey מצומדים, מה חסר ואיך משלימים. הבדיקה החתומה היא קריאה בלבד ונרשמת ביומן." data-wkp-card>
      ${remote
        ? html`<div class="muted" data-wkp-remote>${LOCAL_ONLY_GENERIC}</div>`
        : html`<div class="top">
              ${d ? html`<sw-badge kind=${d.paired ? 'live' : d.paired === false ? 'error' : 'unknown'} filled label=${VERDICT_TEXT[d.verdict]} data-wkp-verdict=${d.verdict}></sw-badge>
                  <span class="muted" data-wkp-talk>${d.talk_ready ? 'דיבור דרך WisKey: מוכן' : 'דיבור דרך WisKey: לא מוכן'}</span>` : html`<span class="muted">${this.busy === 'load' ? 'טוען…' : ''}</span>`}
              <span class="sp"></span>
              ${d?.probe ? html`<span class="muted" data-wkp-checked>נבדק ב־<bdi>${formatTime(d.probe.at, 'he-IL', UTC_ZONE)}</bdi>${probeIsStale(d.probe) ? ' · בדיקה ישנה, מומלץ לבדוק שוב' : ''}</span>` : nothing}
              <sw-button size="sm" variant="primary" icon="shield" data-wkp-probe ?disabled=${!!this.busy} @click=${() => this.probe()}>${this.busy === 'probe' ? 'בודק…' : 'בדוק חיבור חתום'}</sw-button>
            </div>
            ${this.error && !this.confirming ? html`<div class="err" role="alert" style="margin-block-start:8px">${this.error}</div>` : nothing}
            ${d
              ? html`<div class="lines">${d.lines.map((l) => this.renderLine(l))}</div>
                  ${d.owner_steps.length ? html`<div class="section" data-wkp-steps><h4>מה נדרש מחוץ ל־Arx</h4><ol>${d.owner_steps.map((s) => html`<li>${s}</li>`)}</ol></div>` : nothing}
                  ${this.renderRepair(d)} ${this.renderFeatures(d)} ${this.renderConfirm(d)}`
              : nothing}`}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wiskey-pairing': SystemWiskeyPairing;
  }
}
