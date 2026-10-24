import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { getReads, type Notice, type ReadsAnswer } from '../api/notices';
import { nt } from '../i18n/notices';
import { noticesCss } from './styles';
import { readAtText, readsView, type ReadsSeg } from './reads-model';

/**
 * NOTICEPAGE-295 (CR-NOTICE106 section 9, owner decision 2026-10-24 #73: names are shown to notice managers): the "מי קרא" sheet.
 * The read count in the manager's table is a button that opens it: the three counts (read / unread / recipients), a progress bar, a
 * segmented read / unread, and a table of name, place and time. Data: `GET /notices/{id}/reads` - the server answers managers only
 * (403 otherwise) and, while the installation shows no names (`notices.reads_names` off), only the two counts, so the list is then
 * left out. Not exported, not pushed, nothing is cached.
 */

export * from './reads-model';

@customElement('notice-reads')
export class NoticeReads extends LitElement {
  static styles = [noticesCss, css`
    .reads { display: grid; gap: 8px; }
    .reads .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
    .reads .kpi { cursor: default; }
    .bar { block-size: 8px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3, var(--sw-surface-2)); overflow: hidden; }
    .bar i { display: block; block-size: 100%; background: var(--sw-success); border-radius: inherit; }
    .body-grid { display: grid; gap: 12px; }
    .list { max-block-size: 280px; overflow: auto; }
    .date { white-space: nowrap; }
    @media (max-width: 767px) { .reads .kpi { padding: 8px 10px; } }
  `];

  /** The notice whose readers to show (null = closed). */
  @property({ attribute: false }) notice: Notice | null = null;
  @state() private data: ReadsAnswer | null = null;
  @state() private error = '';
  @state() private seg: ReadsSeg = 'read';
  private seq = 0;

  protected willUpdate(p: Map<string, unknown>): void {
    if (p.has('notice')) void this.load();
  }

  private async load(): Promise<void> {
    const n = this.notice;
    const my = ++this.seq;
    this.data = null;
    this.error = '';
    this.seg = 'read';
    if (!n) return;
    try {
      const d = await getReads(n.id);
      if (my === this.seq) this.data = d;
    } catch (e) {
      if (my === this.seq) this.error = describeError(e);
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('reads-close', { bubbles: true, composed: true }));
  }

  private body() {
    if (this.error) return html`<sw-state-panel compact state="error" heading=${nt('readsLoadError')} hint=${this.error} actionLabel=${nt('retry')} @action=${() => this.load()}></sw-state-panel>`;
    if (!this.data) return html`<sw-state-panel compact state="loading"></sw-state-panel>`;
    const v = readsView(this.data);
    const rows = v.rows[this.seg];
    return html`<div class="body-grid" data-reads-body>
      <div class="reads"><div class="kpis" data-reads-kpis>
        <div class="kpi" data-look="ok"><span class="dot"></span><div><b class="num" data-reads-read>${v.read}</b><span class="l">${nt('segReadShort')}</span></div></div>
        <div class="kpi" data-look="off"><span class="dot"></span><div><b class="num" data-reads-unread>${v.unread}</b><span class="l">${nt('segUnreadShort')}</span></div></div>
        <div class="kpi" data-look="acc"><span class="dot"></span><div><b class="num" data-reads-total>${v.total}</b><span class="l">${nt('recipients')}</span></div></div></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${v.pct} aria-label=${nt('readSheet')}><i style=${`inline-size:${v.pct}%`}></i></div></div>
      ${v.named ? html`
        <div class="seg" role="group" aria-label=${nt('readsList')} data-reads-seg>
          <button aria-pressed=${String(this.seg === 'read')} data-seg="read" @click=${() => (this.seg = 'read')}>${nt('readN', { n: v.read })}</button>
          <button aria-pressed=${String(this.seg === 'unread')} data-seg="unread" @click=${() => (this.seg = 'unread')}>${nt('unreadN', { n: v.unread })}</button></div>
        ${rows.length
          ? html`<div class="list"><table class="t" data-reads-table><thead><tr><th>${nt('colName')}</th><th>${nt('colPlace')}</th>${this.seg === 'read' ? html`<th>${nt('colReadAt')}</th>` : nothing}</tr></thead><tbody>
              ${rows.map((r) => html`<tr data-reads-row><td><span class="t1">${r.name}</span></td><td class="mut">${r.place || '-'}</td>${this.seg === 'read' ? html`<td class="date num">${readAtText(r.at)}</td>` : nothing}</tr>`)}
            </tbody></table></div>`
          : html`<p class="mut" data-reads-none>${nt('readsNone')}</p>`}` : nothing}
    </div>`;
  }

  render() {
    const n = this.notice;
    return html`<sw-dialog ?open=${!!n} heading=${nt('readSheet')} subheading=${n?.title ?? ''} @close=${() => this.close()}>
      ${n ? this.body() : nothing}
      <sw-button slot="footer" variant="primary" @click=${() => this.close()}>${nt('close')}</sw-button></sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-reads': NoticeReads;
  }
}
