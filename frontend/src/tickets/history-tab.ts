import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { bidi } from '../i18n/bidi';
import { ticketsApi, type TicketDetail } from '../api/tickets';
import { buildTimeline, filterCounts, filterItems, HISTORY_FILTERS, linkAuditRows, windowLast, type FeedItem, type HistoryFilter } from './conversation-model';
import { cvt, type ConvTextKey } from './conversation-text';
import { actorName, marksInternal, shortDateTime } from './model';
import { tIcon } from './icons';
import { tt } from './text';
import { timelineLine } from './timeline-line';

/** The History timeline shows the newest 60 rows, "הצג הכול" renders the rest in place (never an inner scroll box). */
const HISTORY_WINDOW = 60;
const FILTER_LABEL: Record<HistoryFilter, ConvTextKey> = { all: 'f_all', messages: 'f_messages', notes: 'f_notes', status: 'f_status', costs: 'f_costs' };

export interface HistoryCtx {
  /** the handler link panel (tickets/link-panel.ts, managers only): copy / new / revoke / send again - the audit card's actions */
  link: TemplateResult | typeof nothing;
}

/**
 * TKUI2 (release 2.6.0): the History tab of the request (IA §4.1, mock-up v5 `tabHistory`), rendered inside `<ticket-detail>`'s one
 * scroll container:
 *   - the full timeline (newest first, the same model as the Conversation tab - tickets/conversation-model.ts) with the filter chips
 *     הכול / הודעות / הערות / מצב / עלויות and their counts (contract §6 filters); `#timeline` stays the anchor of the card's "ציר זמן";
 *   - the files: every photo of the request with when, internal or visible to the vendor;
 *   - the audit card: the handler link (state, opens, devices, expiry and its copy / new / revoke actions - the link panel) and the
 *     link's audit rows (opened / copied / new / revoked, who and when).
 */
export class HistoryTab implements ReactiveController {
  private filter: HistoryFilter = 'all';
  private all = false;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {}

  reset(): void {
    this.filter = 'all';
    this.all = false;
  }

  private pick(f: HistoryFilter): void {
    this.filter = f;
    this.all = false;
    this.host.requestUpdate();
  }

  render(t: TicketDetail, ctx: HistoryCtx): TemplateResult {
    const items = buildTimeline(t);
    const counts = filterCounts(items);
    const rows = filterItems(items, this.filter);
    const win = windowLast(rows, this.all, HISTORY_WINDOW);
    const marks = marksInternal(t);
    const depts = t.department ? { [t.department.id]: t.department.name } : {};
    return html`<section class="sect" data-sect="timeline" id="timeline">
        <h4><span class="tag t1">${tIcon('clock')}</span>${cvt('h_timeline')}<span class="cnt">${rows.length}</span></h4>
        <div class="hv-chips" role="group" aria-label=${cvt('h_filters')} data-history-filters>
          ${HISTORY_FILTERS.map((f) => html`<button type="button" class=${`hv-chip${this.filter === f ? ' on' : ''}`} aria-pressed=${String(this.filter === f)}
            data-history-filter=${f} ?disabled=${f !== 'all' && !counts[f]} @click=${() => this.pick(f)}>
            <span>${cvt(FILTER_LABEL[f])}</span><small class="n">${counts[f]}</small></button>`)}
        </div>
        <ol class="tline" data-timeline data-history-filter-active=${this.filter} aria-live="off">
          ${repeat([...win.shown].reverse(), (e) => e.id, (e) => this.row(e, marks, depts))}
        </ol>
        ${rows.length ? nothing : html`<p class="slot-note" data-history-empty>${cvt('h_empty_filter')}</p>`}
        ${win.hidden ? html`<button type="button" class="btn sm quiet hv-all" data-history-all @click=${() => { this.all = true; this.host.requestUpdate(); }}>
          ${tIcon('clock')}${cvt('h_more', { n: win.hidden })}</button>` : nothing}
      </section>
      ${this.files(t)}
      ${this.audit(items, ctx)}`;
  }

  private row(e: FeedItem, marks: boolean, depts: Record<string, string>): TemplateResult {
    const ev = e.event!;
    const line = timelineLine(ev, depts);
    const internal = marks && !e.external && (e.kind === 'note' || e.kind === 'photo');
    return html`<li data-kind=${e.kind} data-event=${e.id} data-type=${e.type}>
      <span class="ring">${tIcon(line.icon)}</span>
      <div class="tx">
        <span class="meta">${shortDateTime(e.at)} · ${bidi(actorName(ev))}${internal ? html` · <b>${tt('internal')}</b>` : nothing}</span>
        <span class="line">${line.text}</span>
        ${e.body ? html`<div class="body">${e.body}</div>` : nothing}
      </div>
    </li>`;
  }

  private files(t: TicketDetail): TemplateResult {
    const marks = marksInternal(t);
    const list = [...t.attachments].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return html`<section class="sect" data-sect="files">
      <h4><span class="tag">${tIcon('image')}</span>${cvt('h_files')}<span class="cnt">${list.length || ''}</span></h4>
      ${list.length ? html`<div class="hv-files">${repeat(list, (a) => a.id, (a, i) => html`<a class="blk hv-file" href=${ticketsApi().photoUrl(a)} target="_blank" rel="noopener" data-file=${a.id}>
          <img src=${ticketsApi().photoUrl(a)} alt="" loading="lazy" decoding="async" />
          <span class="bt"><span class="who">${cvt('file_photo', { n: list.length - i })}</span>
            <small>${shortDateTime(a.at)}${a.mine ? html` · ${cvt('file_mine')}` : nothing}${marks ? html` · <span data-file-scope=${a.external ? 'external' : 'internal'}>${a.external ? cvt('file_vendor') : cvt('file_internal')}</span>` : nothing}</small></span>
          ${tIcon('eye')}
        </a>`)}</div>` : html`<p class="slot-note" data-files-empty>${cvt('h_files_none')}</p>`}
    </section>`;
  }

  private audit(items: FeedItem[], ctx: HistoryCtx): TemplateResult | typeof nothing {
    const rows = linkAuditRows(items);
    if (ctx.link === nothing && !rows.length) return nothing;
    return html`<section class="sect" data-sect="audit">
      <h4><span class="tag">${tIcon('eye')}</span>${cvt('h_audit')}<span class="cnt">${rows.length || ''}</span></h4>
      ${ctx.link}
      ${rows.length ? html`<ol class="hv-audit" data-link-audit>${rows.map((e) => {
        const line = timelineLine(e.event!);
        return html`<li class="blk" data-audit=${e.kind}><span class="bi">${tIcon(line.icon)}</span>
          <span class="bt"><span class="who">${line.text}</span><small>${shortDateTime(e.at)} · ${bidi(actorName(e.event!))}</small></span></li>`;
      })}</ol>` : html`<p class="slot-note" data-audit-empty>${cvt('h_audit_none')}</p>`}
    </section>`;
  }
}

export const historyStyles = css`
  .hv-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hv-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 36px;
    padding-inline: 12px;
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-solid);
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .hv-chip .n {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-variant-numeric: tabular-nums;
  }
  .hv-chip.on {
    background: var(--dv-accent-soft);
    border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    color: var(--dv-accent-text);
  }
  .hv-chip.on .n {
    color: inherit;
  }
  .hv-chip:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .hv-chip:focus-visible,
  .hv-file:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 1px;
  }
  .hv-all {
    align-self: center;
  }
  .hv-files {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .hv-file {
    text-decoration: none;
    color: inherit;
  }
  .hv-file img {
    flex: none;
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--sw-r-md);
    object-fit: cover;
    background: var(--dv-surface-3);
  }
  .hv-file .ic {
    color: var(--dv-text-3);
  }
  .hv-audit {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  @media (max-width: 767px) {
    .hv-chip,
    .hv-all {
      min-block-size: 44px;
    }
    .hv-files {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;
