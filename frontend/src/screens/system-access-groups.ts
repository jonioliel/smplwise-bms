import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import {
  getGroupVersions,
  getGroups,
  getStatusStations,
  type GroupsPolicy,
  type GroupsReply,
  type PersonGroup,
  type PolicyVersion,
  type PolicyVersions,
  type ProfileField,
  type StatusStation,
  type StatusStationsReply,
  type SyncMeta,
  type VersionsReply,
} from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import { can, isApi } from '../api/session';
import { accessControlAccess } from '../access-control/access';
import { Resource } from '../access-control/status-feed';
import { CELL, statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { age, appendVersions, fieldFlags, fieldTypeKey, groupRule, optionsLine, versionsLeft, whenOf } from '../access-control/status-logic';
import { ageText, versionActionText, whenText } from '../access-control/status-text';
import { UTC_ZONE } from './wiskey-format';
import { bubbleChrome } from '../styles/bubble-chrome';
import { st, type StKey } from '../i18n/access-status';

/**
 * CR-036 S10: "קבוצות ושדות" - the third segment of the Settings page "בקרת כניסה": the person groups (and the stations each opens),
 * the profile fields (type, required, options) and the history of that policy. View only: editing stays in the intercom's own window
 * (the write phase of CR-036 adds it here later). What each part needs: the groups read needs `access.people.read` (the server shows
 * a station-scoped caller only the groups whose every station they see); the field definitions come only to a holder of
 * `access.people.sensitive` or an installation-wide administrator (the server sends `fields: null` otherwise - the card is then
 * absent); the history is installation-wide and absent for a station-scoped administrator.
 */
@customElement('system-access-groups')
export class SystemAccessGroups extends LitElement {
  /** The page's refresh counter: a change reads everything again. */
  @property({ type: Number }) rev = 0;
  @state() private wide = true;

  private groupsRes!: Resource<GroupsPolicy, GroupsReply>;
  private versionsRes!: Resource<PolicyVersions, VersionsReply>;
  private stationsRes!: Resource<StatusStation[], StatusStationsReply>;
  private lastRev = 0;
  private lastMeta = '';

  static styles = [
    statusStyles,
    css`
      .rev {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    const change = () => {
      this.requestUpdate();
      this.emitMeta();
    };
    this.wide = !isApi() || can('access.admin.read');
    this.stationsRes = new Resource({ fetch: () => getStatusStations(), pick: (r: StatusStationsReply) => r.stations, onChange: change });
    this.groupsRes = new Resource({ fetch: () => getGroups(), pick: (r: GroupsReply) => r.groups, onChange: change });
    this.versionsRes = new Resource({
      fetch: (cursor: unknown) => getGroupVersions(typeof cursor === 'number' ? cursor : 0),
      pick: (r: VersionsReply) => r.versions,
      merge: appendVersions,
      cursorOf: (d: PolicyVersions) => d.next_offset,
      onChange: change,
    });
    this.reloadAll();
  }

  disconnectedCallback(): void {
    for (const r of [this.groupsRes, this.versionsRes, this.stationsRes]) r?.dispose();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      this.reloadAll();
    }
  }

  private reloadAll(): void {
    void this.stationsRes.reload();
    if (!isApi() || accessControlAccess().people) void this.groupsRes.reload();
    if (this.wide) void this.versionsRes.reload();
  }

  private emitMeta(): void {
    const meta: SyncMeta | null = this.groupsRes?.snap.reply?.sync ?? this.versionsRes?.snap.reply?.sync ?? this.stationsRes?.snap.reply?.sync ?? null;
    const json = JSON.stringify(meta);
    if (json === this.lastMeta) return;
    this.lastMeta = json;
    this.dispatchEvent(new CustomEvent('access-meta', { detail: { meta, zone: this.zone() }, bubbles: true, composed: true }));
  }

  private zone(): DisplayZone {
    return this.stationsRes?.snap.reply?.default_zone ?? UTC_ZONE;
  }

  private nameOf = (id: string): string => this.stationsRes.snap.data?.find((s) => s.id === id)?.name ?? id;

  private ruleText(g: PersonGroup): string {
    const rule = groupRule(g, (this.stationsRes.snap.data ?? []).map((s) => s.id));
    switch (rule.kind) {
      case 'all':
        return st('ruleAll');
      case 'none':
        return st('ruleNone');
      case 'unknown':
        return st('ruleUnknown');
      case 'stations':
        return rule.ids.map((id) => this.nameOf(id)).join(', ');
    }
  }

  // ------------------------------------------------------------------ cards

  private groupsCard(): TemplateResult | typeof nothing {
    if (isApi() && !accessControlAccess().people) return nothing;
    const r = this.groupsRes;
    const s = r.snap;
    if (s.failure === 'forbidden') return nothing;
    const policy = s.data;
    let body: TemplateResult;
    if (!s.everAnswered || (s.busy && !policy)) body = skeletonRows(4);
    else if (!policy) body = failurePanel(s.failure ?? 'error', s.message, () => void r.reload(), true);
    else if (!policy.groups.length) body = html`<div class="empty">${st('groupsEmpty')}</div>`;
    else
      body = html`<div class="list" data-access-groups>
        ${policy.groups.map(
          (g) => html`<div class="row" data-access-group=${g.id}>
            <span class="dot ${g.enabled ? 'ok' : 'off'}" aria-hidden="true"></span>
            <span class="main"><span class="t">${g.label}</span><span class="s wrap">${this.ruleText(g)}</span></span>
            ${g.enabled ? nothing : html`<span class="side"><sw-badge kind="offline" label=${st('groupOff')}></sw-badge></span>`}
          </div>`,
        )}
      </div>`;
    return html`<sw-card flush data-access-card="groups">
      <div class="ch">
        <div><h3>${st('groupsTitle')}</h3><div class="sub">${st('groupsSub')}</div></div>
        ${policy ? html`<div class="ctl rev" data-access-revision><span class="muted">${st('revisionNow', { n: policy.revision ?? '—' })}</span>${policy.photo_enabled === null ? nothing : html`<span class="muted">${policy.photo_enabled ? st('photoOn') : st('photoOff')}</span>`}</div>` : nothing}
      </div>
      ${r.stale && policy ? html`<div class="note stale" role="status" data-access-stale="groups"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt ? st('stale', { t: ageText(age(s.fetchedAt, new Date(), this.zone())) }) : st('staleNever')}</span></div>` : nothing}
      ${body}
    </sw-card>`;
  }

  private fieldsCard(): TemplateResult | typeof nothing {
    const policy = this.groupsRes.snap.data;
    // the definitions are for holders of the sensitive permission or installation-wide administrators: `fields: null` = not for this caller
    if (!policy || policy.fields === null) return nothing;
    const row = (x: Record<string, unknown>) => x as unknown as ProfileField;
    const columns: TableColumn[] = [
      { key: 'label', label: st('colField'), render: (x) => html`<span style=${CELL.strong}>${row(x).label}</span>` },
      { key: 'type', label: st('colType'), render: (x) => st(fieldTypeKey(row(x).type) as StKey) },
      {
        key: 'flags',
        label: st('colFlags'),
        render: (x) => {
          const f = row(x);
          const flags = fieldFlags(f);
          const dep = f.depends_on ? (policy.fields ?? []).find((o) => o.id === f.depends_on?.field_id)?.label ?? f.depends_on.field_id : '';
          return html`<span style=${CELL.row}>${[f.required ? st('flagRequired') : st('flagOptional'), flags.includes('unique') ? st('flagUnique') : '', flags.includes('depends') ? st('flagDepends', { field: dep }) : ''].filter(Boolean).join(' · ')}${flags.includes('disabled') ? html`<sw-badge kind="offline" label=${st('flagDisabled')}></sw-badge>` : nothing}</span>`;
        },
      },
      {
        key: 'options',
        label: st('colOptions'),
        render: (x) => {
          const o = optionsLine(row(x).options ?? []);
          return o.shown.length ? html`<span>${o.shown.join(', ')}${o.more ? html` <span style=${CELL.muted}>${st('optionsMore', { n: o.more })}</span>` : nothing}</span>` : html`<span style=${CELL.muted}>—</span>`;
        },
      },
    ];
    return html`<sw-card flush data-access-card="fields">
      <div class="ch"><div><h3>${st('fieldsTitle')}</h3><div class="sub">${st('fieldsCount', { n: policy.fields.length })}</div></div></div>
      ${policy.fields.length ? html`<sw-table data-access-fields .columns=${columns} .rows=${policy.fields as unknown as Record<string, unknown>[]} rowKey="id"></sw-table>` : html`<div class="empty">${st('fieldsEmpty')}</div>`}
    </sw-card>`;
  }

  private versionsCard(now: Date): TemplateResult | typeof nothing {
    if (!this.wide) return nothing;
    const r = this.versionsRes;
    const s = r.snap;
    if (s.failure === 'forbidden') return nothing;
    const v = s.data;
    const zone = this.zone();
    const row = (x: Record<string, unknown>) => x as unknown as PolicyVersion;
    const columns: TableColumn[] = [
      {
        key: 'revision',
        label: st('colRevision'),
        render: (x) => html`<span style=${CELL.row}><span style=${CELL.strong}>${row(x).revision}</span>${v && row(x).revision === v.current_revision ? html`<sw-badge kind="live" label=${st('versionCurrent')}></sw-badge>` : nothing}</span>`,
      },
      { key: 'saved', label: st('colSaved'), render: (x) => (row(x).saved_at ? whenText(whenOf(row(x).saved_at, now, zone)) : '—') },
      { key: 'action', label: st('colChange'), render: (x) => versionActionText(row(x).action) },
      { key: 'fields', label: st('colFieldChanges'), render: (x) => (row(x).field_changes ? String(row(x).field_changes) : '—') },
      { key: 'groups', label: st('colGroupChanges'), render: (x) => (row(x).group_changes ? String(row(x).group_changes) : '—') },
    ];
    let body: TemplateResult;
    if (!s.everAnswered || (s.busy && !v)) body = skeletonRows(3);
    else if (!v) body = failurePanel(s.failure ?? 'error', s.message, () => void r.reload(), true);
    else if (!v.records.length) body = html`<div class="empty">${st('versionsEmpty')}</div>`;
    else body = html`<sw-table data-access-versions .columns=${columns} .rows=${v.records as unknown as Record<string, unknown>[]} rowKey="revision"></sw-table>`;
    return html`<sw-card flush data-access-card="versions">
      <div class="ch"><div><h3>${st('versionsTitle')}</h3><div class="sub ltr">${st('versionsSub')}</div></div></div>
      ${r.stale && v ? html`<div class="note stale" role="status" data-access-stale="versions"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt ? st('stale', { t: ageText(age(s.fetchedAt, now, zone)) }) : st('staleNever')}</span></div>` : nothing}
      ${body}
      ${r.hasMore ? html`<div class="more"><sw-button size="lg" data-access-versions-more ?disabled=${s.loadingMore} @click=${() => void r.more()}>${s.loadingMore ? st('loadingMore') : `${st('more')} (${versionsLeft(v)})`}</sw-button></div>` : nothing}
      ${s.moreFailed ? html`<div class="note err" role="alert" data-access-versions-more-failed><span>${st('moreFailed')}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => void r.more()}>${st('retry')}</sw-button></div>` : nothing}
      ${v?.retained_from_revision ? html`<div class="foot-note" data-access-versions-retained>${st('versionsRetained', { n: v.retained_from_revision })}</div>` : nothing}
    </sw-card>`;
  }

  render() {
    const now = new Date();
    const g = this.groupsRes.snap;
    const hasGroups = !isApi() || accessControlAccess().people;
    // a page whose only reads failed in the same way says it once (the groups read is the page's first)
    if (hasGroups && g.everAnswered && !g.data && g.failure && g.failure !== 'forbidden' && ['not_configured', 'connecting', 'not_installed', 'unsupported'].includes(g.failure)) {
      return html`<div class="stack" data-access-status=${g.failure}>${failurePanel(g.failure, g.message, () => this.reloadAll())}</div>`;
    }
    const groups = this.groupsCard();
    const fields = this.fieldsCard();
    return html`<div class="stack" data-access-status="ready">
      ${groups !== nothing && fields !== nothing ? html`<div class="grid2">${groups}${fields}</div>` : html`${groups}${fields}`}
      ${this.versionsCard(now)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-groups': SystemAccessGroups;
  }
}
