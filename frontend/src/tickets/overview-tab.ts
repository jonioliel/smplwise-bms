import { css, html, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import { rfqVendorFileUrl, type TicketDetail, type TicketEvent } from '../api/tickets';
import type { LinkBlock } from '../api/tickets-s4';
import { formatMoney } from './cost-model';
import { dwt, type DrawerTextKey } from './drawer-text';
import type { DrawerTab } from './drawer-model';
import { tIcon } from './icons';
import { relTime, shortDateTime } from './model';
import { canChangeOwner, ownerView } from './owner-model';
import { initials } from './status-block';
import { etaText, slaState } from './status-sentence';
import { ticketsLang } from './text';
import { lt } from './org-locations-text'; // CR-ORG-LOCATIONS
import { showOnMapHref } from './org-locations-model'; // ORGPLAN-291

/**
 * TKUI1 (release 2.6.0): the Overview tab (סקירה) of the request - IA §4.1 / wireframe §6.1, mock-up v5 `tabOverview()`:
 *   People  - the handler card (name, kind, since, the link line "קישור פעיל · נפתח N פעמים"; "החלף" for a manager), the requester line.
 *             The internal owner ("אחראי בארגון", TKUI3B, contract v1.4 §2): its line under the handler for the full view; "החלפה" / "קביעת
 *             אחראי" for the manager of an open request. A limited viewer or an older server shows nothing (hidden, never "unknown").
 *   Now     - at most four rows, empty rows hidden: the ETA, the last message (→ שיחה), the cost line (→ עלויות), the SLA target while far.
 *   Facts   - place, device, department · category, priority, opened; the description folded after three lines ("עוד").
 *   Photos  - one row (the host renders it: add / remove keep their existing behaviour) and the device-history fold.
 * Pure rendering inside `<ticket-detail>`'s shadow root (`overviewStyles`); the host owns state (`descOpen`) and every action.
 */

export interface OverviewCtx {
  now: Date;
  busy: boolean;
  descOpen: boolean;
  onToggleDesc: () => void;
  onTab: (tab: DrawerTab) => void;
  onReassign: (() => void) | null;
  onEdit: (() => void) | null;
  /** TKUI3B: the manager of an open request may change the internal owner ("אחראי בארגון"), else null */
  onChangeOwner?: (() => void) | null;
  /** the address of the ticket this one duplicates (cancelled as a duplicate), or '' */
  duplicateHref: string;
  /** TKRFQ4: the address of another item (the siblings of a split work order) in the host's mode */
  hrefOf?: (id: string) => string;
  /** the photo row (the host's existing block, limited to one row) */
  photos: TemplateResult | typeof nothing;
  /** the handler link panel (tickets/link-panel.ts, managers only) under the handler card: copy / new / revoke / send again stay one tap away */
  link: TemplateResult | typeof nothing;
  /** the device-history section (tickets/ticket-device-context.ts) or nothing */
  device: TemplateResult | typeof nothing;
}

const MESSAGE_KINDS = ['inbound', 'late_reply', 'note', 'message'];

/** The last message-like row with a body (a handler's reply, a note), for the "הודעה אחרונה" row. */
export function lastMessage(events: readonly TicketEvent[]): TicketEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (MESSAGE_KINDS.includes(e.kind) && e.body && e.body.trim()) return e;
  }
  return null;
}

/** The cost one-liner of the Now row: the stage in the new words (never the retired term) and, for who may see them, the amount. */
export function costLine(t: Pick<TicketDetail, 'cost'>): { text: string; tone: '' | 'warn' | 'ok' | 'info'; amount: string } | null {
  const c = t.cost;
  if (!c || c.status === 'not_required') return null;
  const key: Record<string, DrawerTextKey> = { awaiting: 'cs_awaiting', submitted: c.can_decide ? 'cs_submitted_mine' : 'cs_submitted', rejected: 'cs_rejected', approved: 'cs_approved', paid: 'cs_paid' };
  const tone = c.status === 'submitted' ? 'warn' : c.status === 'approved' || c.status === 'paid' ? 'ok' : c.status === 'rejected' ? 'warn' : 'info';
  const amount = c.can_view && c.total_minor != null && c.currency ? formatMoney(c.total_minor, c.currency, ticketsLang()) : '';
  return { text: dwt(key[c.status]), tone, amount };
}

function linkLine(l: LinkBlock | null | undefined): { text: string; tone: 'ok' | '' } | null {
  if (!l) return null;
  if (l.state === 'live' && l.first_opened_at) return { text: dwt('linkActive', { n: l.open_count }), tone: 'ok' };
  if (l.state === 'live') return { text: dwt('linkNotOpened'), tone: '' };
  return { text: dwt('linkOther'), tone: '' };
}

function people(t: TicketDetail & { link?: LinkBlock | null }, ctx: OverviewCtx): TemplateResult {
  const a = t.assignee;
  const ext = a?.kind === 'contact';
  const asg = t.assignments.filter((x) => !x.ended_at).at(-1);
  const staff = ext && t.link?.kind === 'staff';
  const role = !a ? '' : staff ? dwt('roleStaff') : ext ? dwt('roleVendor') : dwt('roleUser');
  const link = ext ? linkLine(t.link) : null;
  return html`<section class="sect" data-ov="people">
    <h4><span class="tag t5">${tIcon('users')}</span>${dwt('ovPeople')}</h4>
    ${a ? html`<div class=${`person ${ext ? 'ext' : 'int'}`} data-person="handler" data-assignee=${a.id ?? ''}>
      <span class=${`av lg ${ext ? 'ext' : 'int'}`} aria-hidden="true">${initials(a.name)}</span>
      <div class="pt">
        <div class="nm"><b>${bidi(a.name)}</b><span class="role">${role}${a.since ? ` · ${relTime(a.since, ctx.now)}` : ''}</span></div>
        ${link || asg?.channel === 'whatsapp' ? html`<div class="meta">
          ${asg?.channel === 'whatsapp' ? html`<span class="chan">${tIcon('send')}WhatsApp</span>` : nothing}
          ${link ? html`<span class=${`chan ${link.tone}`} data-link-line>${tIcon('link')}${link.text}</span>` : nothing}

        </div>` : nothing}
      </div>
      ${ctx.onReassign ? html`<button type="button" class="btn sm quiet" data-ov-reassign data-assign ?disabled=${ctx.busy} @click=${ctx.onReassign}>${tIcon('refresh')}${dwt('a_reassign')}</button>` : nothing}
    </div>` : html`<div class="oline muted" data-person="none">${tIcon('user')}<span>${dwt('noHandler')}</span></div>`}
    ${ownerLine(t, ctx)}
    <div class="oline" data-person="requester"><span class="av xs" aria-hidden="true">${initials(t.created_by.name)}</span>
      <span>${bidi(dwt('requesterLine', { who: t.created_by.name, when: shortDateTime(t.created_at) }))}</span></div>
  </section>`;
}

/** TKUI3B: the internal owner's line - the person responsible in the organisation (not the handler), with the manager's change button. */
function ownerLine(t: TicketDetail, ctx: OverviewCtx): TemplateResult | typeof nothing {
  const v = ownerView(t);
  if (v === 'hidden') return nothing;
  const o = t.internal_owner;
  const change = ctx.onChangeOwner && canChangeOwner(t)
    ? html`<button type="button" class="btn sm quiet" data-ov-owner-change ?disabled=${ctx.busy} @click=${ctx.onChangeOwner}>${tIcon('edit')}${dwt(o ? 'ownerChange' : 'ownerSet')}</button>` : nothing;
  if (!o) return html`<div class="oline muted" data-person="owner" data-owner="none">${tIcon('user')}<span>${dwt('ownerNone')}</span>${change}</div>`;
  return html`<div class="oline" data-person="owner" data-owner=${o.id}><span class="av xs" aria-hidden="true">${initials(o.name)}</span>
    <span class="ownertx"><b>${bidi(o.name)}</b> <span class="muted">${dwt('ownerLabel')}${o.since ? ` · ${relTime(o.since, ctx.now)}` : ''}${o.active === false ? ` · ${dwt('ownerInactive')}` : ''}</span></span>${change}</div>`;
}

function nowRows(t: TicketDetail, ctx: OverviewCtx): TemplateResult | typeof nothing {
  const rows: TemplateResult[] = [];
  const row = (key: string, icon: Parameters<typeof tIcon>[0], label: string, value: TemplateResult | string, act?: TemplateResult) =>
    html`<div class="orow" data-now=${key}><span class="oi">${tIcon(icon)}</span><div class="ot"><small>${label}</small><div>${value}</div></div>${act ?? nothing}</div>`;
  const final = t.status === 'closed' || t.status === 'cancelled';
  if (t.eta_at && !final) rows.push(row('eta', 'clock', dwt('nowEta'), etaText(t.eta_at, ctx.now)));
  const last = lastMessage(t.events);
  if (last) rows.push(row('last', last.kind === 'note' ? 'note' : 'send', dwt('nowLast'), html`<b>${bidi(last.actor.name)}:</b> <span class="clip">${last.body}</span>`,
    html`<button type="button" class="btn sm quiet" data-now-go="conv" @click=${() => ctx.onTab('conv')}>${dwt('toConv')}</button>`));
  const cost = costLine(t);
  if (cost) rows.push(row('cost', 'flag', dwt('nowCost'), html`<span class=${`chip ${cost.tone}`}>${cost.text}</span>${cost.amount ? html`<span class="num muted">${cost.amount}</span>` : nothing}`,
    html`<button type="button" class="btn sm quiet" data-now-go="costs" @click=${() => ctx.onTab('costs')}>${dwt('toCosts')}</button>`));
  const sla = slaState(t, ctx.now).row;
  if (sla && rows.length < 4) rows.push(row('sla', 'clock', dwt('nowSla'), html`<span class="muted">${sla}</span>`));
  if (!rows.length) return nothing;
  return html`<section class="sect" data-ov="now"><h4><span class="tag t3">${tIcon('flag')}</span>${dwt('ovNow')}</h4>${rows.slice(0, 4)}</section>`;
}

/** The Now rows alone - the phone half sheet shows the status block + these (IA §4.1). */
export function nowSection(t: TicketDetail, ctx: OverviewCtx): TemplateResult | typeof nothing {
  return nowRows(t, ctx);
}

/** ORGPLAN-291: "show on map" under the location - the server sends `plan_area` only to a viewer who may read that floor on the map. */
function showOnMapLink(t: TicketDetail): TemplateResult | typeof nothing {
  const href = showOnMapHref(t.location?.plan_area);
  if (!href) return nothing;
  return html`<div class="f wide" data-fact="location-map"><a href=${href} data-location-on-map>${tIcon('link')}${lt('showOnMap')}</a></div>`;
}

function facts(t: TicketDetail, ctx: OverviewCtx): TemplateResult {
  const f = (key: string, label: string, value: string, wide = false) => (value ? html`<div class=${`f${wide ? ' wide' : ''}`} data-fact=${key}><small>${label}</small><span>${bidi(value)}</span></div>` : nothing);
  const dc = [t.department?.name, t.category?.name].filter(Boolean).join(' · ');
  const long = (t.description ?? '').length > 160 || (t.description ?? '').split('\n').length > 3;
  return html`<section class="sect" data-ov="facts">
    <h4><span class="tag t2">${tIcon('layers')}</span>${dwt('ovFacts')}${ctx.onEdit ? html`<button type="button" class="btn sm quiet act" data-edit ?disabled=${ctx.busy} @click=${ctx.onEdit}>${tIcon('edit')}${dwt('a_edit')}</button>` : nothing}</h4>
    <div class="facts">
      ${f('location', lt('fLocation'), t.location?.text ?? '', true)}
      ${showOnMapLink(t)}
      ${f('place', dwt('fPlace'), t.place_text)}
      ${f('device', dwt('fDevice'), t.device_name)}
      ${f('dept', dwt('fDept'), dc)}
      ${f('priority', dwt('fPriority'), t.priority?.name ?? '')}
      ${f('opened', dwt('fOpened'), `${shortDateTime(t.created_at)} · ${t.created_by.name}`)}
      ${rfqOriginFact(t, ctx)}
      ${t.duplicate_of ? html`<div class="f" data-fact="duplicate"><small>${dwt('fDuplicate')}</small><a href=${ctx.duplicateHref} data-duplicate-of>${dwt('sn_duplicate', { n: t.duplicate_of.number })}</a></div>` : nothing}
      ${t.close_note && (t.status === 'closed' || t.status === 'cancelled') ? html`<div class="f wide" data-fact="close-note"><small>${dwt('fCloseNote')}</small><span data-close-note>${t.close_note}</span></div>` : nothing}
      ${t.description ? html`<div class="f wide" data-fact="description"><small>${dwt('fDescription')}</small>
        <span class=${`desc${ctx.descOpen ? ' open' : ''}`} data-description>${t.description}</span>
        ${long ? html`<button type="button" class="btn sm quiet more" aria-expanded=${String(ctx.descOpen)} data-desc-more @click=${ctx.onToggleDesc}>${ctx.descOpen ? dwt('descLess') : dwt('descMore')}</button>` : nothing}
      </div>` : nothing}
    </div>
  </section>`;
}

/** TKRFQ4: "נפתחה מבקשת הצעת מחיר RFQ-07" - the request (a link when the viewer may open it), and the other items of a split. */
function rfqOriginFact(t: TicketDetail, ctx: OverviewCtx): TemplateResult | typeof nothing {
  const o = t.rfq_origin;
  if (!o) return nothing;
  const label = dwt('rfqOrigin', { ref: o.ref });
  const sib = o.siblings.length ? html`<small class="muted" data-rfq-siblings>${dwt('rfqSiblings', { list: '' })}${o.siblings.map((s, i) => html`${i ? ', ' : ''}<a href=${ctx.hrefOf ? ctx.hrefOf(s.id) : `#/tickets/${s.id}`} data-rfq-sibling=${s.id}>#${s.number}</a>`)}</small>` : nothing;
  // RFQ-VENDOR-UPLOAD (owner 2026-10-17): the awarded vendor's own files - read-only, each a download (the server sends attachment +
  // nosniff + a sandbox CSP); the server lists them only for a viewer who may see this request's costs
  const files = o.vendor_files ?? [];
  const vf = files.length ? html`<small class="muted" data-rfq-vendor-files>${dwt('rfqVendorFiles')}: ${files.map((x, i) => html`${i ? ', ' : ''}<a
    href=${rfqVendorFileUrl(t.id, x.id)} download rel="noopener noreferrer" data-rfq-vendor-file=${x.id}>${bidi(x.name)}</a>`)}</small>` : nothing;
  return html`<div class="f wide" data-fact="rfq-origin"><small>${dwt('fRfqOrigin')}</small>
    <span>${o.id ? html`<a href=${`#/tickets/rfqs?rfq=${encodeURIComponent(o.id)}`} data-rfq-origin=${o.id}>${label}</a>` : html`<span data-rfq-origin>${label}</span>`}</span>${sib}${vf}</div>`;
}

export function overviewTab(t: TicketDetail & { link?: LinkBlock | null }, ctx: OverviewCtx): TemplateResult {
  return html`<div class="one" data-tab-content="overview">
    ${people(t, ctx)}
    ${ctx.link}
    ${nowRows(t, ctx)}
    ${facts(t, ctx)}
    ${ctx.photos}
    ${ctx.device !== nothing ? html`<details class="fold" data-ov="device"><summary><span class="tag t2">${tIcon('clock')}</span>${dwt('ovDevice')}${tIcon('chevronDown', 'chev')}</summary>${ctx.device}</details>` : nothing}
  </div>`;
}

export const overviewStyles = css`
  .one {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-inline-size: 0;
  }
  .sect > h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 28px;
  }
  .sect > h4 .act {
    margin-inline-start: auto;
  }
  .person {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    border-inline-start: 3px solid var(--dv-text-3);
  }
  .person.int {
    border-inline-start-color: var(--dv-accent);
  }
  .person .pt {
    min-inline-size: 0;
  }
  .person .nm {
    display: flex;
    align-items: baseline;
    gap: 4px 8px;
    flex-wrap: wrap;
  }
  .person .nm .role {
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
    font-weight: 500;
  }
  .person .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: 4px;
  }
  .chan {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-block-size: 26px;
    padding-inline: 9px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .chan.ok {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .chan .ic {
    font-size: var(--sw-fs-sm);
  }
  .oline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .oline .btn {
    margin-inline-start: auto;
    flex: none;
  }
  .ownertx {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .av.xs {
    inline-size: 24px;
    block-size: 24px;
    font-size: var(--sw-fs-xs);
  }
  .orow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    min-inline-size: 0;
  }
  .orow .oi {
    flex: none;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .orow .ot {
    flex: 1;
    min-inline-size: 0;
  }
  .orow .ot small {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-weight: 600;
  }
  .orow .ot > div {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
  }
  .orow .ot > div b {
    flex: 0 0 auto;
    max-inline-size: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .orow .clip {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .orow .btn {
    flex: none;
  }
  .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
  }
  .facts .f {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .facts .f small {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-weight: 600;
  }
  .facts .f > span {
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .facts .f.wide {
    grid-column: 1 / -1;
  }
  .facts .desc {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-line;
    line-height: 1.5;
  }
  .facts .desc.open {
    display: block;
  }
  .facts .more {
    align-self: flex-start;
  }
  details.fold {
    border-radius: var(--sw-r-lg);
  }
  details.fold > summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 44px;
    cursor: pointer;
    list-style: none;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--dv-text-2);
  }
  details.fold > summary::-webkit-details-marker {
    display: none;
  }
  details.fold > summary .chev {
    margin-inline-start: auto;
    transition: transform var(--mm-motion, 120ms);
  }
  details.fold:not([open]) > summary .chev {
    transform: rotate(90deg);
  }
  details.fold > summary:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 2px;
    border-radius: var(--sw-r-sm);
  }
  @media (max-width: 767px) {
    .facts {
      grid-template-columns: minmax(0, 1fr);
    }
    .person {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .person > .btn {
      grid-column: 1 / -1;
      min-block-size: 44px;
    }
    .orow .btn {
      min-block-size: 44px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    details.fold > summary .chev {
      transition: none;
    }
  }
`;
