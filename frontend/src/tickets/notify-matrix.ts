import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError, describeError, get, put } from '../api/client';
import { nmt, sourceLabel } from '../i18n/notify-matrix';
import {
  CHANNEL_GROUPS, HHMM, cycleMode, effectiveDept, matrixOf, MATRIX_MODES, setCell, setChannel, setDeptField, setSla, slaKey, toggleId,
  type ChannelGroup, type DeptRecipients, type MatrixMode, type NotifyDoc, type NotifyMatrix, type NotifySource,
} from './notify-matrix-model';
import { dateInputLang } from '../api/day-format';

interface MetaDept { id: string; name: string; pending: number; priorities: { id: string; key: string; name: string }[] }
interface Meta {
  sources: NotifySource[];
  departments: MetaDept[];
  users: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  channels: ChannelGroup[];
  pending: number;
}

/**
 * TKNOTIFMATRIX: the notification matrix and the daily digest, rows of Settings > the module > general (administrator, `system.configure`).
 * Switches that keep today's behaviour by default: the matrix (per department, "all departments" as the fallback: which event goes at
 * once / in the digest / not at all), the digest (one grouped notification per recipient and department per day) and "urgent always
 * immediate". Per department (2.9.1): its own digest time, the digest's recipients (managers by default, plus users and roles), a
 * channel override, and per priority (the SLA policy) whether an urgent event bypasses the matrix. Light DOM, like the sibling settings
 * rows: the card's `.row` / `.lbl` / `.seg` styles reach it. Saves with the card's revision; the new document goes up as `doc-changed`.
 */
@customElement('ticket-notify-matrix')
export class TicketNotifyMatrix extends LitElement {
  @property({ attribute: false }) doc: { revision: number; notify?: NotifyDoc } | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private meta: Meta | null = null;
  @state() private dept = '*';
  @state() private busy = false;
  @state() private error = '';
  @state() private time: string | null = null;
  @state() private deptTime: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'contents';
    this.loadMeta(true);
  }

  private loadMeta(report: boolean): void {
    get<Meta>('tickets/settings/notify-matrix').then((m) => (this.meta = m)).catch((e) => {
      if (report) this.error = `${nmt('loadError')}: ${describeError(e)}`;
    });
  }

  private async save(notify: Record<string, unknown>): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const doc = await put<{ revision: number; notify?: NotifyDoc }>('tickets/settings', { revision: this.doc.revision, notify });
      this.dispatchEvent(new CustomEvent('doc-changed', { detail: doc, bubbles: true, composed: true }));
      this.time = null;
      this.deptTime = null;
      this.loadMeta(false);
    } catch (e) {
      this.error = e instanceof ApiError ? e.body.user_message || describeError(e) : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private get off(): boolean {
    return this.disabled || this.busy;
  }

  private toggle(label: string, sub: string, checked: boolean, attr: string, key: string): TemplateResult {
    return html`<div class="row"><span class="lbl">${label}<span class="muted">${sub}</span></span>
      <sw-toggle label=${label} labelHidden .checked=${checked} ?disabled=${this.off} data-notify=${attr}
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [key]: e.detail.checked })}></sw-toggle></div>`;
  }

  private seg<T extends string>(label: string, values: readonly T[], cur: T, name: (v: T) => string, attr: (v: T) => string, pick: (v: T) => void): TemplateResult {
    return html`<span class="seg" role="radiogroup" aria-label=${label}>${values.map((v) => html`<button type="button" role="radio"
      aria-pressed=${String(cur === v)} aria-checked=${String(cur === v)} data-notify-cell=${attr(v)} ?disabled=${this.off}
      @click=${() => pick(v)}>${name(v)}</button>`)}</span>`;
  }

  private pick(src: NotifySource, matrix: NotifyMatrix): TemplateResult {
    const cur = matrixOf(matrix, this.dept, src.key);
    const own = this.dept === '*' || matrix[this.dept]?.[src.key] !== undefined;
    const modes = MATRIX_MODES.filter((m) => m !== 'digest' || src.digest);
    const name = { now: nmt('modeNow'), digest: nmt('modeDigest'), off: nmt('modeOff') } as const;
    const label = sourceLabel(src.key, src.label);
    return html`<div class="row" data-notify-source=${src.key}><span class="lbl">${label}<span class="muted">${[
        src.assignee ? nmt('assigneeTag') : '', src.sla ? nmt('slaTag') : '', own ? '' : nmt('inherited')].filter(Boolean).join(' · ')}</span></span>
      ${this.seg(label, modes, cur, (m: MatrixMode) => name[m], (m) => `${src.key}:${m}`,
        (m) => void this.save({ matrix: setCell(matrix, this.dept, src.key, cycleMode(cur, m)) }))}</div>`;
  }

  private chips(kind: 'users' | 'roles', rec: DeptRecipients, n: NotifyDoc): TemplateResult {
    const all = kind === 'users' ? this.meta?.users ?? [] : this.meta?.roles ?? [];
    const picked = rec[kind];
    const nameOf = (id: string) => all.find((x) => x.id === id)?.name ?? id;
    const set = (ids: string[]) => void this.save({ departments: setDeptField(n.departments, this.dept, 'recipients', { ...rec, [kind]: ids }) });
    const label = nmt(kind === 'users' ? 'recUsers' : 'recRoles');
    return html`<div class="row"><span class="lbl">${label}</span>
      <span class="end nm-chips" data-notify-pick=${kind}>
        ${picked.map((id) => html`<span class="nm-chip">${nameOf(id)}<button type="button" class="nm-x" aria-label=${nmt('remove', { name: nameOf(id) })}
          ?disabled=${this.off} @click=${() => set(toggleId(picked, id))}>×</button></span>`)}
        <select class="in" aria-label=${nmt(kind === 'users' ? 'addUser' : 'addRole')} ?disabled=${this.off} data-notify-add=${kind}
          @change=${(e: Event) => { const s = e.target as HTMLSelectElement; if (s.value) set(toggleId(picked, s.value)); s.value = ''; }}>
          <option value="">${nmt(kind === 'users' ? 'addUser' : 'addRole')}</option>
          ${all.filter((x) => !picked.includes(x.id)).map((x) => html`<option value=${x.id}>${x.name}</option>`)}
        </select></span></div>`;
  }

  private deptSection(n: NotifyDoc): TemplateResult {
    const eff = effectiveDept(n, this.dept);
    const own = (n.departments ?? {})[this.dept] ?? {};
    const timeVal = this.deptTime ?? (this.dept !== '*' && own.digest_time ? own.digest_time : '');
    const timeDirty = this.deptTime !== null && (this.deptTime === '' || HHMM.test(this.deptTime)) && this.deptTime !== (own.digest_time ?? '');
    const rec = eff.recipients;
    const groups = CHANNEL_GROUPS.filter((g) => this.meta?.channels.includes(g));
    return html`
      ${this.dept !== '*' && n.digest_enabled ? html`<div class="row"><span class="lbl">${nmt('deptTime')}<span class="muted">${nmt('deptTimeSub', { time: n.digest_time })}</span></span>
        <span class="end"><input class="in time" type="time" lang=${dateInputLang()} aria-label=${nmt('deptTime')} data-notify-dept-time .value=${timeVal} ?disabled=${this.off}
          @input=${(e: Event) => (this.deptTime = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" variant="primary" data-notify-dept-time-save ?disabled=${!timeDirty || this.off}
            @click=${() => void this.save({ departments: setDeptField(n.departments, this.dept, 'digest_time', this.deptTime || undefined) })}>${nmt('save')}</sw-button></span></div>` : nothing}
      ${n.digest_enabled ? html`
        <div class="row"><span class="lbl">${nmt('recipients')}<span class="muted">${nmt('recipientsSub')}${this.dept !== '*' && eff.recipientsInherited ? ` · ${nmt('inherited')}` : ''}</span></span>
          ${this.dept !== '*' && !eff.recipientsInherited ? html`<sw-button size="sm" variant="ghost" data-notify-rec-inherit ?disabled=${this.off}
            @click=${() => void this.save({ departments: setDeptField(n.departments, this.dept, 'recipients', undefined) })}>${nmt('backToStar')}</sw-button>` : nothing}</div>
        <div class="row"><span class="lbl">${nmt('recManagers')}</span>
          <sw-toggle label=${nmt('recManagers')} labelHidden .checked=${rec.managers} ?disabled=${this.off} data-notify-rec-managers
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ departments: setDeptField(n.departments, this.dept, 'recipients', { ...rec, managers: e.detail.checked }) })}></sw-toggle></div>
        ${this.chips('users', rec, n)}
        ${this.chips('roles', rec, n)}` : nothing}
      <div class="row"><span class="lbl">${nmt('channels')}<span class="muted">${nmt('channelsSub')}</span></span></div>
      <div class="row"><span class="lbl">${nmt('chInapp')}</span><span class="muted" data-notify-inapp>${nmt('chInappAlways')}</span></div>
      ${groups.map((g) => {
        const c = eff.channels[g];
        const cur = (own.channels?.[g] ?? 'inherit') as 'on' | 'off' | 'inherit';
        const label = nmt(`ch_${g}`);
        const name = (v: 'on' | 'off' | 'inherit') => (v === 'inherit' ? (c.inherited ? `${nmt('inherited')}: ${nmt(c.value === 'on' ? 'chOn' : 'chOff')}` : nmt('chInherit')) : nmt(v === 'on' ? 'chOn' : 'chOff'));
        return html`<div class="row" data-notify-channel=${g}><span class="lbl">${label}</span>
          ${this.seg(label, ['inherit', 'on', 'off'] as const, cur, name, (v) => `ch-${g}:${v}`,
            (v) => void this.save({ departments: setDeptField(n.departments, this.dept, 'channels', setChannel(own.channels, g, v)) }))}</div>`;
      })}`;
  }

  private slaSection(n: NotifyDoc): TemplateResult | typeof nothing {
    const dept = this.meta?.departments.find((d) => d.id === this.dept);
    if (!dept || !dept.priorities.length) return nothing;
    const map = n.sla_urgent ?? {};
    const name = (v: 'inherit' | 'immediate' | 'matrix') => nmt(v === 'inherit' ? 'slaInherit' : v === 'immediate' ? 'slaImmediate' : 'slaMatrix');
    return html`<div class="row"><span class="lbl">${nmt('sla')}<span class="muted">${nmt('slaSub')}</span></span></div>
      ${dept.priorities.map((p) => {
        const key = slaKey(dept.id, p.id);
        const cur = map[key] ?? 'inherit';
        return html`<div class="row" data-notify-sla=${p.id}><span class="lbl">${p.name}</span>
          ${this.seg(p.name, ['inherit', 'immediate', 'matrix'] as const, cur, name, (v) => `sla-${p.id}:${v}`,
            (v) => void this.save({ sla_urgent: setSla(map, key, v) }))}</div>`;
      })}`;
  }

  render() {
    const n = this.doc?.notify;
    if (!n) return nothing;
    const timeVal = this.time ?? n.digest_time;
    const dirty = this.time !== null && this.time !== n.digest_time && HHMM.test(this.time);
    const pending = this.meta ? nmt('pending', { n: this.meta.pending }) : '';
    return html`
      ${this.toggle(nmt('matrixOn'), nmt('matrixOnSub'), n.matrix_enabled, 'matrix-enabled', 'matrix_enabled')}
      ${this.toggle(nmt('digestOn'), nmt('digestOnSub'), n.digest_enabled, 'digest-enabled', 'digest_enabled')}
      ${this.toggle(nmt('urgent'), nmt('urgentSub'), n.urgent_immediate ?? true, 'urgent-immediate', 'urgent_immediate')}
      <div class="row"><span class="lbl">${nmt('siteTime')}<span class="muted">${[nmt('siteTimeSub'), pending].filter(Boolean).join(' · ')}</span></span>
        <span class="end"><input class="in time" type="time" lang=${dateInputLang()} aria-label=${nmt('siteTime')} data-notify-time .value=${timeVal} ?disabled=${this.off}
          @input=${(e: Event) => (this.time = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" variant="primary" data-notify-time-save ?disabled=${!dirty || this.busy} @click=${() => void this.save({ digest_time: this.time })}>${nmt('save')}</sw-button></span></div>
      ${n.matrix_enabled && this.meta ? html`
        <div class="row"><span class="lbl">${nmt('dept')}</span>
          <select class="in" aria-label=${nmt('dept')} data-notify-dept .value=${this.dept}
            @change=${(e: Event) => { this.dept = (e.target as HTMLSelectElement).value; this.deptTime = null; }}>
            <option value="*">${nmt('allDepts')}</option>
            ${this.meta.departments.map((d) => html`<option value=${d.id} ?selected=${this.dept === d.id}>${d.name}${d.pending ? ` (${d.pending})` : ''}</option>`)}
          </select></div>
        ${this.deptSection(n)}
        <div class="row"><span class="lbl">${nmt('events')}</span></div>
        ${this.meta.sources.map((s) => this.pick(s, n.matrix))}
        ${this.dept !== '*' ? this.slaSection(n) : nothing}` : nothing}
      ${this.error ? html`<div class="row"><span class="field-error" role="alert" data-notify-error>${this.error}</span></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-notify-matrix': TicketNotifyMatrix;
  }
}
