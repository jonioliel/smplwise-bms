import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { BULK_KIND_LABEL, followBulk, previewBulk, runBulk, type BulkKind, type BulkPreview, type BulkRecord } from '../api/device-bulk';
import type { BulkTarget } from '../api/home-site';
import { ltrNum } from '../i18n/bidi';

/** One building of the dialog: its requests (api/home-site.ts bulkTargets) and the tree's hint of what is on. */
export interface SiteOffBuilding {
  id: string;
  name: string;
  shared: boolean;
  targets: BulkTarget[];
  lightsOn: number;
  activeOn: number;
}

type Phase = 'closed' | 'pick' | 'loading' | 'confirm' | 'nothing' | 'running' | 'result' | 'error';

/**
 * MULTIBUILDING-HOME-2330: "כבה הכל" on a site of several buildings. In a building it names the building; at the site level it is only
 * this dialog: the buildings with a check each ("משותף" unchecked by default - home.screen.site_off_shared), then the server's previews
 * and a STRONG confirmation (a second step with the exact count, and for more than one building an explicit "I confirm" check).
 *
 * It never sends anything of its own: every request is the existing safe bulk path (api/device-bulk.ts) - one preview per platform floor /
 * area of the chosen buildings (the server decides the entity set and the permission), then `runBulk` with that preview's digest, only
 * from the confirm button. The building-wide server scope (= the whole installation) is never used here.
 */
@customElement('home-site-off')
export class HomeSiteOff extends LitElement {
  @state() private phase: Phase = 'closed';
  @state() private kind: BulkKind = 'all_off';
  @state() private buildings: SiteOffBuilding[] = [];
  @state() private checked: Record<string, boolean> = {};
  @state() private single = false;
  @state() private ack = false;
  @state() private previews: { b: string; p: BulkPreview }[] = [];
  @state() private records: BulkRecord[] = [];
  @state() private error = '';
  private follow: { stopped: boolean } | null = null;

  static styles = css`
    .lead {
      margin: 0 0 6px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
    }
    .list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list li + li {
      border-block-start: 1px solid var(--sw-border);
    }
    label.b {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      cursor: pointer;
      font-size: var(--sw-fs-base);
      color: var(--sw-text);
    }
    label.b input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
    }
    label.b.shared .nm {
      color: var(--sw-shared-text);
    }
    label.b.shared input {
      accent-color: var(--sw-shared);
    }
    .nm {
      font-weight: var(--sw-fw-semibold);
    }
    .hint {
      margin-inline-start: auto;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
    }
    .note {
      margin-block-start: 10px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    .big {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-block-end: 6px;
    }
    .ack {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-block-start: 12px;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-danger-text);
      cursor: pointer;
    }
    .ack input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-danger);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-weight: var(--sw-fw-semibold);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 10px;
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: 12px;
    }
    .headline {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
    }
    .headline.ok {
      color: var(--sw-success-text, var(--sw-success));
    }
    .headline.partial {
      color: var(--sw-warning-text, var(--sw-warning));
    }
    .bar {
      block-size: 12px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      overflow: hidden;
      margin-block: 8px;
    }
    .bar > div {
      block-size: 100%;
      background: var(--sw-success);
      transition: inline-size var(--sw-t-med) var(--sw-ease);
    }
  `;

  get running(): boolean {
    return this.phase === 'running' || this.phase === 'loading';
  }

  /** Open for one building (`single`: no list, the building is named) or for the site (the list with checks). */
  show(o: { kind: BulkKind; buildings: SiteOffBuilding[]; checked: Record<string, boolean>; single: boolean }) {
    if (this.running) return;
    this.kind = o.kind;
    this.buildings = o.buildings;
    this.checked = { ...o.checked };
    this.single = o.single;
    this.ack = false;
    this.previews = [];
    this.records = [];
    this.error = '';
    this.phase = 'pick';
    if (o.single) void this.load();
  }

  private close = () => {
    if (this.phase === 'loading') return;
    this.phase = 'closed';
  };

  private chosen(): SiteOffBuilding[] {
    return this.buildings.filter((b) => this.checked[b.id]);
  }

  /** The server's preview of every request of the chosen buildings (what it would send, by its own rules). */
  private async load() {
    const chosen = this.chosen();
    this.phase = 'loading';
    if (!isApi()) {
      // the static demo has no server: the numbers are the tree's hint and nothing can be sent
      this.previews = [];
      this.phase = chosen.some((b) => b.activeOn > 0) ? 'confirm' : 'nothing';
      return;
    }
    try {
      const out: { b: string; p: BulkPreview }[] = [];
      for (const b of chosen) for (const t of b.targets) out.push({ b: b.id, p: await previewBulk(t.scope, t.id, this.kind) });
      this.previews = out.filter((x) => x.p.count > 0);
      this.phase = this.previews.length ? 'confirm' : 'nothing';
    } catch (err) {
      this.error = err instanceof ApiError && err.status === 403 ? 'אין לך הרשאה לפעולות מרוכזות בהיקף הזה.' : describeError(err);
      this.phase = 'error';
    }
  }

  private async confirm() {
    if (this.phase !== 'confirm' || !isApi() || (!this.single && this.chosen().length > 1 && !this.ack)) return;
    this.phase = 'running';
    try {
      const first: BulkRecord[] = [];
      for (const x of this.previews) first.push(await runBulk(x.p.scope, x.p.id, this.kind, x.p.digest));
      this.records = first;
      this.follow = { stopped: false };
      await Promise.all(first.map((r, i) => followBulk(r, (n) => (this.records = this.records.map((o, j) => (j === i ? n : o))), this.follow!)));
      this.phase = 'result';
      this.dispatchEvent(new CustomEvent('bulk-done', { bubbles: true, composed: true }));
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'target_changed'
        ? 'רשימת ההתקנים השתנתה מאז שנפתח החלון, ולכן חלק מהפקודות לא נשלחו. פתחו את הפעולה מחדש.'
        : describeError(err);
      this.phase = 'error';
      this.dispatchEvent(new CustomEvent('bulk-done', { bubbles: true, composed: true }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.follow) this.follow.stopped = true;
  }

  render() {
    if (this.phase === 'closed') return html`<sw-dialog data-site-off="closed"></sw-dialog>`;
    const chosen = this.chosen();
    const heading = this.single ? `${BULK_KIND_LABEL[this.kind]} ב${chosen[0]?.name ?? ''}` : `${BULK_KIND_LABEL[this.kind]} באתר?`;
    return html`<sw-dialog open ?locked=${this.phase === 'loading'} data-site-off=${this.phase} heading=${heading} @close=${this.close}>${this.body(chosen)}</sw-dialog>`;
  }

  private body(chosen: SiteOffBuilding[]) {
    const cancel = (label = 'ביטול') => html`<sw-button data-site-off-cancel autofocus @click=${this.close}>${label}</sw-button>`;
    if (this.phase === 'pick') {
      const total = this.buildings.reduce((s, b) => s + b.activeOn, 0);
      const sharedOff = this.buildings.some((b) => b.shared && !this.checked[b.id]);
      return html`<p class="lead">תאורה, מתגים, מיזוג, תריסים ומסכים - ${ltrNum(total)} פעילים ב־${ltrNum(this.buildings.length)} בניינים. בחרו מה נכלל:</p>
        <ul class="list" data-site-off-list>
          ${this.buildings.map((b) => html`<li><label class=${classMap({ b: true, shared: b.shared })}>
            <input type="checkbox" data-site-off-building=${b.id} .checked=${!!this.checked[b.id]} @change=${(e: Event) => (this.checked = { ...this.checked, [b.id]: (e.target as HTMLInputElement).checked })} />
            <span class="nm">${b.name}</span><span class="hint">${ltrNum(b.lightsOn)} דולקות · ${ltrNum(b.activeOn)} פעילים</span>
          </label></li>`)}
        </ul>
        ${sharedOff ? html`<div class="note" data-site-off-shared-note>"משותף" (חניון, שער, חדר חשמל) לא נכלל כברירת מחדל - הגדרה בהגדרות המסך הראשי.</div>` : nothing}
        <div class="actions">${cancel()}<sw-button variant="danger" icon="bolt" data-site-off-next ?disabled=${!chosen.length} @click=${() => void this.load()}>המשך · ${ltrNum(chosen.length)} בניינים</sw-button></div>`;
    }
    if (this.phase === 'loading') return html`<div class="muted" data-site-off-loading>בודק מה דולק…</div><div class="actions">${cancel()}</div>`;
    if (this.phase === 'error') return html`<div class="err" data-site-off-error>${this.error}</div><div class="actions">${cancel('סגור')}</div>`;
    if (this.phase === 'nothing') return html`<div class="big" data-site-off-nothing>אין מה לכבות</div><div class="muted">בבחירה הזאת הכול כבר כבוי או שאין התקנים שאושרו לפעולה קבוצתית.</div><div class="actions">${cancel('סגור')}</div>`;
    if (this.phase === 'confirm') {
      const demo = !isApi();
      const count = demo ? chosen.reduce((s, b) => s + b.activeOn, 0) : this.previews.reduce((s, x) => s + x.p.count, 0);
      const many = !this.single && chosen.length > 1;
      const where = this.single ? chosen[0]?.name ?? '' : `${ltrNum(chosen.length)} בניינים`;
      return html`<div class="big" data-site-off-question data-count=${count}>${BULK_KIND_LABEL[this.kind]} ב${this.single ? '' : '־'}${where}: ${ltrNum(count)} התקנים</div>
        <ul class="list">${chosen.map((b) => {
          const n = demo ? b.activeOn : this.previews.filter((x) => x.b === b.id).reduce((s, x) => s + x.p.count, 0);
          return html`<li class="muted" data-site-off-sum=${b.id}>${b.name} · ${ltrNum(n)} התקנים</li>`;
        })}</ul>
        ${many ? html`<label class="ack"><input type="checkbox" data-site-off-ack .checked=${this.ack} @change=${(e: Event) => (this.ack = (e.target as HTMLInputElement).checked)} />אני מאשר כיבוי ב־${ltrNum(chosen.length)} בניינים</label>` : nothing}
        ${demo ? html`<div class="note">נתוני הדגמה: אין שרת מחובר, לא יישלח דבר.</div>` : nothing}
        <div class="actions">${cancel()}<sw-button variant="danger" icon="bolt" data-site-off-confirm ?disabled=${demo || (many && !this.ack)} @click=${() => void this.confirm()}>${BULK_KIND_LABEL[this.kind]} (${ltrNum(count)})</sw-button></div>`;
    }
    const total = this.records.reduce((s, r) => s + r.counts.total, 0);
    const ok = this.records.reduce((s, r) => s + r.counts.confirmed + (r.counts.sent ?? 0), 0);
    const done = this.phase === 'result';
    const pct = total ? Math.round((ok / total) * 100) : 0;
    return html`<div class=${classMap({ headline: true, ok: done && ok === total, partial: done && ok < total })} data-site-off-result=${done ? (ok === total ? 'ok' : 'partial') : 'running'}>
        ${done ? (ok === total ? 'בוצע' : `בוצע חלקית: ${ltrNum(total - ok)} לא אושרו`) : `${ltrNum(ok)} מתוך ${ltrNum(total)} אושרו`}
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${total} aria-valuenow=${ok} aria-label="אושרו"><div style=${`inline-size:${pct}%`}></div></div>
      <div class="muted">${done ? 'התקן ייחשב כבוי רק כשיתקבל דיווח על כך.' : 'אפשר לסגור את החלון; הפעולה ממשיכה בשרת.'}</div>
      <div class="actions">${cancel('סגור')}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-site-off': HomeSiteOff;
  }
}
