import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import type { DropdownItem } from '../components/sw-dropdown';
import type { StateKind } from '../components/sw-badge';
import { getParity, type ParityReply, type ParityReport, type ParityRow } from '../api/access-parity';
import { listUsers, type DirectoryUser } from '../api/access';
import { can, isApi } from '../api/session';
import { Resource } from '../access-control/status-feed';
import { CELL, statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { CHECKLIST, CLASSIC_SEGMENTS, checklistProgress, countText, loadChecklist, outcomeText, outcomeTone, rowLinks, saveChecklist, screenText, toggleItem, whyText, type ChecklistState } from '../access-control/parity-logic';
import { whenOf } from '../access-control/status-logic';
import { whenText } from '../access-control/status-text';
import { WISKEY_SCREENS, WISKEY_SCREEN_SEGMENT, WISKEY_UI, type WiskeyScreen } from '../shell/nav';
import type { DisplayZone } from '../api/intercom';
import { bubbleChrome } from '../styles/bubble-chrome';
import { pt } from '../i18n/access-parity';

const HOURS = [24, 168] as const;

/** A link inside a table cell (the table's own shadow root: inline, tokens only), a 44 px target. */
const LINK = 'display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0 12px;box-sizing:border-box;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-pill);color:var(--sw-text);text-decoration:none;font-size:var(--sw-fs-sm)';

/** The viewer's own zone: when the report ran is said in the time of whoever reads it. */
function viewerZone(): DisplayZone {
  try {
    return { kind: 'iana', name: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
  } catch {
    return { kind: 'iana', name: 'UTC' };
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * CR-036 S12 (section 6.2): "השוואה למסכי האינטרקום" - in Settings › כללי › מתגי מסכי כניסה, under the per-screen switch it informs
 * (owner answer 4 of 2026-10-11: a screen moves to Arx after its side-by-side check), for administrators of every station.
 * 1. The parity report: per native screen, how many records a direct read of the intercom holds, how many the native screen shows for
 *    the chosen user, and why they differ (the permission rule that filtered) - counts only, never a name. It is asked only on the button
 *    (one report reads the integration about 30 times). A system administrator may run it for another Arx user (CR-036 6.2 step 2: the
 *    three identities), from the users directory.
 * 2. The side-by-side checklist (step 3): per screen that has a switch, the native screen and the classic panel open side by side, and
 *    what to compare; the ticks are kept in this browser only.
 */
@customElement('system-access-parity')
export class SystemAccessParity extends LitElement {
  /** The page's refresh counter: a change runs the report again only when one was already run. */
  @property({ type: Number }) rev = 0;
  @state() private subject = '';
  @state() private hours: number = HOURS[0];
  @state() private users: DirectoryUser[] = [];
  @state() private ticks: ChecklistState = {};
  @state() private asked = false;

  private res!: Resource<ParityReport, ParityReply>;
  private lastRev = 0;

  static styles = [
    statusStyles,
    css`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
      .chk {
        display: flex;
        flex-direction: column;
        border-block-start: 1px solid var(--sw-border);
        padding: 8px 14px 12px;
        gap: 4px;
      }
      .chk-head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 12px;
        min-block-size: var(--_t);
      }
      .chk-head .t {
        flex: 1 1 160px;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .chk-head a {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: var(--_t);
        padding: 0 12px;
        box-sizing: border-box;
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-pill);
        color: var(--sw-text);
        text-decoration: none;
        font-size: var(--sw-fs-sm);
      }
      .chk-head a:hover {
        background: var(--sw-hover-wash);
      }
      label.item {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: var(--_t);
        color: var(--sw-text-2);
        cursor: pointer;
      }
      label.item input {
        inline-size: 20px;
        block-size: 20px;
        margin: 0;
        accent-color: var(--sw-accent);
        flex: none;
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.res = new Resource({
      fetch: () => getParity({ asUser: this.subject || undefined, hours: this.hours }),
      pick: (r: ParityReply) => r.parity,
      onChange: () => this.requestUpdate(),
    });
    this.ticks = loadChecklist(browserStorage());
    // another user's view needs system.configure on the server; the directory may refuse the list (then the report is the caller's own)
    if (isApi() && can('system.configure')) {
      listUsers()
        .then((d) => (this.users = d.users.filter((u) => u.active && !u.is_self)))
        .catch(() => (this.users = []));
    }
  }

  disconnectedCallback(): void {
    this.res?.dispose();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      if (this.asked) void this.res.reload();
    }
  }

  private run(): void {
    this.asked = true;
    void this.res.reload();
  }

  private subjectItems(): DropdownItem[] {
    return [{ id: '', label: pt('subjectMe') }, ...this.users.map((u) => ({ id: u.id, label: u.name || u.username || u.id }))];
  }

  private hourItems(): DropdownItem[] {
    return HOURS.map((h) => ({ id: String(h), label: h === 24 ? pt('window24') : pt('window168') }));
  }

  private switchedOn = (segment: string): boolean | null => {
    const screen = WISKEY_SCREENS.find((s) => WISKEY_SCREEN_SEGMENT[s] === segment);
    return screen ? WISKEY_UI[screen] === 'smplwise' : null;
  };

  private openCell(row: ParityRow): TemplateResult | string {
    const l = rowLinks(row.route, this.switchedOn);
    if (!l.native && !l.classic) return '—';
    return html`<span style=${CELL.row}>
      ${l.native ? html`<a style=${LINK} href=${l.native} target="_blank" rel="noopener" data-parity-open="native">${pt('openArx')}</a>` : nothing}
      ${l.classic ? html`<a style=${LINK} href=${l.classic} target="_blank" rel="noopener" data-parity-open="classic">${pt('openClassic')}</a>` : nothing}
    </span>`;
  }

  private table(report: ParityReport): TemplateResult {
    const rec = (x: Record<string, unknown>) => x as unknown as ParityRow;
    const columns: TableColumn[] = [
      { key: 'screen', label: pt('colScreen'), render: (x) => html`<span style=${CELL.strong}>${screenText(rec(x).screen)}</span>` },
      { key: 'source', label: pt('colSource'), render: (x) => countText(rec(x).source) },
      {
        key: 'native',
        label: pt('colNative'),
        render: (x) => {
          const r = rec(x);
          return html`<span>${countText(r.native)}${r.outcome === 'filtered' && r.expected_count !== null ? html`<span style=${CELL.sub}>${pt('expected', { n: r.expected_count })}</span>` : nothing}</span>`;
        },
      },
      { key: 'outcome', label: pt('colOutcome'), render: (x) => html`<sw-badge data-parity-outcome=${rec(x).outcome} kind=${outcomeTone(rec(x).outcome) as StateKind} label=${outcomeText(rec(x).outcome)}></sw-badge>` },
      {
        key: 'why',
        label: pt('colWhy'),
        render: (x) => {
          const r = rec(x);
          const why = whyText(r);
          return html`<span>${why || nothing}${r.reason ? html`<span style=${why ? CELL.sub : CELL.raw}><span style=${CELL.raw}>${r.reason}</span></span>` : nothing}${!why && !r.reason ? '—' : nothing}</span>`;
        },
      },
      { key: 'open', label: pt('colOpen'), render: (x) => this.openCell(rec(x)) },
    ];
    return html`<sw-table data-parity-table .columns=${columns} .rows=${report.screens as unknown as Record<string, unknown>[]} rowKey="screen"></sw-table>`;
  }

  private report(): TemplateResult {
    const s = this.res.snap;
    const r = s.data;
    let body: TemplateResult;
    if (!this.asked) body = html`<div class="empty" data-parity-idle>${pt('notRun')}</div>`;
    else if (s.busy && !r) body = skeletonRows(6);
    else if (!r) return html`<sw-card flush data-access-card="parity">${this.head()}${failurePanel(s.failure ?? 'error', s.message, () => this.run())}</sw-card>`;
    else body = this.table(r);
    const now = new Date();
    return html`<sw-card flush data-access-card="parity" data-parity-state=${!this.asked ? 'idle' : s.busy ? 'busy' : r ? 'ready' : 'failed'}>
      ${this.head()}
      ${s.failure && r ? html`<div class="note err" role="alert" data-parity-failed><sw-icon name="warning" size=${16}></sw-icon><span>${s.message || outcomeText('unavailable')}</span></div>` : nothing}
      ${body}
      ${r
        ? html`<div class="foot-note" data-parity-foot>${[
            pt('ranFor', { name: r.subject.self ? pt('subjectMe') : r.subject.display_name, when: s.fetchedAt ? whenText(whenOf(s.fetchedAt, now, viewerZone())) : '' }),
            pt('windowNote', { n: r.window_hours }),
            pt('summary', { match: r.summary.match ?? 0, filtered: r.summary.filtered ?? 0, mismatch: r.summary.mismatch ?? 0 }),
          ].join(' · ')}</div>`
        : nothing}
    </sw-card>`;
  }

  private head(): TemplateResult {
    const busy = this.res.snap.busy;
    return html`<div class="ch">
      <div><h3>${pt('title')}</h3><div class="sub">${pt('sub')}</div></div>
      <div class="ctl">
        ${this.users.length ? html`<sw-dropdown tall data-parity-subject label=${pt('subject')} .items=${this.subjectItems()} .value=${this.subject} @change=${(e: CustomEvent<{ id: string }>) => (this.subject = e.detail.id)}></sw-dropdown>` : nothing}
        <sw-dropdown tall data-parity-hours label=${pt('window')} .items=${this.hourItems()} .value=${String(this.hours)} @change=${(e: CustomEvent<{ id: string }>) => (this.hours = Number(e.detail.id) || HOURS[0])}></sw-dropdown>
        <sw-button size="lg" variant="primary" icon="refresh" data-parity-run ?disabled=${busy} @click=${() => this.run()}>${busy ? pt('running') : pt('run')}</sw-button>
      </div>
    </div>`;
  }

  private tick(screen: string, item: string): void {
    this.ticks = toggleItem(this.ticks, screen, item);
    saveChecklist(browserStorage(), this.ticks);
  }

  private clearTicks(): void {
    this.ticks = {};
    saveChecklist(browserStorage(), {});
  }

  private checklist(): TemplateResult {
    const screens = CHECKLIST.filter((c) => (WISKEY_SCREENS as string[]).includes(c.screen));
    const progress = checklistProgress(this.ticks, screens);
    return html`<sw-card flush data-access-card="parity-checklist">
      <div class="ch">
        <div><h3>${pt('checklistTitle')}</h3><div class="sub">${pt('checklistSub')}</div></div>
        <div class="ctl">
          <span class="muted" data-parity-progress>${pt('checklistDone', progress)}</span>
          ${progress.done ? html`<sw-button size="lg" variant="ghost" data-parity-clear @click=${() => this.clearTicks()}>${pt('checklistClear')}</sw-button>` : nothing}
        </div>
      </div>
      ${screens.map((c) => {
        const segment = WISKEY_SCREEN_SEGMENT[c.screen as WiskeyScreen];
        const href = `#/wiskey/${segment}`;
        return html`<div class="chk" data-parity-checklist=${c.screen}>
          <div class="chk-head">
            <span class="t">${pt(c.label)}</span>
            ${WISKEY_UI[c.screen as WiskeyScreen] === 'smplwise' ? html`<a href=${href} target="_blank" rel="noopener" data-parity-open="native">${pt('openArx')}</a>` : nothing}
            ${CLASSIC_SEGMENTS.includes(segment) ? html`<a href=${`${href}?classic=1`} target="_blank" rel="noopener" data-parity-open="classic">${pt('openClassic')}</a>` : nothing}
          </div>
          ${c.items.map(
            (item) => html`<label class="item"><input type="checkbox" data-parity-item=${`${c.screen}:${item}`} .checked=${!!this.ticks[c.screen]?.[item]} @change=${() => this.tick(c.screen, item)} /><span>${pt(item)}</span></label>`,
          )}
        </div>`;
      })}
    </sw-card>`;
  }

  render() {
    return html`<div class="stack" data-access-status="ready">${this.report()}${this.checklist()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-parity': SystemAccessParity;
  }
}
