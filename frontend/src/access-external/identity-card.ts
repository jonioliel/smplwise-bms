import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import { ApiError, describeError } from '../api/client';
import { can, canAnywhere, isApi } from '../api/session';
import { attachRecovered, deletePersonNow, getIdentity, matchLink, pushName, unlinkPerson, type Identity } from '../api/access-grants';
import { getAcPeople, type AcPerson } from '../api/access-people';
import { evidenceRefOk, mayOpenIdentityCard } from './model';
import { xCss } from './styles';
import { xt, type XtKey } from '../i18n/access-external';
import { markerView } from '../tickets/vendor-marker';

type Dialog = null | 'link' | 'unlink' | 'delete' | 'attach';

const HISTORY_KEY: Record<string, XtKey> = {
  'access.person_link.create': 'h_create', 'access.person_link.match': 'h_match', 'access.person_link.unlink': 'h_unlink',
  'access.person_link.name_pushed': 'h_name', 'access.grant.request': 'h_request', 'access.grant.activate': 'h_activate',
  'access.grant.end': 'h_end', 'access.grant.revoked': 'h_revoked', 'access.grant.confirm_gone': 'h_gone', 'access.grant.create_recovered': 'h_recovered',
};

/**
 * SHAREDID-293 (mockup screen 3): the access-control identity of one directory person - the link to a WisKey person (created by Arx,
 * an existing person, missing, an unresolved create) and what may be done with it: link to an existing person (manual only), unlink,
 * delete now (a person Arx created), push the name (owner decision 5) and attach a recovered person (owner decision 7, system
 * administrators only). Shown in the contact card and in the grant drawer; renders nothing when the server answers 404 (the caller
 * may not see identities, or the contact is a company). The server decides every action again.
 * Events: `changed` after an action (the host reloads its own data).
 */
@customElement('access-identity-card')
export class AccessIdentityCard extends LitElement {
  @property({ attribute: 'contact-id' }) contactId = '';
  @property() name = '';
  /** Compact: inside the grant drawer (no rules / history columns). */
  @property({ type: Boolean }) compact = false;
  /** SHAREDUI-295: the installation's zone for the times shown (the host passes it; else the browser's) */
  @property({ attribute: false }) tz: string | undefined = undefined;
  @state() private data: Identity | null = null;
  @state() private absent = false;
  /** SHAREDUI-295: loading, and a load that failed for another reason than "not yours to see" (a 403 / 404 hides the card) */
  @state() private loading = false;
  @state() private loadError = '';
  @state() private dialog: Dialog = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private notice = '';
  @state() private word = '';
  @state() private q = '';
  @state() private people: AcPerson[] | null = null;
  @state() private peopleError = false;
  @state() private pick = '';
  @state() private ref = '';

  static styles = [
    xCss,
    css`
      :host { display: block; --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px)); --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px)); }
      .state { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .state .sp { flex: 1; }
      .card { display: grid; gap: 12px; }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
      :host([compact]) .grid { grid-template-columns: 1fr; }
      h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; }
      .idstate { display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center; padding: 12px; border-radius: var(--sw-r-md); background: var(--cs); }
      .idstate .big { inline-size: 44px; block-size: 44px; border-radius: var(--sw-r-sm); display: grid; place-items: center; background: var(--sw-surface-solid); color: var(--ct); }
      .idstate b { display: block; color: var(--sw-heading); }
      .idstate small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
      .act { display: grid; gap: 6px; align-content: start; padding: 12px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .act h4 { margin: 0; font-size: var(--sw-fs-base); color: var(--sw-heading); display: flex; gap: 6px; align-items: center; }
      .act.dis { background: var(--sw-surface-2); border-style: dashed; }
      .act .why { display: flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
      .act.wide { grid-column: 1 / -1; border-style: dashed; }
      .side { display: grid; gap: 12px; }
      .plist { display: grid; gap: 6px; max-block-size: 40vh; overflow: auto; }
      .plist label { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); cursor: pointer; min-block-size: var(--sw-touch-desktop); box-sizing: border-box; }
      .plist small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
      .ok-line { color: var(--x-ok-t); font-size: var(--sw-fs-sm); font-weight: 600; margin: 0; }
      .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-block-start: 14px; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    `,
  ];

  protected updated(changed: PropertyValues): void {
    if (changed.has('contactId') && this.contactId) void this.load();
  }

  async load(): Promise<void> {
    // the same gate as the server's (tickets.configure, tickets.directory or the grant permission somewhere): nobody else is asked at all
    if (!isApi() || !mayOpenIdentityCard(canAnywhere('access.external.grant'), can)) {
      this.data = null;
      this.absent = true;
      return;
    }
    this.loading = !this.data;
    this.loadError = '';
    try {
      this.data = (await getIdentity(this.contactId)).identity;
      this.absent = false;
    } catch (e) {
      this.data = null;
      // not the caller's to see (or a company): nothing at all; anything else: say so, with a retry (fail closed - no action is offered)
      const hidden = e instanceof ApiError && (e.status === 403 || e.status === 404);
      this.absent = hidden;
      this.loadError = hidden ? '' : describeError(e);
    } finally {
      this.loading = false;
    }
  }

  private open(d: Dialog): void {
    this.dialog = d;
    this.error = '';
    this.word = '';
    this.ref = '';
    this.pick = '';
    if (d === 'link' || d === 'attach') void this.search();
  }

  private async search(): Promise<void> {
    this.peopleError = false;
    try {
      const r = await getAcPeople({ query: this.q, filters: {}, offset: 0, limit: 20, snapshot: '' });
      this.people = r.people?.records ?? [];
      if (r.state !== 'ready') this.peopleError = true;
    } catch {
      this.people = [];
      this.peopleError = true;
    }
  }

  private async run(fn: () => Promise<unknown>, done: XtKey): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await fn();
      this.dialog = null;
      this.notice = xt(done);
      await this.load();
      this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private stateView(d: Identity): { tone: string; icon: string; t: XtKey; desc: string } {
    const l = d.link;
    if (!l && d.unresolved) return { tone: 'warn', icon: 'help', t: 'id_unresolved_t', desc: xt('id_unresolved_d', { t: fmt(d.unresolved.started_at, this.tz) }) };
    if (!l) return { tone: 'off', icon: 'user', t: 'id_none_t', desc: xt('id_none_d') };
    if (l.state === 'wiskey_missing') return { tone: 'warn', icon: 'warning', t: 'id_missing_t', desc: xt('id_missing_d') };
    if (l.state === 'unlinking') return { tone: 'off', icon: 'link', t: 'id_unlinking_t', desc: xt('id_unlinking_d') };
    if (l.origin === 'matched') return { tone: 'acc', icon: 'lock', t: 'id_matched_t', desc: xt('id_matched_d') };
    return { tone: 'ok', icon: 'link', t: 'id_created_t', desc: xt('id_created_d') };
  }

  private act(icon: string, title: XtKey, text: XtKey, btn: XtKey, can: boolean, why: string, run: () => void, data: string, danger = false): TemplateResult {
    return html`<div class="act ${can ? '' : 'dis'}" data-identity-act=${data}>
      <h4><sw-icon name=${icon} size="16"></sw-icon>${xt(title)}</h4>${xt(text)}
      <sw-button size="sm" variant=${danger ? 'danger' : 'secondary'} ?disabled=${!can || this.busy} @click=${run}>${xt(btn)}</sw-button>
      ${can ? nothing : html`<span class="why"><sw-icon name="info" size="14"></sw-icon>${why}</span>`}
    </div>`;
  }

  private dialogs(d: Identity): TemplateResult | typeof nothing {
    const name = this.name || '';
    const foot = (ok: TemplateResult) => html`${this.error ? html`<p class="err-line" role="alert">${this.error}</p>` : nothing}<div class="foot"><sw-button variant="ghost" @click=${() => (this.dialog = null)}>${xt('back')}</sw-button>${ok}</div>`;
    if (this.dialog === 'unlink' && d.link) {
      const id = d.link.id;
      return html`<sw-dialog open heading=${xt('ul_q', { name })} data-identity-dialog="unlink" @close=${() => (this.dialog = null)}>
        <ul class="stack" style="margin:0;padding-inline-start:18px">${d.live_grant ? html`<li>${xt('ul_1')}</li>` : nothing}<li>${xt('ul_2')}</li>${d.link.origin === 'created_from_arx' ? html`<li>${xt('ul_3')}</li>` : nothing}</ul>
        ${foot(html`<sw-button variant="danger" ?disabled=${this.busy} @click=${() => this.run(() => unlinkPerson(id), 'ul_done')}>${xt('act_unlink')}</sw-button>`)}
      </sw-dialog>`;
    }
    if (this.dialog === 'delete' && d.link) {
      const id = d.link.id;
      const w = xt('del_word');
      return html`<sw-dialog open heading=${xt('del_q', { name })} data-identity-dialog="delete" @close=${() => (this.dialog = null)}>
        <div class="callout" data-tone="err"><sw-icon name="warning" size="18"></sw-icon><div><b>${xt('del_warn')}</b><ul><li>${xt('del_1')}</li><li>${xt('del_2')}</li><li>${xt('del_3')}</li></ul></div></div>
        <div class="field" style="margin-block-start:12px"><label for="dw">${xt('typeWord', { w })}</label><input id="dw" class="in" autocomplete="off" .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} /></div>
        ${foot(html`<sw-button variant="danger" ?disabled=${this.busy || this.word.trim() !== w} @click=${() => this.run(() => deletePersonNow(id, this.word.trim()), 'del_done')}>${xt('act_deleteBtn')}</sw-button>`)}
      </sw-dialog>`;
    }
    if (this.dialog === 'link') {
      return html`<sw-dialog open wide heading=${xt('lk_title')} subheading=${name} data-identity-dialog="link" @close=${() => (this.dialog = null)}>
        <div class="stack">
          <div class="callout" data-tone="warn"><sw-icon name="lock" size="18"></sw-icon><div><b>${xt('lk_callout')}</b><ul><li>${xt('lk_c1')}</li><li>${xt('lk_c2')}</li><li>${xt('lk_c3')}</li></ul></div></div>
          ${this.peopleSearch()}
        </div>
        ${foot(html`<sw-button variant="primary" icon="link" ?disabled=${this.busy || !this.pick} @click=${() => this.run(() => matchLink(this.contactId, this.pick), 'lk_done')}>${xt('lk_ok')}</sw-button>`)}
      </sw-dialog>`;
    }
    if (this.dialog === 'attach' && d.unresolved?.op_id && d.unresolved.grant_id) {
      const op = d.unresolved.op_id;
      const gid = d.unresolved.grant_id;
      const refOk = evidenceRefOk(this.ref);
      return html`<sw-dialog open wide heading=${xt('at_title')} subheading=${xt('at_sub')} data-identity-dialog="attach" @close=${() => (this.dialog = null)}>
        <div class="stack">
          <div class="callout" data-tone="warn"><sw-icon name="warning" size="18"></sw-icon><div><b>${xt('at_warn')}</b>${xt('at_warnText')}</div></div>
          <div class="kv"><div><span>${xt('at_op')}</span><b class="num">${op.slice(0, 8)}… · ${fmt(d.unresolved.started_at, this.tz)}</b></div><div><span>${xt('at_count')}</span><b>${xt('at_countValue')}</b></div></div>
          <div class="field"><label>${xt('at_person')}</label>${this.peopleSearch()}</div>
          <div class="field"><label for="aref">${xt('at_ref')}</label><input id="aref" class="in ltr" maxlength="128" .value=${this.ref} aria-invalid=${this.ref && !refOk ? 'true' : 'false'} @input=${(e: Event) => (this.ref = (e.target as HTMLInputElement).value)} /><span class="hint ${this.ref && !refOk ? 'e' : ''}">${xt('at_refHint')}</span></div>
          <div class="callout" data-tone="acc"><sw-icon name="refresh" size="18"></sw-icon><div>${xt('at_after')}</div></div>
        </div>
        ${foot(html`<sw-button variant="primary" ?disabled=${this.busy || !this.pick || !refOk} data-attach-ok @click=${() => this.run(() => attachRecovered(gid, { op_id: op, wiskey_person_id: this.pick, evidence_ref: this.ref }), 'at_done')}>${xt('at_ok')}</sw-button>`)}
      </sw-dialog>`;
    }
    return nothing;
  }

  private peopleSearch(): TemplateResult {
    return html`<div class="stack" style="gap:8px">
      <input class="in" type="search" aria-label=${xt('lk_search')} placeholder=${xt('lk_search')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} @change=${() => this.search()} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.search()} />
      ${this.peopleError ? html`<p class="note"><sw-icon name="info" size="14"></sw-icon>${xt('peopleUnavailable')}</p>` : nothing}
      <div class="plist" role="radiogroup" aria-label=${xt('at_person')}>
        ${(this.people ?? []).length
          ? (this.people ?? []).map((p) => html`<label><input type="radio" name="lp" .checked=${this.pick === p.id} @change=${() => (this.pick = p.id)} /><span><b>${p.display_name}</b><small>${p.access_category ? xt(p.access_category === 'contractor' ? 'contractor' : 'visitor') : ''}${p.stations ? ` · ${p.stations.length}` : ''}</small></span></label>`)
          : html`<p class="note">${xt('lk_none')}</p>`}
      </div>
    </div>`;
  }

  render() {
    const d = this.data;
    if (this.absent) return nothing;
    if (!d && this.loadError)
      return html`<section class="card"><h3><sw-icon name="lock" size="18"></sw-icon>${xt('id_title')}</h3>
        <div class="state" role="alert" data-identity-error><sw-icon name="warning" size="16"></sw-icon><span>${xt('id_error')}</span><span class="sp"></span>
          <sw-button size="sm" icon="refresh" @click=${() => this.load()}>${xt('retry')}</sw-button></div></section>`;
    if (!d) return this.loading ? html`<section class="card"><h3><sw-icon name="lock" size="18"></sw-icon>${xt('id_title')}</h3><div class="state" role="status" data-identity-loading>${xt('id_loading')}</div></section>` : nothing;
    const v = this.stateView(d);
    const drift = !!d.link?.name_drift;
    const marker = markerView(d.permanent_vendor); // VENDMARK-295: permanent / temporary, information only
    const auto = d.name_sync === 'auto';
    const why = (k: XtKey) => xt(k);
    const card = html`<section class="card" data-identity=${d.link ? `${d.link.origin}:${d.link.state}` : d.unresolved ? 'unresolved' : 'none'}>
      <h3><sw-icon name="lock" size="18"></sw-icon>${xt('id_title')}</h3>
      <div class="idstate" data-tone=${v.tone}><span class="big"><sw-icon name=${v.icon} size="22"></sw-icon></span><div><b>${xt(v.t)}</b><small>${v.desc}</small>
        ${drift ? html`<span class="chip" data-tone="warn" data-identity-drift style="margin-block-start:6px">${xt('id_drift')}</span>` : nothing}
        ${marker ? html`<span class="chip" data-tone=${marker.tone} data-identity-marker=${marker.permanent ? 'permanent' : 'temporary'} style="margin-block-start:6px">${xt(marker.key)}</span>` : nothing}</div></div>
      ${this.notice ? html`<p class="ok-line" role="status">${this.notice}</p>` : nothing}
      <div class="acts">
        ${this.act('link', 'act_link', 'act_linkText', 'act_linkBtn', d.can.link, d.link ? why('act_linkWhy') : why('act_noRight'), () => this.open('link'), 'link')}
        ${this.act('close', 'act_unlink', 'act_unlinkText', 'act_unlinkBtn', d.can.unlink, d.link ? why('act_noRight') : why('act_unlinkWhy'), () => this.open('unlink'), 'unlink')}
        ${this.act('trash', 'act_delete', 'act_deleteText', 'act_deleteBtn', d.can.delete, d.link?.origin === 'matched' ? why('act_deleteWhyMatched') : !d.link ? why('act_deleteWhyNone') : why('act_noRight'), () => this.open('delete'), 'delete', true)}
        ${d.link?.origin === 'created_from_arx'
          ? this.act('refresh', 'act_push', 'act_pushText', 'act_pushBtn', d.can.push_name && drift, auto ? why('act_pushAuto') : drift ? why('act_noRight') : why('id_drift'), () => this.run(() => pushName(d.link!.id), 'act_pushDone'), 'push')
          : nothing}
        ${d.unresolved
          ? html`<div class="act wide ${d.can.attach ? '' : 'dis'}" data-identity-act="attach"><h4><sw-icon name="user" size="16"></sw-icon>${xt('act_attach')}</h4>${xt('act_attachText')}
              <sw-button size="sm" ?disabled=${!d.can.attach || this.busy} @click=${() => this.open('attach')}>${xt('act_attachBtn')}</sw-button>
              ${d.can.attach ? nothing : html`<span class="why"><sw-icon name="lock" size="14"></sw-icon>${xt('at_sub')}</span>`}</div>`
          : nothing}
      </div>
    </section>`;
    if (this.compact) return html`${card}${this.dialogs(d)}`;
    return html`<div class="grid">${card}
      <aside class="side">
        <section class="stack" style="gap:8px"><h3><sw-icon name="shield" size="18"></sw-icon>${xt('ir_title')}</h3><div class="kv">
          <div><span>${xt('ir_source')}</span><b>Arx</b></div>
          <div><span>${xt('ir_sent')}</span><b>${xt('ir_sentValue')}</b></div>
          <div><span>${xt('ir_phone')}</span><b>${xt('ir_phoneValue')}</b></div>
          <div><span>${xt('ir_doors')}</span><b>${xt('ir_doorsValue')}</b></div>
          <div><span>${xt('ir_name')}</span><b>${auto ? xt('ir_nameAuto') : xt('ir_nameManual')}</b></div></div></section>
        ${d.history.length
          ? html`<section class="stack" style="gap:8px"><h3><sw-icon name="history" size="18"></sw-icon>${xt('id_history')}</h3><ol class="tl">${d.history.map(
              (h) => html`<li><time>${fmt(h.at, this.tz)}</time><i data-tone="acc"></i><span>${HISTORY_KEY[h.action] ? xt(HISTORY_KEY[h.action]) : h.action}</span></li>`,
            )}</ol></section>`
          : nothing}
      </aside></div>${this.dialogs(d)}`;
  }
}

function fmt(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const o: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  try {
    return d.toLocaleString(document.documentElement.lang || 'he-IL', tz ? { ...o, timeZone: tz } : o);
  } catch {
    return d.toLocaleString(document.documentElement.lang || 'he-IL', o);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'access-identity-card': AccessIdentityCard;
  }
}
