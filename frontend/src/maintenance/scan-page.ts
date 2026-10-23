import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { maintApi, type ScanAnswer } from '../api/maintenance';
import { mt } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { badgeText, fmtDate, kindText, lookOf, pageHref, pageOfKind } from './model';
import { maintCss } from './styles';

/**
 * A scanned QR / NFC sticker (`#/m/<token>` -> `#/tickets/maintenance/scan/<token>`), for a signed-in person only: the task it opens
 * (straight into its page with the sheet open, or into the round's run), or the device with its maintenance tasks and its open requests
 * (the count only while the tickets module is on). An unknown, revoked or invisible tag is the same "not found" (no existence leak).
 */
@customElement('maint-scan-page')
export class MaintScanPage extends LitElement {
  @property() token = '';
  @property({ attribute: false }) access!: MaintAccess;
  @state() private answer: ScanAnswer | null = null;
  @state() private error: 'gone' | string = '';

  static styles = maintCss;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('token') && this.token) void this.load();
  }

  private async load() {
    try {
      const a = await maintApi.scan(this.token);
      this.answer = a;
      if (a.kind === 'task' && a.task.kind !== 'round') window.location.replace(`${pageHref(pageOfKind(a.task.kind))}?task=${encodeURIComponent(a.task.id)}`);
    } catch (e) {
      this.error = e instanceof ApiError && e.status === 404 ? 'gone' : describeError(e);
    }
  }

  private async startRound() {
    const a = this.answer;
    if (a?.kind !== 'task') return;
    try {
      const runId = a.task.open_run_id ?? (await maintApi.startRun(a.task.id)).id;
      window.location.replace(`${pageHref('rounds')}?run=${encodeURIComponent(runId)}`);
    } catch (e) {
      const runId = e instanceof ApiError ? (e.body?.details as { run_id?: string } | undefined)?.run_id : undefined;
      if (runId) window.location.replace(`${pageHref('rounds')}?run=${encodeURIComponent(runId)}`);
      else this.error = describeError(e);
    }
  }

  render() {
    if (this.error === 'gone') return html`<sw-state-panel icon="qr" state="empty" heading=${mt('scanNotFound')} hint=${mt('scanNotFoundHint')} data-state="not-found"></sw-state-panel>`;
    if (this.error) return html`<sw-state-panel state="error" heading=${this.error} data-state="error"></sw-state-panel>`;
    const a = this.answer;
    if (!a) return html`<div class="skl" aria-busy="true" aria-label=${mt('loading')} data-state="loading"></div>`;
    if (a.kind === 'task') {
      const t = a.task;
      return html`<div class="top"><div><h1>${a.label || t.title}</h1><p class="sub">${mt('scanTitle')} · ${kindText(t.kind)}${t.place ? ` · ${t.place.name}` : ''}</p></div></div>
        <div class="panel" data-look=${lookOf(t)} data-maint-scan-task=${t.id}><div class="hd"><div><div class="t1">${t.title}</div><div class="mut num">${fmtDate(t.due_date)}</div></div><span class="sp"></span><span class="badge">${badgeText(t)}</span></div>
          ${t.can.start_round || t.open_run_id ? html`<button type="button" class="btn pri big" data-maint-scan-start @click=${() => void this.startRound()}>${mt(t.open_run_id ? 'continue' : 'scanStartRound')}</button>`
            : html`<a class="btn" href=${`${pageHref(pageOfKind(t.kind))}?task=${encodeURIComponent(t.id)}`}>${mt('scanOpen')}</a>`}</div>`;
    }
    return html`<div class="top"><div><h1>${a.label || a.entity_id}</h1><p class="sub">${mt('scanTitle')} · ${mt('tagDevice')}</p></div><span class="sp"></span>
        <div class="meta"><a class="btn" href=${a.route} data-maint-scan-device>${mt('scanOpen')}</a></div></div>
      ${this.access.ticketsOn && a.open_requests !== null ? html`<div class="chip" data-look="acc" data-maint-scan-requests>${mt('scanOpenRequests', { n: a.open_requests })}</div>` : nothing}
      <div class="panel"><div class="hd"><h4>${mt('scanDeviceTasks')}</h4></div>
        ${a.tasks.length ? html`<div class="list">${a.tasks.map((t) => html`<a class="li" style="text-decoration:none;color:inherit" data-look=${lookOf(t)} href=${`${pageHref(pageOfKind(t.kind))}?task=${encodeURIComponent(t.id)}`}>
            <div class="grow"><div class="t1">${t.title}</div><div class="t2">${kindText(t.kind)} · <span class="num">${fmtDate(t.due_date)}</span></div></div><span class="badge">${badgeText(t)}</span></a>`)}</div>`
          : html`<div class="mut">${mt('noMatch')}</div>`}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-scan-page': MaintScanPage;
  }
}
